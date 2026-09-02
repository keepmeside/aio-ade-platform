import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/* Ownership proof for a managed Claude auth directory: a small file naming the account that owns
 * it. Renaming it without reading the old name makes every existing managed account unrecognized
 * — the app rejects its own storage and the user is silently signed out, on the host and on every
 * SSH/WSL runtime whose marker this build cannot reach to fix. */

export const MANAGED_AUTH_MARKER = '.aio-ade-managed-claude-auth'
export const LEGACY_MANAGED_AUTH_MARKER = '.orca-managed-claude-auth'

/** Canonical first; writes always target index 0. */
export const MANAGED_AUTH_MARKERS: readonly string[] = [
  MANAGED_AUTH_MARKER,
  LEGACY_MANAGED_AUTH_MARKER
]

/** The account id recorded in whichever marker exists, or null when none is readable. */
export function readManagedAuthMarkerAccountId(authDirPath: string): string | null {
  for (const marker of MANAGED_AUTH_MARKERS) {
    const markerPath = join(authDirPath, marker)
    try {
      if (!existsSync(markerPath)) {
        continue
      }
      const stats = lstatSync(markerPath)
      if (stats.isSymbolicLink() || !stats.isFile()) {
        continue
      }
      const accountId = readFileSync(markerPath, 'utf-8').trim()
      if (accountId) {
        return accountId
      }
    } catch {
      // Try the next marker; an unreadable marker is not proof of ownership.
    }
  }
  return null
}

export function hasManagedAuthMarker(authDirPath: string): boolean {
  return MANAGED_AUTH_MARKERS.some((marker) => existsSync(join(authDirPath, marker)))
}

/**
 * POSIX test that accepts either marker inside `dirExpression`, for remote and WSL hosts where
 * the check runs as a shell snippet rather than through `node:fs`.
 */
export function buildManagedAuthMarkerShellTest(
  dirExpression: string,
  expectedAccountId: string | null,
  quote: (value: string) => string
): string {
  const clauses = MANAGED_AUTH_MARKERS.map((marker) => {
    const markerPath = `"${dirExpression}/${marker}"`
    const contentTest = expectedAccountId
      ? `test "$(cat ${markerPath})" = ${quote(expectedAccountId)}`
      : `test -n "$(cat ${markerPath})"`
    return `{ test -f ${markerPath} && ${contentTest}; }`
  })
  return clauses.join(' || ')
}
