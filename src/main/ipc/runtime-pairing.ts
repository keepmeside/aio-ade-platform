import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { networkInterfaces } from 'node:os'
import type { RuntimeAccessGrant } from '../../shared/runtime-access-grants'
import { isTailnetIPv4Address } from '../../shared/tailnet-address'
import type { DeviceEntry } from '../runtime/device-registry'
import type { OrcaRuntimeRpcServer } from '../runtime/runtime-rpc'

export type NetworkInterface = {
  name: string
  address: string
}

function isUsableIPv6Address(address: string): boolean {
  return !/^fe[89ab][0-9a-f]:/i.test(address)
}

function isProxyFakeIpIPv4Address(address: string): boolean {
  return /^198\.(?:18|19)\./.test(address)
}

function getNetworkInterfaces(): NetworkInterface[] {
  const result: NetworkInterface[] = []
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    if (!addresses) {
      continue
    }
    for (const address of addresses) {
      if (address.internal) {
        continue
      }
      if (address.family === 'IPv4' && !isProxyFakeIpIPv4Address(address.address)) {
        result.push({ name, address: address.address })
      } else if (address.family === 'IPv6' && isUsableIPv6Address(address.address)) {
        result.push({ name, address: address.address })
      }
    }
  }
  return result.sort((a, b) => rankAddress(a.address) - rankAddress(b.address))
}

function rankAddress(address: string): number {
  if (isTailnetIPv4Address(address)) {
    return 0
  }
  return address.includes(':') ? 2 : 1
}

function getDefaultPairingAddress(): string | null {
  return getNetworkInterfaces()[0]?.address ?? null
}

function toRuntimeAccessGrant(device: DeviceEntry): RuntimeAccessGrant {
  return {
    deviceId: device.deviceId,
    name: device.name,
    createdAt: device.pairedAt,
    lastSeenAt: device.lastSeenAt > 0 ? device.lastSeenAt : null
  }
}

export type RuntimePairingHandlerDependencies = {
  consumePendingAuthFailure?: (webContentsId: number) => boolean
}

export function registerRuntimePairingHandlers(
  rpcServer: OrcaRuntimeRpcServer,
  dependencies: RuntimePairingHandlerDependencies = {}
): void {
  ipcMain.handle('runtime:listNetworkInterfaces', () => ({ interfaces: getNetworkInterfaces() }))

  ipcMain.handle(
    'runtime:getPairingUrl',
    (_event, args?: { address?: string; rotate?: boolean }) => {
      const address = args?.address ?? getDefaultPairingAddress()
      if (!address) {
        return { available: false as const }
      }
      return rpcServer.createPairingOffer({
        address,
        rotate: args?.rotate,
        name: `Runtime ${new Date().toLocaleDateString()}`,
        scope: 'runtime'
      })
    }
  )

  ipcMain.handle('runtime:listAccessGrants', () => {
    const registry = rpcServer.getDeviceRegistry()
    return {
      grants:
        registry
          ?.listDevices()
          .filter((device) => device.scope === 'runtime')
          .sort((a, b) => b.pairedAt - a.pairedAt)
          .map(toRuntimeAccessGrant) ?? []
    }
  })

  ipcMain.handle('runtime:revokeAccess', (_event, args: { deviceId: string }) => ({
    revoked: rpcServer.revokeRuntimeAccess(args.deviceId)
  }))

  ipcMain.handle('runtime:isWebSocketReady', () => ({
    ready: rpcServer.getWebSocketEndpoint() !== null,
    endpoint: rpcServer.getWebSocketEndpoint()
  }))

  ipcMain.handle('runtime:consumeAuthFailure', (event: IpcMainInvokeEvent) => {
    if (!isWindowRenderer(event)) {
      return false
    }
    return dependencies.consumePendingAuthFailure?.(event.sender.id) ?? false
  })
}

function isWindowRenderer(event: IpcMainInvokeEvent): boolean {
  return !event.sender.isDestroyed() && event.sender.getType() === 'window'
}
