import type { AgentAuthProfile } from '../../shared/agent-auth-profile-types'
import type { AgentAuthProfileUpsertInput } from '../../shared/agent-auth-profile-upsert-input'
import type { AgentAuthSecretRead } from './agent-auth-secret-vault'

// Connectivity/validity probe for a stored profile: one GET against the
// provider's /v1/models endpoint with the profile's key. Answers "is the key
// present, decryptable, and accepted" — a 401/403 is a valid answer, not an
// exception. The profile's own proxy setting is deliberately not applied here
// (undecided contract); the caller applies the environment proxy before
// handing us its fetch.

export type AgentAuthProfileHealthTestKind =
  | 'missing-secret'
  | 'decrypt-failed'
  | 'timeout'
  | 'network'
  | 'rejected'
  | 'server-error'
  | 'profile-missing'
  | 'invalid-input'

export type AgentAuthProfileHealthTestResult =
  | { ok: true; status: number }
  | { ok: false; kind: AgentAuthProfileHealthTestKind; error: string }

export type AgentAuthProfileHealthTestFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal }
) => Promise<{ status: number; ok: boolean }>

// Resolves what a connection test should probe: a stored profile, an unsaved
// create draft (raw key, nothing persisted), or an update draft where input
// secrets override and omitted ones fall back to the stored secret.
export type ResolvedAgentAuthProfileHealthTest =
  | {
      ok: true
      profile: Pick<AgentAuthProfile, 'provider' | 'apiKeyKind' | 'baseUrl'>
      readApiKey: () => AgentAuthSecretRead
    }
  | { ok: false; kind: 'invalid-input'; error: string }

export function resolveAgentAuthProfileHealthTest({
  storedProfile,
  input,
  readStoredApiKey
}: {
  storedProfile?: AgentAuthProfile
  input?: AgentAuthProfileUpsertInput
  readStoredApiKey: (profileId: string) => AgentAuthSecretRead
}): ResolvedAgentAuthProfileHealthTest {
  if (storedProfile === undefined) {
    if (input === undefined) {
      return {
        ok: false,
        kind: 'invalid-input',
        error: 'A connection test needs a profile id or draft input.'
      }
    }
    return {
      ok: true,
      profile: {
        provider: input.provider,
        apiKeyKind: input.apiKeyKind ?? null,
        baseUrl: input.baseUrl
      },
      readApiKey: () =>
        input.apiKey != null
          ? { status: 'found', value: input.apiKey, persistence: 'memory-only' }
          : { status: 'missing' }
    }
  }
  if (input === undefined) {
    return {
      ok: true,
      profile: {
        provider: storedProfile.provider,
        apiKeyKind: storedProfile.apiKeyKind,
        baseUrl: storedProfile.baseUrl
      },
      readApiKey: () => readStoredApiKey(storedProfile.id)
    }
  }
  if (input.provider !== storedProfile.provider) {
    return {
      ok: false,
      kind: 'invalid-input',
      error: `Cannot change the profile's provider from "${storedProfile.provider}" to "${input.provider}".`
    }
  }
  return {
    ok: true,
    profile: {
      provider: storedProfile.provider,
      apiKeyKind: input.apiKeyKind !== undefined ? input.apiKeyKind : storedProfile.apiKeyKind,
      baseUrl: input.baseUrl
    },
    readApiKey: () => {
      if (input.apiKey !== undefined) {
        return input.apiKey !== null
          ? { status: 'found', value: input.apiKey, persistence: 'memory-only' }
          : { status: 'missing' }
      }
      return readStoredApiKey(storedProfile.id)
    }
  }
}

const DEFAULT_BASE_URL_BY_PROVIDER: Record<AgentAuthProfile['provider'], string> = {
  claude: 'https://api.anthropic.com',
  codex: 'https://api.openai.com'
}

const HEALTH_TEST_TIMEOUT_MS = 10_000

function scrubSecrets(message: string): string {
  return message
    .replace(/\bsk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .trim()
}

export async function testAgentAuthProfileHealth({
  profile,
  readApiKey,
  fetch
}: {
  // Narrow on purpose: a draft under test has no id or secret refs yet.
  profile: Pick<AgentAuthProfile, 'provider' | 'apiKeyKind' | 'baseUrl'>
  readApiKey: () => AgentAuthSecretRead
  fetch: AgentAuthProfileHealthTestFetch
}): Promise<AgentAuthProfileHealthTestResult> {
  if (profile.apiKeyKind === null) {
    return { ok: false, kind: 'missing-secret', error: 'This profile has no API key.' }
  }
  const secret = readApiKey()
  if (secret.status === 'missing') {
    return { ok: false, kind: 'missing-secret', error: 'This profile has no API key.' }
  }
  if (secret.status === 'decrypt-failed') {
    return { ok: false, kind: 'decrypt-failed', error: secret.error }
  }

  const baseUrl = profile.baseUrl ?? DEFAULT_BASE_URL_BY_PROVIDER[profile.provider]
  const headers: Record<string, string> =
    profile.provider === 'claude'
      ? profile.apiKeyKind === 'auth-token'
        ? { authorization: `Bearer ${secret.value}` }
        : { 'x-api-key': secret.value }
      : { authorization: `Bearer ${secret.value}` }
  if (profile.provider === 'claude') {
    headers['anthropic-version'] = '2023-06-01'
  }

  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers,
      signal: AbortSignal.timeout(HEALTH_TEST_TIMEOUT_MS)
    })
    if (response.status >= 200 && response.status < 300) {
      return { ok: true, status: response.status }
    }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        kind: 'rejected',
        error: `The API rejected the key (HTTP ${response.status}).`
      }
    }
    return {
      ok: false,
      kind: 'server-error',
      error: `The endpoint returned HTTP ${response.status}.`
    }
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    ) {
      return {
        ok: false,
        kind: 'timeout',
        error: `The endpoint did not respond within ${HEALTH_TEST_TIMEOUT_MS / 1_000} seconds.`
      }
    }
    if (error instanceof TypeError) {
      // Why: fetch's network-failure signal carries no useful detail; a fixed
      // message never depends on scrubbing for the common path.
      return { ok: false, kind: 'network', error: 'Could not reach the endpoint.' }
    }
    return {
      ok: false,
      kind: 'network',
      error: scrubSecrets(error instanceof Error ? error.message : String(error))
    }
  }
}
