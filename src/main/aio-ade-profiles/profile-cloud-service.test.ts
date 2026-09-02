import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  AioAdeCloudCapabilities,
  AioAdeCloudOrgSummary,
  AioAdeProfileCloudSummary
} from '../../shared/aio-ade-profiles'
import type { AioAdeCloudSessionExchangeResponse } from './profile-cloud-session-exchange'

const {
  beginAioAdeCloudPkceFlowMock,
  createAioAdeCloudProfileMock,
  exchangeAioAdeCloudAuthCodeMock,
  revokeAioAdeCloudSessionMock,
  selectAioAdeCloudOrgMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginAioAdeCloudPkceFlowMock: vi.fn(),
  createAioAdeCloudProfileMock: vi.fn(),
  exchangeAioAdeCloudAuthCodeMock: vi.fn(),
  revokeAioAdeCloudSessionMock: vi.fn(),
  selectAioAdeCloudOrgMock: vi.fn(),
  safeStorageMock: {
    decryptString: vi.fn((value: Buffer) => value.toString('utf-8')),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf-8')),
    isEncryptionAvailable: vi.fn(() => true)
  }
}))

let userDataPath = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataPath
  },
  safeStorage: safeStorageMock
}))

vi.mock('./profile-cloud-pkce', () => ({
  beginAioAdeCloudPkceFlow: beginAioAdeCloudPkceFlowMock
}))

vi.mock('./profile-cloud-client', () => ({
  createAioAdeCloudProfile: createAioAdeCloudProfileMock,
  exchangeAioAdeCloudAuthCode: exchangeAioAdeCloudAuthCodeMock,
  revokeAioAdeCloudSession: revokeAioAdeCloudSessionMock,
  selectAioAdeCloudOrg: selectAioAdeCloudOrgMock
}))

import {
  connectCurrentAioAdeProfile,
  createCloudLinkedAioAdeProfile,
  getCurrentAioAdeProfileAuthStatus,
  selectCurrentAioAdeProfileOrg,
  signOutCurrentAioAdeProfile
} from './profile-cloud-service'

const cloudSummary: AioAdeProfileCloudSummary = {
  cloudProfileId: 'cloud-profile-1',
  userId: 'user-1',
  email: 'nina@example.com',
  displayName: 'Nina',
  linkedAt: 10
}

const capabilities: AioAdeCloudCapabilities = {
  flags: { share: true },
  refreshedAt: 11
}

const organizations: AioAdeCloudOrgSummary[] = [
  { orgId: 'org-1', name: 'Acme', role: 'Admin' },
  { orgId: 'org-2', name: 'Personal' }
]

function configureCloudEnv(): void {
  vi.stubEnv('AIO_ADE_CLOUD_API_URL', 'https://aio-ade-cloud.example')
  vi.stubEnv('AIO_ADE_CLOUD_CLIENT_ID', 'desktop-client')
}

function futureExpiresAt(): number {
  return Date.now() + 3_600_000
}

function mockSuccessfulConnect(expiresAt = futureExpiresAt()): void {
  beginAioAdeCloudPkceFlowMock.mockResolvedValue({
    code: 'auth-code',
    codeVerifier: 'code-verifier',
    nonce: 'nonce',
    redirectUri: 'http://127.0.0.1:4100/auth/callback',
    state: 'state'
  })
  exchangeAioAdeCloudAuthCodeMock.mockResolvedValue({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt,
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies AioAdeCloudSessionExchangeResponse)
}

describe('AIO-ADE cloud profile service', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'aio-ade-cloud-service-'))
    beginAioAdeCloudPkceFlowMock.mockReset()
    createAioAdeCloudProfileMock.mockReset()
    exchangeAioAdeCloudAuthCodeMock.mockReset()
    revokeAioAdeCloudSessionMock.mockReset()
    selectAioAdeCloudOrgMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    revokeAioAdeCloudSessionMock.mockResolvedValue(undefined)
    vi.unstubAllEnvs()
    vi.stubEnv('AIO_ADE_CLOUD_API_URL', '')
    vi.stubEnv('AIO_ADE_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('reports local unconfigured auth without cloud setup', () => {
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath)).toMatchObject({
      activeProfileId: 'local-default',
      configured: false,
      state: 'unconfigured',
      persistence: 'none'
    })
  })

  it('connects the active local profile without replacing its local profile ID', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()

    const result = await connectCurrentAioAdeProfile(userDataPath)

    if (result.status !== 'connected') {
      throw new Error(`Expected connected result, got ${result.status}`)
    }
    expect(result.activeProfileId).toBe('local-default')
    expect(result.profiles[0]).toMatchObject({
      id: 'local-default',
      kind: 'cloud-linked',
      cloud: cloudSummary
    })
    expect(exchangeAioAdeCloudAuthCodeMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ localProfileId: 'local-default', nonce: 'nonce' })
    )
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'connected',
      persistence: 'encrypted',
      cloud: cloudSummary,
      organizations,
      capabilities
    })
  })

  it('treats provider-denied sign-in as a cancelled connect attempt', async () => {
    configureCloudEnv()
    beginAioAdeCloudPkceFlowMock.mockRejectedValue(new Error('aio_ade_cloud_auth_denied'))

    const result = await connectCurrentAioAdeProfile(userDataPath)

    expect(result.status).toBe('cancelled')
    expect(exchangeAioAdeCloudAuthCodeMock).not.toHaveBeenCalled()
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'local',
      persistence: 'none'
    })
  })

  it('does not report a saved cloud session as connected when cloud config is unavailable', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentAioAdeProfile(userDataPath)
    vi.stubEnv('AIO_ADE_CLOUD_API_URL', '')
    vi.stubEnv('AIO_ADE_CLOUD_CLIENT_ID', '')

    expect(getCurrentAioAdeProfileAuthStatus(userDataPath)).toMatchObject({
      configured: false,
      state: 'unconfigured',
      persistence: 'encrypted',
      cloud: cloudSummary,
      setupMessage: 'AIO-ADE Cloud sign-in is not configured for this build.'
    })
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath).organizations).toBeUndefined()
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath).capabilities).toBeUndefined()
  })

  it('signs out by removing cloud metadata while keeping the local profile', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentAioAdeProfile(userDataPath)

    const result = await signOutCurrentAioAdeProfile(userDataPath)

    expect(result.status).toBe('signed-out')
    expect(result.activeProfileId).toBe('local-default')
    expect(result.profiles[0]).toMatchObject({ id: 'local-default', kind: 'local' })
    expect(result.profiles[0]?.cloud).toBeUndefined()
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'local',
      persistence: 'none'
    })
    expect(revokeAioAdeCloudSessionMock).toHaveBeenCalledOnce()
  })

  it('creates a new empty cloud-linked profile with its own cloud session', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentAioAdeProfile(userDataPath)
    createAioAdeCloudProfileMock.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: 1000,
      cloud: {
        ...cloudSummary,
        cloudProfileId: 'cloud-profile-2',
        activeOrgId: 'org-1',
        activeOrgName: 'Acme'
      },
      organizations,
      capabilities: { flags: { share: true, team: true }, refreshedAt: 13 }
    } satisfies AioAdeCloudSessionExchangeResponse)

    const result = await createCloudLinkedAioAdeProfile(userDataPath, {
      orgId: 'org-1',
      name: 'Acme'
    })

    if (result.status !== 'created') {
      throw new Error(`Expected created result, got ${result.status}`)
    }
    expect(result.profile).toMatchObject({
      id: expect.stringMatching(/^cloud-/),
      name: 'Acme',
      kind: 'cloud-linked',
      cloud: expect.objectContaining({ cloudProfileId: 'cloud-profile-2' })
    })
    expect(createAioAdeCloudProfileMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'access-token' }),
      { orgId: 'org-1', name: 'Acme' }
    )
  })

  it('selects an organization for a connected profile', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentAioAdeProfile(userDataPath)
    const orgCloudSummary = {
      ...cloudSummary,
      activeOrgId: 'org-1',
      activeOrgName: 'Acme'
    }
    selectAioAdeCloudOrgMock.mockResolvedValue({
      cloud: orgCloudSummary,
      organizations,
      capabilities: { flags: { share: true, sso: true }, refreshedAt: 12 }
    })

    const result = await selectCurrentAioAdeProfileOrg(userDataPath, 'org-1')

    expect(result.status).toBe('selected')
    expect(selectAioAdeCloudOrgMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'access-token' }),
      'org-1'
    )
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath).cloud).toMatchObject({
      activeOrgId: 'org-1',
      activeOrgName: 'Acme'
    })
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath).organizations).toEqual(organizations)
  })
})
