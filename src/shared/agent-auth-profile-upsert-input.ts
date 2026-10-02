import { z } from 'zod'
import {
  AGENT_AUTH_PROFILE_ALLOWED_HEADER_NAMES,
  AGENT_AUTH_PROFILE_API_KEY_KINDS,
  AGENT_AUTH_PROFILE_ID_PATTERN,
  AgentAuthProfileBaseUrlSchema,
  AgentAuthProfileProviderSchema,
  parseErrorToResult
} from './agent-auth-profile-types'

// IPC input for create/update. Non-secret fields carry the full desired
// state; secret values are tri-state because the renderer never sees them
// again after save — undefined keeps the stored secret, null removes it, a
// string sets/rotates it. The id is absent on create (main generates it) and
// required on update.

export const AgentAuthProfileHeaderInputSchema = z.strictObject({
  name: z.enum(AGENT_AUTH_PROFILE_ALLOWED_HEADER_NAMES),
  value: z.string().min(1).nullable().optional()
})
export type AgentAuthProfileHeaderInput = z.infer<typeof AgentAuthProfileHeaderInputSchema>

export const AgentAuthProfileProxyInputSchema = z.strictObject({
  url: AgentAuthProfileBaseUrlSchema,
  authValue: z.string().min(1).nullable().optional()
})
export type AgentAuthProfileProxyInput = z.infer<typeof AgentAuthProfileProxyInputSchema>

export const AgentAuthProfileUpsertInputSchema = z
  .strictObject({
    id: z
      .string()
      .refine((value) => AGENT_AUTH_PROFILE_ID_PATTERN.test(value), {
        message:
          'Profile id must start alphanumeric and use only letters, digits, dots, and hyphens.'
      })
      .optional(),
    label: z.string().min(1).max(64).optional(),
    provider: AgentAuthProfileProviderSchema,
    apiKey: z.string().min(1).nullable().optional(),
    apiKeyKind: z.enum(AGENT_AUTH_PROFILE_API_KEY_KINDS).nullable().optional(),
    baseUrl: AgentAuthProfileBaseUrlSchema.nullable(),
    model: z.string().min(1).nullable(),
    headers: z.array(AgentAuthProfileHeaderInputSchema),
    proxy: AgentAuthProfileProxyInputSchema.nullable()
  })
  .superRefine((input, ctx) => {
    const hasApiKey = input.apiKey !== undefined && input.apiKey !== null
    const hasKind = input.apiKeyKind !== undefined && input.apiKeyKind !== null
    if (
      hasApiKey !== hasKind ||
      (input.apiKey === undefined) !== (input.apiKeyKind === undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['apiKey'],
        message: 'apiKey and apiKeyKind must be set together, both null, or both omitted.'
      })
    }
    const isCreate = input.id === undefined
    const headerNames = new Set<string>()
    for (const [index, header] of input.headers.entries()) {
      if (headerNames.has(header.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['headers', index, 'name'],
          message: `Duplicate header name "${header.name}".`
        })
      }
      headerNames.add(header.name)
      if (isCreate && (header.value === undefined || header.value === null)) {
        ctx.addIssue({
          code: 'custom',
          path: ['headers', index, 'value'],
          message: `Header "${header.name}" requires a value for a new profile.`
        })
      }
    }
  })
export type AgentAuthProfileUpsertInput = z.infer<typeof AgentAuthProfileUpsertInputSchema>

export type ParsedAgentAuthProfileUpsertInput =
  | { ok: true; value: AgentAuthProfileUpsertInput }
  | { ok: false; error: string }

export function parseAgentAuthProfileUpsertInput(raw: unknown): ParsedAgentAuthProfileUpsertInput {
  const result = AgentAuthProfileUpsertInputSchema.safeParse(raw)
  if (result.success) {
    return { ok: true, value: result.data }
  }
  return parseErrorToResult(result.error)
}
