import { ipcMain } from 'electron'
import { z } from 'zod'
import { AgentAuthProfileProviderSchema } from '../../shared/agent-auth-profile-types'
import {
  parseAgentAuthProfileUpsertInput,
  type AgentAuthProfileUpsertInput
} from '../../shared/agent-auth-profile-upsert-input'
import type { AgentAuthProfileService } from '../agent-auth-profiles/agent-auth-profile-service'

// IPC boundary for agent auth profiles. Args are zod-strict at the edge —
// malformed input throws and the renderer's error extraction strips the
// Electron wrapper — while service outcomes ride the result envelope so the
// renderer branches on `ok` instead of catching.

const profileIdSchema = z.string().min(1)
const createSchema = z.strictObject({ input: z.unknown() })
const updateSchema = z.strictObject({ profileId: profileIdSchema, input: z.unknown() })
const duplicateSchema = z.strictObject({
  profileId: profileIdSchema,
  label: z.string().optional()
})
const deleteSchema = z.strictObject({ profileId: profileIdSchema })
const testConnectionSchema = z.strictObject({
  profileId: profileIdSchema.optional(),
  input: z.unknown().optional()
})
const providerDefaultSchema = z.strictObject({
  provider: AgentAuthProfileProviderSchema,
  profileId: profileIdSchema.nullable()
})
const sessionBindingSchema = z.strictObject({
  sessionId: profileIdSchema,
  profileId: profileIdSchema.nullable()
})
const workspaceBindingSchema = z.strictObject({
  key: z.string().min(1),
  profileId: profileIdSchema.nullable()
})

function parseUpsertInputOrThrow(raw: unknown): AgentAuthProfileUpsertInput {
  const parsed = parseAgentAuthProfileUpsertInput(raw)
  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  return parsed.value
}

export function registerAgentAuthProfileHandlers(service: AgentAuthProfileService): void {
  ipcMain.handle('agentAuthProfiles:list', () => service.list())
  ipcMain.handle('agentAuthProfiles:create', async (_event, args: unknown) => {
    const { input } = createSchema.parse(args)
    return service.create(parseUpsertInputOrThrow(input))
  })
  ipcMain.handle('agentAuthProfiles:update', async (_event, args: unknown) => {
    const { profileId, input } = updateSchema.parse(args)
    return service.update(profileId, parseUpsertInputOrThrow(input))
  })
  ipcMain.handle('agentAuthProfiles:duplicate', async (_event, args: unknown) => {
    const { profileId, label } = duplicateSchema.parse(args)
    return service.duplicate(profileId, label)
  })
  ipcMain.handle('agentAuthProfiles:delete', async (_event, args: unknown) => {
    const { profileId } = deleteSchema.parse(args)
    return service.delete(profileId)
  })
  ipcMain.handle('agentAuthProfiles:testConnection', async (_event, args: unknown) => {
    const parsed = testConnectionSchema.parse(args ?? {})
    return service.testConnection({
      profileId: parsed.profileId,
      input: parsed.input === undefined ? undefined : parseUpsertInputOrThrow(parsed.input)
    })
  })
  ipcMain.handle('agentAuthProfiles:setProviderDefault', async (_event, args: unknown) => {
    const { provider, profileId } = providerDefaultSchema.parse(args)
    return service.setProviderDefault(provider, profileId)
  })
  ipcMain.handle('agentAuthProfiles:setSessionBinding', async (_event, args: unknown) => {
    const { sessionId, profileId } = sessionBindingSchema.parse(args)
    return service.setSessionBinding(sessionId, profileId)
  })
  ipcMain.handle('agentAuthProfiles:setWorkspaceBinding', async (_event, args: unknown) => {
    const { key, profileId } = workspaceBindingSchema.parse(args)
    return service.setWorkspaceBinding(key, profileId)
  })
}
