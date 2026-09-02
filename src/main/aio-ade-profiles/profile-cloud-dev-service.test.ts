import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const {
  beginAioAdeCloudPkceFlowMock,
  exchangeAioAdeCloudAuthCodeMock,
  revokeAioAdeCloudSessionMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginAioAdeCloudPkceFlowMock: vi.fn(),
  exchangeAioAdeCloudAuthCodeMock: vi.fn(),
  revokeAioAdeCloudSessionMock: vi.fn(),
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
  createAioAdeCloudProfile: vi.fn(),
  exchangeAioAdeCloudAuthCode: exchangeAioAdeCloudAuthCodeMock,
  refreshAioAdeCloudCapabilities: vi.fn(),
  refreshAioAdeCloudSession: vi.fn(),
  revokeAioAdeCloudSession: revokeAioAdeCloudSessionMock,
  selectAioAdeCloudOrg: vi.fn()
}))

import {
  connectCurrentAioAdeProfile,
  createCloudLinkedAioAdeProfile,
  getCurrentAioAdeProfileAuthStatus,
  selectCurrentAioAdeProfileOrg,
  signOutCurrentAioAdeProfile
} from './profile-cloud-service'

describe('AIO-ADE cloud dev auth service', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'aio-ade-cloud-dev-auth-'))
    beginAioAdeCloudPkceFlowMock.mockReset()
    exchangeAioAdeCloudAuthCodeMock.mockReset()
    revokeAioAdeCloudSessionMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    vi.unstubAllEnvs()
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('AIO_ADE_CLOUD_DEV_AUTH', '1')
    vi.stubEnv('AIO_ADE_CLOUD_API_URL', '')
    vi.stubEnv('AIO_ADE_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('connects the active profile without PKCE or cloud endpoints', async () => {
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'local'
    })

    const result = await connectCurrentAioAdeProfile(userDataPath)

    expect(result.status).toBe('connected')
    expect(beginAioAdeCloudPkceFlowMock).not.toHaveBeenCalled()
    expect(exchangeAioAdeCloudAuthCodeMock).not.toHaveBeenCalled()
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'connected',
      persistence: 'encrypted',
      cloud: {
        cloudProfileId: 'dev-cloud-local-default',
        email: 'dev@aio-ade.local'
      },
      capabilities: {
        flags: expect.objectContaining({ 'share.create': true })
      }
    })
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath).organizations).toHaveLength(2)
  })

  it('selects dev organizations and creates org-scoped cloud profiles locally', async () => {
    await connectCurrentAioAdeProfile(userDataPath)

    const selected = await selectCurrentAioAdeProfileOrg(userDataPath, 'dev-acme')
    const created = await createCloudLinkedAioAdeProfile(userDataPath, {
      orgId: 'dev-acme',
      name: 'Acme Dev'
    })

    expect(selected.status).toBe('selected')
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath).cloud).toMatchObject({
      activeOrgId: 'dev-acme',
      activeOrgName: 'Acme Dev'
    })
    expect(created.status).toBe('created')
    if (created.status === 'created') {
      expect(created.profile).toMatchObject({
        name: 'Acme Dev',
        kind: 'cloud-linked',
        cloud: expect.objectContaining({
          activeOrgId: 'dev-acme',
          activeOrgName: 'Acme Dev'
        })
      })
    }
  })

  it('signs out locally without calling the cloud logout endpoint', async () => {
    await connectCurrentAioAdeProfile(userDataPath)

    const result = await signOutCurrentAioAdeProfile(userDataPath)

    expect(result.status).toBe('signed-out')
    expect(revokeAioAdeCloudSessionMock).not.toHaveBeenCalled()
    expect(getCurrentAioAdeProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'local',
      persistence: 'none'
    })
  })
})
