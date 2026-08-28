/* Every shell Orca spawns sources a generated rc payload, and that payload used to re-export a
 * per-agent env var for each agent in the old roster. Leaving one behind is invisible on this
 * machine and harmful on a host that still has the agent installed: the OMP block redefined `omp`
 * as a shell function for every interactive shell, so a user's own binary silently gained an
 * `--extension` argument. The launcher no longer starts these agents, so the plumbing must go with
 * them — while the Claude, Agent Teams and Codex plumbing in the same payloads keeps working. */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  getDaemonBashShellReadyRcfileContent,
  getDaemonZshShellReadyRcfileContent
} from '../daemon/shell-ready'
import {
  getBashShellReadyRcfileContent,
  getZshShellReadyRcfileContent
} from '../providers/local-pty-shell-ready'
import { getPowerShellOsc133Bootstrap } from '../powershell-osc133-bootstrap'
import { getRelayShellLaunchConfig } from '../../relay/pty-shell-launch'
import { addOrcaWslInteropEnv } from './wsl-orca-env'

/** Env names that existed only to point a dropped agent at an Orca-managed directory. */
const DROPPED_AGENT_ENV = [
  'OPENCODE_CONFIG_DIR',
  'MIMOCODE_HOME',
  'ORCA_OMP_STATUS_EXTENSION',
  'ORCA_OMP_SOURCE_AGENT_DIR',
  'PI_CODING_AGENT_DIR'
]

const home = mkdtempSync(join(tmpdir(), 'orca-roster-shell-env-'))

afterAll(() => {
  rmSync(home, { recursive: true, force: true })
})

/** Writes the relay overlay wrappers into a scratch HOME and returns one of them. */
function relayWrapper(fileName: string, shellPath = '/bin/zsh'): string {
  getRelayShellLaunchConfig(
    shellPath,
    // ORCA_REMOTE_CLI_BIN_DIR is the one overlay trigger that survives the roster narrowing.
    { HOME: home, ORCA_REMOTE_CLI_BIN_DIR: '/remote/bin' },
    'linux'
  )
  const shellDir = fileName.startsWith('.z') ? 'zsh' : 'bash'
  return readFileSync(join(home, '.orca-relay', 'shell-ready', shellDir, fileName), 'utf8')
}

const shellPayloads: [string, () => string][] = [
  ['daemon bash rcfile', getDaemonBashShellReadyRcfileContent],
  ['daemon zsh rcfile', getDaemonZshShellReadyRcfileContent],
  ['local bash rcfile', getBashShellReadyRcfileContent],
  ['local zsh rcfile', getZshShellReadyRcfileContent],
  ['powershell bootstrap', getPowerShellOsc133Bootstrap],
  ['relay zsh .zshrc', () => relayWrapper('.zshrc')],
  ['relay zsh .zlogin', () => relayWrapper('.zlogin')],
  ['relay bash rcfile', () => relayWrapper('rcfile', '/bin/bash')]
]

describe('generated shell payloads carry env only for agents this build launches', () => {
  it.each(shellPayloads)('%s names no dropped agent', (_label, getContent) => {
    const content = getContent()

    for (const variable of DROPPED_AGENT_ENV) {
      expect(content).not.toContain(variable)
    }
  })

  it.each(shellPayloads)(
    '%s defines no wrapper function over a dropped binary',
    (_l, getContent) => {
      const content = getContent()

      // The wrapper shape was `omp() { … }` in POSIX shells and `function Global:omp` in PowerShell.
      expect(content).not.toMatch(/(^|\s)(function\s+(Global:)?)?omp\s*(\(\)|\{)/m)
    }
  )
})

describe('the retained agents keep their shell plumbing', () => {
  it.each([
    ['daemon bash rcfile', getDaemonBashShellReadyRcfileContent],
    ['daemon zsh rcfile', getDaemonZshShellReadyRcfileContent],
    ['local bash rcfile', getBashShellReadyRcfileContent],
    ['local zsh rcfile', getZshShellReadyRcfileContent]
  ] as [string, () => string][])(
    '%s still restores CODEX_HOME and both shim paths',
    (_l, getContent) => {
      const content = getContent()

      expect(content).toContain('export CODEX_HOME="${ORCA_CODEX_HOME}"')
      expect(content).toContain('ORCA_AGENT_TEAMS_SHIM_DIR')
      expect(content).toContain('ORCA_ATTRIBUTION_SHIM_DIR')
    }
  )

  it('powershell still restores CODEX_HOME', () => {
    expect(getPowerShellOsc133Bootstrap()).toContain('$env:CODEX_HOME = $env:ORCA_CODEX_HOME')
  })

  it('relay wrappers still restore the remote CLI bin dir', () => {
    expect(relayWrapper('.zshrc')).toContain('ORCA_REMOTE_CLI_BIN_DIR')
    expect(relayWrapper('rcfile', '/bin/bash')).toContain('ORCA_REMOTE_CLI_BIN_DIR')
  })
})

describe('WSL passthrough', () => {
  it('carries the hook coordinates without the dropped agents’ overlay vars', () => {
    const env: Record<string, string> = {
      HOME: home,
      ORCA_AGENT_HOOK_PORT: '51820',
      ORCA_AGENT_HOOK_ENDPOINT: '/home/jin/.orca/hook.sock',
      ORCA_OMP_STATUS_EXTENSION: 'C:\\Users\\jin\\.omp\\agent\\extensions\\orca-agent-status.ts',
      ORCA_OMP_SOURCE_AGENT_DIR: 'C:\\Users\\jin\\.omp\\agent',
      OPENCODE_CONFIG_DIR: '/home/jin/.config/opencode',
      ORCA_OPENCODE_CONFIG_DIR: '/home/jin/.config/opencode'
    }

    addOrcaWslInteropEnv(env)

    expect(env.WSLENV).toContain('ORCA_AGENT_HOOK_PORT/u')
    expect(env.WSLENV).toContain('ORCA_AGENT_HOOK_ENDPOINT/u')
    expect(env.WSLENV).not.toContain('ORCA_OMP')
    expect(env.WSLENV).not.toContain('OPENCODE_CONFIG_DIR')
  })
})
