import { describe, expect, it, vi } from 'vitest'
import {
  buildAgentAuthProfileSecretRef,
  type AgentAuthProfile
} from '../../shared/agent-auth-profile-types'
import type { AgentAuthSecretRead } from './agent-auth-secret-vault'
import { testAgentAuthProfileHealth } from './agent-auth-profile-health-test'

function makeProfile(overrides: Partial<AgentAuthProfile> = {}): AgentAuthProfile {
  return {
    id: 'profile-work',
    label: 'Work',
    provider: 'claude',
    apiKeySecretRef: buildAgentAuthProfileSecretRef('profile-work', 'api-key'),
    apiKeyKind: 'api-key',
    baseUrl: null,
    model: null,
    headers: [],
    proxy: null,
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides
  }
}

function foundKey(value = 'profile-key-1'): AgentAuthSecretRead {
  return { status: 'found', value, persistence: 'encrypted' }
}

type FetchCall = { url: string; headers: Record<string, string> }

function makeFetch(status: number, calls: FetchCall[] = []) {
  return async (
    url: string,
    init: { headers: Record<string, string> }
  ): Promise<{ status: number; ok: boolean }> => {
    calls.push({ url, headers: init.headers })
    return { status, ok: status >= 200 && status < 300 }
  }
}

describe('agent auth profile health test', () => {
  it('sends x-api-key with the anthropic version header for an api-key Claude profile', async () => {
    const calls: FetchCall[] = []
    const result = await testAgentAuthProfileHealth({
      profile: makeProfile(),
      readApiKey: () => foundKey(),
      fetch: makeFetch(200, calls)
    })

    expect(result).toEqual({ ok: true, status: 200 })
    expect(calls[0]?.url).toBe('https://api.anthropic.com/v1/models')
    expect(calls[0]?.headers['x-api-key']).toBe('profile-key-1')
    expect(calls[0]?.headers['anthropic-version']).toBe('2023-06-01')
  })

  it('sends a bearer token for an auth-token Claude profile', async () => {
    const calls: FetchCall[] = []
    const result = await testAgentAuthProfileHealth({
      profile: makeProfile({ apiKeyKind: 'auth-token' }),
      readApiKey: () => foundKey('profile-token-1'),
      fetch: makeFetch(200, calls)
    })

    expect(result).toEqual({ ok: true, status: 200 })
    expect(calls[0]?.headers['authorization']).toBe('Bearer profile-token-1')
    expect(calls[0]?.headers['x-api-key']).toBeUndefined()
  })

  it('honors the profile base URL', async () => {
    const calls: FetchCall[] = []
    await testAgentAuthProfileHealth({
      profile: makeProfile({ baseUrl: 'https://gw.example.test' }),
      readApiKey: () => foundKey(),
      fetch: makeFetch(200, calls)
    })

    expect(calls[0]?.url).toBe('https://gw.example.test/v1/models')
  })

  it('sends a bearer token to the OpenAI models endpoint for a Codex profile', async () => {
    const calls: FetchCall[] = []
    const result = await testAgentAuthProfileHealth({
      profile: makeProfile({
        provider: 'codex',
        apiKeySecretRef: buildAgentAuthProfileSecretRef('profile-work', 'api-key')
      }),
      readApiKey: () => foundKey(),
      fetch: makeFetch(200, calls)
    })

    expect(result).toEqual({ ok: true, status: 200 })
    expect(calls[0]?.url).toBe('https://api.openai.com/v1/models')
    expect(calls[0]?.headers['authorization']).toBe('Bearer profile-key-1')
  })

  it('reports a missing secret without calling fetch', async () => {
    const fetch = vi.fn()
    const noKeyRef = await testAgentAuthProfileHealth({
      profile: makeProfile({ apiKeySecretRef: null, apiKeyKind: null }),
      readApiKey: () => foundKey(),
      fetch
    })
    const vaultMissing = await testAgentAuthProfileHealth({
      profile: makeProfile(),
      readApiKey: () => ({ status: 'missing' }),
      fetch
    })

    expect(noKeyRef).toEqual({
      ok: false,
      kind: 'missing-secret',
      error: 'This profile has no API key.'
    })
    expect(vaultMissing).toEqual({
      ok: false,
      kind: 'missing-secret',
      error: 'This profile has no API key.'
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces a vault decrypt failure', async () => {
    const result = await testAgentAuthProfileHealth({
      profile: makeProfile(),
      readApiKey: () => ({
        status: 'decrypt-failed',
        error: 'Could not decrypt stored agent auth secret.'
      }),
      fetch: vi.fn()
    })

    expect(result).toEqual({
      ok: false,
      kind: 'decrypt-failed',
      error: 'Could not decrypt stored agent auth secret.'
    })
  })

  it('reports a rejected key on 401 and 403 instead of throwing', async () => {
    const rejected = await testAgentAuthProfileHealth({
      profile: makeProfile(),
      readApiKey: () => foundKey(),
      fetch: makeFetch(401)
    })
    const forbidden = await testAgentAuthProfileHealth({
      profile: makeProfile(),
      readApiKey: () => foundKey(),
      fetch: makeFetch(403)
    })

    expect(rejected).toEqual({
      ok: false,
      kind: 'rejected',
      error: 'The API rejected the key (HTTP 401).'
    })
    expect(forbidden).toEqual({
      ok: false,
      kind: 'rejected',
      error: 'The API rejected the key (HTTP 403).'
    })
  })

  it('reports other non-2xx statuses as server errors', async () => {
    const result = await testAgentAuthProfileHealth({
      profile: makeProfile(),
      readApiKey: () => foundKey(),
      fetch: makeFetch(500)
    })

    expect(result).toEqual({
      ok: false,
      kind: 'server-error',
      error: 'The endpoint returned HTTP 500.'
    })
  })

  it('reports network failures without leaking the key', async () => {
    const result = await testAgentAuthProfileHealth({
      profile: makeProfile(),
      readApiKey: () => foundKey('sk-profile-secret-1'),
      fetch: async () => {
        throw new TypeError('fetch failed for sk-profile-secret-1')
      }
    })

    expect(result).toEqual({ ok: false, kind: 'network', error: 'Could not reach the endpoint.' })
  })

  it('reports timeouts', async () => {
    const result = await testAgentAuthProfileHealth({
      profile: makeProfile(),
      readApiKey: () => foundKey(),
      fetch: async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      }
    })

    expect(result).toEqual({
      ok: false,
      kind: 'timeout',
      error: 'The endpoint did not respond within 10 seconds.'
    })
  })

  it('scrubs key material out of unexpected error messages', async () => {
    const result = await testAgentAuthProfileHealth({
      profile: makeProfile(),
      readApiKey: () => foundKey('sk-live-secret-key-1'),
      fetch: async () => {
        throw new Error(
          'gateway said: invalid key sk-live-secret-key-1 (Bearer sk-live-secret-key-1)'
        )
      }
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected failed result')
    }
    expect(result.kind).toBe('network')
    expect(result.error).not.toContain('sk-live-secret-key-1')
    expect(result.error).toContain('[redacted]')
  })
})
