import { EventEmitter } from 'node:events'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn()
}))

vi.mock('child_process', () => ({
  spawn: spawnMock
}))

import { launchAioAdeApp } from './launch'

class FakeChildProcess extends EventEmitter {
  unref = vi.fn()
}

describe('launchAioAdeApp', () => {
  beforeEach(() => {
    spawnMock.mockReset()
  })

  afterEach(() => {
    delete process.env.AIO_ADE_OPEN_COMMAND
    delete process.env.AIO_ADE_APP_EXECUTABLE
    delete process.env.AIO_ADE_APP_EXECUTABLE_NEEDS_APP_ROOT
    delete process.env.ELECTRON_RUN_AS_NODE
  })

  it('handles asynchronous detached spawn errors without throwing', async () => {
    process.env.AIO_ADE_APP_EXECUTABLE = '/missing/AIO-ADE'
    const child = new FakeChildProcess()
    spawnMock.mockReturnValue(child)

    launchAioAdeApp()
    child.emit('error', new Error('ENOENT'))
    await Promise.resolve()

    expect(child.unref).toHaveBeenCalled()
  })

  /* Every branch the `open` launch path can take. `open` is the CLI's only route into the desktop
   * app, and which executable it picks depends on the environment rather than on arguments, so
   * each branch is pinned rather than assumed. */

  it('runs AIO_ADE_OPEN_COMMAND through a shell and ignores every other signal', () => {
    process.env.AIO_ADE_OPEN_COMMAND = 'my-launcher --flag'
    process.env.AIO_ADE_APP_EXECUTABLE = '/should/not/be/used'
    process.env.ELECTRON_RUN_AS_NODE = '1'
    spawnMock.mockReturnValue(new FakeChildProcess())

    launchAioAdeApp()

    const [command, args, options] = spawnMock.mock.calls[0]
    expect(command).toBe('my-launcher --flag')
    expect(args).toEqual([])
    expect(options.shell).toBe(true)
    expect(options.detached).toBe(true)
  })

  it('launches AIO_ADE_APP_EXECUTABLE with no app-root argument by default', () => {
    process.env.AIO_ADE_APP_EXECUTABLE = '/opt/AIO-ADE'
    spawnMock.mockReturnValue(new FakeChildProcess())

    launchAioAdeApp()

    const [command, args, options] = spawnMock.mock.calls[0]
    expect(command).toBe('/opt/AIO-ADE')
    expect(args).toEqual([])
    expect(options.detached).toBe(true)
  })

  it('passes the app root first when the executable needs it', () => {
    process.env.AIO_ADE_APP_EXECUTABLE = '/opt/AIO-ADE'
    process.env.AIO_ADE_APP_EXECUTABLE_NEEDS_APP_ROOT = '1'
    spawnMock.mockReturnValue(new FakeChildProcess())

    launchAioAdeApp()

    const [, args] = spawnMock.mock.calls[0]
    expect(args).toHaveLength(1)
    expect(resolve(args[0])).toBe(args[0])
  })

  it('uses a shell for a Windows npm command shim', () => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'win32' })
    try {
      process.env.AIO_ADE_APP_EXECUTABLE = 'C:\\tools\\aio-ade.cmd'
      spawnMock.mockReturnValue(new FakeChildProcess())

      launchAioAdeApp()

      expect(spawnMock.mock.calls[0][2].shell).toBe(true)
    } finally {
      Object.defineProperty(process, 'platform', platform ?? { value: process.platform })
    }
  })

  it('re-launches the Electron executable out of node mode', () => {
    process.env.ELECTRON_RUN_AS_NODE = '1'
    spawnMock.mockReturnValue(new FakeChildProcess())

    launchAioAdeApp()

    const [command, , options] = spawnMock.mock.calls[0]
    expect(command).toBe(process.execPath)
    // Why: the child must come up as Electron, not inherit the CLI's node mode.
    expect(options.env.ELECTRON_RUN_AS_NODE).toBeUndefined()
  })

  it('falls back to the executable on macOS when no .app bundle is resolvable', () => {
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    try {
      process.env.ELECTRON_RUN_AS_NODE = '1'
      spawnMock.mockReturnValue(new FakeChildProcess())

      launchAioAdeApp()

      expect(spawnMock.mock.calls[0][0]).toBe(process.execPath)
    } finally {
      Object.defineProperty(process, 'platform', platform ?? { value: process.platform })
    }
  })

  it('reports a launch failure when nothing identifies the app', () => {
    spawnMock.mockReturnValue(new FakeChildProcess())

    expect(() => launchAioAdeApp()).toThrow(/Could not determine how to launch AIO-ADE/)
    expect(spawnMock).not.toHaveBeenCalled()
  })
})
