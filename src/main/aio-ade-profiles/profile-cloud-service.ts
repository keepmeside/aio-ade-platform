import type {
  ConnectCurrentAioAdeProfileResult,
  CreateCloudLinkedAioAdeProfileArgs,
  CreateCloudLinkedAioAdeProfileResult,
  AioAdeProfileAuthStatus,
  SelectAioAdeProfileOrgResult,
  SignOutCurrentAioAdeProfileResult
} from '../../shared/aio-ade-profiles'
import { ensureActiveAioAdeProfile } from './profile-index-store'
import { getAioAdeCloudAuthConfig, isAioAdeCloudDevAuthEnabled } from './profile-cloud-auth-config'
import {
  clearAioAdeCloudSession,
  readAioAdeCloudSession,
  saveAioAdeCloudSessionExchange
} from './profile-cloud-session-store'
import { cloudSessionIdentity, tombstoneCloudSession } from './profile-cloud-session-mutation'
import {
  createAioAdeCloudProfile,
  exchangeAioAdeCloudAuthCode,
  revokeAioAdeCloudSession
} from './profile-cloud-client'
import { beginAioAdeCloudPkceFlow } from './profile-cloud-pkce'
import {
  createCloudLinkedAioAdeProfileRecord,
  linkAioAdeProfileToCloud,
  unlinkAioAdeProfileFromCloud
} from './profile-cloud-index'
import { runWithFreshAioAdeCloudSession } from './profile-cloud-session-refresh'
import {
  connectDevAioAdeCloudProfile,
  createDevCloudLinkedAioAdeProfile,
  selectDevAioAdeCloudOrg
} from './profile-cloud-dev-service'
import { getAioAdeProfileAuthStatusFromProfile } from './profile-cloud-auth-status'
import { selectCloudOrgWithMutationFence } from './profile-cloud-org-selection'

export { refreshCurrentAioAdeProfileAuth } from './profile-cloud-capability-refresh'

function isUserCancelledAuthError(message: string): boolean {
  return message === 'aio_ade_cloud_auth_timeout' || message === 'aio_ade_cloud_auth_denied'
}

function activeAuth(
  active: ReturnType<typeof ensureActiveAioAdeProfile>,
  userDataPath: string
): AioAdeProfileAuthStatus {
  return getAioAdeProfileAuthStatusFromProfile(active, userDataPath)
}

export function getCurrentAioAdeProfileAuthStatus(userDataPath: string): AioAdeProfileAuthStatus {
  return getAioAdeProfileAuthStatusFromProfile(
    ensureActiveAioAdeProfile(userDataPath),
    userDataPath
  )
}

export async function connectCurrentAioAdeProfile(
  userDataPath: string
): Promise<ConnectCurrentAioAdeProfileResult> {
  const active = ensureActiveAioAdeProfile(userDataPath)
  if (isAioAdeCloudDevAuthEnabled()) {
    const list = connectDevAioAdeCloudProfile(active, userDataPath)
    return {
      status: 'connected',
      auth: getCurrentAioAdeProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  }

  const configState = getAioAdeCloudAuthConfig()
  if (!configState.configured) {
    return {
      status: 'unconfigured',
      auth: activeAuth(active, userDataPath)
    }
  }

  try {
    const code = await beginAioAdeCloudPkceFlow(configState.config, active.profile.id)
    const exchange = await exchangeAioAdeCloudAuthCode(configState.config, {
      ...code,
      localProfileId: active.profile.id
    })
    saveAioAdeCloudSessionExchange(active.profile.id, userDataPath, exchange)
    const list = linkAioAdeProfileToCloud(active.profile.id, exchange.cloud, userDataPath)
    return {
      status: 'connected',
      auth: getCurrentAioAdeProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isUserCancelledAuthError(message)) {
      return {
        status: 'cancelled',
        auth: getCurrentAioAdeProfileAuthStatus(userDataPath)
      }
    }
    return {
      status: 'failed',
      auth: getCurrentAioAdeProfileAuthStatus(userDataPath),
      error: message
    }
  }
}

export async function signOutCurrentAioAdeProfile(
  userDataPath: string
): Promise<SignOutCurrentAioAdeProfileResult> {
  const active = ensureActiveAioAdeProfile(userDataPath)
  const configState = getAioAdeCloudAuthConfig()
  const session = readAioAdeCloudSession(active.profile.id, userDataPath)
  if (active.profile.cloud) {
    // Why: persist the destructive fence before logout network I/O so a
    // refresh already in flight cannot save after explicit sign-out.
    tombstoneCloudSession(
      cloudSessionIdentity(active.profile.id, active.profile.cloud),
      userDataPath
    )
  }
  if (!isAioAdeCloudDevAuthEnabled() && configState.configured && session.status === 'found') {
    await revokeAioAdeCloudSession(configState.config, session.session).catch(() => undefined)
  }
  clearAioAdeCloudSession(active.profile.id, userDataPath)
  const list = unlinkAioAdeProfileFromCloud(active.profile.id, userDataPath)
  return {
    status: 'signed-out',
    auth: getCurrentAioAdeProfileAuthStatus(userDataPath),
    activeProfileId: list.activeProfileId,
    profiles: list.profiles
  }
}

export async function createCloudLinkedAioAdeProfile(
  userDataPath: string,
  args: CreateCloudLinkedAioAdeProfileArgs
): Promise<CreateCloudLinkedAioAdeProfileResult> {
  const active = ensureActiveAioAdeProfile(userDataPath)
  if (isAioAdeCloudDevAuthEnabled()) {
    const result = createDevCloudLinkedAioAdeProfile(active, userDataPath, args)
    if (result.status !== 'created') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'created',
      auth: getCurrentAioAdeProfileAuthStatus(userDataPath),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles,
      profile: result.list.profile
    }
  }

  const configState = getAioAdeCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: activeAuth(active, userDataPath) }
  }
  try {
    const operation = await runWithFreshAioAdeCloudSession(
      configState.config,
      active,
      userDataPath,
      (session) => createAioAdeCloudProfile(configState.config, session, args)
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    const created = operation.value
    const list = createCloudLinkedAioAdeProfileRecord(
      created.cloud,
      { name: args.name },
      userDataPath
    )
    saveAioAdeCloudSessionExchange(list.profile.id, userDataPath, created)
    return {
      status: 'created',
      auth: getCurrentAioAdeProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles,
      profile: list.profile
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: getCurrentAioAdeProfileAuthStatus(userDataPath),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function selectCurrentAioAdeProfileOrg(
  userDataPath: string,
  orgId: string
): Promise<SelectAioAdeProfileOrgResult> {
  const active = ensureActiveAioAdeProfile(userDataPath)
  if (isAioAdeCloudDevAuthEnabled()) {
    const result = selectDevAioAdeCloudOrg(active, userDataPath, orgId)
    if (result.status !== 'updated') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'selected',
      auth: getCurrentAioAdeProfileAuthStatus(userDataPath),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles
    }
  }

  const configState = getAioAdeCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: activeAuth(active, userDataPath) }
  }
  try {
    const list = await selectCloudOrgWithMutationFence({
      config: configState.config,
      active,
      userDataPath,
      orgId
    })
    if (!list) {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'selected',
      auth: getCurrentAioAdeProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: getCurrentAioAdeProfileAuthStatus(userDataPath),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
