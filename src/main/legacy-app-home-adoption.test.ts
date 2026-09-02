import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getAppHomeDir, getLegacyAppHomeDir } from '../shared/app-home-paths'
import {
  ADOPTED_LEGACY_HOME_ENTRIES,
  adoptLegacyAppHome,
  REGENERATED_LEGACY_HOME_ENTRIES
} from './legacy-app-home-adoption'

let home: string

function legacyFile(relativePath: string, contents: string): string {
  const target = join(getLegacyAppHomeDir(home), relativePath)
  mkdirSync(join(target, '..'), { recursive: true })
  writeFileSync(target, contents, 'utf8')
  return target
}

function canonicalPath(relativePath: string): string {
  return join(getAppHomeDir(home), relativePath)
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'aio-ade-home-adoption-'))
})

afterEach(() => {
  home = ''
})

describe('adoptLegacyAppHome', () => {
  it('does nothing when no pre-rebrand directory exists', () => {
    const result = adoptLegacyAppHome(home)

    expect(result).toMatchObject({ ranMigration: false, adopted: [], failed: [] })
    // A fresh install must not be given an empty canonical root it never asked for.
    expect(existsSync(getAppHomeDir(home))).toBe(false)
  })

  it('copies durable credentials and settings into the canonical root', () => {
    legacyFile('keybindings.json', '{"version":1}')
    legacyFile('jira-sites.json', '[{"id":"site"}]')
    legacyFile(join('jira-tokens', 'c2l0ZQ.enc'), 'encrypted-token')
    legacyFile('openai-speech-token.enc', 'encrypted-key')

    const result = adoptLegacyAppHome(home)

    expect(result.ranMigration).toBe(true)
    expect(result.failed).toEqual([])
    expect(readFileSync(canonicalPath('keybindings.json'), 'utf8')).toBe('{"version":1}')
    expect(readFileSync(canonicalPath('jira-sites.json'), 'utf8')).toBe('[{"id":"site"}]')
    // Nested token directories must come across whole or the site stays unauthenticated.
    expect(readFileSync(canonicalPath(join('jira-tokens', 'c2l0ZQ.enc')), 'utf8')).toBe(
      'encrypted-token'
    )
    expect(readFileSync(canonicalPath('openai-speech-token.enc'), 'utf8')).toBe('encrypted-key')
  })

  it('leaves the pre-rebrand copy in place so a downgrade still finds it', () => {
    legacyFile('keybindings.json', '{"version":1}')

    adoptLegacyAppHome(home)

    expect(existsSync(join(getLegacyAppHomeDir(home), 'keybindings.json'))).toBe(true)
  })

  it('never overwrites an entry the canonical root already has', () => {
    legacyFile('jira-sites.json', 'legacy')
    mkdirSync(getAppHomeDir(home), { recursive: true })
    writeFileSync(canonicalPath('jira-sites.json'), 'current', 'utf8')

    const result = adoptLegacyAppHome(home)

    expect(readFileSync(canonicalPath('jira-sites.json'), 'utf8')).toBe('current')
    expect(result.adopted).not.toContain('jira-sites.json')
  })

  it('skips entries the app regenerates on demand', () => {
    legacyFile(join('agent-hooks', 'claude-hook.sh'), '#!/bin/sh\n')
    legacyFile(join('claude-agent-teams-bin', 'tmux'), '#!/bin/sh\n')

    const result = adoptLegacyAppHome(home)

    for (const entry of REGENERATED_LEGACY_HOME_ENTRIES) {
      expect(existsSync(canonicalPath(entry))).toBe(false)
      expect(result.adopted).not.toContain(entry)
    }
  })

  it('skips symlinks instead of following them out of the home directory', () => {
    const outside = join(home, 'outside-secret')
    writeFileSync(outside, 'do-not-copy', 'utf8')
    mkdirSync(getLegacyAppHomeDir(home), { recursive: true })
    symlinkSync(outside, join(getLegacyAppHomeDir(home), 'linear-token.enc'))
    legacyFile('linear-viewer.json', '{"id":"viewer"}')

    const result = adoptLegacyAppHome(home)

    expect(existsSync(canonicalPath('linear-token.enc'))).toBe(false)
    expect(result.adopted).toContain('linear-viewer.json')
  })

  it('runs the copy once and then leaves both roots alone', () => {
    legacyFile('keybindings.json', 'legacy')
    adoptLegacyAppHome(home)
    writeFileSync(canonicalPath('keybindings.json'), 'edited-after-migration', 'utf8')

    const second = adoptLegacyAppHome(home)

    expect(second.ranMigration).toBe(false)
    expect(readFileSync(canonicalPath('keybindings.json'), 'utf8')).toBe('edited-after-migration')
  })

  // Mode bits do not block root, and win32 ignores them entirely.
  const canBlockReads = process.platform !== 'win32' && process.getuid?.() !== 0
  it.runIf(canBlockReads)('reports a failed entry without abandoning the rest', () => {
    legacyFile(join('linear-tokens', 'workspace.enc'), 'encrypted')
    legacyFile('keybindings.json', '{"version":1}')
    chmodSync(join(getLegacyAppHomeDir(home), 'linear-tokens'), 0o000)

    const result = adoptLegacyAppHome(home)

    chmodSync(join(getLegacyAppHomeDir(home), 'linear-tokens'), 0o700)
    expect(result.adopted).toContain('keybindings.json')
    expect(result.failed.map((failure) => failure.entry)).toContain('linear-tokens')
  })

  it.runIf(canBlockReads)('retries after a failure instead of stranding that store', () => {
    legacyFile(join('linear-tokens', 'workspace.enc'), 'encrypted')
    const tokenDir = join(getLegacyAppHomeDir(home), 'linear-tokens')
    chmodSync(tokenDir, 0o000)
    expect(adoptLegacyAppHome(home).failed).not.toEqual([])
    chmodSync(tokenDir, 0o700)

    // Why: a transient permission error must not permanently skip a credential store, so the
    // one-shot marker is only written once every allowlisted entry came across.
    const retry = adoptLegacyAppHome(home)

    expect(retry.ranMigration).toBe(true)
    expect(retry.failed).toEqual([])
    expect(readFileSync(canonicalPath(join('linear-tokens', 'workspace.enc')), 'utf8')).toBe(
      'encrypted'
    )
  })

  it('keeps the adopted set and the regenerated set disjoint', () => {
    for (const entry of REGENERATED_LEGACY_HOME_ENTRIES) {
      expect(ADOPTED_LEGACY_HOME_ENTRIES).not.toContain(entry)
    }
  })
})
