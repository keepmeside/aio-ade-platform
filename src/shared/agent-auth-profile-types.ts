import { z } from 'zod'

// Versioned, secret-free schema for agent auth profiles. The serialized store
// may only hold opaque vault refs (`vault:v1:<profileId>:<secretName>`); raw
// key material lives in the secret vault, never in this file's on-disk shape.

export const AGENT_AUTH_PROFILE_STORE_VERSION = 1 as const

export const AGENT_AUTH_PROFILE_ALLOWED_HEADER_NAMES = [
  'authorization',
  'x-api-key',
  'anthropic-beta',
  'anthropic-version',
  'x-title',
  'http-referer'
] as const

// Env names each provider's runtime resolver injects and strips. Declarative
// contract only — resolution behavior lives in the per-provider resolvers.
export const AGENT_AUTH_PROFILE_ENV_KEYS = {
  claude: {
    apiKey: 'ANTHROPIC_API_KEY',
    authToken: 'ANTHROPIC_AUTH_TOKEN',
    baseUrl: 'ANTHROPIC_BASE_URL',
    model: 'ANTHROPIC_MODEL',
    customHeaders: 'ANTHROPIC_CUSTOM_HEADERS'
  },
  codex: {
    apiKey: 'OPENAI_API_KEY',
    baseUrl: 'OPENAI_BASE_URL',
    providerEnvKey: 'model_providers.<id>.env_key'
  }
} as const

const AGENT_AUTH_PROFILE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9.-]*$/
const AGENT_AUTH_PROFILE_SECRET_NAME_PATTERN = /^(api-key|proxy-auth|header:[a-z0-9-]+)$/
const AGENT_AUTH_PROFILE_SECRET_REF_PREFIX = 'vault:v1:'

export function isValidAgentAuthProfileId(value: string): boolean {
  return AGENT_AUTH_PROFILE_ID_PATTERN.test(value)
}

export function isValidAgentAuthProfileSecretName(value: string): boolean {
  return AGENT_AUTH_PROFILE_SECRET_NAME_PATTERN.test(value)
}

export type AgentAuthProfileSecretRefParts = {
  profileId: string
  secretName: string
}

export function buildAgentAuthProfileSecretRef(profileId: string, secretName: string): string {
  if (!AGENT_AUTH_PROFILE_ID_PATTERN.test(profileId)) {
    throw new Error(
      'Agent auth profile id must start alphanumeric and use only letters, digits, dots, and hyphens.'
    )
  }
  if (!AGENT_AUTH_PROFILE_SECRET_NAME_PATTERN.test(secretName)) {
    throw new Error(
      'Agent auth profile secret name must be "api-key", "proxy-auth", or "header:<lowercase-name>".'
    )
  }
  return `${AGENT_AUTH_PROFILE_SECRET_REF_PREFIX}${profileId}:${secretName}`
}

export function parseAgentAuthProfileSecretRef(ref: string): AgentAuthProfileSecretRefParts | null {
  if (typeof ref !== 'string' || !ref.startsWith(AGENT_AUTH_PROFILE_SECRET_REF_PREFIX)) {
    return null
  }
  const body = ref.slice(AGENT_AUTH_PROFILE_SECRET_REF_PREFIX.length)
  const separator = body.indexOf(':')
  if (separator <= 0) {
    return null
  }
  const profileId = body.slice(0, separator)
  const secretName = body.slice(separator + 1)
  if (!AGENT_AUTH_PROFILE_ID_PATTERN.test(profileId)) {
    return null
  }
  if (!AGENT_AUTH_PROFILE_SECRET_NAME_PATTERN.test(secretName)) {
    return null
  }
  return { profileId, secretName }
}

export function normalizeAgentAuthProfileBaseUrl(input: string): string {
  const trimmed = input.trim()
  if (trimmed === '') {
    throw new Error('Agent auth profile base URL must not be empty.')
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Agent auth profile base URL must be a valid http(s) URL.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Agent auth profile base URL must use http or https.')
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error('Agent auth profile base URL must not embed credentials.')
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw new Error('Agent auth profile base URL must not carry a query string or fragment.')
  }
  return trimmed.replace(/\/+$/, '')
}

const AgentAuthProfileBaseUrlSchema = z
  .string()
  .refine(
    (value) => {
      try {
        normalizeAgentAuthProfileBaseUrl(value)
        return true
      } catch {
        return false
      }
    },
    {
      message:
        'Base URL must be a plain http(s) URL without embedded credentials, query, or trailing slashes.'
    }
  )
  .transform((value) => normalizeAgentAuthProfileBaseUrl(value))

export const AgentAuthProfileProviderSchema = z.enum(['claude', 'codex'])
export type AgentAuthProfileProvider = z.infer<typeof AgentAuthProfileProviderSchema>

export const AGENT_AUTH_PROFILE_API_KEY_KINDS = ['api-key', 'auth-token'] as const

function vaultSecretRefSchema(expectedSecretName: string, fieldLabel: string) {
  return z.string().refine(
    (ref) => {
      const parsed = parseAgentAuthProfileSecretRef(ref)
      return parsed !== null && parsed.secretName === expectedSecretName
    },
    { message: `${fieldLabel} must be "vault:v1:<profileId>:${expectedSecretName}".` }
  )
}

export const AgentAuthProfileHeaderSchema = z
  .strictObject({
    name: z.enum(AGENT_AUTH_PROFILE_ALLOWED_HEADER_NAMES),
    secretRef: z.string()
  })
  .superRefine((header, ctx) => {
    const parsed = parseAgentAuthProfileSecretRef(header.secretRef)
    if (parsed === null || parsed.secretName !== `header:${header.name}`) {
      ctx.addIssue({
        code: 'custom',
        path: ['secretRef'],
        message: `Header secret ref must be "vault:v1:<profileId>:header:${header.name}".`
      })
    }
  })
export type AgentAuthProfileHeader = z.infer<typeof AgentAuthProfileHeaderSchema>

const AgentAuthProfileHeadersSchema = z
  .array(AgentAuthProfileHeaderSchema)
  .superRefine((headers, ctx) => {
    const seen = new Set<string>()
    for (const [index, header] of headers.entries()) {
      if (seen.has(header.name)) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'name'],
          message: `Duplicate header name "${header.name}".`
        })
      }
      seen.add(header.name)
    }
  })

export const AgentAuthProfileProxySchema = z.strictObject({
  url: AgentAuthProfileBaseUrlSchema,
  authSecretRef: vaultSecretRefSchema('proxy-auth', 'Proxy auth secret ref').optional()
})
export type AgentAuthProfileProxy = z.infer<typeof AgentAuthProfileProxySchema>

export const AgentAuthProfileSchema = z
  .strictObject({
    id: z
      .string()
      .min(1)
      .refine((value) => AGENT_AUTH_PROFILE_ID_PATTERN.test(value), {
        message:
          'Profile id must start alphanumeric and use only letters, digits, dots, and hyphens.'
      }),
    label: z.string().min(1).optional(),
    provider: AgentAuthProfileProviderSchema,
    apiKeySecretRef: vaultSecretRefSchema('api-key', 'API key secret ref').nullable(),
    apiKeyKind: z.enum(AGENT_AUTH_PROFILE_API_KEY_KINDS).nullable(),
    baseUrl: AgentAuthProfileBaseUrlSchema.nullable(),
    model: z.string().min(1).nullable(),
    headers: AgentAuthProfileHeadersSchema,
    proxy: AgentAuthProfileProxySchema.nullable(),
    createdAt: z
      .number()
      .refine((value) => Number.isFinite(value), { message: 'createdAt must be finite.' }),
    updatedAt: z
      .number()
      .refine((value) => Number.isFinite(value), { message: 'updatedAt must be finite.' })
  })
  .superRefine((profile, ctx) => {
    const hasApiKeyRef = profile.apiKeySecretRef !== null
    const hasApiKeyKind = profile.apiKeyKind !== null
    if (hasApiKeyRef !== hasApiKeyKind) {
      ctx.addIssue({
        code: 'custom',
        path: ['apiKeySecretRef'],
        message: 'apiKeySecretRef and apiKeyKind must be set together or both null.'
      })
    }
    // Secrets are vault-scoped per profile so deleting a profile can never
    // strand or cross-wire another profile's refs.
    const secretRefs: [PropertyKey[], string][] = []
    if (profile.apiKeySecretRef !== null) {
      secretRefs.push([['apiKeySecretRef'], profile.apiKeySecretRef])
    }
    profile.headers.forEach((header, index) => {
      secretRefs.push([['headers', index, 'secretRef'], header.secretRef])
    })
    if (profile.proxy?.authSecretRef !== undefined) {
      secretRefs.push([['proxy', 'authSecretRef'], profile.proxy.authSecretRef])
    }
    for (const [path, ref] of secretRefs) {
      const parsed = parseAgentAuthProfileSecretRef(ref)
      if (parsed !== null && parsed.profileId !== profile.id) {
        ctx.addIssue({
          code: 'custom',
          path,
          message: `Secret ref must reference this profile's id "${profile.id}".`
        })
      }
    }
  })
export type AgentAuthProfile = z.infer<typeof AgentAuthProfileSchema>

export const AgentAuthProfileStoreSchema = z
  .strictObject({
    version: z.literal(AGENT_AUTH_PROFILE_STORE_VERSION),
    profiles: z.array(AgentAuthProfileSchema)
  })
  .superRefine((store, ctx) => {
    const seen = new Set<string>()
    for (const [index, profile] of store.profiles.entries()) {
      if (seen.has(profile.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['profiles', index, 'id'],
          message: `Duplicate profile id "${profile.id}".`
        })
      }
      seen.add(profile.id)
    }
  })
export type AgentAuthProfileStore = z.infer<typeof AgentAuthProfileStoreSchema>

export type ParsedAgentAuthProfileStore =
  | { ok: true; value: AgentAuthProfileStore }
  | { ok: false; error: string }

export function parseAgentAuthProfileStore(raw: unknown): ParsedAgentAuthProfileStore {
  const result = AgentAuthProfileStoreSchema.safeParse(raw)
  if (result.success) {
    return { ok: true, value: result.data }
  }
  const firstIssue = result.error.issues[0]
  const issuePath = firstIssue?.path?.length ? ` at ${firstIssue.path.map(String).join('.')}` : ''
  return {
    ok: false,
    error: `${firstIssue?.message ?? 'Invalid agent auth profile store.'}${issuePath}`
  }
}
