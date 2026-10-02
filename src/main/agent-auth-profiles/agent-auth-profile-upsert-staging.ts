import type { AgentAuthProfile } from '../../shared/agent-auth-profile-types'
import { buildAgentAuthProfileSecretRef } from '../../shared/agent-auth-profile-types'
import type { AgentAuthProfileUpsertInput } from '../../shared/agent-auth-profile-upsert-input'

export type StagedSecretWrite = { secretName: string; value: string; fieldLabel: string }

export type StagedAgentAuthProfile = {
  profile: AgentAuthProfile
  secretWrites: StagedSecretWrite[]
  droppedSecretNames: string[]
}

export type StagedAgentAuthProfileResult =
  | { ok: true; staged: StagedAgentAuthProfile }
  | { ok: false; error: string }

// Pure staging: resolves an upsert input into the next stored profile plus
// the vault writes it needs and the secret names it stops referencing.
// Nothing is written here — the caller executes secretWrites BEFORE the
// store commit (fail-loud) and droppedSecretNames AFTER it (best-effort:
// orphan ciphertext is harmless, a dangling ref is not). Purity is the point:
// a validation failure must never leave a half-rotated secret under a store
// row that still references it.

export type StageCreatedProfileInput = {
  profileId: string
  input: AgentAuthProfileUpsertInput
  timestamp: number
}

export function stageCreatedProfile({
  profileId,
  input,
  timestamp
}: StageCreatedProfileInput): StagedAgentAuthProfileResult {
  if (input.id !== undefined) {
    return { ok: false, error: 'A new profile must not carry an id.' }
  }
  const secretWrites: StagedSecretWrite[] = []

  let apiKeySecretRef: AgentAuthProfile['apiKeySecretRef'] = null
  let apiKeyKind: AgentAuthProfile['apiKeyKind'] = null
  if (input.apiKey != null && input.apiKeyKind != null) {
    secretWrites.push({ secretName: 'api-key', value: input.apiKey, fieldLabel: 'API key' })
    apiKeySecretRef = buildAgentAuthProfileSecretRef(profileId, 'api-key')
    apiKeyKind = input.apiKeyKind
  }

  const headers: AgentAuthProfile['headers'] = []
  for (const header of input.headers) {
    if (header.value == null) {
      // Why: unreachable through the parsed input schema; a direct caller still fails loudly.
      return { ok: false, error: `Header "${header.name}" requires a value for a new profile.` }
    }
    const secretName = `header:${header.name}`
    secretWrites.push({
      secretName,
      value: header.value,
      fieldLabel: `header "${header.name}"`
    })
    headers.push({
      name: header.name,
      secretRef: buildAgentAuthProfileSecretRef(profileId, secretName)
    })
  }

  let proxy: AgentAuthProfile['proxy'] = null
  if (input.proxy !== null) {
    const staged = stageProxy(
      profileId,
      input.proxy.url,
      undefined,
      input.proxy.authValue ?? undefined
    )
    secretWrites.push(...(staged.authWrite !== undefined ? [staged.authWrite] : []))
    proxy = staged.proxy
  }

  const profile: AgentAuthProfile = {
    id: profileId,
    provider: input.provider,
    apiKeySecretRef,
    apiKeyKind,
    baseUrl: input.baseUrl,
    model: input.model,
    headers,
    proxy,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  if (input.label !== undefined) {
    profile.label = input.label
  }
  return { ok: true, staged: { profile, secretWrites, droppedSecretNames: [] } }
}

export type StageUpdatedProfileInput = {
  existingProfile: AgentAuthProfile
  input: AgentAuthProfileUpsertInput
  timestamp: number
}

export function stageUpdatedProfile({
  existingProfile,
  input,
  timestamp
}: StageUpdatedProfileInput): StagedAgentAuthProfileResult {
  const profileId = existingProfile.id
  // Coherence with the target row: the id may not move and the provider is
  // immutable — a profile's secret refs and managed home are provider-scoped.
  if (input.id !== undefined && input.id !== profileId) {
    return {
      ok: false,
      error: `Profile id cannot change from "${profileId}" to "${input.id}".`
    }
  }
  if (input.provider !== existingProfile.provider) {
    return {
      ok: false,
      error: `Cannot change the profile's provider from "${existingProfile.provider}" to "${input.provider}".`
    }
  }
  const secretWrites: StagedSecretWrite[] = []
  const droppedSecretNames: string[] = []

  // Tri-state api key: omitted keeps the stored secret, null removes it, a string rotates it.
  let apiKeySecretRef = existingProfile.apiKeySecretRef
  let apiKeyKind = existingProfile.apiKeyKind
  if (input.apiKey === null) {
    apiKeySecretRef = null
    apiKeyKind = null
    droppedSecretNames.push('api-key')
  } else if (input.apiKey !== undefined) {
    secretWrites.push({ secretName: 'api-key', value: input.apiKey, fieldLabel: 'API key' })
    apiKeySecretRef = buildAgentAuthProfileSecretRef(profileId, 'api-key')
    // The input schema pairs apiKey with apiKeyKind; ?? null keeps a bad
    // direct caller on the store schema's fail-loud path instead of lying.
    apiKeyKind = input.apiKeyKind ?? null
  }

  // Headers carry the full desired list: a kept name with the value omitted
  // keeps the stored secret, a string sets/rotates it, and names absent from
  // the list (or an explicit null value) drop the header.
  const nextHeaderNames = new Set<string>()
  const headers: AgentAuthProfile['headers'] = []
  for (const header of input.headers) {
    if (header.value === undefined) {
      const kept = existingProfile.headers.find((entry) => entry.name === header.name)
      if (kept === undefined) {
        return { ok: false, error: `Header "${header.name}" has no stored value to keep.` }
      }
      headers.push(kept)
      nextHeaderNames.add(header.name)
      continue
    }
    if (header.value === null) {
      continue
    }
    const secretName = `header:${header.name}`
    secretWrites.push({
      secretName,
      value: header.value,
      fieldLabel: `header "${header.name}"`
    })
    headers.push({
      name: header.name,
      secretRef: buildAgentAuthProfileSecretRef(profileId, secretName)
    })
    nextHeaderNames.add(header.name)
  }
  for (const header of existingProfile.headers) {
    if (!nextHeaderNames.has(header.name)) {
      droppedSecretNames.push(`header:${header.name}`)
    }
  }

  // Proxy auth is tri-state like the api key: omitted keeps the stored
  // credentials, null drops them, a string rotates them.
  let proxy: AgentAuthProfile['proxy'] = null
  if (input.proxy !== null) {
    const carried =
      input.proxy.authValue === undefined ? existingProfile.proxy?.authSecretRef : undefined
    const staged = stageProxy(
      profileId,
      input.proxy.url,
      carried,
      input.proxy.authValue ?? undefined
    )
    secretWrites.push(...(staged.authWrite !== undefined ? [staged.authWrite] : []))
    proxy = staged.proxy
  }
  if (existingProfile.proxy?.authSecretRef !== undefined && proxy?.authSecretRef === undefined) {
    droppedSecretNames.push('proxy-auth')
  }

  const profile: AgentAuthProfile = {
    id: profileId,
    provider: existingProfile.provider,
    apiKeySecretRef,
    apiKeyKind,
    baseUrl: input.baseUrl,
    model: input.model,
    headers,
    proxy,
    createdAt: existingProfile.createdAt,
    updatedAt: timestamp
  }
  const label = input.label !== undefined ? input.label : existingProfile.label
  if (label !== undefined) {
    profile.label = label
  }
  return { ok: true, staged: { profile, secretWrites, droppedSecretNames } }
}

/** Carries an existing auth ref (keep) or stages a new value (rotate). */
function stageProxy(
  profileId: string,
  url: string,
  carriedAuthSecretRef: string | undefined,
  newAuthValue: string | undefined
): { proxy: AgentAuthProfile['proxy']; authWrite?: StagedSecretWrite } {
  if (newAuthValue === undefined) {
    return {
      proxy:
        carriedAuthSecretRef !== undefined ? { url, authSecretRef: carriedAuthSecretRef } : { url }
    }
  }
  return {
    proxy: { url, authSecretRef: buildAgentAuthProfileSecretRef(profileId, 'proxy-auth') },
    authWrite: { secretName: 'proxy-auth', value: newAuthValue, fieldLabel: 'proxy credentials' }
  }
}
