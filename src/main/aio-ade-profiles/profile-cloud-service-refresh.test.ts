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
  refreshAioAdeCloudCapabilitiesMock,
  refreshAioAdeCloudSessionMock,
  AioAdeCloudRequestErrorMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginAioAdeCloudPkceFlowMock: vi.fn(),
  createAioAdeCloudProfileMock: vi.fn(),
  exchangeAioAdeCloudAuthCodeMock: vi.fn(),
  refreshAioAdeCloudCapabilitiesMock: vi.fn(),
  refreshAioAdeCloudSessionMock: vi.fn(),
  AioAdeCloudRequestErrorMock: class AioAdeCloudRequestError extends Error {
    constructor(public readonly statusCode: number) {
      super(`aio_ade_cloud_request_failed_${statusCode}`)
      this.name = 'AioAdeCloudRequestError'
    }
  },
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
  AioAdeCloudRequestError: AioAdeCloudRequestErrorMock,
  createAioAdeCloudProfile: createAioAdeCloudProfileMock,
  exchangeAioAdeCloudAuthCode: exchangeAioAdeCloudAuthCodeMock,
  refreshAioAdeCloudCapabilities: refreshAioAdeCloudCapabilitiesMock,
  refreshAioAdeCloudSession: refreshAioAdeCloudSessionMock,
  revokeAioAdeCloudSession: vi.fn(),
  selectAioAdeCloudOrg: vi.fn()
}))

import {
  connectCurrentAioAdeProfile,
  createCloudLinkedAioAdeProfile,
  getCurrentAioAdeProfileAuthStatus,
  refreshCurrentAioAdeProfileAuth
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

function futureExpiresAt(): number {
  return Date.now() + 3_600_000
}

function configureCloudEnv(): void {
  vi.stubEnv('AIO_ADE_CLOUD_API_URL', 'https://aio-ade-cloud.example')
  vi.stubEnv('AIO_ADE_CLOUD_CLIENT_ID', 'desktop-client')
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

describe('AIO-ADE cloud profile service session refresh', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'aio-ade-cloud-service-refresh-'))
    beginAioAdeCloudPkceFlowMock.mockReset()
    createAioAdeCloudProfileMock.mockReset()
    exchangeAioAdeCloudAuthCodeMock.mockReset()
    refreshAioAdeCloudCapabilitiesMock.mockReset()
    refreshAioAdeCloudSessionMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    vi.unstubAllEnvs()
    vi.stubEnv('AIO_ADE_CLOUD_API_URL', '')
    vi.stubEnv('AIO_ADE_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('refreshes an expired access token before creating cloud profiles', async () => {
    configureCloudEnv()
    mockSuccessfulConnect(Date.now() - 1_000)
    await connectCurrentAioAdeProfile(userDataPath)
    refreshAioAdeCloudSessionMock.mockResolvedValue({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      expiresAt: futureExpiresAt(),
      cloud: cloudSummary,
      organizations,
      capabilities
    } satisfies AioAdeCloudSessionExchangeResponse)
    createAioAdeCloudProfileMock.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: futureExpiresAt(),
      cloud: {
        ...cloudSummary,
        cloudProfileId: 'cloud-profile-2',
        activeOrgId: 'org-1',
        activeOrgName: 'Acme'
      },
      organizations,
      capabilities
    } satisfies AioAdeCloudSessionExchangeResponse)

    const result = await createCloudLinkedAioAdeProfile(userDataPath, {
      orgId: 'org-1',
      name: 'Acme'
    })

    expect(result.status).toBe('created')
    expect(refreshAioAdeCloudSessionMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ refreshToken: 'refresh-token' })
    )
    expect(createAioAdeCloudProfileMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' }),
      { orgId: 'org-1', name: 'Acme' }
    )
  })

  it('refreshes capability flags for the connected profile', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentAioAdeProfile(userDataPath)
    refreshAioAdeCloudCapabilitiesMock.mockResolvedValue({
      capabilities: {
        flags: { share: false, team: true },
        refreshedAt: 25
      }
    })

    const result = await refreshCurrentAioAdeProfileAuth(userDataPath)

    expect(result.status).toBe('refreshed')
    expect(refreshAioAdeCloudCapabilitiesMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'access-token' })
    )
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath).capabilities).toEqual({
      flags: { share: false, team: true },
      refreshedAt: 25
    })
  })

  it('clears stale active org metadata when capability refresh returns no active org', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    exchangeAioAdeCloudAuthCodeMock.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: futureExpiresAt(),
      cloud: { ...cloudSummary, activeOrgId: 'org-1', activeOrgName: 'Acme' },
      organizations,
      capabilities
    } satisfies AioAdeCloudSessionExchangeResponse)
    await connectCurrentAioAdeProfile(userDataPath)
    refreshAioAdeCloudCapabilitiesMock.mockResolvedValue({
      cloud: cloudSummary,
      organizations: [],
      capabilities: {
        flags: { share: false },
        refreshedAt: 31
      }
    })

    const result = await refreshCurrentAioAdeProfileAuth(userDataPath)
    const status = getCurrentAioAdeProfileAuthStatus(userDataPath)

    expect(result.status).toBe('refreshed')
    expect(status.cloud?.activeOrgId).toBeUndefined()
    expect(status.cloud?.activeOrgName).toBeUndefined()
    expect(status.organizations).toEqual([])
    expect(status.capabilities).toEqual({
      flags: { share: false },
      refreshedAt: 31
    })
  })

  it('requires reconnect when an expired refresh token is rejected', async () => {
    configureCloudEnv()
    mockSuccessfulConnect(Date.now() - 1_000)
    await connectCurrentAioAdeProfile(userDataPath)
    refreshAioAdeCloudSessionMock.mockRejectedValue(new AioAdeCloudRequestErrorMock(401))

    const result = await refreshCurrentAioAdeProfileAuth(userDataPath)

    expect(result.status).toBe('reconnect-required')
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'reconnect-required',
      persistence: 'none',
      cloud: cloudSummary
    })
  })
})
