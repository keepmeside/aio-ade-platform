import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APP_HOME_DIR_NAME,
  getAppHomeDir,
  getAppHomePath,
  getAppHomePathCandidates,
  getLegacyAppHomeDir,
  getPosixAppHomePath,
  getPosixAppHomePathCandidates,
  LEGACY_APP_HOME_DIR_NAME
} from './app-home-paths'

describe('app home directory names', () => {
  it('writes under the current brand and keeps the pre-rebrand name readable', () => {
    expect(APP_HOME_DIR_NAME).toBe('.aio-ade')
    // A rename without this fallback strands every existing install's Jira/Linear
    // tokens, speech key and keybindings with nothing failing loudly.
    expect(LEGACY_APP_HOME_DIR_NAME).toBe('.orca')
  })

  it('resolves both roots for an explicit home', () => {
    expect(getAppHomeDir('/home/tester')).toBe(join('/home/tester', '.aio-ade'))
    expect(getLegacyAppHomeDir('/home/tester')).toBe(join('/home/tester', '.orca'))
  })
})

describe('getAppHomePath', () => {
  it('joins segments under the canonical root', () => {
    expect(getAppHomePath('/home/tester', 'keybindings.json')).toBe(
      join('/home/tester', '.aio-ade', 'keybindings.json')
    )
    expect(getAppHomePath('/home/tester', 'agent-hooks', 'claude-hook.sh')).toBe(
      join('/home/tester', '.aio-ade', 'agent-hooks', 'claude-hook.sh')
    )
  })
})

describe('getAppHomePathCandidates', () => {
  it('orders the canonical root ahead of the legacy root', () => {
    expect(getAppHomePathCandidates('/home/tester', 'jira-sites.json')).toEqual([
      join('/home/tester', '.aio-ade', 'jira-sites.json'),
      join('/home/tester', '.orca', 'jira-sites.json')
    ])
  })

  it('returns the roots themselves when no segment is given', () => {
    expect(getAppHomePathCandidates('/home/tester')).toEqual([
      join('/home/tester', '.aio-ade'),
      join('/home/tester', '.orca')
    ])
  })
})

describe('remote POSIX variants', () => {
  it('always uses forward slashes so a Windows host can address a POSIX remote', () => {
    expect(getPosixAppHomePath('/home/remote', 'agent-hooks', 'codex-hook.sh')).toBe(
      '/home/remote/.aio-ade/agent-hooks/codex-hook.sh'
    )
    expect(getPosixAppHomePathCandidates('/home/remote', 'agent-hooks')).toEqual([
      '/home/remote/.aio-ade/agent-hooks',
      '/home/remote/.orca/agent-hooks'
    ])
  })

  it('tolerates a trailing slash on the remote home', () => {
    expect(getPosixAppHomePath('/home/remote/', 'sessions')).toBe('/home/remote/.aio-ade/sessions')
  })
})
