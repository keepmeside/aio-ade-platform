import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, readlink, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  LEGACY_PRODUCT_CLI_CLEANUP_MARKER,
  runLegacyProductCliCleanup
} from './legacy-product-cli-cleanup'

const tempRoots: string[] = []

async function createFixture(): Promise<{
  root: string
  homePath: string
  resourcesPath: string
  userDataPath: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'legacy-product-cli-cleanup-'))
  tempRoots.push(root)
  const homePath = join(root, 'home')
  const resourcesPath = join(root, 'resources')
  const userDataPath = join(root, 'user-data')
  await mkdir(join(resourcesPath, 'bin'), { recursive: true })
  return { root, homePath, resourcesPath, userDataPath }
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('legacy product CLI cleanup', () => {
  it('removes only Unix launchers owned by the packaged legacy resources', async () => {
    const fixture = await createFixture()
    const managedPath = join(fixture.homePath, '.local', 'bin', 'orca-ide')
    const userOwnedPath = join(fixture.homePath, '.local', 'bin', 'orca')
    const managedTarget = join(fixture.resourcesPath, 'bin', 'orca-ide')
    const userTarget = join(fixture.root, 'user-owned-orca')
    await mkdir(dirname(managedPath), { recursive: true })
    await writeFile(managedTarget, 'legacy launcher')
    await writeFile(userTarget, 'user launcher')
    await symlink(managedTarget, managedPath)
    await symlink(userTarget, userOwnedPath)

    const result = await runLegacyProductCliCleanup({
      platform: 'linux',
      isPackaged: true,
      ...fixture
    })

    expect(result.removed).toEqual([managedPath])
    expect(existsSync(managedPath)).toBe(false)
    expect(await readlink(userOwnedPath)).toBe(userTarget)
  })

  it('removes a legacy AppImage wrapper but preserves unrelated regular files', async () => {
    const fixture = await createFixture()
    const managedPath = join(fixture.homePath, '.local', 'bin', 'orca-ide')
    const userOwnedPath = join(fixture.homePath, '.local', 'bin', 'orca')
    await mkdir(dirname(managedPath), { recursive: true })
    await writeFile(
      managedPath,
      [
        'Orca AppImage runtime did not set APPDIR.',
        'app.asar.unpacked","out","cli","index.js',
        'export ORCA_NODE_OPTIONS=',
        'ELECTRON_RUN_AS_NODE=1 exec "$APPIMAGE" -e'
      ].join('\n')
    )
    await writeFile(userOwnedPath, '#!/usr/bin/env bash\necho user-owned\n')

    const result = await runLegacyProductCliCleanup({
      platform: 'linux',
      isPackaged: true,
      ...fixture
    })

    expect(result.removed).toEqual([managedPath])
    expect(existsSync(managedPath)).toBe(false)
    expect(await readFile(userOwnedPath, 'utf8')).toContain('user-owned')
  })

  it('removes the marker-owned bare Linux dispatcher that shadowed GNOME Orca', async () => {
    const fixture = await createFixture()
    const dispatcherPath = join(fixture.homePath, '.local', 'bin', 'orca')
    await mkdir(dirname(dispatcherPath), { recursive: true })
    await writeFile(
      dispatcherPath,
      '#!/usr/bin/env bash\n# orca-serve-bare-orca-dispatcher\nexec /missing/orca-ide "$@"\n'
    )

    const result = await runLegacyProductCliCleanup({
      platform: 'linux',
      isPackaged: true,
      ...fixture
    })

    expect(result.removed).toEqual([dispatcherPath])
    expect(existsSync(dispatcherPath)).toBe(false)
  })

  it('uses a privileged macOS fallback only after validating the managed symlink target', async () => {
    const fixture = await createFixture()
    const commandPath = join(fixture.root, 'usr', 'local', 'bin', 'orca')
    const managedTarget = join(fixture.resourcesPath, 'bin', 'orca')
    const macPrivilegedRunner = vi.fn(async () => unlink(commandPath))
    await mkdir(dirname(commandPath), { recursive: true })
    await writeFile(managedTarget, 'legacy launcher')
    await symlink(managedTarget, commandPath)

    const result = await runLegacyProductCliCleanup({
      platform: 'darwin',
      isPackaged: true,
      ...fixture,
      macCommandPath: commandPath,
      unlinkPath: vi.fn(async (path) => {
        if (path === commandPath) {
          throw Object.assign(new Error('permission denied'), { code: 'EACCES' })
        }
        await unlink(path)
      }),
      macPrivilegedRunner
    })

    expect(result.removed).toEqual([commandPath])
    expect(macPrivilegedRunner).toHaveBeenCalledWith(
      expect.stringContaining(`readlink '${commandPath}'`)
    )
    expect(existsSync(commandPath)).toBe(false)
  })

  it('marks successful cleanup once and skips later launches', async () => {
    const fixture = await createFixture()
    const cleanupWindowsPath = vi.fn().mockResolvedValue(['windows-path'])
    const cleanupWslRegistrations = vi.fn().mockResolvedValue(['Ubuntu'])

    await runLegacyProductCliCleanup({
      platform: 'win32',
      isPackaged: true,
      ...fixture,
      cleanupWindowsPath,
      cleanupWslRegistrations
    })
    const second = await runLegacyProductCliCleanup({
      platform: 'win32',
      isPackaged: true,
      ...fixture,
      cleanupWindowsPath,
      cleanupWslRegistrations
    })

    expect(second.status).toBe('already-completed')
    expect(cleanupWindowsPath).toHaveBeenCalledTimes(1)
    expect(cleanupWslRegistrations).toHaveBeenCalledTimes(1)
    expect(
      JSON.parse(
        await readFile(join(fixture.userDataPath, LEGACY_PRODUCT_CLI_CLEANUP_MARKER), 'utf8')
      )
    ).toMatchObject({ cleanupVersion: 1 })
  })

  it('does not stamp the marker when cleanup fails so the next launch retries', async () => {
    const fixture = await createFixture()
    const cleanupWindowsPath = vi.fn().mockResolvedValue([])
    const cleanupWslRegistrations = vi.fn().mockRejectedValueOnce(new Error('WSL unavailable'))

    await expect(
      runLegacyProductCliCleanup({
        platform: 'win32',
        isPackaged: true,
        ...fixture,
        cleanupWindowsPath,
        cleanupWslRegistrations
      })
    ).rejects.toThrow('WSL unavailable')

    expect(existsSync(join(fixture.userDataPath, LEGACY_PRODUCT_CLI_CLEANUP_MARKER))).toBe(false)
  })
})
