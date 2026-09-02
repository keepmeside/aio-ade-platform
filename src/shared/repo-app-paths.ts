/* Paths the app owns inside a user's repository. Renderer-safe: no node builtins, and every join
 * uses `/` because these same relative paths address SSH worktrees and remote runtimes.
 *
 * Both pre-rebrand names live in repositories this project does not own — the directory holds
 * per-user issue-command overrides and markdown templates, and the yaml file is committed and
 * shared across a team. Reads check the canonical name first and fall back; writes go canonical. */

export const REPO_APP_DIR_NAME = '.aio-ade'
export const LEGACY_REPO_APP_DIR_NAME = '.orca'

export const PROJECT_CONFIG_FILE_NAME = 'aio-ade.yaml'
export const LEGACY_PROJECT_CONFIG_FILE_NAME = 'orca.yaml'

function joinRepoPath(repoPath: string, segments: string[]): string {
  return [repoPath.replace(/[\\/]+$/, ''), ...segments].join('/')
}

export function getRepoAppDir(repoPath: string): string {
  return joinRepoPath(repoPath, [REPO_APP_DIR_NAME])
}

export function getLegacyRepoAppDir(repoPath: string): string {
  return joinRepoPath(repoPath, [LEGACY_REPO_APP_DIR_NAME])
}

export function getRepoAppDirCandidates(repoPath: string): string[] {
  return [getRepoAppDir(repoPath), getLegacyRepoAppDir(repoPath)]
}

export function getRepoAppPath(repoPath: string, ...segments: string[]): string {
  return joinRepoPath(repoPath, [REPO_APP_DIR_NAME, ...segments])
}

export function getLegacyRepoAppPath(repoPath: string, ...segments: string[]): string {
  return joinRepoPath(repoPath, [LEGACY_REPO_APP_DIR_NAME, ...segments])
}

export function getRepoAppPathCandidates(repoPath: string, ...segments: string[]): string[] {
  return [getRepoAppPath(repoPath, ...segments), getLegacyRepoAppPath(repoPath, ...segments)]
}

export function getRepoProjectConfigCandidates(repoPath: string): string[] {
  return [
    joinRepoPath(repoPath, [PROJECT_CONFIG_FILE_NAME]),
    joinRepoPath(repoPath, [LEGACY_PROJECT_CONFIG_FILE_NAME])
  ]
}

/** Repo-relative candidates, canonical first — for hosts addressed through a path joiner. */
export function getRepoAppRelativeCandidates(...segments: string[]): string[] {
  return [
    [REPO_APP_DIR_NAME, ...segments].join('/'),
    [LEGACY_REPO_APP_DIR_NAME, ...segments].join('/')
  ]
}
