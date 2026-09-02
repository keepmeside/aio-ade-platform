import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  listAioAdeProfileOrgMembersMock,
  inviteAioAdeProfileOrgMemberMock,
  revokeAioAdeProfileOrgInviteMock,
  changeAioAdeProfileOrgMemberRoleMock,
  removeAioAdeProfileOrgMemberMock
} = vi.hoisted(() => ({
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
  listAioAdeProfileOrgMembersMock: vi.fn(),
  inviteAioAdeProfileOrgMemberMock: vi.fn(),
  revokeAioAdeProfileOrgInviteMock: vi.fn(),
  changeAioAdeProfileOrgMemberRoleMock: vi.fn(),
  removeAioAdeProfileOrgMemberMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../aio-ade-profiles/profile-storage-paths', () => ({
  getProfileUserDataPath: () => '/tmp/aio-ade-user-data'
}))

vi.mock('../aio-ade-profiles/profile-cloud-org-members-service', () => ({
  listAioAdeProfileOrgMembers: listAioAdeProfileOrgMembersMock,
  inviteAioAdeProfileOrgMember: inviteAioAdeProfileOrgMemberMock,
  revokeAioAdeProfileOrgInvite: revokeAioAdeProfileOrgInviteMock,
  changeAioAdeProfileOrgMemberRole: changeAioAdeProfileOrgMemberRoleMock,
  removeAioAdeProfileOrgMember: removeAioAdeProfileOrgMemberMock
}))

import { registerAioAdeProfileOrgMemberHandlers } from './aio-ade-profile-org-members-handlers'

function invoke(channel: string, args?: unknown): unknown {
  const handler = handlers.get(channel)
  if (!handler) {
    throw new Error(`No handler for ${channel}`)
  }
  return handler({}, args)
}

describe('registerAioAdeProfileOrgMemberHandlers', () => {
  beforeEach(() => {
    handlers.clear()
    listAioAdeProfileOrgMembersMock.mockReset().mockResolvedValue({ status: 'ok', roster: {} })
    inviteAioAdeProfileOrgMemberMock.mockReset().mockResolvedValue({ status: 'ok' })
    revokeAioAdeProfileOrgInviteMock.mockReset().mockResolvedValue({ status: 'ok' })
    changeAioAdeProfileOrgMemberRoleMock.mockReset().mockResolvedValue({ status: 'ok' })
    removeAioAdeProfileOrgMemberMock.mockReset().mockResolvedValue({ status: 'ok' })
    registerAioAdeProfileOrgMemberHandlers()
  })

  it('registers all five org-member channels', () => {
    expect([...handlers.keys()].sort()).toEqual(
      [
        'aioAdeProfiles:orgInviteRevoke',
        'aioAdeProfiles:orgMemberChangeRole',
        'aioAdeProfiles:orgMemberInvite',
        'aioAdeProfiles:orgMemberRemove',
        'aioAdeProfiles:orgMembersList'
      ].sort()
    )
  })

  it('forwards a valid invite to the service with a trimmed email', async () => {
    await invoke('aioAdeProfiles:orgMemberInvite', {
      orgId: 'org-1',
      email: '  new@example.com  ',
      role: 'admin'
    })
    expect(inviteAioAdeProfileOrgMemberMock).toHaveBeenCalledWith('/tmp/aio-ade-user-data', {
      orgId: 'org-1',
      email: 'new@example.com',
      role: 'admin'
    })
  })

  it('rejects an invite with a missing org id', async () => {
    await expect(
      invoke('aioAdeProfiles:orgMemberInvite', { email: 'a@b.com', role: 'member' })
    ).rejects.toThrow('invalid_aio_ade_profile_org_selection')
    expect(inviteAioAdeProfileOrgMemberMock).not.toHaveBeenCalled()
  })

  it('rejects an invite with an unknown role', async () => {
    await expect(
      invoke('aioAdeProfiles:orgMemberInvite', { orgId: 'org-1', email: 'a@b.com', role: 'root' })
    ).rejects.toThrow('invalid_aio_ade_org_role')
  })

  it('rejects a role change with a blank user id', async () => {
    await expect(
      invoke('aioAdeProfiles:orgMemberChangeRole', { orgId: 'org-1', userId: '  ', role: 'admin' })
    ).rejects.toThrow('invalid_aio_ade_org_member_user')
  })

  it('forwards remove and revoke with validated args', async () => {
    await invoke('aioAdeProfiles:orgMemberRemove', { orgId: 'org-1', userId: 'user-2' })
    expect(removeAioAdeProfileOrgMemberMock).toHaveBeenCalledWith('/tmp/aio-ade-user-data', {
      orgId: 'org-1',
      userId: 'user-2'
    })
    await invoke('aioAdeProfiles:orgInviteRevoke', { orgId: 'org-1', email: 'gone@b.com' })
    expect(revokeAioAdeProfileOrgInviteMock).toHaveBeenCalledWith('/tmp/aio-ade-user-data', {
      orgId: 'org-1',
      email: 'gone@b.com'
    })
  })
})
