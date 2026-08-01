import type { AgentStatusEntry } from '../../../shared/agent-status-types'
import { parseLegacyNumericPaneKey, parsePaneKey } from '../../../shared/stable-pane-id'

export type AgentStatusPaneIdentity = { tabId: string; paneId: string }

export function parseAgentStatusPaneIdentity(
  paneKey: string | undefined
): AgentStatusPaneIdentity | null {
  if (!paneKey) {
    return null
  }
  const parsed = parsePaneKey(paneKey)
  if (parsed) {
    return { tabId: parsed.tabId, paneId: parsed.leafId }
  }
  const legacy = parseLegacyNumericPaneKey(paneKey)
  return legacy ? { tabId: legacy.tabId, paneId: legacy.numericPaneId } : null
}

export function resolveAgentStatusWorktreeId(
  entry: Pick<AgentStatusEntry, 'paneKey' | 'worktreeId'>,
  worktreeIdByTabId: ReadonlyMap<string, string>
): string | null {
  const paneIdentity = parseAgentStatusPaneIdentity(entry.paneKey)
  return worktreeIdByTabId.get(paneIdentity?.tabId ?? '') ?? entry.worktreeId ?? null
}
