import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  adoptLegacyUserData,
  getLegacyUserDataAdoptionMarkerPath,
  getLegacyUserDataPath
} from './legacy-user-data-adoption'
import { ADOPTED_USER_DATA_ENTRIES } from '../shared/user-data-dir-names'

/* The `name` change relocates userData wholesale, so the failure this guards is silent: every
 * store reads as absent and the app looks freshly installed. */

function makeAppDataRoot(): { canonical: string; legacy: string } {
  const root = mkdtempSync(join(tmpdir(), 'aio-ade-user-data-adoption-'))
  const canonical = join(root, 'aio-ade')
  mkdirSync(canonical, { recursive: true })
  const legacy = getLegacyUserDataPath(canonical)
  mkdirSync(legacy, { recursive: true })
  return { canonical, legacy }
}

describe('legacy userData adoption', () => {
  it('resolves the legacy directory as a sibling under the same app-data root', () => {
    const { canonical, legacy } = makeAppDataRoot()

    expect(legacy).toBe(join(canonical, '..', 'orca'))
  })

  it('copies the pre-profile data file under its canonical name', () => {
    const { canonical, legacy } = makeAppDataRoot()
    writeFileSync(join(legacy, 'orca-data.json'), '{"settings":{"zoom":2}}', 'utf8')

    const result = adoptLegacyUserData(canonical)

    expect(result.ranMigration).toBe(true)
    expect(result.adopted).toContain('aio-ade-data.json')
    expect(JSON.parse(readFileSync(join(canonical, 'aio-ade-data.json'), 'utf8'))).toEqual({
      settings: { zoom: 2 }
    })
  })

  it('copies the whole profile tree so every profile survives, not just the active one', () => {
    const { canonical, legacy } = makeAppDataRoot()
    mkdirSync(join(legacy, 'profiles', 'work'), { recursive: true })
    mkdirSync(join(legacy, 'profiles', 'personal'), { recursive: true })
    writeFileSync(join(legacy, 'profiles', 'work', 'orca-data.json'), '{"a":1}', 'utf8')
    writeFileSync(join(legacy, 'profiles', 'personal', 'orca-data.json'), '{"b":2}', 'utf8')

    adoptLegacyUserData(canonical)

    expect(readFileSync(join(canonical, 'profiles', 'work', 'orca-data.json'), 'utf8')).toBe(
      '{"a":1}'
    )
    expect(readFileSync(join(canonical, 'profiles', 'personal', 'orca-data.json'), 'utf8')).toBe(
      '{"b":2}'
    )
  })

  it('adopts the account directories, whose names never carried the brand token', () => {
    const { canonical, legacy } = makeAppDataRoot()
    mkdirSync(join(legacy, 'claude-accounts'), { recursive: true })
    writeFileSync(join(legacy, 'claude-accounts', 'index.json'), '{"accounts":[]}', 'utf8')

    const result = adoptLegacyUserData(canonical)

    expect(result.adopted).toContain('claude-accounts')
    expect(readFileSync(join(canonical, 'claude-accounts', 'index.json'), 'utf8')).toBe(
      '{"accounts":[]}'
    )
  })

  it('never follows a symlink out of the legacy directory', () => {
    const { canonical, legacy } = makeAppDataRoot()
    const outside = mkdtempSync(join(tmpdir(), 'aio-ade-outside-'))
    writeFileSync(join(outside, 'secret.json'), '{"token":"x"}', 'utf8')
    symlinkSync(join(outside, 'secret.json'), join(legacy, 'orca-data.json'))

    const result = adoptLegacyUserData(canonical)

    expect(result.adopted).not.toContain('aio-ade-data.json')
    expect(result.failed).toEqual([])
  })

  it('runs once, then leaves a later launch alone', () => {
    const { canonical, legacy } = makeAppDataRoot()
    writeFileSync(join(legacy, 'orca-data.json'), '{"first":true}', 'utf8')

    expect(adoptLegacyUserData(canonical).ranMigration).toBe(true)
    expect(adoptLegacyUserData(canonical).ranMigration).toBe(false)
    expect(getLegacyUserDataAdoptionMarkerPath(canonical)).toContain('.legacy-user-data-adopted')
  })

  it('does not overwrite canonical data that already exists', () => {
    const { canonical, legacy } = makeAppDataRoot()
    writeFileSync(join(legacy, 'orca-data.json'), '{"old":true}', 'utf8')
    writeFileSync(join(canonical, 'aio-ade-data.json'), '{"new":true}', 'utf8')

    adoptLegacyUserData(canonical)

    expect(readFileSync(join(canonical, 'aio-ade-data.json'), 'utf8')).toBe('{"new":true}')
  })

  it('is a no-op when there is no previous install', () => {
    const root = mkdtempSync(join(tmpdir(), 'aio-ade-fresh-'))
    const canonical = join(root, 'aio-ade')
    mkdirSync(canonical, { recursive: true })

    expect(adoptLegacyUserData(canonical).ranMigration).toBe(false)
  })

  /* Why: `safeStorage` derives its macOS key from the app name, so a copied ciphertext cannot be
   * decrypted under the new identity. Copying it would turn a missing credential into a decryption
   * error, which is the worse of the two. */
  it('leaves safeStorage-encrypted credential files behind', () => {
    const encrypted = ADOPTED_USER_DATA_ENTRIES.filter((entry) => entry.legacy.endsWith('.enc'))

    expect(encrypted).toEqual([])
  })
})
