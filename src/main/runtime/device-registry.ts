// Per-client credentials keep runtime WebSocket access independently revocable.
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hardenExistingSecureFile, writeSecureJsonFile } from '../../shared/secure-file'
import type { DeviceScope } from '../../shared/runtime-types'
import { DEVICE_REGISTRY_FILENAME } from './runtime-pairing-files'

export type { DeviceScope }

export type DeviceEntry = {
  deviceId: string
  name: string
  token: string
  scope: DeviceScope
  pairedAt: number
  lastSeenAt: number
}

export class DeviceRegistry {
  private readonly registryPath: string
  private devices: DeviceEntry[] = []

  constructor(userDataPath: string) {
    this.registryPath = join(userDataPath, DEVICE_REGISTRY_FILENAME)
    this.load()
  }

  addDevice(name: string, scope: DeviceScope = 'runtime'): DeviceEntry {
    return this.createAndPersistDevice(this.devices, name, scope)
  }

  private createAndPersistDevice(
    existingDevices: DeviceEntry[],
    name: string,
    scope: DeviceScope
  ): DeviceEntry {
    const entry: DeviceEntry = {
      deviceId: randomUUID(),
      name,
      token: randomBytes(24).toString('hex'),
      scope,
      pairedAt: Date.now(),
      lastSeenAt: 0
    }
    const nextDevices = [...existingDevices, entry]
    this.save(nextDevices)
    this.devices = nextDevices
    return entry
  }

  getOrCreatePendingDevice(name: string, scope: DeviceScope = 'runtime'): DeviceEntry {
    const existing = this.devices.find((device) => device.lastSeenAt === 0 && device.scope === scope)
    return existing ?? this.addDevice(name, scope)
  }

  rotatePendingDevice(name: string, scope: DeviceScope = 'runtime'): DeviceEntry {
    const retainedDevices = this.devices.filter(
      (device) => device.lastSeenAt !== 0 || device.scope !== scope
    )
    return this.createAndPersistDevice(retainedDevices, name, scope)
  }

  removeDevice(deviceId: string): boolean {
    const nextDevices = this.devices.filter((device) => device.deviceId !== deviceId)
    if (nextDevices.length === this.devices.length) {
      return false
    }
    this.devices = nextDevices
    this.save()
    return true
  }

  getDevice(deviceId: string): DeviceEntry | null {
    return this.devices.find((device) => device.deviceId === deviceId) ?? null
  }

  getPendingDevice(scope: DeviceScope = 'runtime'): DeviceEntry | null {
    return this.devices.find((device) => device.lastSeenAt === 0 && device.scope === scope) ?? null
  }

  listDevices(): readonly DeviceEntry[] {
    return this.devices
  }

  validateToken(token: string): DeviceEntry | null {
    return this.devices.find((device) => device.token === token) ?? null
  }

  updateLastSeen(deviceId: string): void {
    const device = this.devices.find((candidate) => candidate.deviceId === deviceId)
    if (device) {
      device.lastSeenAt = Date.now()
      this.save()
    }
  }

  private load(): void {
    if (!existsSync(this.registryPath)) {
      this.devices = []
      return
    }
    try {
      hardenExistingSecureFile(this.registryPath)
      const parsed = JSON.parse(readFileSync(this.registryPath, 'utf-8')) as DeviceEntry[]
      // Retired phone credentials never gain the broader runtime capability set.
      this.devices = parsed
        .filter((device) => device.scope === 'runtime')
        .map((device) => ({ ...device, scope: 'runtime' }))
    } catch {
      this.devices = []
    }
  }

  private save(devices: DeviceEntry[] = this.devices): void {
    writeSecureJsonFile(this.registryPath, devices)
  }
}
