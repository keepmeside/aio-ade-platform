/** SSH-backed repos carry a connection id; local and WSL repos do not. */
export function repoIsRemote(repo: { connectionId?: string | null }): boolean {
  return Boolean(repo.connectionId)
}
