import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock, networkInterfacesMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  networkInterfacesMock: vi.fn()
}))

vi.mock('electron', () => ({ ipcMain: { handle: handleMock } }))
vi.mock('os', () => ({ networkInterfaces: networkInterfacesMock }))

import { registerRuntimePairingHandlers } from './runtime-pairing'

describe('registerRuntimePairingHandlers', () => {
  const handlers = new Map<string, (...args: never[]) => unknown>()

  beforeEach(() => {
    handlers.clear()
    handleMock.mockReset()
    networkInterfacesMock.mockReset().mockReturnValue({})
    handleMock.mockImplementation((channel: string, handler: (...args: never[]) => unknown) => {
      handlers.set(channel, handler)
    })
  })

  it('prefers tailnet addresses and excludes proxy or link-local addresses', () => {
    networkInterfacesMock.mockReturnValue({
      proxy: [{ family: 'IPv4', internal: false, address: '198.18.0.1' }],
      lan: [
        { family: 'IPv4', internal: false, address: '192.168.1.24' },
        { family: 'IPv6', internal: false, address: 'fe80::1' },
        { family: 'IPv6', internal: false, address: '2605:340::1' }
      ],
      tailscale: [{ family: 'IPv4', internal: false, address: '100.64.1.20' }]
    })

    registerRuntimePairingHandlers({} as never)

    expect(handlers.get('runtime:listNetworkInterfaces')?.()).toEqual({
      interfaces: [
        { name: 'tailscale', address: '100.64.1.20' },
        { name: 'lan', address: '192.168.1.24' },
        { name: 'lan', address: '2605:340::1' }
      ]
    })
  })

  it('creates only runtime-scoped direct pairing offers', () => {
    const createPairingOffer = vi.fn().mockReturnValue({
      available: true,
      pairingUrl: 'orca://pair#runtime',
      webClientUrl: 'http://100.64.1.20:6768/web-index.html#pairing=runtime',
      endpoint: 'ws://100.64.1.20:6768',
      deviceId: 'runtime-1'
    })
    registerRuntimePairingHandlers({ createPairingOffer } as never)

    expect(
      handlers.get('runtime:getPairingUrl')?.(null as never, {
        address: '100.64.1.20',
        rotate: true
      } as never)
    ).toEqual(expect.objectContaining({ available: true, deviceId: 'runtime-1' }))
    expect(createPairingOffer).toHaveBeenCalledWith({
      address: '100.64.1.20',
      rotate: true,
      name: expect.stringMatching(/^Runtime /),
      scope: 'runtime'
    })
  })

  it('lists and revokes runtime access grants', () => {
    const revokeRuntimeAccess = vi.fn().mockReturnValue(true)
    const rpcServer = {
      getDeviceRegistry: () => ({
        listDevices: () => [
          { deviceId: 'old', name: 'Old', scope: 'runtime', pairedAt: 1, lastSeenAt: 2 },
          { deviceId: 'new', name: 'New', scope: 'runtime', pairedAt: 3, lastSeenAt: 0 },
          { deviceId: 'phone', name: 'Phone', scope: 'mobile', pairedAt: 4, lastSeenAt: 5 }
        ]
      }),
      revokeRuntimeAccess
    }
    registerRuntimePairingHandlers(rpcServer as never)

    expect(handlers.get('runtime:listAccessGrants')?.()).toEqual({
      grants: [
        { deviceId: 'new', name: 'New', createdAt: 3, lastSeenAt: null },
        { deviceId: 'old', name: 'Old', createdAt: 1, lastSeenAt: 2 }
      ]
    })
    expect(
      handlers.get('runtime:revokeAccess')?.(null as never, { deviceId: 'new' } as never)
    ).toEqual({ revoked: true })
  })

  it('reports WebSocket readiness', () => {
    registerRuntimePairingHandlers({
      getWebSocketEndpoint: () => 'ws://0.0.0.0:6768'
    } as never)

    expect(handlers.get('runtime:isWebSocketReady')?.()).toEqual({
      ready: true,
      endpoint: 'ws://0.0.0.0:6768'
    })
  })

  it('consumes auth failures only for the window renderer', () => {
    const consumePendingAuthFailure = vi.fn(() => true)
    registerRuntimePairingHandlers({} as never, { consumePendingAuthFailure })
    const invoke = handlers.get('runtime:consumeAuthFailure')!

    expect(
      invoke({ sender: { id: 42, isDestroyed: () => false, getType: () => 'window' } } as never)
    ).toBe(true)
    expect(
      invoke({ sender: { id: 99, isDestroyed: () => false, getType: () => 'webview' } } as never)
    ).toBe(false)
    expect(consumePendingAuthFailure).toHaveBeenCalledOnce()
  })
})
