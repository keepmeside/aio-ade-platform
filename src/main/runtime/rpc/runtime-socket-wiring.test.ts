import { describe, expect, it, vi } from 'vitest'
import type { WebSocket } from 'ws'
import type { DeviceRegistry } from '../device-registry'
import { deriveSharedKey, encrypt, generateKeyPair } from './e2ee-crypto'
import { RuntimeSocketWiring, type RuntimeSocketTransport } from './runtime-socket-wiring'

class FakeSocket {
  readonly OPEN = 1
  readyState = this.OPEN
  bufferedAmount = 0
  readonly sent: (string | Buffer)[] = []
  readonly send = vi.fn((data: string | Buffer) => this.sent.push(data))
  readonly close = vi.fn()
}

class FakeTransport implements RuntimeSocketTransport {
  private messageHandler: Parameters<RuntimeSocketTransport['onMessage']>[0] | null = null
  private closeHandler: Parameters<RuntimeSocketTransport['onConnectionClose']>[0] | null = null
  readonly setClientId = vi.fn()
  readonly terminateClientConnections = vi.fn(() => 0)

  onMessage(handler: Parameters<RuntimeSocketTransport['onMessage']>[0]): void {
    this.messageHandler = handler
  }

  onConnectionClose(handler: Parameters<RuntimeSocketTransport['onConnectionClose']>[0]): void {
    this.closeHandler = handler
  }

  receive(ws: FakeSocket, message: string): void {
    this.messageHandler?.(message, vi.fn(), ws as unknown as WebSocket)
  }

  disconnect(ws: FakeSocket): void {
    this.closeHandler?.(null, ws as unknown as WebSocket, false)
  }
}

function registryFor(
  deviceId: string,
  token: string,
  scope: 'mobile' | 'runtime' = 'mobile'
): DeviceRegistry {
  return {
    validateToken: (candidate: string) =>
      candidate === token
        ? {
            deviceId,
            token,
            name: 'Phone',
            scope,
            pairedAt: 1,
            lastSeenAt: 0
          }
        : null,
    updateLastSeen: vi.fn()
  } as unknown as DeviceRegistry
}

describe('RuntimeSocketWiring', () => {
  it('terminates a revoked device across every attached transport', () => {
    const direct = new FakeTransport()
    const relay = new FakeTransport()
    direct.terminateClientConnections.mockReturnValue(1)
    relay.terminateClientConnections.mockReturnValue(2)
    const desktop = generateKeyPair()
    const wiring = new RuntimeSocketWiring({
      deviceRegistry: registryFor('device-1', 'valid-token'),
      e2eeKeypair: {
        publicKey: desktop.publicKey,
        secretKey: desktop.secretKey,
        publicKeyB64: Buffer.from(desktop.publicKey).toString('base64')
      },
      onText: vi.fn(),
      onBinary: vi.fn(),
      onClose: vi.fn()
    })
    const detachDirect = wiring.attachTransport(direct)
    wiring.attachTransport(relay)

    expect(wiring.terminateDeviceConnections('valid-token')).toBe(3)
    expect(direct.terminateClientConnections).toHaveBeenCalledWith('valid-token')
    expect(relay.terminateClientConnections).toHaveBeenCalledWith('valid-token')

    detachDirect()
    direct.terminateClientConnections.mockClear()
    relay.terminateClientConnections.mockClear()
    expect(wiring.terminateDeviceConnections('valid-token')).toBe(2)
    expect(direct.terminateClientConnections).not.toHaveBeenCalled()
    expect(relay.terminateClientConnections).toHaveBeenCalledWith('valid-token')
  })

  it('releases detached transports from revocation fanout under origin churn', () => {
    const desktop = generateKeyPair()
    const wiring = new RuntimeSocketWiring({
      deviceRegistry: registryFor('device-1', 'valid-token'),
      e2eeKeypair: {
        publicKey: desktop.publicKey,
        secretKey: desktop.secretKey,
        publicKeyB64: Buffer.from(desktop.publicKey).toString('base64')
      },
      onText: vi.fn(),
      onBinary: vi.fn(),
      onClose: vi.fn()
    })
    const live = new FakeTransport()
    wiring.attachTransport(live)
    const retired = Array.from({ length: 1_000 }, () => new FakeTransport())

    for (const transport of retired) {
      const detach = wiring.attachTransport(transport)
      detach()
      detach()
    }

    expect(wiring['transports'].size).toBe(1)
    expect(wiring.terminateDeviceConnections('valid-token')).toBe(0)
    expect(live.terminateClientConnections).toHaveBeenCalledOnce()
    expect(
      retired.every((transport) => transport.terminateClientConnections.mock.calls.length === 0)
    ).toBe(true)
  })

  it('preserves the legacy direct handshake, identity, and close cleanup', () => {
    const desktop = generateKeyPair()
    const phone = generateKeyPair()
    const ws = new FakeSocket()
    const transport = new FakeTransport()
    const onText = vi.fn()
    const onClose = vi.fn()
    const wiring = new RuntimeSocketWiring({
      deviceRegistry: registryFor('device-1', 'valid-token', 'runtime'),
      e2eeKeypair: {
        publicKey: desktop.publicKey,
        secretKey: desktop.secretKey,
        publicKeyB64: Buffer.from(desktop.publicKey).toString('base64')
      },
      onText,
      onBinary: vi.fn(),
      onClose
    })
    wiring.attachTransport(transport)

    transport.receive(
      ws,
      JSON.stringify({
        type: 'e2ee_hello',
        publicKeyB64: Buffer.from(phone.publicKey).toString('base64')
      })
    )
    const sharedKey = deriveSharedKey(phone.secretKey, desktop.publicKey)
    transport.receive(
      ws,
      encrypt(
        JSON.stringify({
          type: 'e2ee_auth',
          deviceToken: 'valid-token',
          clientCapabilities: ['session-tabs.close-intent.v1']
        }),
        sharedKey
      )
    )
    transport.receive(ws, encrypt('{"id":"rpc-1","method":"status.get"}', sharedKey))

    expect(transport.setClientId).toHaveBeenCalledWith(ws, 'valid-token')
    expect(onText).toHaveBeenCalledOnce()
    expect(onText.mock.calls[0]?.[0]).toMatchObject({
      device: { deviceId: 'device-1', deviceToken: 'valid-token', scope: 'runtime' },
      clientCapabilities: ['session-tabs.close-intent.v1'],
      transport: { transport: 'direct' }
    })

    transport.disconnect(ws)
    expect(onClose).toHaveBeenCalledWith(expect.objectContaining({ ws }), false)
    expect(wiring.channelCount).toBe(0)
    expect(wiring.connectionCount).toBe(0)
  })

  it('closes an unknown-token socket even when reporting the failure throws', () => {
    const desktop = generateKeyPair()
    const phone = generateKeyPair()
    const ws = new FakeSocket()
    const transport = new FakeTransport()
    const notificationError = new Error('renderer exited')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onUnpairedDeviceAuthFailure = vi.fn(() => {
      throw notificationError
    })
    const wiring = new RuntimeSocketWiring({
      deviceRegistry: registryFor('device-1', 'valid-token'),
      e2eeKeypair: {
        publicKey: desktop.publicKey,
        secretKey: desktop.secretKey,
        publicKeyB64: Buffer.from(desktop.publicKey).toString('base64')
      },
      onText: vi.fn(),
      onBinary: vi.fn(),
      onClose: vi.fn(),
      onUnpairedDeviceAuthFailure
    })
    wiring.attachTransport(transport)

    transport.receive(
      ws,
      JSON.stringify({
        type: 'e2ee_hello',
        publicKeyB64: Buffer.from(phone.publicKey).toString('base64')
      })
    )
    const sharedKey = deriveSharedKey(phone.secretKey, desktop.publicKey)
    expect(() =>
      transport.receive(
        ws,
        encrypt(JSON.stringify({ type: 'e2ee_auth', deviceToken: 'stale-token' }), sharedKey)
      )
    ).not.toThrow()

    expect(onUnpairedDeviceAuthFailure).toHaveBeenCalledOnce()
    expect(onUnpairedDeviceAuthFailure).toHaveBeenCalledWith()
    expect(consoleError).toHaveBeenCalledWith(
      '[runtime] Failed to report unpaired-device auth failure:',
      notificationError
    )
    expect(transport.setClientId).not.toHaveBeenCalled()
    expect(ws.close).toHaveBeenCalledWith(4001, 'Unauthorized')
    expect(wiring.channelCount).toBe(0)
    consoleError.mockRestore()
  })

  it('reports auth encrypted to a stale desktop key on the direct path', () => {
    const currentDesktop = generateKeyPair()
    const staleDesktop = generateKeyPair()
    const phone = generateKeyPair()
    const ws = new FakeSocket()
    const transport = new FakeTransport()
    const onUnpairedDeviceAuthFailure = vi.fn()
    const wiring = new RuntimeSocketWiring({
      deviceRegistry: registryFor('device-1', 'valid-token'),
      e2eeKeypair: {
        publicKey: currentDesktop.publicKey,
        secretKey: currentDesktop.secretKey,
        publicKeyB64: Buffer.from(currentDesktop.publicKey).toString('base64')
      },
      onText: vi.fn(),
      onBinary: vi.fn(),
      onClose: vi.fn(),
      onUnpairedDeviceAuthFailure
    })
    wiring.attachTransport(transport)

    transport.receive(
      ws,
      JSON.stringify({
        type: 'e2ee_hello',
        publicKeyB64: Buffer.from(phone.publicKey).toString('base64')
      })
    )
    const staleSharedKey = deriveSharedKey(phone.secretKey, staleDesktop.publicKey)
    transport.receive(
      ws,
      encrypt(JSON.stringify({ type: 'e2ee_auth', deviceToken: 'valid-token' }), staleSharedKey)
    )

    expect(onUnpairedDeviceAuthFailure).toHaveBeenCalledOnce()
    expect(transport.setClientId).not.toHaveBeenCalled()
    expect(ws.close).toHaveBeenCalledWith(4001, 'Unauthorized')
  })
})
