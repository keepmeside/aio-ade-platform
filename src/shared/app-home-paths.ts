import { join } from 'node:path'

/** Dot-directory the app owns inside the user's home. */
export const APP_HOME_DIR_NAME = '.aio-ade'

/* Why: the pre-rebrand name. Jira/Linear tokens, the speech API key, keybindings and remote
 * relay session snapshots all live under it on an existing install. A dot-directory is invisible
 * to a diff review, so renaming without reading both would strand that data and the app would
 * simply look freshly installed — nothing would fail. Reads check both roots, writes go to the
 * canonical one, and `legacy-app-home-adoption` copies the durable entries across once. */
export const LEGACY_APP_HOME_DIR_NAME = '.orca'

export function getAppHomeDir(homePath: string): string {
  return join(homePath, APP_HOME_DIR_NAME)
}

export function getLegacyAppHomeDir(homePath: string): string {
  return join(homePath, LEGACY_APP_HOME_DIR_NAME)
}

export function getAppHomePath(homePath: string, ...segments: string[]): string {
  return join(getAppHomeDir(homePath), ...segments)
}

export function getLegacyAppHomePath(homePath: string, ...segments: string[]): string {
  return join(getLegacyAppHomeDir(homePath), ...segments)
}

/** Both roots, canonical first — for read-with-fallback and for uninstall sweeps. */
export function getAppHomePathCandidates(homePath: string, ...segments: string[]): string[] {
  return [getAppHomePath(homePath, ...segments), getLegacyAppHomePath(homePath, ...segments)]
}

// Why: a Windows host addresses POSIX remotes over SSH/WSL, so these must not pick up `\`.
function joinPosix(homePath: string, dirName: string, segments: string[]): string {
  return [homePath.replace(/\/+$/, ''), dirName, ...segments].join('/')
}

export function getPosixAppHomePath(remoteHome: string, ...segments: string[]): string {
  return joinPosix(remoteHome, APP_HOME_DIR_NAME, segments)
}

export function getLegacyPosixAppHomePath(remoteHome: string, ...segments: string[]): string {
  return joinPosix(remoteHome, LEGACY_APP_HOME_DIR_NAME, segments)
}

export function getPosixAppHomePathCandidates(remoteHome: string, ...segments: string[]): string[] {
  return [
    getPosixAppHomePath(remoteHome, ...segments),
    getLegacyPosixAppHomePath(remoteHome, ...segments)
  ]
}
