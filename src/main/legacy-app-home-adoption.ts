import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getAppHomeDir, getLegacyAppHomeDir } from '../shared/app-home-paths'

/* One-way copy of the pre-rebrand `~/.orca` directory into `~/.aio-ade`.
 *
 * Durable user data only. Everything the app regenerates is deliberately left behind: copying a
 * stale hook script or shim would resurrect content the installer is about to rewrite anyway, and
 * the hook-config matcher already sweeps managed entries by `agent-hooks/<file>` regardless of the
 * parent directory. The legacy copy is never deleted, so a downgrade still finds its data. */

/** Credentials and settings an existing install would otherwise lose. */
export const ADOPTED_LEGACY_HOME_ENTRIES: readonly string[] = [
  'keybindings.json',
  'jira-sites.json',
  'jira-tokens',
  'linear-token.enc',
  'linear-viewer.json',
  'linear-workspaces.json',
  'linear-tokens',
  'openai-speech-token.enc',
  'sessions'
]

/** Regenerated on demand — present here so a future entry has to pick a side deliberately. */
export const REGENERATED_LEGACY_HOME_ENTRIES: readonly string[] = [
  'agent-hooks',
  'claude-agent-teams-bin'
]

const ADOPTION_MARKER_FILE_NAME = '.legacy-home-adopted'

export type LegacyAppHomeAdoption = {
  ranMigration: boolean
  adopted: string[]
  failed: { entry: string; reason: string }[]
}

export function getLegacyAppHomeAdoptionMarkerPath(homePath: string): string {
  return join(getAppHomeDir(homePath), ADOPTION_MARKER_FILE_NAME)
}

export function adoptLegacyAppHome(homePath: string = homedir()): LegacyAppHomeAdoption {
  const result: LegacyAppHomeAdoption = { ranMigration: false, adopted: [], failed: [] }
  const legacyRoot = getLegacyAppHomeDir(homePath)
  const canonicalRoot = getAppHomeDir(homePath)
  if (existsSync(getLegacyAppHomeAdoptionMarkerPath(homePath)) || !existsSync(legacyRoot)) {
    return result
  }

  result.ranMigration = true
  for (const entry of ADOPTED_LEGACY_HOME_ENTRIES) {
    const source = join(legacyRoot, entry)
    const target = join(canonicalRoot, entry)
    if (!existsSync(source) || existsSync(target)) {
      continue
    }
    try {
      if (copyWithoutSymlinks(source, target)) {
        result.adopted.push(entry)
      }
    } catch (error) {
      result.failed.push({
        entry,
        reason: error instanceof Error ? error.message : String(error)
      })
    }
  }

  try {
    mkdirSync(canonicalRoot, { recursive: true })
    if (result.failed.length === 0) {
      writeFileSync(getLegacyAppHomeAdoptionMarkerPath(homePath), `${Date.now()}\n`, 'utf8')
    }
  } catch (error) {
    // Why: no marker means the next launch retries, which is the safe direction — the copy skips
    // anything already present, so a retry can never clobber newer canonical data. A transient
    // permission error must not permanently strand one credential store.
    result.failed.push({
      entry: ADOPTION_MARKER_FILE_NAME,
      reason: error instanceof Error ? error.message : String(error)
    })
  }
  return result
}

/** Entry names only — the adopted files hold encrypted tokens that must never reach a log. */
export function reportLegacyAppHomeAdoption(result: LegacyAppHomeAdoption): void {
  if (!result.ranMigration) {
    return
  }
  if (result.adopted.length > 0) {
    console.log(`[app-home] adopted from the previous brand: ${result.adopted.join(', ')}`)
  }
  for (const failure of result.failed) {
    console.warn(`[app-home] could not adopt ${failure.entry}: ${failure.reason}`)
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
  const children = readdirSync(source)
  mkdirSync(target, { recursive: true })
  for (const child of children) {
    copyWithoutSymlinks(join(source, child), join(target, child))
  }
  return true
}
