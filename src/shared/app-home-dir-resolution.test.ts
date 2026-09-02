import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { resolveExistingAppHomeDir, resolveExistingAppHomePath } from './app-home-dir-resolution'
import { getAppHomeDir, getLegacyAppHomeDir } from './app-home-paths'

let home: string

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'aio-ade-home-resolve-'))
})

describe('resolveExistingAppHomeDir', () => {
  it('creates nothing and points at the canonical root when starting clean', () => {
    expect(resolveExistingAppHomeDir(home)).toBe(getAppHomeDir(home))
  })

  it('keeps using the pre-rebrand root when only that one exists', () => {
    mkdirSync(getLegacyAppHomeDir(home), { recursive: true })

    expect(resolveExistingAppHomeDir(home)).toBe(getLegacyAppHomeDir(home))
  })

  it('prefers the canonical root once it exists', () => {
    mkdirSync(getLegacyAppHomeDir(home), { recursive: true })
    mkdirSync(getAppHomeDir(home), { recursive: true })

    expect(resolveExistingAppHomeDir(home)).toBe(getAppHomeDir(home))
  })
})

describe('resolveExistingAppHomePath', () => {
  it('falls back per entry so one adopted file does not hide the rest', () => {
    mkdirSync(getAppHomeDir(home), { recursive: true })
    writeFileSync(join(getAppHomeDir(home), 'keybindings.json'), '{}', 'utf8')
    mkdirSync(getLegacyAppHomeDir(home), { recursive: true })
    writeFileSync(join(getLegacyAppHomeDir(home), 'jira-sites.json'), '[]', 'utf8')

    expect(resolveExistingAppHomePath(home, 'keybindings.json')).toBe(
      join(getAppHomeDir(home), 'keybindings.json')
    )
    expect(resolveExistingAppHomePath(home, 'jira-sites.json')).toBe(
      join(getLegacyAppHomeDir(home), 'jira-sites.json')
    )
  })

  it('returns the canonical write target when neither root has the entry', () => {
    expect(resolveExistingAppHomePath(home, 'sessions')).toBe(join(getAppHomeDir(home), 'sessions'))
  })
})
