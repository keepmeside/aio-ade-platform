import { ipcMain } from 'electron'
import type {
  AioAdeOrgRole,
  AioAdeProfileOrgInviteRevokeArgs,
  AioAdeProfileOrgMemberChangeRoleArgs,
  AioAdeProfileOrgMemberInviteArgs,
  AioAdeProfileOrgMemberMutationResult,
  AioAdeProfileOrgMemberRemoveArgs,
  AioAdeProfileOrgMembersListArgs,
  AioAdeProfileOrgMembersListResult
} from '../../shared/aio-ade-profiles'
import { getProfileUserDataPath } from '../aio-ade-profiles/profile-storage-paths'
import {
  changeAioAdeProfileOrgMemberRole,
  inviteAioAdeProfileOrgMember,
  listAioAdeProfileOrgMembers,
  removeAioAdeProfileOrgMember,
  revokeAioAdeProfileOrgInvite
} from '../aio-ade-profiles/profile-cloud-org-members-service'

function orgMembersScopedArgs(args: unknown): { orgId: string; record: Record<string, unknown> } {
  if (!args || typeof args !== 'object') {
    throw new Error('invalid_aio_ade_profile_org_selection')
  }
  const record = args as Record<string, unknown>
  const orgId = typeof record.orgId === 'string' ? record.orgId.trim() : ''
  if (!orgId) {
    throw new Error('invalid_aio_ade_profile_org_selection')
  }
  return { orgId, record }
}

function orgRoleFromUnknown(value: unknown): AioAdeOrgRole {
  if (value === 'owner' || value === 'admin' || value === 'member') {
    return value
  }
  throw new Error('invalid_aio_ade_org_role')
}

function orgEmailFromUnknown(value: unknown): string {
  const email = typeof value === 'string' ? value.trim() : ''
  if (!email) {
    throw new Error('invalid_aio_ade_org_member_email')
  }
  return email
}

function orgUserIdFromUnknown(value: unknown): string {
  const userId = typeof value === 'string' ? value.trim() : ''
  if (!userId) {
    throw new Error('invalid_aio_ade_org_member_user')
  }
  return userId
}

function orgMemberInviteArgsFromUnknown(args: unknown): AioAdeProfileOrgMemberInviteArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, email: orgEmailFromUnknown(record.email), role: orgRoleFromUnknown(record.role) }
}

function orgInviteRevokeArgsFromUnknown(args: unknown): AioAdeProfileOrgInviteRevokeArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, email: orgEmailFromUnknown(record.email) }
}

function orgMemberChangeRoleArgsFromUnknown(args: unknown): AioAdeProfileOrgMemberChangeRoleArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return {
    orgId,
    userId: orgUserIdFromUnknown(record.userId),
    role: orgRoleFromUnknown(record.role)
  }
}

function orgMemberRemoveArgsFromUnknown(args: unknown): AioAdeProfileOrgMemberRemoveArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, userId: orgUserIdFromUnknown(record.userId) }
}

export function registerAioAdeProfileOrgMemberHandlers(): void {
  ipcMain.handle(
    'aioAdeProfiles:orgMembersList',
    async (
      _event,
      rawArgs: AioAdeProfileOrgMembersListArgs
    ): Promise<AioAdeProfileOrgMembersListResult> =>
      listAioAdeProfileOrgMembers(getProfileUserDataPath(), orgMembersScopedArgs(rawArgs).orgId)
  )

  ipcMain.handle(
    'aioAdeProfiles:orgMemberInvite',
    async (
      _event,
      rawArgs: AioAdeProfileOrgMemberInviteArgs
    ): Promise<AioAdeProfileOrgMemberMutationResult> =>
      inviteAioAdeProfileOrgMember(
        getProfileUserDataPath(),
        orgMemberInviteArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'aioAdeProfiles:orgInviteRevoke',
    async (
      _event,
      rawArgs: AioAdeProfileOrgInviteRevokeArgs
    ): Promise<AioAdeProfileOrgMemberMutationResult> =>
      revokeAioAdeProfileOrgInvite(
        getProfileUserDataPath(),
        orgInviteRevokeArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'aioAdeProfiles:orgMemberChangeRole',
    async (
      _event,
      rawArgs: AioAdeProfileOrgMemberChangeRoleArgs
    ): Promise<AioAdeProfileOrgMemberMutationResult> =>
      changeAioAdeProfileOrgMemberRole(
        getProfileUserDataPath(),
        orgMemberChangeRoleArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'aioAdeProfiles:orgMemberRemove',
    async (
      _event,
      rawArgs: AioAdeProfileOrgMemberRemoveArgs
    ): Promise<AioAdeProfileOrgMemberMutationResult> =>
      removeAioAdeProfileOrgMember(
        getProfileUserDataPath(),
        orgMemberRemoveArgsFromUnknown(rawArgs)
      )
  )
}
