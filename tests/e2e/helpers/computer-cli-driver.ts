import { execFile } from 'node:child_process'
import { access, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { createElectronHomeIsolation } from './electron-home-isolation'

const execFileAsync = promisify(execFile)
const RUNTIME_METADATA_FILE = 'aio-ade-runtime.json'
let aioAdeDevUserDataPath: string | null = null

export type CliResult = {
  stdout: string
  stderr: string
}

type RunAioAdeCliOptions = {
  retryMissingRuntimeMetadata?: boolean
}

export async function runAioAdeCli(
  args: string[],
  options: RunAioAdeCliOptions = {}
): Promise<CliResult> {
  try {
    return await runAioAdeCliOnce(args)
  } catch (error) {
    if (
      options.retryMissingRuntimeMetadata !== false &&
      isMissingRuntimeMetadataError(args, error)
    ) {
      // Why: Windows CI can let the dev runtime exit while launching the
      // fixture app; reopen once so the desktop action gets a live runtime.
      await ensureAioAdeRuntimeLaunched()
      return await runAioAdeCliOnce(args)
    }
    throw error
  }
}

async function runAioAdeCliOnce(args: string[]): Promise<CliResult> {
  const devCli = join(process.cwd(), 'config/scripts/aio-ade-dev.mjs')
  const command = process.env.AIO_ADE_COMPUTER_CLI ?? process.execPath
  const cliArgs = process.env.AIO_ADE_COMPUTER_CLI ? args : [devCli, ...args]
  const env = process.env.AIO_ADE_COMPUTER_CLI
    ? { ...process.env }
    : await createComputerE2ERuntimeEnv()
  try {
    const result = await execFileAsync(command, cliArgs, {
      env,
      maxBuffer: 20 * 1024 * 1024
    })
    return { stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    if (error && typeof error === 'object' && 'stdout' in error && 'stderr' in error) {
      const output = error as { message: string; stdout: string; stderr: string }
      throw new Error(`${output.message}\nstdout:\n${output.stdout}\nstderr:\n${output.stderr}`)
    }
    throw error
  }
}

export async function ensureAioAdeRuntimeLaunched(): Promise<void> {
  await runAioAdeCli(['open', '--json'], { retryMissingRuntimeMetadata: false })
  await waitForAioAdeRuntimeReady()
}

export async function stopAioAdeRuntime(): Promise<void> {
  // Why: the runtime is a launched desktop session, not a child process this
  // driver owns — a test must not kill it. Left as a no-op teardown hook so the
  // spec call sites keep their shape.
}

export function parseJsonOutput<T>(stdout: string): T {
  return JSON.parse(stdout) as T
}

async function getComputerE2eAioAdeDevUserDataPath(): Promise<string> {
  if (!aioAdeDevUserDataPath) {
    // Why: the shared aio-ade-dev profile can keep an older runtime alive across
    // local test runs, making computer-use E2E exercise stale provider code.
    aioAdeDevUserDataPath = await mkdtemp(join(tmpdir(), 'aio-ade-computer-runtime-'))
  }
  return aioAdeDevUserDataPath
}

async function waitForAioAdeRuntimeReady(): Promise<void> {
  const userDataPath = await getComputerE2eAioAdeDevUserDataPath()
  const metadataPath = join(userDataPath, RUNTIME_METADATA_FILE)
  const deadline = Date.now() + 15000
  let lastError: unknown = null

  while (Date.now() < deadline) {
    try {
      await access(metadataPath)
      const status = parseJsonOutput<{
        result: { runtime: { reachable: boolean } }
      }>((await runAioAdeCli(['status', '--json'], { retryMissingRuntimeMetadata: false })).stdout)
      if (status.result.runtime.reachable) {
        return
      }
    } catch (error) {
      lastError = error
    }
    await delay(250)
  }

  const detail = [lastError instanceof Error ? `Last error: ${lastError.message}` : null]
    .filter(Boolean)
    .join(' ')
  throw new Error(`AIO-ADE runtime metadata was not ready at ${metadataPath}.${detail}`)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createComputerE2ERuntimeEnv(): Promise<NodeJS.ProcessEnv> {
  const userDataDir =
    process.env.AIO_ADE_DEV_USER_DATA_PATH ?? (await getComputerE2eAioAdeDevUserDataPath())
  // Why: agent runtimes export ELECTRON_RUN_AS_NODE, which would make the
  // spawned Electron behave as plain Node; strip it like every other caller.
  const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...inheritedEnv } = process.env
  void _electronRunAsNode
  const isolation = createElectronHomeIsolation({
    inheritedEnv,
    launchEnv: {},
    extraEnv: {},
    userDataDir,
    codexRealHomeEnabled: false
  })
  return {
    ...isolation.env,
    // Why: the Node CLI and the Electron child must resolve the same runtime
    // metadata while the E2E boundary owns their home and Codex paths.
    AIO_ADE_DEV_USER_DATA_PATH: userDataDir
  }
}

function isMissingRuntimeMetadataError(args: string[], error: unknown): boolean {
  if (args[0] !== 'computer') {
    return false
  }
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return false
  }
  const message = String((error as { message?: unknown }).message)
  return (
    message.includes('"code": "runtime_unavailable"') &&
    message.includes('Could not read AIO-ADE runtime metadata')
  )
}
