/* Regression pin for #9297: local agent detection must resolve executables
 * against PATH with fs and spawn ZERO where/which subprocesses. On unfixed
 * code this fails because detectInstalledAgents spawns one `where`/`which`
 * process per probe command. See the read-only repro in comment-scan:
 * repro-9297-where-per-agent-probe.test.ts (which pins the OLD, buggy count).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleMock,
  execFileMock,
  execFileAsyncMock,
  hydrateShellPathMock,
  mergePathSegmentsMock,
  getActiveMultiplexerMock,
  getBitbucketAuthStatusMock,
  getAzureDevOpsAuthStatusMock,
  getGiteaAuthStatusMock,
  detectCommandsInInstallDirsMock,
  mergePersistedWindowsPathAsyncMock,
  mergePersistedWindowsPathMock
} = vi.hoisted(() => ({
  handleMock: vi.fn(),
  execFileMock: vi.fn(),
  execFileAsyncMock: vi.fn(),
  hydrateShellPathMock: vi.fn(),
  mergePathSegmentsMock: vi.fn(),
  getActiveMultiplexerMock: vi.fn(),
  getBitbucketAuthStatusMock: vi.fn(),
  getAzureDevOpsAuthStatusMock: vi.fn(),
  getGiteaAuthStatusMock: vi.fn(),
  detectCommandsInInstallDirsMock: vi.fn(),
  mergePersistedWindowsPathAsyncMock: vi.fn(),
  mergePersistedWindowsPathMock: vi.fn()
}))

vi.mock('electron', () => ({ ipcMain: { handle: handleMock } }))

vi.mock('child_process', () => {
  const execFileWithPromisify = Object.assign(execFileMock, {
    [Symbol.for('nodejs.util.promisify.custom')]: execFileAsyncMock
  })
  return { execFile: execFileWithPromisify, spawn: vi.fn() }
})

vi.mock('../startup/hydrate-shell-path', () => ({
  hydrateShellPath: hydrateShellPathMock,
  mergePathSegments: mergePathSegmentsMock
}))

vi.mock('./ssh', () => ({ getActiveMultiplexer: getActiveMultiplexerMock }))
vi.mock('../bitbucket/client', () => ({ getBitbucketAuthStatus: getBitbucketAuthStatusMock }))
vi.mock('../azure-devops/client', () => ({
  getAzureDevOpsAuthStatus: getAzureDevOpsAuthStatusMock
}))
vi.mock('../gitea/client', () => ({ getGiteaAuthStatus: getGiteaAuthStatusMock }))

// Isolate the subprocess-spawn assertion from the fs-based install-dir fallback.
vi.mock('./local-agent-install-dir-detection', () => ({
  detectCommandsInInstallDirs: detectCommandsInInstallDirsMock
}))

// Win32 preflight env merge reads persisted registry PATH; stub it out.
vi.mock('../pty/windows-environment-path', () => ({
  mergePersistedWindowsPathAsync: mergePersistedWindowsPathAsyncMock,
  mergePersistedWindowsPath: mergePersistedWindowsPathMock
}))

import { _resetPreflightCache, detectInstalledAgents } from './preflight'
import { TUI_AGENT_CONFIG } from '../../shared/tui-agent-config'
import {
  getTuiAgentDetectionProbeCommands,
  KNOWN_TUI_AGENT_DETECTION_COMMANDS
} from './tui-agent-detection-commands'

describe('#9297: local agent detection spawns zero where/which subprocesses', () => {
  const originalPlatform = process.platform
  const originalPath = process.env.PATH

  beforeEach(() => {
    execFileAsyncMock.mockReset()
    execFileMock.mockReset()
    // Any spawn attempt is the bug; make it explode so a regression is loud.
    execFileAsyncMock.mockImplementation(async (command: string) => {
      throw new Error(`unexpected subprocess spawn: ${command}`)
    })
    detectCommandsInInstallDirsMock.mockReset()
    detectCommandsInInstallDirsMock.mockReturnValue(new Set<string>())
    // Empty PATH -> deterministic "no agents found" regardless of the host's
    // real installed CLIs, so the assertion is stable on any dev machine.
    process.env.PATH = ''
    _resetPreflightCache()
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform })
    process.env.PATH = originalPath
  })

  for (const platform of ['win32', 'darwin'] as const) {
    it(`resolves via fs (no where/which spawn) on ${platform}`, async () => {
      Object.defineProperty(process, 'platform', { configurable: true, value: platform })

      const probeCommands = getTuiAgentDetectionProbeCommands(
        KNOWN_TUI_AGENT_DETECTION_COMMANDS,
        platform
      )
      // Guardrail: keeps the zero-spawn assertion below non-vacuous — every
      // agent shipped for this runtime must still contribute a probe command.
      const shippedDetectCmds = Object.values(TUI_AGENT_CONFIG)
        .filter((config) => !config.detectUnsupportedRuntimes?.includes(platform))
        .map((config) => config.detectCmd)
      expect(shippedDetectCmds.length).toBeGreaterThan(0)
      expect(probeCommands).toEqual(expect.arrayContaining(shippedDetectCmds))

      const agents = await detectInstalledAgents()

      // Perf-win lock: before the fix this was probeCommands.length, one gated
      // where.exe per probe; after the fix it is exactly 0.
      expect(execFileAsyncMock).toHaveBeenCalledTimes(0)
      // Behavior preserved: empty PATH resolves nothing.
      expect(agents).toEqual([])
    })
  }
})
