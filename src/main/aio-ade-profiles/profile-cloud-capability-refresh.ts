import type { RefreshCurrentAioAdeProfileAuthResult } from '../../shared/aio-ade-profiles'
import { getAioAdeCloudAuthConfig, isAioAdeCloudDevAuthEnabled } from './profile-cloud-auth-config'
import { getAioAdeProfileAuthStatusFromProfile } from './profile-cloud-auth-status'
import { refreshAioAdeCloudCapabilities } from './profile-cloud-client'
import { linkAioAdeProfileToCloud } from './profile-cloud-index'
import { ensureActiveAioAdeProfile, getAioAdeProfileListState } from './profile-index-store'
import { refreshDevAioAdeCloudProfile } from './profile-cloud-dev-service'
import {
  captureCloudSessionMutation,
  cloudSessionIdentity,
  recordCloudSessionIdentityMutationIfCurrent
} from './profile-cloud-session-mutation'
import { runWithFreshAioAdeCloudSession } from './profile-cloud-session-refresh'
import {
  readAioAdeCloudSession,
  saveAioAdeCloudSessionIfCurrent
} from './profile-cloud-session-store'

export async function refreshCurrentAioAdeProfileAuth(
  userDataPath: string
): Promise<RefreshCurrentAioAdeProfileAuthResult> {
  const active = ensureActiveAioAdeProfile(userDataPath)
  const auth = () => getAioAdeProfileAuthStatusFromProfile(active, userDataPath)
  if (!active.profile.cloud) {
    return { status: 'local', auth: auth() }
  }
  if (isAioAdeCloudDevAuthEnabled()) {
    const result = refreshDevAioAdeCloudProfile(active, userDataPath)
    if (result.status !== 'updated') {
      return { status: 'reconnect-required', auth: auth() }
    }
    return {
      status: 'refreshed',
      auth: auth(),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles
    }
  }
  const configState = getAioAdeCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: auth() }
  }
  try {
    const identity = cloudSessionIdentity(active.profile.id, active.profile.cloud)
    let mutationSnapshot = captureCloudSessionMutation(identity, userDataPath)
    const operation = await runWithFreshAioAdeCloudSession(
      configState.config,
      active,
      userDataPath,
      (session) => refreshAioAdeCloudCapabilities(configState.config, session)
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required', auth: auth() }
    }
    const refresh = operation.value
    if (refresh.cloud) {
      const refreshedIdentity = cloudSessionIdentity(active.profile.id, refresh.cloud)
      if (
        refreshedIdentity.cloudUserId !== identity.cloudUserId ||
        refreshedIdentity.cloudProfileId !== identity.cloudProfileId
      ) {
        throw new Error('aio_ade_cloud_identity_changed_during_capability_refresh')
      }
      if (refreshedIdentity.organizationId !== identity.organizationId) {
        const advanced = recordCloudSessionIdentityMutationIfCurrent(
          refreshedIdentity,
          userDataPath,
          mutationSnapshot
        )
        if (!advanced) {
          return { status: 'reconnect-required', auth: auth() }
        }
        mutationSnapshot = advanced
      }
    }
    const session = readAioAdeCloudSession(active.profile.id, userDataPath)
    if (session.status !== 'found') {
      return { status: 'reconnect-required', auth: auth() }
    }
    if (
      saveAioAdeCloudSessionIfCurrent(
        active.profile.id,
        userDataPath,
        {
          ...session.session,
          organizations: refresh.organizations ?? session.session.organizations,
          capabilities: refresh.capabilities
        },
        mutationSnapshot
      ) === null
    ) {
      return { status: 'reconnect-required', auth: auth() }
    }
    const list = refresh.cloud
      ? linkAioAdeProfileToCloud(active.profile.id, refresh.cloud, userDataPath)
      : getAioAdeProfileListState(userDataPath)
    return {
      status: 'refreshed',
      auth: getAioAdeProfileAuthStatusFromProfile(
        ensureActiveAioAdeProfile(userDataPath),
        userDataPath
      ),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: auth(),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
