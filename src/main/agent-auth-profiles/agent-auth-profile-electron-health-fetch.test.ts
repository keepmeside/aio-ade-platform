import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agentAuthProfileElectronHealthFetch } from './agent-auth-profile-electron-health-fetch'

const { netFetchMock, ensureProxyMock, defaultSession } = vi.hoisted(() => ({
  netFetchMock: vi.fn(),
  ensureProxyMock: vi.fn(),
  defaultSession: {}
}))

vi.mock('electron', () => ({
  net: { fetch: netFetchMock },
  session: { defaultSession }
}))

vi.mock('../network/proxy-settings', () => ({
  ensureElectronProxyFromEnvironment: ensureProxyMock
}))

const PROBE_URL = 'https://api.example.com/v1/models'

function init(): { headers: Record<string, string>; signal: AbortSignal } {
  return { headers: { 'x-api-key': 'test-key' }, signal: new AbortController().signal }
}

describe('agentAuthProfileElectronHealthFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('applies the environment proxy before fetching and maps the response', async () => {
    ensureProxyMock.mockResolvedValue({ source: 'env' })
    netFetchMock.mockResolvedValue({ status: 200, ok: true })
    const request = init()

    const result = await agentAuthProfileElectronHealthFetch(PROBE_URL, request)

    expect(result).toEqual({ status: 200, ok: true })
    expect(ensureProxyMock).toHaveBeenCalledWith({
      proxySession: defaultSession,
      probeUrl: PROBE_URL
    })
    expect(netFetchMock).toHaveBeenCalledWith(PROBE_URL, request)
    expect(ensureProxyMock.mock.invocationCallOrder[0]).toBeLessThan(
      netFetchMock.mock.invocationCallOrder[0]
    )
  })

  it('still probes when the proxy cannot be applied', async () => {
    ensureProxyMock.mockRejectedValue(new Error('proxy unavailable'))
    netFetchMock.mockResolvedValue({ status: 401, ok: false })

    const result = await agentAuthProfileElectronHealthFetch(PROBE_URL, init())

    expect(result).toEqual({ status: 401, ok: false })
    expect(netFetchMock).toHaveBeenCalledTimes(1)
  })
})
