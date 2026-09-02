import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AioAdeOrgMembersRoster } from '../../shared/aio-ade-profiles'
import { AioAdeCloudRequestError } from './profile-cloud-client'

const {
  runWithFreshAioAdeCloudSessionMock,
  listAioAdeCloudOrgMembersMock,
  inviteAioAdeCloudOrgMemberMock,
  revokeAioAdeCloudOrgInviteMock,
  changeAioAdeCloudOrgMemberRoleMock,
  removeAioAdeCloudOrgMemberMock
} = vi.hoisted(() => ({
  runWithFreshAioAdeCloudSessionMock: vi.fn(),
  listAioAdeCloudOrgMembersMock: vi.fn(),
  inviteAioAdeCloudOrgMemberMock: vi.fn(),
  revokeAioAdeCloudOrgInviteMock: vi.fn(),
  changeAioAdeCloudOrgMemberRoleMock: vi.fn(),
  removeAioAdeCloudOrgMemberMock: vi.fn()
}))

let userDataPath = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataPath }
}))

vi.mock('./profile-cloud-session-refresh', () => ({
  runWithFreshAioAdeCloudSessionMock,
  runWithFreshAioAdeCloudSession: runWithFreshAioAdeCloudSessionMock
}))

vi.mock('./profile-cloud-org-members-client', () => ({
  listAioAdeCloudOrgMembers: listAioAdeCloudOrgMembersMock,
  inviteAioAdeCloudOrgMember: inviteAioAdeCloudOrgMemberMock,
  revokeAioAdeCloudOrgInvite: revokeAioAdeCloudOrgInviteMock,
  changeAioAdeCloudOrgMemberRole: changeAioAdeCloudOrgMemberRoleMock,
  removeAioAdeCloudOrgMember: removeAioAdeCloudOrgMemberMock
}))

import {
  changeAioAdeProfileOrgMemberRole,
  inviteAioAdeProfileOrgMember,
  listAioAdeProfileOrgMembers,
  removeAioAdeProfileOrgMember,
  revokeAioAdeProfileOrgInvite
} from './profile-cloud-org-members-service'

const fakeSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: Date.now() + 3_600_000,
  capabilities: { flags: {}, refreshedAt: 1 }
}

// Why: mirror the real contract — invoke the operation with a live session and
// surface its resolved value; business 4xx are returned by the operation as
// values, never thrown, so the session layer never sees them.
function runOperationDirectly(): void {
  runWithFreshAioAdeCloudSessionMock.mockImplementation(
    async (
      _config: unknown,
      _active: unknown,
      _path: unknown,
      op: (session: unknown) => unknown
    ) => ({
      status: 'ok',
      value: await op(fakeSession)
    })
  )
}

function configureCloudEnv(): void {
  vi.stubEnv('AIO_ADE_CLOUD_API_URL', 'https://aio-ade-cloud.example')
  vi.stubEnv('AIO_ADE_CLOUD_CLIENT_ID', 'desktop-client')
}

const roster: AioAdeOrgMembersRoster = {
  members: [{ userId: 'user-1', email: 'nina@example.com', role: 'owner' }],
  pendingInvites: [],
  viewerRole: 'owner',
  canManageMembers: true
}

describe('AIO-ADE cloud org members service (configured)', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'aio-ade-org-members-'))
    runWithFreshAioAdeCloudSessionMock.mockReset()
    listAioAdeCloudOrgMembersMock.mockReset()
    inviteAioAdeCloudOrgMemberMock.mockReset()
    revokeAioAdeCloudOrgInviteMock.mockReset()
    changeAioAdeCloudOrgMemberRoleMock.mockReset()
    removeAioAdeCloudOrgMemberMock.mockReset()
    vi.unstubAllEnvs()
    vi.stubEnv('AIO_ADE_CLOUD_DEV_AUTH', '')
    vi.stubEnv('AIO_ADE_CLOUD_API_URL', '')
    vi.stubEnv('AIO_ADE_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('reports unconfigured when cloud sign-in is not set up', async () => {
    await expect(listAioAdeProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'unconfigured'
    })
    expect(runWithFreshAioAdeCloudSessionMock).not.toHaveBeenCalled()
  })

  it('returns the roster from the client', async () => {
    configureCloudEnv()
    runOperationDirectly()
    listAioAdeCloudOrgMembersMock.mockResolvedValue(roster)

    await expect(listAioAdeProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'ok',
      roster
    })
    expect(listAioAdeCloudOrgMembersMock).toHaveBeenCalledWith(
      expect.any(Object),
      fakeSession,
      'org-1'
    )
  })

  it('maps a 409 already_member invite conflict', async () => {
    configureCloudEnv()
    runOperationDirectly()
    inviteAioAdeCloudOrgMemberMock.mockRejectedValue(
      new AioAdeCloudRequestError(409, 'already_member')
    )

    await expect(
      inviteAioAdeProfileOrgMember(userDataPath, {
        orgId: 'org-1',
        email: 'a@b.com',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'conflict', reason: 'already_member' })
  })

  it('maps a 403 role change to forbidden', async () => {
    configureCloudEnv()
    runOperationDirectly()
    changeAioAdeCloudOrgMemberRoleMock.mockRejectedValue(new AioAdeCloudRequestError(403))

    await expect(
      changeAioAdeProfileOrgMemberRole(userDataPath, {
        orgId: 'org-1',
        userId: 'user-2',
        role: 'admin'
      })
    ).resolves.toEqual({ status: 'forbidden' })
  })

  it('maps a 400 cannot_remove_self to an invalid result', async () => {
    configureCloudEnv()
    runOperationDirectly()
    removeAioAdeCloudOrgMemberMock.mockRejectedValue(
      new AioAdeCloudRequestError(400, 'cannot_remove_self')
    )

    await expect(
      removeAioAdeProfileOrgMember(userDataPath, { orgId: 'org-1', userId: 'user-1' })
    ).resolves.toEqual({ status: 'invalid', reason: 'cannot_remove_self' })
  })

  it('maps a 404 revoke to not-found', async () => {
    configureCloudEnv()
    runOperationDirectly()
    revokeAioAdeCloudOrgInviteMock.mockRejectedValue(new AioAdeCloudRequestError(404))

    await expect(
      revokeAioAdeProfileOrgInvite(userDataPath, { orgId: 'org-1', email: 'gone@b.com' })
    ).resolves.toEqual({ status: 'not-found' })
  })

  it('reports reconnect-required when the session layer cannot refresh', async () => {
    configureCloudEnv()
    runWithFreshAioAdeCloudSessionMock.mockResolvedValue({ status: 'reconnect-required' })

    await expect(listAioAdeProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'reconnect-required'
    })
  })
})

describe('AIO-ADE cloud org members service (dev auth)', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'aio-ade-org-members-dev-'))
    runWithFreshAioAdeCloudSessionMock.mockReset()
    vi.unstubAllEnvs()
    vi.stubEnv('AIO_ADE_CLOUD_DEV_AUTH', '1')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('serves an in-memory roster the caller can manage', async () => {
    const result = await listAioAdeProfileOrgMembers(userDataPath, 'dev-list-org')
    if (result.status !== 'ok') {
      throw new Error(`Expected ok, got ${result.status}`)
    }
    expect(result.roster.canManageMembers).toBe(true)
    expect(result.roster.viewerRole).toBe('owner')
    expect(result.roster.members[0]).toMatchObject({ role: 'owner' })
    expect(result.roster.members.some((member) => member.userId === null)).toBe(true)
    expect(result.roster.pendingInvites.length).toBeGreaterThan(0)
    expect(runWithFreshAioAdeCloudSessionMock).not.toHaveBeenCalled()
  })

  it('mutates the dev roster across invite and revoke', async () => {
    const orgId = 'dev-mutate-org'
    await expect(
      inviteAioAdeProfileOrgMember(userDataPath, {
        orgId,
        email: 'fresh@aio-ade.local',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'ok' })

    const afterInvite = await listAioAdeProfileOrgMembers(userDataPath, orgId)
    if (afterInvite.status !== 'ok') {
      throw new Error('expected ok')
    }
    expect(afterInvite.roster.pendingInvites.some((i) => i.email === 'fresh@aio-ade.local')).toBe(
      true
    )

    await expect(
      inviteAioAdeProfileOrgMember(userDataPath, {
        orgId,
        email: 'fresh@aio-ade.local',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'conflict', reason: 'already_invited' })

    await expect(
      revokeAioAdeProfileOrgInvite(userDataPath, { orgId, email: 'fresh@aio-ade.local' })
    ).resolves.toEqual({ status: 'ok' })
    await expect(
      revokeAioAdeProfileOrgInvite(userDataPath, { orgId, email: 'fresh@aio-ade.local' })
    ).resolves.toEqual({ status: 'not-found' })
  })

  it('blocks changing the dev owner (self) role', async () => {
    const orgId = 'dev-self-org'
    const list = await listAioAdeProfileOrgMembers(userDataPath, orgId)
    if (list.status !== 'ok') {
      throw new Error('expected ok')
    }
    const self = list.roster.members.find((member) => member.role === 'owner')
    await expect(
      changeAioAdeProfileOrgMemberRole(userDataPath, {
        orgId,
        userId: self?.userId ?? 'dev-user',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'invalid', reason: 'cannot_change_own_role' })
  })
})
