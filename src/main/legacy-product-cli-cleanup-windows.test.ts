import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanupLegacyWindowsCliPath,
  cleanupLegacyWslCliRegistrations
} from './legacy-product-cli-cleanup-windows'

const tempRoots: string[] = []

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('legacy Windows product CLI cleanup', () => {
  it('passes only the packaged resources bin directory to the user PATH cleanup script', async () => {
    const runPowerShell = vi.fn().mockResolvedValue('removed\n')
    const resourcesPath = 'C:\\Users\\dev\\AppData\\Local\\Programs\\Orca\\resources'

    await expect(cleanupLegacyWindowsCliPath(resourcesPath, runPowerShell)).resolves.toEqual([
      join(resourcesPath, 'bin')
    ])

    const script = runPowerShell.mock.calls[0]?.[0] as string
    expect(script).toContain(Buffer.from(join(resourcesPath, 'bin'), 'utf8').toString('base64'))
    expect(script).toContain("SetEnvironmentVariable('Path'")
  })

  it('removes only marker-owned WSL launchers for recorded distros', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'legacy-wsl-cli-cleanup-'))
    tempRoots.push(userDataPath)
    const registryPath = join(userDataPath, 'wsl-cli-registrations.json')
    await mkdir(userDataPath, { recursive: true })
    await writeFile(
      registryPath,
      JSON.stringify({ schemaVersion: 2, registeredDistros: ['Ubuntu', 'Debian'] })
    )
    const runWslCommand = vi.fn().mockResolvedValue('removed\n')

    await expect(cleanupLegacyWslCliRegistrations(userDataPath, runWslCommand)).resolves.toEqual([
      'Ubuntu',
      'Debian'
    ])

    expect(runWslCommand).toHaveBeenCalledTimes(2)
    const script = runWslCommand.mock.calls[0]?.[1] as string
    expect(script).toContain('# Orca managed WSL CLI launcher')
    expect(script).toContain('$HOME/.local/bin/orca-ide')
    expect(script).toContain('$HOME/.local/bin/orca')
    expect(script).toContain('# Orca managed WSL CLI PowerShell bridge')
    expect(existsSync(registryPath)).toBe(false)
  })

  it('keeps the WSL registry when any distro cleanup fails', async () => {
    const userDataPath = await mkdtemp(join(tmpdir(), 'legacy-wsl-cli-cleanup-'))
    tempRoots.push(userDataPath)
    const registryPath = join(userDataPath, 'wsl-cli-registrations.json')
    await writeFile(
      registryPath,
      JSON.stringify({ schemaVersion: 2, registeredDistros: ['Ubuntu'] })
    )
    const runWslCommand = vi.fn().mockRejectedValue(new Error('distro unavailable'))

    await expect(cleanupLegacyWslCliRegistrations(userDataPath, runWslCommand)).rejects.toThrow(
      'distro unavailable'
    )
    expect(existsSync(registryPath)).toBe(true)
  })
})
