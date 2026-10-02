import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentAuthProfileService } from '../agent-auth-profiles/agent-auth-profile-service'
import { registerAgentAuthProfileHandlers } from './agent-auth-profiles'

const { handleMock, removeHandlerMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    removeHandler: removeHandlerMock
  }
}))

const VALID_CREATE_INPUT = {
  provider: 'claude',
  apiKey: 'test-key',
  apiKeyKind: 'api-key',
  label: 'Work',
  baseUrl: null,
  model: null,
  headers: [],
  proxy: null
}

function makeService(): {
  service: AgentAuthProfileService
  spies: Record<string, ReturnType<typeof vi.fn>>
} {
  const spies = {
    list: vi.fn(() => ({ ok: true, value: 'list-snapshot' })),
    create: vi.fn(() => ({ ok: true, value: 'created' })),
    update: vi.fn(() => ({ ok: true, value: 'updated' })),
    duplicate: vi.fn(() => ({ ok: true, value: 'duplicated' })),
    delete: vi.fn(() => ({ ok: true, value: { warnings: [] } })),
    testConnection: vi.fn(() => ({ ok: true, status: 200 })),
    setProviderDefault: vi.fn(() => ({ ok: true, value: {} })),
    setSessionBinding: vi.fn(() => ({ ok: true, value: true })),
    setWorkspaceBinding: vi.fn(() => ({ ok: true, value: true }))
  }
  return { service: spies as unknown as AgentAuthProfileService, spies }
}

function getRegisteredHandlers(): Map<string, (...args: unknown[]) => unknown> {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  for (const [channel, handler] of handleMock.mock.calls as [
    string,
    (...args: unknown[]) => unknown
  ][]) {
    handlers.set(channel, handler)
  }
  return handlers
}

const CHANNELS = [
  'agentAuthProfiles:list',
  'agentAuthProfiles:create',
  'agentAuthProfiles:update',
  'agentAuthProfiles:duplicate',
  'agentAuthProfiles:delete',
  'agentAuthProfiles:testConnection',
  'agentAuthProfiles:setProviderDefault',
  'agentAuthProfiles:setSessionBinding',
  'agentAuthProfiles:setWorkspaceBinding'
]

describe('registerAgentAuthProfileHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers every channel once', () => {
    const { service } = makeService()
    registerAgentAuthProfileHandlers(service)
    const handlers = getRegisteredHandlers()
    expect([...handlers.keys()].sort()).toEqual([...CHANNELS].sort())
  })

  it('dispatches list and returns the service envelope', () => {
    const { service, spies } = makeService()
    registerAgentAuthProfileHandlers(service)
    const handlers = getRegisteredHandlers()

    expect(handlers.get('agentAuthProfiles:list')!()).toEqual({ ok: true, value: 'list-snapshot' })
    expect(spies.list).toHaveBeenCalledTimes(1)
  })

  it('creates with a parsed upsert input', async () => {
    const { service, spies } = makeService()
    registerAgentAuthProfileHandlers(service)
    const handlers = getRegisteredHandlers()

    const result = await handlers.get('agentAuthProfiles:create')!(undefined, {
      input: VALID_CREATE_INPUT
    })

    expect(result).toEqual({ ok: true, value: 'created' })
    expect(spies.create).toHaveBeenCalledWith(expect.objectContaining({ provider: 'claude' }))
  })

  it('rejects a create whose input fails upsert parsing', async () => {
    const { service } = makeService()
    registerAgentAuthProfileHandlers(service)
    const handlers = getRegisteredHandlers()

    const { apiKeyKind: _omitted, ...input } = VALID_CREATE_INPUT

    await expect(handlers.get('agentAuthProfiles:create')!(undefined, { input })).rejects.toThrow(
      /apiKey and apiKeyKind/
    )
  })

  it('updates with profileId and a parsed input', async () => {
    const { service, spies } = makeService()
    registerAgentAuthProfileHandlers(service)
    const handlers = getRegisteredHandlers()

    const input = { ...VALID_CREATE_INPUT, apiKey: undefined, apiKeyKind: undefined }

    const result = await handlers.get('agentAuthProfiles:update')!(undefined, {
      profileId: 'profile-1',
      input
    })

    expect(result).toEqual({ ok: true, value: 'updated' })
    expect(spies.update).toHaveBeenCalledWith(
      'profile-1',
      expect.objectContaining({ provider: 'claude' })
    )
  })

  it('duplicates with and without a label', async () => {
    const { service, spies } = makeService()
    registerAgentAuthProfileHandlers(service)
    const handlers = getRegisteredHandlers()

    await handlers.get('agentAuthProfiles:duplicate')!(undefined, { profileId: 'profile-1' })
    await handlers.get('agentAuthProfiles:duplicate')!(undefined, {
      profileId: 'profile-1',
      label: 'Copy'
    })

    expect(spies.duplicate).toHaveBeenNthCalledWith(1, 'profile-1', undefined)
    expect(spies.duplicate).toHaveBeenNthCalledWith(2, 'profile-1', 'Copy')
  })

  it('deletes by profileId', async () => {
    const { service, spies } = makeService()
    registerAgentAuthProfileHandlers(service)
    const handlers = getRegisteredHandlers()

    const result = await handlers.get('agentAuthProfiles:delete')!(undefined, {
      profileId: 'profile-1'
    })

    expect(result).toEqual({ ok: true, value: { warnings: [] } })
    expect(spies.delete).toHaveBeenCalledWith('profile-1')
  })

  it('tests a connection with no args, a stored profile, or a parsed draft', async () => {
    const { service, spies } = makeService()
    registerAgentAuthProfileHandlers(service)
    const handlers = getRegisteredHandlers()
    const testConnection = handlers.get('agentAuthProfiles:testConnection')!

    await testConnection(undefined, undefined)
    await testConnection(undefined, {})
    await testConnection(undefined, { profileId: 'profile-1' })
    await testConnection(undefined, { input: VALID_CREATE_INPUT })

    expect(spies.testConnection).toHaveBeenNthCalledWith(1, {})
    expect(spies.testConnection).toHaveBeenNthCalledWith(2, {})
    expect(spies.testConnection).toHaveBeenNthCalledWith(3, { profileId: 'profile-1' })
    expect(spies.testConnection).toHaveBeenNthCalledWith(4, {
      input: expect.objectContaining({ provider: 'claude' })
    })
  })

  it('rejects a connection test whose draft fails upsert parsing', async () => {
    const { service } = makeService()
    registerAgentAuthProfileHandlers(service)
    const handlers = getRegisteredHandlers()

    const input = { ...VALID_CREATE_INPUT, label: '' }

    await expect(
      handlers.get('agentAuthProfiles:testConnection')!(undefined, { input })
    ).rejects.toThrow(/at label/)
  })

  it('sets provider, session, and workspace bindings including null clears', async () => {
    const { service, spies } = makeService()
    registerAgentAuthProfileHandlers(service)
    const handlers = getRegisteredHandlers()

    await handlers.get('agentAuthProfiles:setProviderDefault')!(undefined, {
      provider: 'codex',
      profileId: 'profile-1'
    })
    await handlers.get('agentAuthProfiles:setProviderDefault')!(undefined, {
      provider: 'codex',
      profileId: null
    })
    await handlers.get('agentAuthProfiles:setSessionBinding')!(undefined, {
      sessionId: 'session-1',
      profileId: 'profile-1'
    })
    await handlers.get('agentAuthProfiles:setSessionBinding')!(undefined, {
      sessionId: 'session-1',
      profileId: null
    })
    await handlers.get('agentAuthProfiles:setWorkspaceBinding')!(undefined, {
      key: '/work/repo',
      profileId: 'profile-1'
    })
    await handlers.get('agentAuthProfiles:setWorkspaceBinding')!(undefined, {
      key: '/work/repo',
      profileId: null
    })

    expect(spies.setProviderDefault).toHaveBeenNthCalledWith(1, 'codex', 'profile-1')
    expect(spies.setProviderDefault).toHaveBeenNthCalledWith(2, 'codex', null)
    expect(spies.setSessionBinding).toHaveBeenNthCalledWith(1, 'session-1', 'profile-1')
    expect(spies.setSessionBinding).toHaveBeenNthCalledWith(2, 'session-1', null)
    expect(spies.setWorkspaceBinding).toHaveBeenNthCalledWith(1, '/work/repo', 'profile-1')
    expect(spies.setWorkspaceBinding).toHaveBeenNthCalledWith(2, '/work/repo', null)
  })

  it('rejects malformed channel args', async () => {
    const { service } = makeService()
    registerAgentAuthProfileHandlers(service)
    const handlers = getRegisteredHandlers()

    await expect(
      handlers.get('agentAuthProfiles:delete')!(undefined, { profileId: '' })
    ).rejects.toThrow()
    await expect(
      handlers.get('agentAuthProfiles:delete')!(undefined, { profileId: 'p', extra: true })
    ).rejects.toThrow()
    await expect(
      handlers.get('agentAuthProfiles:setProviderDefault')!(undefined, {
        provider: 'not-a-provider',
        profileId: null
      })
    ).rejects.toThrow()
  })
})
