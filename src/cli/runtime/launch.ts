import { spawn as spawnProcess, type SpawnOptions } from 'node:child_process'
import { resolve } from 'node:path'
import { getMacAppBundlePath } from './mac-app-update-bundle'
import { RuntimeClientError } from './types'

export function launchAioAdeApp(): void {
  const overrideCommand = process.env.AIO_ADE_OPEN_COMMAND
  if (typeof overrideCommand === 'string' && overrideCommand.trim().length > 0) {
    spawnDetached(overrideCommand, [], { shell: true })
    return
  }

  const overrideExecutable = process.env.AIO_ADE_APP_EXECUTABLE
  if (typeof overrideExecutable === 'string' && overrideExecutable.trim().length > 0) {
    spawnDetached(overrideExecutable, getExecutableAppArgs(), {
      ...getExecutableSpawnOptions(overrideExecutable),
      env: stripElectronRunAsNode(process.env)
    })
    return
  }

  if (process.env.ELECTRON_RUN_AS_NODE === '1') {
    if (process.platform === 'darwin') {
      const appBundlePath = getMacAppBundlePath(process.execPath)
      if (appBundlePath) {
        // Why: launching the inner MacOS binary directly can trigger macOS app
        // launch failures and bypass normal bundle lifecycle. The public
        // packaged CLI should re-open the .app the same way Finder does.
        spawnDetached('open', [appBundlePath], {
          env: stripElectronRunAsNode(process.env)
        })
        return
      }
    }

    spawnDetached(process.execPath, [], {
      env: stripElectronRunAsNode(process.env)
    })
    return
  }

  throw new RuntimeClientError(
    'runtime_open_failed',
    'Could not determine how to launch AIO-ADE. Start AIO-ADE manually and try again.'
  )
}

function spawnDetached(command: string, args: string[], options: SpawnOptions): void {
  const child = spawnProcess(command, args, {
    detached: true,
    stdio: 'ignore',
    ...options
  })
  // Why: detached launch errors are reported asynchronously after this function
  // returns; openAioAde already reports the user-facing timeout if startup fails.
  child.once('error', () => {})
  child.unref()
}

function getExecutableAppArgs(): string[] {
  return process.env.AIO_ADE_APP_EXECUTABLE_NEEDS_APP_ROOT === '1' ? [resolveAppRoot()] : []
}

function getExecutableSpawnOptions(executable: string): Pick<SpawnOptions, 'shell'> {
  return process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable) ? { shell: true } : {}
}

function resolveAppRoot(): string {
  // Why: dev-mode resource resolution in the Electron child may consult
  // process.cwd(). Pin it to the app root so a launched app resolves resources
  // the same regardless of the shell directory the CLI was invoked from.
  return resolve(__dirname, '../../..')
}

export function stripElectronRunAsNode(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next = { ...env }
  delete next.ELECTRON_RUN_AS_NODE
  return next
}
