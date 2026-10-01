import { describe, expect, it } from 'vitest'
import {
  AGENT_AUTH_PROFILE_ALLOWED_HEADER_NAMES,
  AGENT_AUTH_PROFILE_ENV_KEYS,
  AGENT_AUTH_PROFILE_STORE_VERSION,
  AgentAuthProfileSchema,
  AgentAuthProfileStoreSchema,
  buildAgentAuthProfileSecretRef,
  isValidAgentAuthProfileId,
  isValidAgentAuthProfileSecretName,
  normalizeAgentAuthProfileBaseUrl,
  parseAgentAuthProfileSecretRef,
  parseAgentAuthProfileStore
} from './agent-auth-profile-types'

function validProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-work-glm',
    label: 'GLM work',
    provider: 'claude',
    apiKeySecretRef: buildAgentAuthProfileSecretRef('profile-work-glm', 'api-key'),
    apiKeyKind: 'auth-token',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    model: 'glm-4.6',
    headers: [
      {
        name: 'x-title',
        secretRef: buildAgentAuthProfileSecretRef('profile-work-glm', 'header:x-title')
      }
    ],
    proxy: {
      url: 'http://127.0.0.1:7890',
      authSecretRef: buildAgentAuthProfileSecretRef('profile-work-glm', 'proxy-auth')
    },
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides
  }
}

describe('agent auth profile secret refs', () => {
  it('builds and parses vault:v1 refs round-trip', () => {
    const ref = buildAgentAuthProfileSecretRef('profile-work-glm', 'header:x-title')
    expect(ref).toBe('vault:v1:profile-work-glm:header:x-title')
    expect(parseAgentAuthProfileSecretRef(ref)).toEqual({
      profileId: 'profile-work-glm',
      secretName: 'header:x-title'
    })
  })

  it('rejects raw secret values posing as refs', () => {
    // Why: a ref pattern that a real key could satisfy would let a secret
    // land in the plaintext-serialized profile store.
    const rawKey = `sk-ant-api03-${'a'.repeat(95)}`
    expect(parseAgentAuthProfileSecretRef(rawKey)).toBeNull()
    expect(parseAgentAuthProfileSecretRef('vault:v2:profile:api-key')).toBeNull()
    expect(parseAgentAuthProfileSecretRef('vault:v1:BAD_ID:api-key')).toBeNull()
    expect(parseAgentAuthProfileSecretRef('vault:v1:profile:Bad-Name')).toBeNull()
    expect(parseAgentAuthProfileSecretRef('vault:v1:profile:api:key')).toBeNull()
    expect(parseAgentAuthProfileSecretRef('')).toBeNull()
  })

  it('rejects unknown secret-name vocabulary at build time', () => {
    expect(() => buildAgentAuthProfileSecretRef('profile', 'anything-else')).toThrow()
    expect(() => buildAgentAuthProfileSecretRef('BAD ID', 'api-key')).toThrow()
  })

  it('exposes the id and secret-name validators for vault key checks', () => {
    expect(isValidAgentAuthProfileId('profile-work-glm')).toBe(true)
    expect(isValidAgentAuthProfileId('BAD_ID')).toBe(false)
    expect(isValidAgentAuthProfileId('')).toBe(false)
    expect(isValidAgentAuthProfileSecretName('api-key')).toBe(true)
    expect(isValidAgentAuthProfileSecretName('header:x-title')).toBe(true)
    expect(isValidAgentAuthProfileSecretName('header:X-Title')).toBe(false)
    expect(isValidAgentAuthProfileSecretName('anything-else')).toBe(false)
  })
})

describe('agent auth profile schema', () => {
  it('accepts a full claude profile and normalizes nothing away', () => {
    const parsed = AgentAuthProfileSchema.parse(validProfile())
    expect(parsed.provider).toBe('claude')
    expect(parsed.apiKeyKind).toBe('auth-token')
    expect(parsed.baseUrl).toBe('https://open.bigmodel.cn/api/anthropic')
  })

  it('accepts a codex profile with no api key (headers-only auth)', () => {
    const parsed = AgentAuthProfileSchema.parse(
      validProfile({
        provider: 'codex',
        apiKeySecretRef: null,
        apiKeyKind: null,
        baseUrl: 'https://api.openai.com/v1'
      })
    )
    expect(parsed.provider).toBe('codex')
    expect(parsed.apiKeySecretRef).toBeNull()
  })

  it('rejects providers outside the claude|codex roster', () => {
    expect(() => AgentAuthProfileSchema.parse(validProfile({ provider: 'gemini' }))).toThrow()
  })

  it('rejects empty ids and labels', () => {
    expect(() => AgentAuthProfileSchema.parse(validProfile({ id: '' }))).toThrow()
    expect(() => AgentAuthProfileSchema.parse(validProfile({ label: '' }))).toThrow()
  })

  it('requires apiKeySecretRef and apiKeyKind to be both-or-neither', () => {
    expect(() => AgentAuthProfileSchema.parse(validProfile({ apiKeySecretRef: null }))).toThrow()
    expect(() => AgentAuthProfileSchema.parse(validProfile({ apiKeyKind: null }))).toThrow()
  })

  it('normalizes base URLs by stripping trailing slashes', () => {
    expect(normalizeAgentAuthProfileBaseUrl('https://api.example.com/')).toBe(
      'https://api.example.com'
    )
    expect(normalizeAgentAuthProfileBaseUrl('https://api.example.com/v1//')).toBe(
      'https://api.example.com/v1'
    )
    expect(
      AgentAuthProfileSchema.parse(validProfile({ baseUrl: 'https://api.example.com/' })).baseUrl
    ).toBe('https://api.example.com')
  })

  it('rejects base URLs that are not plain http(s) without credentials', () => {
    expect(() => normalizeAgentAuthProfileBaseUrl('ftp://api.example.com/')).toThrow()
    expect(() => normalizeAgentAuthProfileBaseUrl('not a url')).toThrow()
    // Why: userinfo would smuggle a secret-grade credential into the store.
    expect(() => normalizeAgentAuthProfileBaseUrl('https://user:pass@api.example.com/')).toThrow()
    expect(() => normalizeAgentAuthProfileBaseUrl('')).toThrow()
    expect(() => AgentAuthProfileSchema.parse(validProfile({ baseUrl: 42 }))).toThrow()
  })

  it('allows null baseUrl and model', () => {
    const parsed = AgentAuthProfileSchema.parse(
      validProfile({ baseUrl: null, model: null, headers: [], proxy: null })
    )
    expect(parsed.baseUrl).toBeNull()
    expect(parsed.model).toBeNull()
  })

  it('rejects empty model strings', () => {
    expect(() => AgentAuthProfileSchema.parse(validProfile({ model: '' }))).toThrow()
  })

  it('rejects header names outside the allowlist', () => {
    expect(() =>
      AgentAuthProfileSchema.parse(
        validProfile({
          headers: [
            {
              name: 'x-evil',
              secretRef: buildAgentAuthProfileSecretRef('profile-work-glm', 'header:x-evil')
            }
          ]
        })
      )
    ).toThrow()
  })

  it('rejects duplicate header names', () => {
    const header = {
      name: 'x-title',
      secretRef: buildAgentAuthProfileSecretRef('profile-work-glm', 'header:x-title')
    }
    expect(() =>
      AgentAuthProfileSchema.parse(validProfile({ headers: [header, header] }))
    ).toThrow()
  })

  it('rejects malformed header secret refs', () => {
    expect(() =>
      AgentAuthProfileSchema.parse(
        validProfile({ headers: [{ name: 'x-title', secretRef: 'sk-ant-api03-raw-key' }] })
      )
    ).toThrow()
  })

  it('rejects smuggled inline header values instead of stripping them silently', () => {
    expect(() =>
      AgentAuthProfileSchema.parse(
        validProfile({
          headers: [
            {
              name: 'x-title',
              secretRef: buildAgentAuthProfileSecretRef('profile-work-glm', 'header:x-title'),
              value: 'should-not-exist'
            }
          ]
        })
      )
    ).toThrow()
  })

  it('rejects proxy URLs with credentials or non-http schemes', () => {
    expect(() =>
      AgentAuthProfileSchema.parse(
        validProfile({ proxy: { url: 'https://u:p@proxy.example.com/' } })
      )
    ).toThrow()
    expect(() =>
      AgentAuthProfileSchema.parse(validProfile({ proxy: { url: 'socks5://127.0.0.1:1080' } }))
    ).toThrow()
  })

  it('accepts a proxy without auth', () => {
    const parsed = AgentAuthProfileSchema.parse(
      validProfile({ proxy: { url: 'http://127.0.0.1:7890/' } })
    )
    expect(parsed.proxy?.url).toBe('http://127.0.0.1:7890')
  })

  it('rejects smuggled top-level secret fields loudly', () => {
    // Why: zod's default strips unknown keys; for a secret-free store the
    // failure must be visible, not a silent drop.
    expect(() =>
      AgentAuthProfileSchema.parse(validProfile({ apiKey: 'sk-ant-api03-raw' }))
    ).toThrow()
  })

  it('requires finite timestamps', () => {
    expect(() => AgentAuthProfileSchema.parse(validProfile({ createdAt: undefined }))).toThrow()
    expect(() =>
      AgentAuthProfileSchema.parse(validProfile({ updatedAt: Number.POSITIVE_INFINITY }))
    ).toThrow()
  })
})

describe('agent auth profile store envelope', () => {
  it('parses a valid store and keeps profile order', () => {
    const first = validProfile()
    const second = validProfile({
      id: 'profile-codex-alt',
      provider: 'codex',
      apiKeySecretRef: buildAgentAuthProfileSecretRef('profile-codex-alt', 'api-key'),
      headers: [],
      proxy: {
        url: 'http://127.0.0.1:7890',
        authSecretRef: buildAgentAuthProfileSecretRef('profile-codex-alt', 'proxy-auth')
      }
    })
    const parsed = AgentAuthProfileStoreSchema.parse({
      version: AGENT_AUTH_PROFILE_STORE_VERSION,
      defaultProfileIdByProvider: { claude: 'profile-work-glm', codex: 'profile-codex-alt' },
      profiles: [first, second]
    })
    expect(parsed.profiles.map((profile) => profile.id)).toEqual([
      'profile-work-glm',
      'profile-codex-alt'
    ])
    expect(parsed.defaultProfileIdByProvider).toEqual({
      claude: 'profile-work-glm',
      codex: 'profile-codex-alt'
    })
  })

  it('rejects defaults that reference a missing profile', () => {
    expect(() =>
      AgentAuthProfileStoreSchema.parse({
        version: AGENT_AUTH_PROFILE_STORE_VERSION,
        defaultProfileIdByProvider: { claude: 'profile-gone', codex: null },
        profiles: [validProfile()]
      })
    ).toThrow(/does not exist/)
  })

  it('rejects defaults that reference the other provider', () => {
    expect(() =>
      AgentAuthProfileStoreSchema.parse({
        version: AGENT_AUTH_PROFILE_STORE_VERSION,
        defaultProfileIdByProvider: { claude: 'profile-codex-alt', codex: null },
        profiles: [
          validProfile(),
          validProfile({
            id: 'profile-codex-alt',
            provider: 'codex',
            apiKeySecretRef: null,
            apiKeyKind: null,
            headers: [],
            proxy: null
          })
        ]
      })
    ).toThrow(/must have provider/)
  })

  it('pins the store version to the literal current version', () => {
    expect(() =>
      AgentAuthProfileStoreSchema.parse({
        version: AGENT_AUTH_PROFILE_STORE_VERSION + 1,
        profiles: []
      })
    ).toThrow()
    expect(() => AgentAuthProfileStoreSchema.parse({ version: '1', profiles: [] })).toThrow()
    expect(() => AgentAuthProfileStoreSchema.parse({ profiles: [] })).toThrow()
  })

  it('parseAgentAuthProfileStore returns the discriminated union without throwing', () => {
    const ok = parseAgentAuthProfileStore({
      version: AGENT_AUTH_PROFILE_STORE_VERSION,
      defaultProfileIdByProvider: { claude: null, codex: null },
      profiles: [validProfile()]
    })
    expect(ok.ok).toBe(true)

    for (const bad of [
      null,
      'x',
      7,
      { version: 2, profiles: [] },
      { version: 1, profiles: 'nope' },
      { version: 1 }
    ]) {
      const result = parseAgentAuthProfileStore(bad)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(typeof result.error).toBe('string')
        expect(result.error.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('agent auth profile materialization contract', () => {
  it('pins the claude env-key names the runtime resolver must inject and strip', () => {
    expect(AGENT_AUTH_PROFILE_ENV_KEYS.claude).toEqual({
      apiKey: 'ANTHROPIC_API_KEY',
      authToken: 'ANTHROPIC_AUTH_TOKEN',
      baseUrl: 'ANTHROPIC_BASE_URL',
      model: 'ANTHROPIC_MODEL',
      customHeaders: 'ANTHROPIC_CUSTOM_HEADERS'
    })
  })

  it('pins the codex env-key names including the provider envKey indirection', () => {
    expect(AGENT_AUTH_PROFILE_ENV_KEYS.codex).toEqual({
      apiKey: 'OPENAI_API_KEY',
      baseUrl: 'OPENAI_BASE_URL',
      providerEnvKey: 'model_providers.<id>.env_key'
    })
  })

  it('allowlists known gateway headers and excludes identity-bearing ones', () => {
    for (const name of [
      'authorization',
      'x-api-key',
      'anthropic-beta',
      'anthropic-version',
      'x-title',
      'http-referer'
    ]) {
      expect(AGENT_AUTH_PROFILE_ALLOWED_HEADER_NAMES).toContain(name)
    }
    // Why: these would override CLI identity or session transport, not gateway auth.
    for (const dangerous of ['user-agent', 'host', 'cookie', 'content-length']) {
      expect(AGENT_AUTH_PROFILE_ALLOWED_HEADER_NAMES).not.toContain(dangerous)
    }
  })
})
