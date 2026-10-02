import type { ClaudeEnvPatch } from '../claude-accounts/environment'
import type { CodexEnvPatch } from '../codex-accounts/environment'
import type { AgentAuthProfile } from '../../shared/agent-auth-profile-types'
import type { AgentAuthSecretRead } from './agent-auth-secret-vault'

export type AgentAuthProfileSecretReader = (
  profileId: string,
  secretName: string
) => AgentAuthSecretRead

export type AgentAuthProfileEnvPatchResult<T> =
  | { ok: true; patch: T }
  | { ok: false; error: string }

// Fail-loud secret reads: a missing or undecryptable secret yields ok:false —
// never a half patch that would launch with partial credentials.
function readSecretOrFail(
  profileId: string,
  secretName: string,
  reader: AgentAuthProfileSecretReader
): { ok: true; value: string } | { ok: false; error: string } {
  const read = reader(profileId, secretName)
  if (read.status === 'found') {
    return { ok: true, value: read.value }
  }
  if (read.status === 'decrypt-failed') {
    return {
      ok: false,
      error: `Agent auth secret "${secretName}" for profile "${profileId}" could not be decrypted.`
    }
  }
  return {
    ok: false,
    error: `Agent auth secret "${secretName}" for profile "${profileId}" is missing from the vault.`
  }
}

export function buildClaudeAgentAuthProfileEnvPatch(
  profile: AgentAuthProfile,
  reader: AgentAuthProfileSecretReader
): AgentAuthProfileEnvPatchResult<ClaudeEnvPatch> {
  if (profile.provider !== 'claude') {
    throw new Error(
      `Profile "${profile.id}" is a ${profile.provider} profile; only claude profiles build a Claude env patch.`
    )
  }

  const patch: ClaudeEnvPatch = {}

  if (profile.apiKeySecretRef) {
    const read = readSecretOrFail(profile.id, 'api-key', reader)
    if (!read.ok) {
      return { ok: false, error: read.error }
    }
    if (profile.apiKeyKind === 'auth-token') {
      patch.ANTHROPIC_AUTH_TOKEN = read.value
    } else {
      patch.ANTHROPIC_API_KEY = read.value
    }
  }

  if (profile.baseUrl) {
    patch.ANTHROPIC_BASE_URL = profile.baseUrl
  }
  if (profile.model) {
    patch.ANTHROPIC_MODEL = profile.model
  }

  if (profile.headers.length > 0) {
    const lines: string[] = []
    for (const header of profile.headers) {
      const read = readSecretOrFail(profile.id, `header:${header.name}`, reader)
      if (!read.ok) {
        return { ok: false, error: read.error }
      }
      lines.push(`${header.name}: ${read.value}`)
    }
    patch.ANTHROPIC_CUSTOM_HEADERS = lines.join('\n')
  }

  // Proxy stays vault-data-only: no decided env/TOML contract to materialize.
  return { ok: true, patch }
}

export function buildCodexAgentAuthProfileEnvPatch(
  profile: AgentAuthProfile,
  reader: AgentAuthProfileSecretReader
): AgentAuthProfileEnvPatchResult<CodexEnvPatch> {
  if (profile.provider !== 'codex') {
    throw new Error(
      `Profile "${profile.id}" is a ${profile.provider} profile; only codex profiles build a Codex env patch.`
    )
  }

  const patch: CodexEnvPatch = {}

  if (profile.apiKeySecretRef) {
    const read = readSecretOrFail(profile.id, 'api-key', reader)
    if (!read.ok) {
      return { ok: false, error: read.error }
    }
    patch.OPENAI_API_KEY = read.value
  }

  if (profile.baseUrl) {
    patch.OPENAI_BASE_URL = profile.baseUrl
  }

  // Model and headers ride the TOML provider contract, not the env overlay.
  return { ok: true, patch }
}
