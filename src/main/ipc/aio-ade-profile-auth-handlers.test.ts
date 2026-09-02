import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  createCloudLinkedAioAdeProfileMock,
  connectCurrentAioAdeProfileMock,
  getCurrentAioAdeProfileAuthStatusMock,
  refreshCurrentAioAdeProfileAuthMock,
  selectCurrentAioAdeProfileOrgMock,
  signOutCurrentAioAdeProfileMock
} = vi.hoisted(() => ({
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
  createCloudLinkedAioAdeProfileMock: vi.fn(),
  connectCurrentAioAdeProfileMock: vi.fn(),
  getCurrentAioAdeProfileAuthStatusMock: vi.fn(),
  refreshCurrentAioAdeProfileAuthMock: vi.fn(),
  selectCurrentAioAdeProfileOrgMock: vi.fn(),
  signOutCurrentAioAdeProfileMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    exit: vi.fn(),
    getPath: () => '/tmp/aio-ade-user-data',
    relaunch: vi.fn()
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../tray/system-tray', () => ({
  destroySystemTray: vi.fn()
}))

vi.mock('../aio-ade-profiles/profile-index-store', () => ({
  createLocalAioAdeProfile: vi.fn(),
  getAioAdeProfileListState: vi.fn(),
  seedNewAioAdeProfileTelemetryConsent: vi.fn(),
  setActiveAioAdeProfile: vi.fn()
}))

vi.mock('../aio-ade-profiles/profile-project-transfer', () => ({
  transferAioAdeProfileProject: vi.fn()
}))

vi.mock('../aio-ade-profiles/profile-cloud-service', () => ({
  createCloudLinkedAioAdeProfile: createCloudLinkedAioAdeProfileMock,
  connectCurrentAioAdeProfile: connectCurrentAioAdeProfileMock,
  getCurrentAioAdeProfileAuthStatus: getCurrentAioAdeProfileAuthStatusMock,
  refreshCurrentAioAdeProfileAuth: refreshCurrentAioAdeProfileAuthMock,
  selectCurrentAioAdeProfileOrg: selectCurrentAioAdeProfileOrgMock,
  signOutCurrentAioAdeProfile: signOutCurrentAioAdeProfileMock
}))

import { registerAioAdeProfileHandlers } from './aio-ade-profiles'

describe('registerAioAdeProfileHandlers auth channels', () => {
  beforeEach(() => {
    handlers.clear()
    createCloudLinkedAioAdeProfileMock.mockReset()
    connectCurrentAioAdeProfileMock.mockReset()
    getCurrentAioAdeProfileAuthStatusMock.mockReset()
    refreshCurrentAioAdeProfileAuthMock.mockReset()
    selectCurrentAioAdeProfileOrgMock.mockReset()
    signOutCurrentAioAdeProfileMock.mockReset()
  })

  it('returns auth status for the current profile', async () => {
    const status = {
      activeProfileId: 'local-default',
      configured: false,
      state: 'unconfigured',
      persistence: 'none'
    }
    getCurrentAioAdeProfileAuthStatusMock.mockReturnValue(status)
    registerAioAdeProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(Promise.resolve(handlers.get('aioAdeProfiles:authStatus')?.(null))).resolves.toBe(
      status
    )
    expect(getCurrentAioAdeProfileAuthStatusMock).toHaveBeenCalledWith('/tmp/aio-ade-user-data')
  })

  it('connects and signs out the current profile through the cloud service', async () => {
    const connectResult = { status: 'unconfigured', auth: { activeProfileId: 'local-default' } }
    const signOutResult = { status: 'signed-out', auth: { activeProfileId: 'local-default' } }
    connectCurrentAioAdeProfileMock.mockResolvedValue(connectResult)
    signOutCurrentAioAdeProfileMock.mockResolvedValue(signOutResult)
    registerAioAdeProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(handlers.get('aioAdeProfiles:connectCurrent')?.(null))
    ).resolves.toBe(connectResult)
    await expect(
      Promise.resolve(handlers.get('aioAdeProfiles:signOutCurrent')?.(null))
    ).resolves.toBe(signOutResult)
    expect(connectCurrentAioAdeProfileMock).toHaveBeenCalledWith('/tmp/aio-ade-user-data')
    expect(signOutCurrentAioAdeProfileMock).toHaveBeenCalledWith('/tmp/aio-ade-user-data')
  })

  it('refreshes profile auth through the cloud service', async () => {
    const refreshResult = { status: 'refreshed', auth: { activeProfileId: 'local-default' } }
    refreshCurrentAioAdeProfileAuthMock.mockResolvedValue(refreshResult)
    registerAioAdeProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(Promise.resolve(handlers.get('aioAdeProfiles:refreshAuth')?.(null))).resolves.toBe(
      refreshResult
    )
    expect(refreshCurrentAioAdeProfileAuthMock).toHaveBeenCalledWith('/tmp/aio-ade-user-data')
  })

  it('validates organization selection before calling the cloud service', async () => {
    const selectResult = { status: 'selected', auth: { activeProfileId: 'local-default' } }
    selectCurrentAioAdeProfileOrgMock.mockResolvedValue(selectResult)
    registerAioAdeProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(handlers.get('aioAdeProfiles:selectOrg')?.(null, { orgId: ' org-1 ' }))
    ).resolves.toBe(selectResult)
    expect(selectCurrentAioAdeProfileOrgMock).toHaveBeenCalledWith(
      '/tmp/aio-ade-user-data',
      'org-1'
    )

    await expect(
      Promise.resolve(handlers.get('aioAdeProfiles:selectOrg')?.(null, { orgId: ' ' }))
    ).rejects.toThrow('invalid_aio_ade_profile_org_selection')
  })

  it('creates cloud-linked profiles with trimmed optional args', async () => {
    const createResult = {
      status: 'created',
      auth: { activeProfileId: 'local-default' },
      activeProfileId: 'local-default',
      profiles: [],
      profile: { id: 'cloud-1' }
    }
    createCloudLinkedAioAdeProfileMock.mockResolvedValue(createResult)
    registerAioAdeProfileHandlers({
      flush: vi.fn(),
      freezeWrites: vi.fn(),
      getSettings: () => ({})
    } as never)

    await expect(
      Promise.resolve(
        handlers.get('aioAdeProfiles:createCloudLinked')?.(null, {
          orgId: ' org-1 ',
          name: ' Acme '
        })
      )
    ).resolves.toBe(createResult)
    expect(createCloudLinkedAioAdeProfileMock).toHaveBeenCalledWith('/tmp/aio-ade-user-data', {
      orgId: 'org-1',
      name: 'Acme'
    })
  })
})
