import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: true }
}))

import { installLinuxBareAioAdeDispatcher } from './linux-bare-aio-ade-dispatcher'

const created: string[] = []

async function makeFixture(): Promise<{ homePath: string; resourcesPath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'aio-ade-bare-dispatcher-'))
  created.push(root)
  const resourcesPath = join(root, 'resources')
  // The bundled aio-ade launcher must exist for the dispatcher to be written.
  await mkdir(join(resourcesPath, 'bin'), { recursive: true })
  await writeFile(join(resourcesPath, 'bin', 'aio-ade'), '#!/usr/bin/env bash\n', 'utf8')
  return { homePath: join(root, 'home'), resourcesPath }
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('installLinuxBareAioAdeDispatcher', () => {
  it('writes an executable bare-aio-ade dispatcher that execs the bundled aio-ade launcher', async () => {
    const { homePath, resourcesPath } = await makeFixture()

    const result = await installLinuxBareAioAdeDispatcher({
      resourcesPath,
      homePath,
      appImagePath: null
    })

    const expectedTarget = join(resourcesPath, 'bin', 'aio-ade')
    expect(result.state).toBe('installed')
    expect(result.target).toBe(expectedTarget)
    expect(result.dispatcherPath).toBe(join(homePath, '.local', 'bin', 'aio-ade'))

    const content = await readFile(result.dispatcherPath, 'utf8')
    expect(content).toContain('#!/usr/bin/env bash')
    // Single-quoted so a resources path with shell metacharacters can't break out.
    expect(content).toContain(`exec '${expectedTarget}' "$@"`)

    const mode = (await stat(result.dispatcherPath)).mode & 0o777
    expect(mode & 0o111).not.toBe(0)
  })

  it('is idempotent — a second install rewrites its own dispatcher without throwing', async () => {
    const { homePath, resourcesPath } = await makeFixture()

    const first = await installLinuxBareAioAdeDispatcher({
      resourcesPath,
      homePath,
      appImagePath: null
    })
    const second = await installLinuxBareAioAdeDispatcher({
      resourcesPath,
      homePath,
      appImagePath: null
    })

    expect(second).toEqual(first)
    expect(second.state).toBe('installed')
  })

  it('quotes a resources path containing spaces so the exec line cannot be split', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aio-ade-bare-dispatcher-space-'))
    created.push(root)
    const resourcesPath = join(root, 'App Support', 'resources')
    await mkdir(join(resourcesPath, 'bin'), { recursive: true })
    await writeFile(join(resourcesPath, 'bin', 'aio-ade'), '#!/usr/bin/env bash\n', 'utf8')

    const result = await installLinuxBareAioAdeDispatcher({
      resourcesPath,
      homePath: join(root, 'home'),
      appImagePath: null
    })

    const content = await readFile(result.dispatcherPath, 'utf8')
    expect(content).toContain(`exec '${join(resourcesPath, 'bin', 'aio-ade')}' "$@"`)
  })

  it('execs the stable AppImage (not the ephemeral mount) when running from an AppImage', async () => {
    const { homePath, resourcesPath } = await makeFixture()
    const appImagePath = join(homePath, 'Applications', 'AIO-ADE.AppImage')

    const result = await installLinuxBareAioAdeDispatcher({ resourcesPath, homePath, appImagePath })

    expect(result.state).toBe('installed')
    expect(result.target).toBe(appImagePath)
    const content = await readFile(result.dispatcherPath, 'utf8')
    // The AppImage wrapper references the stable outer path, never resourcesPath.
    expect(content).toContain(appImagePath)
    expect(content).not.toContain(resourcesPath)
  })

  it('skips (does not clobber) a user-owned aio-ade already at ~/.local/bin', async () => {
    const { homePath, resourcesPath } = await makeFixture()
    const dispatcherPath = join(homePath, '.local', 'bin', 'aio-ade')
    await mkdir(join(homePath, '.local', 'bin'), { recursive: true })
    await writeFile(dispatcherPath, '#!/bin/sh\necho my own aio-ade\n', 'utf8')

    const result = await installLinuxBareAioAdeDispatcher({
      resourcesPath,
      homePath,
      appImagePath: null
    })

    expect(result.state).toBe('skipped-foreign')
    expect(await readFile(dispatcherPath, 'utf8')).toBe('#!/bin/sh\necho my own aio-ade\n')
  })

  it('skips when the bundled aio-ade launcher is missing from the build', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aio-ade-bare-dispatcher-nolauncher-'))
    created.push(root)

    const result = await installLinuxBareAioAdeDispatcher({
      resourcesPath: join(root, 'resources'),
      homePath: join(root, 'home'),
      appImagePath: null
    })

    expect(result.state).toBe('skipped-launcher-missing')
    expect(result.target).toBeNull()
  })
})
