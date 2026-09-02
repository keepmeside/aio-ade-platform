import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  appExitMock,
  appQuitMock,
  appRelaunchMock,
  relaunchAppMock,
  destroySystemTrayMock,
  createLocalAioAdeProfileMock,
  getAioAdeProfileListStateMock,
  seedNewAioAdeProfileTelemetryConsentMock,
  setActiveAioAdeProfileMock,
  transferAioAdeProfileProjectMock
} = vi.hoisted(() => ({
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
  appExitMock: vi.fn(),
  appQuitMock: vi.fn(),
  appRelaunchMock: vi.fn(),
  relaunchAppMock: vi.fn(),
  destroySystemTrayMock: vi.fn(),
  createLocalAioAdeProfileMock: vi.fn(),
  getAioAdeProfileListStateMock: vi.fn(),
  seedNewAioAdeProfileTelemetryConsentMock: vi.fn(),
  setActiveAioAdeProfileMock: vi.fn(),
  transferAioAdeProfileProjectMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    exit: appExitMock,
    quit: appQuitMock,
    relaunch: appRelaunchMock,
    getPath: () => '/tmp/aio-ade-user-data'
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../tray/system-tray', () => ({
  destroySystemTray: destroySystemTrayMock
}))

vi.mock('../app-relaunch', () => ({
  relaunchApp: relaunchAppMock
}))

vi.mock('../aio-ade-profiles/profile-index-store', () => ({
  createLocalAioAdeProfile: createLocalAioAdeProfileMock,
  getAioAdeProfileListState: getAioAdeProfileListStateMock,
  seedNewAioAdeProfileTelemetryConsent: seedNewAioAdeProfileTelemetryConsentMock,
  setActiveAioAdeProfile: setActiveAioAdeProfileMock
}))

function makeStoreMock(flush = vi.fn()): {
  flush: typeof flush
  freezeWrites: ReturnType<typeof vi.fn>
  getSettings: () => Record<string, never>
} {
  return { flush, freezeWrites: vi.fn(), getSettings: () => ({}) }
}

vi.mock('../aio-ade-profiles/profile-project-transfer', () => ({
  transferAioAdeProfileProject: transferAioAdeProfileProjectMock
}))

import { registerAioAdeProfileHandlers } from './aio-ade-profiles'

describe('registerAioAdeProfileHandlers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    handlers.clear()
    appExitMock.mockReset()
    appQuitMock.mockReset()
    appRelaunchMock.mockReset()
    relaunchAppMock.mockReset()
    relaunchAppMock.mockImplementation(() => appRelaunchMock())
    destroySystemTrayMock.mockReset()
    createLocalAioAdeProfileMock.mockReset()
    getAioAdeProfileListStateMock.mockReset()
    seedNewAioAdeProfileTelemetryConsentMock.mockReset()
    setActiveAioAdeProfileMock.mockReset()
    transferAioAdeProfileProjectMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('registers list and create handlers', async () => {
    const listState = {
      activeProfileId: 'local-default',
      profiles: [{ id: 'local-default', name: 'Personal' }]
    }
    const createState = {
      ...listState,
      profile: { id: 'local-work', name: 'Work' }
    }
    getAioAdeProfileListStateMock.mockReturnValue(listState)
    createLocalAioAdeProfileMock.mockReturnValue(createState)

    registerAioAdeProfileHandlers(makeStoreMock() as never)

    await expect(Promise.resolve(handlers.get('aioAdeProfiles:list')?.(null))).resolves.toEqual({
      ...listState,
      multiProfileUi: false
    })
    await expect(
      Promise.resolve(handlers.get('aioAdeProfiles:createLocal')?.(null, { name: 'Work' }))
    ).resolves.toBe(createState)
    expect(createLocalAioAdeProfileMock).toHaveBeenCalledWith({ name: 'Work' })
  })

  it('reports multiProfileUi when the env flag is set', async () => {
    const previous = process.env.AIO_ADE_MULTI_PROFILE_UI
    process.env.AIO_ADE_MULTI_PROFILE_UI = '1'
    try {
      getAioAdeProfileListStateMock.mockReturnValue({
        activeProfileId: 'local-default',
        profiles: []
      })
      registerAioAdeProfileHandlers(makeStoreMock() as never)

      await expect(Promise.resolve(handlers.get('aioAdeProfiles:list')?.(null))).resolves.toEqual({
        activeProfileId: 'local-default',
        profiles: [],
        multiProfileUi: true
      })
    } finally {
      if (previous === undefined) {
        delete process.env.AIO_ADE_MULTI_PROFILE_UI
      } else {
        process.env.AIO_ADE_MULTI_PROFILE_UI = previous
      }
    }
  })

  it('marks the target profile active, flushes, and relaunches', async () => {
    const flush = vi.fn()
    const onBeforeRelaunch = vi.fn()
    getAioAdeProfileListStateMock.mockReturnValue({
      activeProfileId: 'local-default',
      profiles: []
    })
    setActiveAioAdeProfileMock.mockReturnValue({
      activeProfileId: 'local-work',
      profiles: []
    })
    registerAioAdeProfileHandlers(makeStoreMock(flush) as never, { onBeforeRelaunch })

    const resultPromise = Promise.resolve(
      handlers.get('aioAdeProfiles:switch')?.(null, { profileId: 'local-work' })
    )

    await expect(resultPromise).resolves.toEqual({ status: 'relaunching' })
    expect(setActiveAioAdeProfileMock).toHaveBeenCalledWith('local-work')
    expect(flush).toHaveBeenCalledOnce()
    expect(onBeforeRelaunch).toHaveBeenCalledOnce()
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(
      setActiveAioAdeProfileMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    )
    expect(appRelaunchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(150)

    expect(appRelaunchMock).toHaveBeenCalledOnce()
    expect(relaunchAppMock).toHaveBeenCalledWith('profile-switch')
    // Why quit, not exit: before-quit/will-quit teardown (scrollback capture,
    // PTY kill, daemon checkpoints) must run on a profile switch.
    expect(appQuitMock).toHaveBeenCalledOnce()
    expect(appExitMock).not.toHaveBeenCalled()
  })

  it('does not mark a profile active when current profile flush fails', async () => {
    const flush = vi.fn(() => {
      throw new Error('flush_failed')
    })
    getAioAdeProfileListStateMock.mockReturnValue({
      activeProfileId: 'local-default',
      profiles: []
    })
    registerAioAdeProfileHandlers(makeStoreMock(flush) as never)

    await expect(
      Promise.resolve(handlers.get('aioAdeProfiles:switch')?.(null, { profileId: 'local-work' }))
    ).rejects.toThrow('flush_failed')

    expect(setActiveAioAdeProfileMock).not.toHaveBeenCalled()
    expect(appRelaunchMock).not.toHaveBeenCalled()
  })

  it('does not relaunch when switching to the active profile', async () => {
    getAioAdeProfileListStateMock.mockReturnValue({
      activeProfileId: 'local-default',
      profiles: []
    })
    registerAioAdeProfileHandlers(makeStoreMock() as never)

    await expect(
      Promise.resolve(handlers.get('aioAdeProfiles:switch')?.(null, { profileId: 'local-default' }))
    ).resolves.toEqual({ status: 'already-active' })

    expect(setActiveAioAdeProfileMock).not.toHaveBeenCalled()
    expect(appRelaunchMock).not.toHaveBeenCalled()
  })

  it('rejects invalid profile ids', async () => {
    registerAioAdeProfileHandlers(makeStoreMock() as never)

    await expect(
      Promise.resolve(handlers.get('aioAdeProfiles:switch')?.(null, { profileId: ' ' }))
    ).rejects.toThrow('invalid_aio_ade_profile_id')
  })

  it('transfers projects between inactive profiles after flushing active state', async () => {
    const flush = vi.fn()
    const result = {
      status: 'transferred',
      mode: 'copy',
      sourceProfileId: 'personal',
      targetProfileId: 'work',
      sourceRepoId: 'repo-1',
      targetRepoId: 'repo-2',
      targetProjectId: 'repo:repo-2'
    }
    getAioAdeProfileListStateMock.mockReturnValue({
      activeProfileId: 'personal',
      profiles: []
    })
    transferAioAdeProfileProjectMock.mockReturnValue(result)
    registerAioAdeProfileHandlers(makeStoreMock(flush) as never)

    await expect(
      Promise.resolve(
        handlers.get('aioAdeProfiles:transferProject')?.(null, {
          sourceProfileId: ' personal ',
          targetProfileId: ' work ',
          repoId: ' repo-1 ',
          mode: 'copy'
        })
      )
    ).resolves.toBe(result)

    expect(flush).toHaveBeenCalledOnce()
    expect(transferAioAdeProfileProjectMock).toHaveBeenCalledWith(
      {
        sourceProfileId: 'personal',
        targetProfileId: 'work',
        repoId: 'repo-1',
        mode: 'copy'
      },
      '/tmp/aio-ade-user-data'
    )
  })

  it('moves a project out of the active profile and relaunches into the target profile', async () => {
    const flush = vi.fn()
    const onBeforeRelaunch = vi.fn()
    const result = {
      status: 'transferred',
      mode: 'move',
      sourceProfileId: 'personal',
      targetProfileId: 'work',
      sourceRepoId: 'repo-1',
      targetRepoId: 'repo-1',
      targetProjectId: 'repo:repo-1'
    }
    getAioAdeProfileListStateMock.mockReturnValue({
      activeProfileId: 'personal',
      profiles: []
    })
    transferAioAdeProfileProjectMock.mockReturnValue(result)
    registerAioAdeProfileHandlers(makeStoreMock(flush) as never, { onBeforeRelaunch })

    await expect(
      Promise.resolve(
        handlers.get('aioAdeProfiles:transferProject')?.(null, {
          sourceProfileId: 'personal',
          targetProfileId: 'work',
          repoId: 'repo-1',
          mode: 'move'
        })
      )
    ).resolves.toEqual({ ...result, willRelaunch: true })

    expect(onBeforeRelaunch).toHaveBeenCalledOnce()
    expect(flush).toHaveBeenCalledOnce()
    expect(transferAioAdeProfileProjectMock).toHaveBeenCalledWith(
      {
        sourceProfileId: 'personal',
        targetProfileId: 'work',
        repoId: 'repo-1',
        mode: 'move'
      },
      '/tmp/aio-ade-user-data'
    )
    expect(setActiveAioAdeProfileMock).toHaveBeenCalledWith('work')
    expect(appRelaunchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(150)

    expect(appRelaunchMock).toHaveBeenCalledOnce()
    expect(relaunchAppMock).toHaveBeenCalledWith('profile-transfer')
    expect(appQuitMock).toHaveBeenCalledOnce()
    expect(appExitMock).not.toHaveBeenCalled()
  })

  it('rejects transfers that would mutate the active target profile offline', async () => {
    getAioAdeProfileListStateMock.mockReturnValue({
      activeProfileId: 'work',
      profiles: []
    })
    registerAioAdeProfileHandlers(makeStoreMock() as never)

    await expect(
      Promise.resolve(
        handlers.get('aioAdeProfiles:transferProject')?.(null, {
          sourceProfileId: 'personal',
          targetProfileId: 'work',
          repoId: 'repo-1',
          mode: 'copy'
        })
      )
    ).rejects.toThrow('active_target_aio_ade_profile_transfer_requires_relaunch')

    expect(transferAioAdeProfileProjectMock).not.toHaveBeenCalled()
  })
})
