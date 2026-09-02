import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ADOPTED_USER_DATA_ENTRIES, LEGACY_USER_DATA_DIR_NAME } from '../shared/user-data-dir-names'

/* One-way copy of the pre-rebrand userData directory into the new one.
 *
 * Electron derives userData from the app name, so the `name` change moves the entire directory at
 * once. Every store under it then reads as absent and the app presents itself as a fresh install —
 * no error, no failing test. This runs before any store performs its first read.
 *
 * The legacy directory is never modified, so a downgrade still finds its data intact. */

const ADOPTION_MARKER_FILE_NAME = '.legacy-user-data-adopted'

export type LegacyUserDataAdoption = {
  ranMigration: boolean
  adopted: string[]
  failed: { entry: string; reason: string }[]
}

/** Sibling of the canonical directory under the same app-data root. */
export function getLegacyUserDataPath(canonicalUserDataPath: string): string {
  const parent = join(canonicalUserDataPath, '..')
  return join(parent, LEGACY_USER_DATA_DIR_NAME)
}

export function getLegacyUserDataAdoptionMarkerPath(canonicalUserDataPath: string): string {
  return join(canonicalUserDataPath, ADOPTION_MARKER_FILE_NAME)
}

export function adoptLegacyUserData(canonicalUserDataPath: string): LegacyUserDataAdoption {
  const result: LegacyUserDataAdoption = { ranMigration: false, adopted: [], failed: [] }
  const legacyRoot = getLegacyUserDataPath(canonicalUserDataPath)

  /* Why the basename guard: on a case-insensitive filesystem, or if the canonical name ever equals
   * the legacy one, source and target resolve to the same directory and the copy would walk into
   * itself. */
  if (
    legacyRoot === canonicalUserDataPath ||
    existsSync(getLegacyUserDataAdoptionMarkerPath(canonicalUserDataPath)) ||
    !existsSync(legacyRoot)
  ) {
    return result
  }

  result.ranMigration = true
  for (const entry of ADOPTED_USER_DATA_ENTRIES) {
    const source = join(legacyRoot, entry.legacy)
    const target = join(canonicalUserDataPath, entry.canonical)
    // Skipping an existing target keeps a retry from clobbering newer canonical data.
    if (!existsSync(source) || existsSync(target)) {
      continue
    }
    try {
      if (copyWithoutSymlinks(source, target)) {
        result.adopted.push(entry.canonical)
      }
    } catch (error) {
      result.failed.push({
        entry: entry.canonical,
        reason: error instanceof Error ? error.message : String(error)
      })
    }
  }

  try {
    mkdirSync(canonicalUserDataPath, { recursive: true })
    if (result.failed.length === 0) {
      writeFileSync(
        getLegacyUserDataAdoptionMarkerPath(canonicalUserDataPath),
        `${Date.now()}\n`,
        'utf8'
      )
    }
  } catch (error) {
    // No marker means the next launch retries, which is the safe direction.
    result.failed.push({
      entry: ADOPTION_MARKER_FILE_NAME,
      reason: error instanceof Error ? error.message : String(error)
    })
  }
  return result
}

/** Entry names only — several adopted files hold tokens that must never reach a log. */
export function reportLegacyUserDataAdoption(result: LegacyUserDataAdoption): void {
  if (!result.ranMigration) {
    return
  }
  if (result.adopted.length > 0) {
    console.log(`[user-data] adopted from the previous brand: ${result.adopted.join(', ')}`)
  }
  for (const failure of result.failed) {
    console.warn(`[user-data] could not adopt ${failure.entry}: ${failure.reason}`)
  }
}

/** Returns false when the source was a symlink or another non-regular entry. */
function copyWithoutSymlinks(source: string, target: string): boolean {
  const stats = lstatSync(source)
  if (stats.isSymbolicLink()) {
    return false
  }
  if (stats.isFile()) {
    mkdirSync(join(target, '..'), { recursive: true })
    copyFileSync(source, target)
    return true
  }
  if (!stats.isDirectory()) {
    return false
  }
  mkdirSync(target, { recursive: true })
  for (const child of readdirSync(source)) {
    copyWithoutSymlinks(join(source, child), join(target, child))
  }
  return true
}
