import { describe, expect, it } from 'vitest'
import type {
  AgentAuthProfile,
  AgentAuthProfileProvider
} from '../../shared/agent-auth-profile-types'
import {
  buildClaudeAgentAuthProfileEnvPatch,
  buildCodexAgentAuthProfileEnvPatch,
  type AgentAuthProfileSecretReader
} from './agent-auth-profile-env-materialization'

function makeProfile(
  id: string,
  provider: AgentAuthProfileProvider,
  overrides: Partial<AgentAuthProfile> = {}
): AgentAuthProfile {
  return {
    id,
    label: id,
    provider,
    apiKeySecretRef: null,
    apiKeyKind: null,
    baseUrl: null,
    model: null,
    headers: [],
    proxy: null,
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides
  }
}

function makeReader(
  secrets: Record<string, string>,
  failures: Record<string, 'missing' | 'decrypt-failed'> = {}
): AgentAuthProfileSecretReader {
  return (profileId, secretName) => {
    const key = `${profileId}\0${secretName}`
    const failure = failures[key]
    if (failure === 'missing') {
      return { status: 'missing' }
    }
    if (failure === 'decrypt-failed') {
      return { status: 'decrypt-failed', error: 'Could not decrypt stored agent auth secret.' }
    }
    const value = secrets[key]
    return value === undefined
      ? { status: 'missing' }
      : { status: 'found', value, persistence: 'encrypted' }
  }
}

describe('claude agent auth profile env materialization', () => {
  it('materializes an api-key profile with base URL, model, and vault-backed headers', () => {
    const profile = makeProfile('profile-work-glm', 'claude', {
      apiKeySecretRef: 'vault:v1:profile-work-glm:api-key',
      apiKeyKind: 'api-key',
      baseUrl: 'https://open.bigmodel.cn/api/anthropic',
      model: 'glm-4.6',
      headers: [
        { name: 'x-title', secretRef: 'vault:v1:profile-work-glm:header:x-title' },
        { name: 'http-referer', secretRef: 'vault:v1:profile-work-glm:header:http-referer' }
      ]
    })
    const result = buildClaudeAgentAuthProfileEnvPatch(
      profile,
      makeReader({
        'profile-work-glm\0api-key': 'sk-test-key',
        'profile-work-glm\0header:x-title': 'my-app',
        'profile-work-glm\0header:http-referer': 'https://my-app.example.test'
      })
    )
    expect(result).toEqual({
      ok: true,
      patch: {
        ANTHROPIC_API_KEY: 'sk-test-key',
        ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
        ANTHROPIC_MODEL: 'glm-4.6',
        ANTHROPIC_CUSTOM_HEADERS: 'x-title: my-app\nhttp-referer: https://my-app.example.test'
      }
    })
  })

  it('routes an auth-token profile to ANTHROPIC_AUTH_TOKEN', () => {
    const profile = makeProfile('profile-oauth-token', 'claude', {
      apiKeySecretRef: 'vault:v1:profile-oauth-token:api-key',
      apiKeyKind: 'auth-token'
    })
    const result = buildClaudeAgentAuthProfileEnvPatch(
      profile,
      makeReader({ 'profile-oauth-token\0api-key': 'tok' })
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.patch.ANTHROPIC_AUTH_TOKEN).toBe('tok')
      expect(result.patch.ANTHROPIC_API_KEY).toBeUndefined()
    }
  })

  it('materializes a route-only profile without any key field', () => {
    const profile = makeProfile('profile-route-only', 'claude', {
      baseUrl: 'https://proxy.example.test'
    })
    const result = buildClaudeAgentAuthProfileEnvPatch(profile, makeReader({}))
    expect(result).toEqual({
      ok: true,
      patch: { ANTHROPIC_BASE_URL: 'https://proxy.example.test' }
    })
  })

  it('fails loudly when the api-key secret is missing from the vault', () => {
    const profile = makeProfile('profile-work-glm', 'claude', {
      apiKeySecretRef: 'vault:v1:profile-work-glm:api-key',
      apiKeyKind: 'api-key'
    })
    const result = buildClaudeAgentAuthProfileEnvPatch(profile, makeReader({}))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('profile-work-glm')
      expect(result.error).toContain('missing')
    }
  })

  it('fails loudly when the api-key secret cannot be decrypted', () => {
    const profile = makeProfile('profile-work-glm', 'claude', {
      apiKeySecretRef: 'vault:v1:profile-work-glm:api-key',
      apiKeyKind: 'api-key'
    })
    const result = buildClaudeAgentAuthProfileEnvPatch(
      profile,
      makeReader({}, { 'profile-work-glm\0api-key': 'decrypt-failed' })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('decrypt')
    }
  })

  it('fails loudly when a header secret is missing — never a half patch', () => {
    const profile = makeProfile('profile-work-glm', 'claude', {
      apiKeySecretRef: 'vault:v1:profile-work-glm:api-key',
      apiKeyKind: 'api-key',
      headers: [{ name: 'x-title', secretRef: 'vault:v1:profile-work-glm:header:x-title' }]
    })
    const result = buildClaudeAgentAuthProfileEnvPatch(
      profile,
      makeReader({ 'profile-work-glm\0api-key': 'sk-test-key' })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('x-title')
    }
  })

  it('materializes an empty patch for an empty profile', () => {
    const result = buildClaudeAgentAuthProfileEnvPatch(
      makeProfile('profile-empty', 'claude'),
      makeReader({})
    )
    expect(result).toEqual({ ok: true, patch: {} })
  })

  it('rejects a codex profile', () => {
    expect(() =>
      buildClaudeAgentAuthProfileEnvPatch(makeProfile('p', 'codex'), makeReader({}))
    ).toThrow(/claude/)
  })
})

describe('codex agent auth profile env materialization', () => {
  it('materializes the api key and base URL env overlay', () => {
    const profile = makeProfile('profile-codex-alt', 'codex', {
      apiKeySecretRef: 'vault:v1:profile-codex-alt:api-key',
      apiKeyKind: 'api-key',
      baseUrl: 'https://alt.example.test/v1',
      model: 'gpt-5.2',
      headers: [{ name: 'x-title', secretRef: 'vault:v1:profile-codex-alt:header:x-title' }]
    })
    const result = buildCodexAgentAuthProfileEnvPatch(
      profile,
      makeReader({
        'profile-codex-alt\0api-key': 'sk-test-key',
        'profile-codex-alt\0header:x-title': 'my-app'
      })
    )
    // Model and headers ride the TOML/env-key contract, not the env overlay.
    expect(result).toEqual({
      ok: true,
      patch: {
        OPENAI_API_KEY: 'sk-test-key',
        OPENAI_BASE_URL: 'https://alt.example.test/v1'
      }
    })
  })

  it('materializes a key-only profile without OPENAI_BASE_URL', () => {
    const profile = makeProfile('profile-openai-key', 'codex', {
      apiKeySecretRef: 'vault:v1:profile-openai-key:api-key',
      apiKeyKind: 'api-key'
    })
    const result = buildCodexAgentAuthProfileEnvPatch(
      profile,
      makeReader({ 'profile-openai-key\0api-key': 'sk-test-key' })
    )
    expect(result).toEqual({
      ok: true,
      patch: { OPENAI_API_KEY: 'sk-test-key' }
    })
  })

  it('fails loudly when the api key is missing from the vault', () => {
    const profile = makeProfile('profile-codex-alt', 'codex', {
      apiKeySecretRef: 'vault:v1:profile-codex-alt:api-key',
      apiKeyKind: 'api-key'
    })
    const result = buildCodexAgentAuthProfileEnvPatch(profile, makeReader({}))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('profile-codex-alt')
    }
  })

  it('rejects a claude profile', () => {
    expect(() =>
      buildCodexAgentAuthProfileEnvPatch(makeProfile('p', 'claude'), makeReader({}))
    ).toThrow(/codex/)
  })
})
