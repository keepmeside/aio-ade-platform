/**
 * Why: a repo reached over SSH runs the AIO-ADE CLI through the relay shim, which
 * is always deployed as plain `aio-ade` (Unix) / `aio-ade.cmd` (Windows). The
 * Linux-only `aio-ade` rename — which exists solely to avoid shadowing the
 * GNOME Orca screen reader on a local desktop — must not be applied to those
 * remotes, or `aio-ade claude-teams` lands on a PATH where it does not exist.
 * `connectionId` is the SSH signal; WSL and local stay false.
 */
export function repoIsRemote(repo: { connectionId?: string | null }): boolean {
  return Boolean(repo.connectionId)
}
