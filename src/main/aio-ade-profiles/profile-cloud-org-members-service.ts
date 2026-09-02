import type {
  AioAdeProfileOrgInviteRevokeArgs,
  AioAdeProfileOrgMemberChangeRoleArgs,
  AioAdeProfileOrgMemberInviteArgs,
  AioAdeProfileOrgMemberMutationResult,
  AioAdeProfileOrgMemberRemoveArgs,
  AioAdeProfileOrgMembersListResult
} from '../../shared/aio-ade-profiles'
import type { ActiveAioAdeProfileState } from './profile-index-store'
import { ensureActiveAioAdeProfile } from './profile-index-store'
import type { AioAdeCloudAuthConfig } from './profile-cloud-auth-config'
import { getAioAdeCloudAuthConfig, isAioAdeCloudDevAuthEnabled } from './profile-cloud-auth-config'
import type { AioAdeCloudSession } from './profile-cloud-session-store'
import { AioAdeCloudRequestError } from './profile-cloud-client'
import { runWithFreshAioAdeCloudSession } from './profile-cloud-session-refresh'
import {
  changeAioAdeCloudOrgMemberRole,
  inviteAioAdeCloudOrgMember,
  listAioAdeCloudOrgMembers,
  removeAioAdeCloudOrgMember,
  revokeAioAdeCloudOrgInvite
} from './profile-cloud-org-members-client'
import {
  changeDevAioAdeCloudOrgMemberRole,
  inviteDevAioAdeCloudOrgMember,
  listDevAioAdeCloudOrgMembers,
  removeDevAioAdeCloudOrgMember,
  revokeDevAioAdeCloudOrgInvite
} from './profile-cloud-dev-org-members'

type OrgCallResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'reconnect-required' }
  | { status: 'request-error'; error: AioAdeCloudRequestError }
  | { status: 'failed'; error: string }

// Why: only a 401 means the token itself is stale and should drive a session
// refresh/reconnect. 403/404/409/400 are business or permission outcomes the UI
// must interpret, so they are surfaced as values rather than thrown — otherwise
// runWithFreshAioAdeCloudSession would treat a 403 as an auth failure and burn a
// pointless token refresh + retry before giving up.
async function runOrgMemberCall<T>(
  config: AioAdeCloudAuthConfig,
  active: ActiveAioAdeProfileState,
  userDataPath: string,
  call: (session: AioAdeCloudSession) => Promise<T>
): Promise<OrgCallResult<T>> {
  try {
    const operation = await runWithFreshAioAdeCloudSession(
      config,
      active,
      userDataPath,
      async (session) => {
        try {
          return { ok: true as const, value: await call(session) }
        } catch (error) {
          if (error instanceof AioAdeCloudRequestError && error.statusCode !== 401) {
            return { ok: false as const, error }
          }
          throw error
        }
      }
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required' }
    }
    const outcome = operation.value
    return outcome.ok
      ? { status: 'ok', value: outcome.value }
      : { status: 'request-error', error: outcome.error }
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}

function mapMutationRequestError(
  error: AioAdeCloudRequestError
): AioAdeProfileOrgMemberMutationResult {
  switch (error.statusCode) {
    case 403:
      return { status: 'forbidden' }
    case 404:
      return { status: 'not-found' }
    case 409:
      return {
        status: 'conflict',
        reason: error.errorCode === 'already_member' ? 'already_member' : 'already_invited'
      }
    case 400:
      return {
        status: 'invalid',
        reason:
          error.errorCode === 'cannot_remove_self' ? 'cannot_remove_self' : 'cannot_change_own_role'
      }
    default:
      return { status: 'failed', error: error.message }
  }
}

function mapMutationResult(result: OrgCallResult<void>): AioAdeProfileOrgMemberMutationResult {
  switch (result.status) {
    case 'ok':
      return { status: 'ok' }
    case 'reconnect-required':
      return { status: 'reconnect-required' }
    case 'request-error':
      return mapMutationRequestError(result.error)
    case 'failed':
      return { status: 'failed', error: result.error }
  }
}

export async function listAioAdeProfileOrgMembers(
  userDataPath: string,
  orgId: string
): Promise<AioAdeProfileOrgMembersListResult> {
  const active = ensureActiveAioAdeProfile(userDataPath)
  if (isAioAdeCloudDevAuthEnabled()) {
    return { status: 'ok', roster: listDevAioAdeCloudOrgMembers(orgId) }
  }
  const configState = getAioAdeCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  const result = await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
    listAioAdeCloudOrgMembers(configState.config, session, orgId)
  )
  switch (result.status) {
    case 'ok':
      return { status: 'ok', roster: result.value }
    case 'reconnect-required':
      return { status: 'reconnect-required' }
    case 'request-error':
      return { status: 'failed', error: result.error.message }
    case 'failed':
      return { status: 'failed', error: result.error }
  }
}

export async function inviteAioAdeProfileOrgMember(
  userDataPath: string,
  args: AioAdeProfileOrgMemberInviteArgs
): Promise<AioAdeProfileOrgMemberMutationResult> {
  const active = ensureActiveAioAdeProfile(userDataPath)
  if (isAioAdeCloudDevAuthEnabled()) {
    return inviteDevAioAdeCloudOrgMember(args)
  }
  const configState = getAioAdeCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      inviteAioAdeCloudOrgMember(configState.config, session, args)
    )
  )
}

export async function revokeAioAdeProfileOrgInvite(
  userDataPath: string,
  args: AioAdeProfileOrgInviteRevokeArgs
): Promise<AioAdeProfileOrgMemberMutationResult> {
  const active = ensureActiveAioAdeProfile(userDataPath)
  if (isAioAdeCloudDevAuthEnabled()) {
    return revokeDevAioAdeCloudOrgInvite(args)
  }
  const configState = getAioAdeCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      revokeAioAdeCloudOrgInvite(configState.config, session, args)
    )
  )
}

export async function changeAioAdeProfileOrgMemberRole(
  userDataPath: string,
  args: AioAdeProfileOrgMemberChangeRoleArgs
): Promise<AioAdeProfileOrgMemberMutationResult> {
  const active = ensureActiveAioAdeProfile(userDataPath)
  if (isAioAdeCloudDevAuthEnabled()) {
    return changeDevAioAdeCloudOrgMemberRole(args)
  }
  const configState = getAioAdeCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      changeAioAdeCloudOrgMemberRole(configState.config, session, args)
    )
  )
}

export async function removeAioAdeProfileOrgMember(
  userDataPath: string,
  args: AioAdeProfileOrgMemberRemoveArgs
): Promise<AioAdeProfileOrgMemberMutationResult> {
  const active = ensureActiveAioAdeProfile(userDataPath)
  if (isAioAdeCloudDevAuthEnabled()) {
    return removeDevAioAdeCloudOrgMember(args)
  }
  const configState = getAioAdeCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      removeAioAdeCloudOrgMember(configState.config, session, args)
    )
  )
}
