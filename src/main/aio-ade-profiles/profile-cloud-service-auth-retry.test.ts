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
  selectAioAdeCloudOrgMock,
  AioAdeCloudRequestErrorMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginAioAdeCloudPkceFlowMock: vi.fn(),
  createAioAdeCloudProfileMock: vi.fn(),
  exchangeAioAdeCloudAuthCodeMock: vi.fn(),
  refreshAioAdeCloudCapabilitiesMock: vi.fn(),
  refreshAioAdeCloudSessionMock: vi.fn(),
  selectAioAdeCloudOrgMock: vi.fn(),
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
  selectAioAdeCloudOrg: selectAioAdeCloudOrgMock
}))

import {
  connectCurrentAioAdeProfile,
  createCloudLinkedAioAdeProfile,
  getCurrentAioAdeProfileAuthStatus,
  refreshCurrentAioAdeProfileAuth,
  selectCurrentAioAdeProfileOrg
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

function mockSuccessfulConnect(): void {
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
    expiresAt: futureExpiresAt(),
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies AioAdeCloudSessionExchangeResponse)
}

function mockSuccessfulSessionRefresh(): void {
  refreshAioAdeCloudSessionMock.mockResolvedValue({
    accessToken: 'rotated-access-token',
    refreshToken: 'rotated-refresh-token',
    expiresAt: futureExpiresAt(),
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies AioAdeCloudSessionExchangeResponse)
}

describe('AIO-ADE cloud profile auth-failure retry', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'aio-ade-cloud-service-auth-retry-'))
    beginAioAdeCloudPkceFlowMock.mockReset()
    createAioAdeCloudProfileMock.mockReset()
    exchangeAioAdeCloudAuthCodeMock.mockReset()
    refreshAioAdeCloudCapabilitiesMock.mockReset()
    refreshAioAdeCloudSessionMock.mockReset()
    selectAioAdeCloudOrgMock.mockReset()
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

  it('refreshes and retries cloud profile creation after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentAioAdeProfile(userDataPath)
    createAioAdeCloudProfileMock
      .mockRejectedValueOnce(new AioAdeCloudRequestErrorMock(401))
      .mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: futureExpiresAt(),
        cloud: { ...cloudSummary, cloudProfileId: 'cloud-profile-2' },
        organizations,
        capabilities
      } satisfies AioAdeCloudSessionExchangeResponse)

    const result = await createCloudLinkedAioAdeProfile(userDataPath, { name: 'Acme' })

    expect(result.status).toBe('created')
    expect(createAioAdeCloudProfileMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' }),
      { name: 'Acme' }
    )
  })

  it('refreshes and retries capability refresh after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentAioAdeProfile(userDataPath)
    refreshAioAdeCloudCapabilitiesMock
      .mockRejectedValueOnce(new AioAdeCloudRequestErrorMock(403))
      .mockResolvedValue({
        capabilities: { flags: { share: false }, refreshedAt: 26 } satisfies AioAdeCloudCapabilities
      })

    const result = await refreshCurrentAioAdeProfileAuth(userDataPath)

    expect(result.status).toBe('refreshed')
    expect(refreshAioAdeCloudCapabilitiesMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' })
    )
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath).capabilities).toEqual({
      flags: { share: false },
      refreshedAt: 26
    })
  })

  it('requires reconnect when a retried capability refresh is still unauthorized', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentAioAdeProfile(userDataPath)
    refreshAioAdeCloudCapabilitiesMock
      .mockRejectedValueOnce(new AioAdeCloudRequestErrorMock(401))
      .mockRejectedValueOnce(new AioAdeCloudRequestErrorMock(401))

    const result = await refreshCurrentAioAdeProfileAuth(userDataPath)

    expect(result.status).toBe('reconnect-required')
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'reconnect-required',
      persistence: 'none',
      cloud: cloudSummary
    })
  })

  it('refreshes and retries organization selection after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentAioAdeProfile(userDataPath)
    selectAioAdeCloudOrgMock
      .mockRejectedValueOnce(new AioAdeCloudRequestErrorMock(401))
      .mockResolvedValue({
        cloud: { ...cloudSummary, activeOrgId: 'org-1', activeOrgName: 'Acme' },
        organizations,
        capabilities
      })

    const result = await selectCurrentAioAdeProfileOrg(userDataPath, 'org-1')

    expect(result.status).toBe('selected')
    expect(selectAioAdeCloudOrgMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' }),
      'org-1'
    )
  })
})
