export function pickRemoteCliEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const picked: Record<string, string> = {}
  for (const key of [
    'AIO_ADE_TERMINAL_HANDLE',
    'AIO_ADE_WORKTREE_ID',
    'AIO_ADE_PANE_KEY',
    'AIO_ADE_WORKSPACE_ID',
    'AIO_ADE_USER_DATA_PATH',
    'PATH',
    'Path'
  ]) {
    const value = env[key]
    if (typeof value === 'string') {
      picked[key] = value
    }
  }
  return picked
}
