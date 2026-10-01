import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Why: the driver shells out to the dev CLI and the real filesystem; both are
// mocked so these tests pin the retry/handshake contract without a runtime.
const execFileMock = vi.fn()
const accessMock = vi.fn()
const mkdtempMock = vi.fn()
const readdirMock = vi.fn()

vi.mock('node:child_process', () => ({
  execFile: (...callArgs: unknown[]) => execFileMock(...callArgs)
}))

vi.mock('node:fs/promises', () => ({
  access: (...callArgs: unknown[]) => accessMock(...callArgs),
  mkdtemp: (...callArgs: unknown[]) => mkdtempMock(...callArgs),
  readdir: (...callArgs: unknown[]) => readdirMock(...callArgs)
}))

vi.mock('./electron-home-isolation', () => ({
  createElectronHomeIsolation: () => ({ env: {} })
}))

const { runAioAdeCli } = await import('./computer-cli-driver')

type CliCallback = (error: unknown, value?: { stdout: string; stderr: string }) => void

function makeRuntimeUnavailableError(): Error & { stdout: string; stderr: string } {
  const error = new Error('Command failed: aio-ade computer') as Error & {
    stdout: string
    stderr: string
  }
  error.stdout = [
    '{',
    '  "code": "runtime_unavailable",',
    '  "message": "Could not read AIO-ADE runtime metadata at /tmp/aio-ade-computer-runtime-test/aio-ade-runtime.json. Start the AIO-ADE app first."',
    '}'
  ].join('\n')
  error.stderr = ''
  return error
}

type Dispatch = (subcommand: string, args: string[], callback: CliCallback) => void

function setExecFileDispatch(dispatch: Dispatch): void {
  execFileMock.mockImplementation(
    (_command: string, args: string[], _options: unknown, callback: CliCallback) => {
      dispatch(args[1], args, callback)
    }
  )
}

function dispatchReachableRuntimeThenHealthyComputer(): {
  dispatch: Dispatch
  calls: string[]
} {
  const calls: string[] = []
  let computerAttempts = 0
  const dispatch: Dispatch = (subcommand, _args, callback) => {
    calls.push(subcommand)
    if (subcommand === 'computer') {
      computerAttempts += 1
      if (computerAttempts === 1) {
        callback(makeRuntimeUnavailableError())
        return
      }
      callback(null, { stdout: '{"result":{"apps":[]}}', stderr: '' })
      return
    }
    if (subcommand === 'open') {
      callback(null, { stdout: '{}', stderr: '' })
      return
    }
    if (subcommand === 'status') {
      callback(null, {
        stdout: JSON.stringify({ result: { runtime: { reachable: true } } }),
        stderr: ''
      })
      return
    }
    callback(new Error(`unexpected subcommand: ${subcommand}`))
  }
  return { dispatch, calls }
}

beforeEach(() => {
  execFileMock.mockReset()
  accessMock.mockReset()
  mkdtempMock.mockReset()
  readdirMock.mockReset()
  accessMock.mockResolvedValue(undefined)
  mkdtempMock.mockResolvedValue('/tmp/aio-ade-computer-runtime-test')
  readdirMock.mockResolvedValue([])
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('computer CLI driver retry contract', () => {
  it('relaunches the runtime once and retries a computer command that reported missing metadata', async () => {
    const { dispatch, calls } = dispatchReachableRuntimeThenHealthyComputer()
    setExecFileDispatch(dispatch)

    const result = await runAioAdeCli(['computer', 'list-apps', '--json'])

    expect(result.stdout).toContain('apps')
    expect(calls).toEqual(['computer', 'open', 'status', 'computer'])
  })

  it('does not retry non-computer commands on missing runtime metadata', async () => {
    const calls: string[] = []
    setExecFileDispatch((subcommand, _args, callback) => {
      calls.push(subcommand)
      callback(makeRuntimeUnavailableError())
    })

    await expect(runAioAdeCli(['status', '--json'])).rejects.toThrow(/runtime_unavailable/)
    expect(calls).toEqual(['status'])
  })

  it('does not retry when the caller opts out of the missing-metadata retry', async () => {
    const calls: string[] = []
    setExecFileDispatch((subcommand, _args, callback) => {
      calls.push(subcommand)
      callback(makeRuntimeUnavailableError())
    })

    await expect(
      runAioAdeCli(['computer', 'list-apps', '--json'], { retryMissingRuntimeMetadata: false })
    ).rejects.toThrow(/runtime_unavailable/)
    expect(calls).toEqual(['computer'])
  })
})

describe('computer CLI driver runtime-death diagnostics', () => {
  it('logs post-mortem state before relaunching when the e2e opt-in is set', async () => {
    vi.stubEnv('AIO_ADE_COMPUTER_E2E', '1')
    vi.stubEnv('AIO_ADE_COMPUTER_E2E_STABILITY_PROBE_MS', '0')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { dispatch, calls } = dispatchReachableRuntimeThenHealthyComputer()
    setExecFileDispatch(dispatch)
    readdirMock.mockResolvedValue(['aio-ade-runtime.json', 'Crashpad'])

    const result = await runAioAdeCli(['computer', 'list-apps', '--json'])

    expect(result.stdout).toContain('apps')
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('runtime unavailable before computer list-apps')
    )
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('metadataExists=true'))
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('["aio-ade-runtime.json","Crashpad"]')
    )
    // Why: diagnostics must never break the relaunch — the retry still runs.
    expect(calls).toEqual(['computer', 'open', 'status', 'computer'])
  })

  it('keeps the retry working when post-mortem collection itself fails', async () => {
    vi.stubEnv('AIO_ADE_COMPUTER_E2E', '1')
    vi.stubEnv('AIO_ADE_COMPUTER_E2E_STABILITY_PROBE_MS', '0')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { dispatch, calls } = dispatchReachableRuntimeThenHealthyComputer()
    setExecFileDispatch(dispatch)
    // Why: the first access call post-implementation is the post-mortem
    // metadata check; its failure must be contained, not break the relaunch.
    accessMock.mockRejectedValueOnce(new Error('EACCES'))

    const result = await runAioAdeCli(['computer', 'list-apps', '--json'])

    expect(result.stdout).toContain('apps')
    expect(calls).toEqual(['computer', 'open', 'status', 'computer'])
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('metadataExists=false'))
  })

  it('stays silent on the success path', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const calls: string[] = []
    setExecFileDispatch((subcommand, _args, callback) => {
      calls.push(subcommand)
      if (subcommand === 'computer') {
        callback(null, { stdout: '{"result":{"apps":[]}}', stderr: '' })
        return
      }
      callback(new Error(`unexpected subcommand: ${subcommand}`))
    })

    await runAioAdeCli(['computer', 'list-apps', '--json'])

    expect(consoleError).not.toHaveBeenCalled()
  })
})

describe('computer CLI driver runtime stability probe', () => {
  it('polls status after the ready handshake when the e2e opt-in is set', async () => {
    vi.stubEnv('AIO_ADE_COMPUTER_E2E', '1')
    vi.stubEnv('AIO_ADE_COMPUTER_E2E_STABILITY_PROBE_MS', '500')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { dispatch } = dispatchReachableRuntimeThenHealthyComputer()
    setExecFileDispatch(dispatch)

    await runAioAdeCli(['computer', 'list-apps', '--json'])

    const statusCalls = execFileMock.mock.calls.filter(
      (call) => (call[1] as string[])[1] === 'status'
    )
    // Why: one status for the ready handshake plus at least one probe poll.
    expect(statusCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('logs and stops probing when the runtime drops after the handshake', async () => {
    vi.stubEnv('AIO_ADE_COMPUTER_E2E', '1')
    vi.stubEnv('AIO_ADE_COMPUTER_E2E_STABILITY_PROBE_MS', '2000')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    let statusCalls = 0
    const calls: string[] = []
    let computerAttempts = 0
    setExecFileDispatch((subcommand, _args, callback) => {
      calls.push(subcommand)
      if (subcommand === 'computer') {
        computerAttempts += 1
        if (computerAttempts === 1) {
          callback(makeRuntimeUnavailableError())
          return
        }
        callback(null, { stdout: '{"result":{"apps":[]}}', stderr: '' })
        return
      }
      if (subcommand === 'open') {
        callback(null, { stdout: '{}', stderr: '' })
        return
      }
      if (subcommand === 'status') {
        statusCalls += 1
        callback(null, {
          stdout: JSON.stringify({
            result: { runtime: { reachable: statusCalls === 1 } }
          }),
          stderr: ''
        })
        return
      }
      callback(new Error(`unexpected subcommand: ${subcommand}`))
    })

    const result = await runAioAdeCli(['computer', 'list-apps', '--json'])

    expect(result.stdout).toContain('apps')
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('runtime stability probe'))
    expect(calls).toEqual(['computer', 'open', 'status', 'status', 'computer'])
  })

  it('skips probing outside e2e opt-in runs', async () => {
    const { dispatch } = dispatchReachableRuntimeThenHealthyComputer()
    setExecFileDispatch(dispatch)

    await runAioAdeCli(['computer', 'list-apps', '--json'])

    const statusCalls = execFileMock.mock.calls.filter(
      (call) => (call[1] as string[])[1] === 'status'
    )
    expect(statusCalls).toHaveLength(1)
  })
})
