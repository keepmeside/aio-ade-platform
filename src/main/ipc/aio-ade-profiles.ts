import { app, ipcMain } from 'electron'
import type { Store } from '../persistence'
import { relaunchApp, type AppRelaunchReason } from '../app-relaunch'
import type {
  CreateLocalAioAdeProfileArgs,
  CreateLocalAioAdeProfileResult,
  CreateCloudLinkedAioAdeProfileArgs,
  CreateCloudLinkedAioAdeProfileResult,
  FindAioAdeProfileProjectsByPathArgs,
  FindAioAdeProfileProjectsByPathResult,
  AioAdeProfileListResult,
  RefreshCurrentAioAdeProfileAuthResult,
  SwitchAioAdeProfileArgs,
  SwitchAioAdeProfileResult,
  TransferAioAdeProfileProjectArgs,
  TransferAioAdeProfileProjectResult,
  ConnectCurrentAioAdeProfileResult,
  AioAdeProfileAuthStatus,
  SelectAioAdeProfileOrgArgs,
  SelectAioAdeProfileOrgResult,
  SignOutCurrentAioAdeProfileResult
} from '../../shared/aio-ade-profiles'
import {
  createLocalAioAdeProfile,
  getAioAdeProfileListState,
  seedNewAioAdeProfileTelemetryConsent,
  setActiveAioAdeProfile
} from '../aio-ade-profiles/profile-index-store'
import {
  cloudSessionIdentity,
  recordCloudSessionIdentityMutation
} from '../aio-ade-profiles/profile-cloud-session-mutation'
import { getProfileUserDataPath } from '../aio-ade-profiles/profile-storage-paths'
import { isMultiProfileUiEnabled } from '../aio-ade-profiles/profile-ui-scope'
import { transferAioAdeProfileProject } from '../aio-ade-profiles/profile-project-transfer'
import { findAioAdeProfileProjectsByPath } from '../aio-ade-profiles/profile-project-presence'
import { normalizeExecutionHostId } from '../../shared/execution-host'
import {
  createCloudLinkedAioAdeProfile,
  connectCurrentAioAdeProfile,
  getCurrentAioAdeProfileAuthStatus,
  refreshCurrentAioAdeProfileAuth,
  selectCurrentAioAdeProfileOrg,
  signOutCurrentAioAdeProfile
} from '../aio-ade-profiles/profile-cloud-service'
import { registerAioAdeProfileOrgMemberHandlers } from './aio-ade-profile-org-members-handlers'

type RegisterAioAdeProfileHandlersOptions = {
  onBeforeRelaunch?: () => void | Promise<void>
  onAuthMutation?: () => void
  onBeforeSignOut?: () => void
}

function profileIdFromArgs(args: unknown): string {
  if (
    !args ||
    typeof args !== 'object' ||
    typeof (args as SwitchAioAdeProfileArgs).profileId !== 'string'
  ) {
    throw new Error('invalid_aio_ade_profile_id')
  }
  const profileId = (args as SwitchAioAdeProfileArgs).profileId.trim()
  if (!profileId) {
    throw new Error('invalid_aio_ade_profile_id')
  }
  return profileId
}

function transferProjectArgsFromUnknown(args: unknown): TransferAioAdeProfileProjectArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('invalid_aio_ade_profile_project_transfer')
  }
  const candidate = args as TransferAioAdeProfileProjectArgs
  const sourceProfileId = candidate.sourceProfileId?.trim()
  const targetProfileId = candidate.targetProfileId?.trim()
  const repoId = candidate.repoId?.trim()
  const mode = candidate.mode
  if (!sourceProfileId || !targetProfileId || !repoId || (mode !== 'move' && mode !== 'copy')) {
    throw new Error('invalid_aio_ade_profile_project_transfer')
  }
  return {
    sourceProfileId,
    targetProfileId,
    repoId,
    mode
  }
}

function findProjectsByPathArgsFromUnknown(args: unknown): FindAioAdeProfileProjectsByPathArgs {
  if (!args || typeof args !== 'object') {
    throw new Error('invalid_aio_ade_profile_project_path')
  }
  const candidate = args as FindAioAdeProfileProjectsByPathArgs
  const path = typeof candidate.path === 'string' ? candidate.path.trim() : ''
  if (!path) {
    throw new Error('invalid_aio_ade_profile_project_path')
  }
  let executionHostId: FindAioAdeProfileProjectsByPathArgs['executionHostId'] = null
  if (candidate.executionHostId !== null && candidate.executionHostId !== undefined) {
    if (typeof candidate.executionHostId !== 'string') {
      throw new Error('invalid_aio_ade_profile_project_path')
    }
    executionHostId = normalizeExecutionHostId(candidate.executionHostId)
    if (!executionHostId) {
      throw new Error('invalid_aio_ade_profile_project_path')
    }
  }
  return {
    path,
    connectionId:
      typeof candidate.connectionId === 'string' ? candidate.connectionId.trim() || null : null,
    executionHostId,
    excludeProfileId:
      typeof candidate.excludeProfileId === 'string'
        ? candidate.excludeProfileId.trim() || null
        : null
  }
}

function orgIdFromUnknown(args: unknown): string {
  if (!args || typeof args !== 'object') {
    throw new Error('invalid_aio_ade_profile_org_selection')
  }
  const orgId = (args as SelectAioAdeProfileOrgArgs).orgId?.trim()
  if (!orgId) {
    throw new Error('invalid_aio_ade_profile_org_selection')
  }
  return orgId
}

function createCloudLinkedProfileArgsFromUnknown(
  args: unknown
): CreateCloudLinkedAioAdeProfileArgs {
  if (!args || typeof args !== 'object') {
    return {}
  }
  const candidate = args as CreateCloudLinkedAioAdeProfileArgs
  const orgId = typeof candidate.orgId === 'string' ? candidate.orgId.trim() : undefined
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : undefined
  return {
    ...(orgId ? { orgId } : {}),
    ...(name ? { name } : {})
  }
}

async function runBeforeProfileRelaunch(
  onBeforeRelaunch?: () => void | Promise<void>
): Promise<void> {
  try {
    await onBeforeRelaunch?.()
  } catch (error) {
    console.warn(
      '[aio-ade-profiles] Pre-relaunch cleanup failed; continuing profile switch:',
      error instanceof Error ? error.name : typeof error
    )
  }
}

function scheduleProfileRelaunch(reason: Extract<AppRelaunchReason, `profile-${string}`>): void {
  setTimeout(() => {
    relaunchApp(reason)
    // Why: app.quit() (not app.exit) so before-quit/will-quit still run —
    // renderer scrollback capture, PTY kill, stats flush, and daemon final
    // checkpoints must not be skipped on a profile switch.
    app.quit()
  }, 150)
}

export function registerAioAdeProfileHandlers(
  store: Store,
  options: RegisterAioAdeProfileHandlersOptions = {}
): void {
  ipcMain.handle(
    'aioAdeProfiles:list',
    (): AioAdeProfileListResult => ({
      ...getAioAdeProfileListState(),
      multiProfileUi: isMultiProfileUiEnabled()
    })
  )

  ipcMain.handle(
    'aioAdeProfiles:authStatus',
    (): AioAdeProfileAuthStatus => getCurrentAioAdeProfileAuthStatus(getProfileUserDataPath())
  )

  ipcMain.handle(
    'aioAdeProfiles:createLocal',
    (_event, args?: CreateLocalAioAdeProfileArgs): CreateLocalAioAdeProfileResult => {
      const result = createLocalAioAdeProfile(args)
      seedNewAioAdeProfileTelemetryConsent(result.profile.id, store.getSettings().telemetry)
      return result
    }
  )

  ipcMain.handle(
    'aioAdeProfiles:switch',
    async (_event, args: SwitchAioAdeProfileArgs): Promise<SwitchAioAdeProfileResult> => {
      const profileId = profileIdFromArgs(args)
      const current = getAioAdeProfileListState()
      if (profileId === current.activeProfileId) {
        return { status: 'already-active' }
      }

      const activeProfile = current.profiles.find(
        (profile) => profile.id === current.activeProfileId
      )
      if (activeProfile?.cloud) {
        // Why: profile selection changes the expected identity synchronously;
        // stale refresh saves must fail even before relaunch teardown finishes.
        recordCloudSessionIdentityMutation(
          cloudSessionIdentity(activeProfile.id, activeProfile.cloud),
          getProfileUserDataPath()
        )
      }
      // Why: the current profile must be persisted before the global index
      // points startup at the target profile.
      await runBeforeProfileRelaunch(options.onBeforeRelaunch)
      store.flush()
      setActiveAioAdeProfile(profileId)

      scheduleProfileRelaunch('profile-switch')

      return { status: 'relaunching' }
    }
  )

  ipcMain.handle(
    'aioAdeProfiles:transferProject',
    async (
      _event,
      rawArgs: TransferAioAdeProfileProjectArgs
    ): Promise<TransferAioAdeProfileProjectResult> => {
      const args = transferProjectArgsFromUnknown(rawArgs)
      const current = getAioAdeProfileListState()
      if (args.targetProfileId === current.activeProfileId) {
        throw new Error('active_target_aio_ade_profile_transfer_requires_relaunch')
      }
      if (args.mode === 'move' && args.sourceProfileId === current.activeProfileId) {
        // Why: transfer before any relaunch side effect so a duplicate-target
        // or validation failure cannot strand the app in a quitting state.
        // flush→transfer→freeze runs synchronously with no interleaving, and
        // the freeze keeps late sync saves from resurrecting the moved
        // project from stale memory before the relaunch.
        store.flush()
        const result = transferAioAdeProfileProject(args, getProfileUserDataPath())
        if (result.status === 'transferred') {
          store.freezeWrites()
          await runBeforeProfileRelaunch(options.onBeforeRelaunch)
          setActiveAioAdeProfile(args.targetProfileId)
          scheduleProfileRelaunch('profile-transfer')
          return { ...result, willRelaunch: true }
        }
        return result
      }
      store.flush()
      return transferAioAdeProfileProject(args, getProfileUserDataPath())
    }
  )

  ipcMain.handle(
    'aioAdeProfiles:findProjectProfiles',
    (_event, rawArgs: FindAioAdeProfileProjectsByPathArgs): FindAioAdeProfileProjectsByPathResult =>
      findAioAdeProfileProjectsByPath(
        findProjectsByPathArgsFromUnknown(rawArgs),
        getProfileUserDataPath()
      )
  )

  ipcMain.handle(
    'aioAdeProfiles:connectCurrent',
    async (): Promise<ConnectCurrentAioAdeProfileResult> => {
      const result = await connectCurrentAioAdeProfile(getProfileUserDataPath())
      if (result.status === 'connected') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'aioAdeProfiles:createCloudLinked',
    async (
      _event,
      rawArgs?: CreateCloudLinkedAioAdeProfileArgs
    ): Promise<CreateCloudLinkedAioAdeProfileResult> => {
      const result = await createCloudLinkedAioAdeProfile(
        getProfileUserDataPath(),
        createCloudLinkedProfileArgsFromUnknown(rawArgs)
      )
      if (result.status === 'created') {
        seedNewAioAdeProfileTelemetryConsent(result.profile.id, store.getSettings().telemetry)
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'aioAdeProfiles:refreshAuth',
    async (): Promise<RefreshCurrentAioAdeProfileAuthResult> => {
      const result = await refreshCurrentAioAdeProfileAuth(getProfileUserDataPath())
      if (result.status === 'refreshed') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'aioAdeProfiles:signOutCurrent',
    async (): Promise<SignOutCurrentAioAdeProfileResult> => {
      options.onBeforeSignOut?.()
      return signOutCurrentAioAdeProfile(getProfileUserDataPath())
    }
  )

  ipcMain.handle(
    'aioAdeProfiles:selectOrg',
    async (_event, rawArgs: SelectAioAdeProfileOrgArgs): Promise<SelectAioAdeProfileOrgResult> => {
      const result = await selectCurrentAioAdeProfileOrg(
        getProfileUserDataPath(),
        orgIdFromUnknown(rawArgs)
      )
      if (result.status === 'selected') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  registerAioAdeProfileOrgMemberHandlers()
}
