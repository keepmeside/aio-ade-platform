import { existsSync } from 'node:fs'
import { getAppHomeDir, getAppHomePathCandidates, getLegacyAppHomeDir } from './app-home-paths'

/* Read-side resolution for processes that cannot run the one-way adoption copy — the deployed
 * relay binary on a remote host and the CLI, neither of which owns the desktop app's startup.
 * They keep using whichever root already holds the data and create the canonical one when
 * starting clean, so an existing remote install is never silently reset. */

export function resolveExistingAppHomeDir(homePath: string): string {
  const canonical = getAppHomeDir(homePath)
  if (existsSync(canonical)) {
    return canonical
  }
  const legacy = getLegacyAppHomeDir(homePath)
  return existsSync(legacy) ? legacy : canonical
}

/** The first candidate that exists, or the canonical path when neither does. */
export function resolveExistingAppHomePath(homePath: string, ...segments: string[]): string {
  const candidates = getAppHomePathCandidates(homePath, ...segments)
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}
