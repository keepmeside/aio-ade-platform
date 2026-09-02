import { useAppStore } from '@/store'
import { getRepoAppPath, REPO_APP_DIR_NAME } from '../../../../shared/repo-app-paths'
import { isTerminalDropWindowsPathLike } from './terminal-drop-shell'

export function resolveTerminalDropWorktreePath(
  worktreeId: string,
  fallbackCwd: string | undefined
): string | null {
  const state = useAppStore.getState()
  const allWorktrees = Object.values(state.worktreesByRepo ?? {}).flat()
  const worktree = allWorktrees.find((w) => w.id === worktreeId)
  return worktree?.path ?? fallbackCwd ?? null
}

export function joinRuntimeTerminalDropDir(worktreePath: string): string {
  if (isTerminalDropWindowsPathLike(worktreePath)) {
    return `${worktreePath.replace(/[\\/]+$/, '').replace(/\//g, '\\')}\\${REPO_APP_DIR_NAME}\\drops`
  }
  return getRepoAppPath(worktreePath, 'drops')
}
