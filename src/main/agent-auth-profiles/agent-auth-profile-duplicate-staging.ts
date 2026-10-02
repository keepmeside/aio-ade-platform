import type { AgentAuthProfile } from '../../shared/agent-auth-profile-types'
import { buildAgentAuthProfileSecretRef } from '../../shared/agent-auth-profile-types'
import type { AgentAuthSecretVault } from './agent-auth-secret-vault'
import type {
  StagedAgentAuthProfileResult,
  StagedSecretWrite
} from './agent-auth-profile-upsert-staging'

export type StageDuplicatedProfileInput = {
  vault: AgentAuthSecretVault
  existingProfile: AgentAuthProfile
  newProfileId: string
  label?: string
  timestamp: number
}

// Duplicates a stored profile under a fresh id. Every vault read happens
// here; the copied values are staged as writes for the caller to execute
// before the store commit, so a decrypt failure aborts before anything is
// written. A source secret that is missing drops the field on the copy — a
// copy never carries a dangling ref. Secret refs are rebuilt for the new id
// so the copy's secrets are vault-scoped to it alone.

export function stageDuplicatedProfile({
  vault,
  existingProfile,
  newProfileId,
  label,
  timestamp
}: StageDuplicatedProfileInput): StagedAgentAuthProfileResult {
  if (label !== undefined && (label.trim() === '' || label.length > 64)) {
    return { ok: false, error: 'Duplicate label must be 1-64 characters.' }
  }
  const secretWrites: StagedSecretWrite[] = []

  let apiKeySecretRef: AgentAuthProfile['apiKeySecretRef'] = null
  let apiKeyKind: AgentAuthProfile['apiKeyKind'] = null
  if (existingProfile.apiKeySecretRef !== null) {
    const copied = copyVaultSecret(vault, existingProfile.id, 'api-key', 'API key')
    if (!copied.ok) {
      return copied
    }
    if (copied.value !== null) {
      apiKeySecretRef = buildAgentAuthProfileSecretRef(newProfileId, 'api-key')
      apiKeyKind = existingProfile.apiKeyKind
      secretWrites.push({ secretName: 'api-key', value: copied.value, fieldLabel: 'API key' })
    }
  }

  const headers: AgentAuthProfile['headers'] = []
  for (const header of existingProfile.headers) {
    const secretName = `header:${header.name}`
    const copied = copyVaultSecret(vault, existingProfile.id, secretName, `header "${header.name}"`)
    if (!copied.ok) {
      return copied
    }
    if (copied.value === null) {
      continue
    }
    secretWrites.push({
      secretName,
      value: copied.value,
      fieldLabel: `header "${header.name}"`
    })
    headers.push({
      name: header.name,
      secretRef: buildAgentAuthProfileSecretRef(newProfileId, secretName)
    })
  }

  let proxy: AgentAuthProfile['proxy'] = null
  if (existingProfile.proxy !== null) {
    let authSecretRef: string | undefined
    if (existingProfile.proxy.authSecretRef !== undefined) {
      const copied = copyVaultSecret(vault, existingProfile.id, 'proxy-auth', 'proxy credentials')
      if (!copied.ok) {
        return copied
      }
      if (copied.value !== null) {
        authSecretRef = buildAgentAuthProfileSecretRef(newProfileId, 'proxy-auth')
        secretWrites.push({
          secretName: 'proxy-auth',
          value: copied.value,
          fieldLabel: 'proxy credentials'
        })
      }
    }
    proxy =
      authSecretRef !== undefined
        ? { url: existingProfile.proxy.url, authSecretRef }
        : { url: existingProfile.proxy.url }
  }

  const profile: AgentAuthProfile = {
    id: newProfileId,
    provider: existingProfile.provider,
    apiKeySecretRef,
    apiKeyKind,
    baseUrl: existingProfile.baseUrl,
    model: existingProfile.model,
    headers,
    proxy,
    createdAt: timestamp,
    updatedAt: timestamp
  }
  profile.label = label ?? `${existingProfile.label ?? existingProfile.id} (copy)`
  return { ok: true, staged: { profile, secretWrites, droppedSecretNames: [] } }
}

// Reads one source secret: missing means "drop the field on the copy",
// decrypt-failed means "abort the whole duplicate".
function copyVaultSecret(
  vault: AgentAuthSecretVault,
  profileId: string,
  secretName: string,
  fieldLabel: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  const read = vault.get(profileId, secretName)
  if (read.status === 'found') {
    return { ok: true, value: read.value }
  }
  if (read.status === 'missing') {
    return { ok: true, value: null }
  }
  return {
    ok: false,
    error: `Could not read the stored ${fieldLabel} for duplication: ${read.error}`
  }
}
