import { describe, expect, it, vi } from 'vitest'
import {
  allowsPlaintextAioAdeCloudSession,
  getAioAdeCloudAuthConfig,
  isAioAdeCloudDevAuthEnabled
} from './profile-cloud-auth-config'

vi.mock('electron', () => ({
  app: {
    isPackaged: false
  }
}))

describe('AIO-ADE cloud auth config', () => {
  it('reports unconfigured without both API URL and client ID', () => {
    expect(getAioAdeCloudAuthConfig({})).toEqual({
      configured: false,
      setupMessage: 'AIO-ADE Cloud sign-in is not configured for this build.'
    })
  })

  it('builds default desktop auth endpoints from the API URL', () => {
    const state = getAioAdeCloudAuthConfig({
      AIO_ADE_CLOUD_API_URL: 'https://aio-ade-cloud.example/',
      AIO_ADE_CLOUD_CLIENT_ID: 'desktop-client'
    })

    expect(state).toEqual({
      configured: true,
      config: {
        apiBaseUrl: 'https://aio-ade-cloud.example',
        authorizeEndpoint: 'https://aio-ade-cloud.example/v1/desktop/auth/authorize',
        sessionEndpoint: 'https://aio-ade-cloud.example/v1/desktop/auth/session',
        refreshEndpoint: 'https://aio-ade-cloud.example/v1/desktop/auth/refresh',
        capabilitiesEndpoint: 'https://aio-ade-cloud.example/v1/desktop/auth/capabilities',
        profileEndpoint: 'https://aio-ade-cloud.example/v1/desktop/auth/profile',
        orgEndpoint: 'https://aio-ade-cloud.example/v1/desktop/auth/org',
        logoutEndpoint: 'https://aio-ade-cloud.example/v1/desktop/auth/logout',
        relayTokenEndpoint: 'https://aio-ade-cloud.example/v1/desktop/auth/relay-token',
        relayDirectorUrl: 'https://relay.aio-ade.keepmeside.dev',
        clientId: 'desktop-client',
        scope: 'openid profile email offline_access'
      }
    })
  })

  it('uses first-party production endpoints without runtime env in packaged builds', () => {
    expect(getAioAdeCloudAuthConfig({}, true)).toEqual({
      configured: true,
      config: {
        apiBaseUrl: 'https://login.aio-ade.keepmeside.dev',
        authorizeEndpoint: 'https://login.aio-ade.keepmeside.dev/v1/desktop/auth/authorize',
        sessionEndpoint: 'https://login.aio-ade.keepmeside.dev/v1/desktop/auth/session',
        refreshEndpoint: 'https://login.aio-ade.keepmeside.dev/v1/desktop/auth/refresh',
        capabilitiesEndpoint: 'https://login.aio-ade.keepmeside.dev/v1/desktop/auth/capabilities',
        profileEndpoint: 'https://login.aio-ade.keepmeside.dev/v1/desktop/auth/profile',
        orgEndpoint: 'https://login.aio-ade.keepmeside.dev/v1/desktop/auth/org',
        logoutEndpoint: 'https://login.aio-ade.keepmeside.dev/v1/desktop/auth/logout',
        relayTokenEndpoint: 'https://login.aio-ade.keepmeside.dev/v1/desktop/auth/relay-token',
        relayDirectorUrl: 'https://relay.aio-ade.keepmeside.dev',
        clientId: 'aio-ade-desktop',
        scope: 'openid profile email offline_access'
      }
    })
  })

  it('allows loopback HTTP endpoints for local desktop auth development', () => {
    const state = getAioAdeCloudAuthConfig({
      AIO_ADE_CLOUD_API_URL: 'http://localhost:4100',
      AIO_ADE_CLOUD_CLIENT_ID: 'desktop-client'
    })

    expect(state.configured).toBe(true)
  })

  it('rejects loopback HTTP endpoints in packaged builds', () => {
    expect(
      getAioAdeCloudAuthConfig(
        {
          AIO_ADE_CLOUD_API_URL: 'http://localhost:4100',
          AIO_ADE_CLOUD_CLIENT_ID: 'desktop-client'
        },
        true
      )
    ).toMatchObject({ configured: false })

    const httpsState = getAioAdeCloudAuthConfig(
      {
        AIO_ADE_CLOUD_API_URL: 'https://aio-ade-cloud.example',
        AIO_ADE_CLOUD_CLIENT_ID: 'desktop-client'
      },
      true
    )
    expect(httpsState.configured).toBe(true)
  })

  it('rejects non-HTTPS non-loopback API URLs', () => {
    expect(
      getAioAdeCloudAuthConfig({
        AIO_ADE_CLOUD_API_URL: 'http://aio-ade-cloud.example',
        AIO_ADE_CLOUD_CLIENT_ID: 'desktop-client'
      })
    ).toMatchObject({ configured: false })
  })

  it('allows dev plaintext sessions only outside production', () => {
    expect(
      allowsPlaintextAioAdeCloudSession({
        AIO_ADE_CLOUD_ALLOW_PLAINTEXT_SESSION: '1',
        NODE_ENV: 'development'
      })
    ).toBe(true)
    expect(
      allowsPlaintextAioAdeCloudSession({
        AIO_ADE_CLOUD_ALLOW_PLAINTEXT_SESSION: '1',
        NODE_ENV: 'production'
      })
    ).toBe(false)
  })

  it('ignores dev flags in packaged builds even without NODE_ENV', () => {
    // Why: packaged main bundles never define NODE_ENV, so packaged-ness must
    // gate the escape hatches on its own.
    expect(
      allowsPlaintextAioAdeCloudSession({ AIO_ADE_CLOUD_ALLOW_PLAINTEXT_SESSION: '1' }, true)
    ).toBe(false)
    expect(isAioAdeCloudDevAuthEnabled({ AIO_ADE_CLOUD_DEV_AUTH: '1' }, true)).toBe(false)
  })

  it('allows local dev auth only outside production', () => {
    expect(
      isAioAdeCloudDevAuthEnabled({
        AIO_ADE_CLOUD_DEV_AUTH: '1',
        NODE_ENV: 'development'
      })
    ).toBe(true)
    expect(
      isAioAdeCloudDevAuthEnabled({
        AIO_ADE_CLOUD_DEV_AUTH: '1',
        NODE_ENV: 'production'
      })
    ).toBe(false)
  })
})
