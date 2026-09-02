import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildManagedAuthMarkerShellTest,
  LEGACY_MANAGED_AUTH_MARKER,
  MANAGED_AUTH_MARKER,
  readManagedAuthMarkerAccountId
} from './managed-auth-marker'

let authDir: string

beforeEach(() => {
  authDir = mkdtempSync(join(tmpdir(), 'aio-ade-managed-auth-'))
})

describe('managed auth marker names', () => {
  it('writes the current marker and still recognizes the pre-rebrand one', () => {
    expect(MANAGED_AUTH_MARKER).toBe('.aio-ade-managed-claude-auth')
    // The marker is the ownership proof for a managed Claude auth directory. Renaming it
    // without reading the old name makes every existing managed account unrecognized —
    // the app rejects its own storage and the user is silently signed out.
    expect(LEGACY_MANAGED_AUTH_MARKER).toBe('.orca-managed-claude-auth')
  })
})

describe('readManagedAuthMarkerAccountId', () => {
  it('returns null when neither marker is present', () => {
    expect(readManagedAuthMarkerAccountId(authDir)).toBe(null)
  })

  it('reads the current marker', () => {
    writeFileSync(join(authDir, MANAGED_AUTH_MARKER), 'account-1\n', 'utf-8')

    expect(readManagedAuthMarkerAccountId(authDir)).toBe('account-1')
  })

  it('reads a marker written before the rebrand', () => {
    writeFileSync(join(authDir, LEGACY_MANAGED_AUTH_MARKER), 'account-1\n', 'utf-8')

    expect(readManagedAuthMarkerAccountId(authDir)).toBe('account-1')
  })

  it('prefers the current marker when both exist', () => {
    writeFileSync(join(authDir, MANAGED_AUTH_MARKER), 'current\n', 'utf-8')
    writeFileSync(join(authDir, LEGACY_MANAGED_AUTH_MARKER), 'stale\n', 'utf-8')

    expect(readManagedAuthMarkerAccountId(authDir)).toBe('current')
  })

  it('rejects a directory standing in for the marker file', () => {
    mkdirSync(join(authDir, MANAGED_AUTH_MARKER), { recursive: true })

    expect(readManagedAuthMarkerAccountId(authDir)).toBe(null)
  })
})

describe('buildManagedAuthMarkerShellTest', () => {
  it('accepts either marker on a remote or WSL host', () => {
    const script = buildManagedAuthMarkerShellTest(
      '$candidate_real',
      'acct-7',
      (value) => `'${value}'`
    )

    expect(script).toContain(MANAGED_AUTH_MARKER)
    expect(script).toContain(LEGACY_MANAGED_AUTH_MARKER)
    expect(script).toContain("'acct-7'")
  })

  it('only requires a non-empty account id when none is expected', () => {
    const script = buildManagedAuthMarkerShellTest('$dir', null, (value) => `'${value}'`)

    expect(script).toContain('-n')
    expect(script).not.toContain('=')
  })

  it('quotes the account id through the caller-supplied quoter', () => {
    const quote = vi.fn((value: string) => `Q(${value})`)
    const script = buildManagedAuthMarkerShellTest('$dir', "a'b", quote)

    expect(quote).toHaveBeenCalledWith("a'b")
    expect(script).toContain("Q(a'b)")
  })
})
