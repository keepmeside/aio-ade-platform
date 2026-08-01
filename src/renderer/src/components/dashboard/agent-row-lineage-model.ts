import type { DashboardAgentRow } from './useDashboardData'

export type AgentRowLineageTree<T extends DashboardAgentRow> = {
  rootRows: T[]
  childrenByParentPaneKey: Map<string, T[]>
  childPaneKeys: Set<string>
}

export function resolveAgentRowParentPaneKey<T extends DashboardAgentRow>(
  row: T,
  rowsByPaneKey: ReadonlyMap<string, T>,
  _paneKeyByTerminalHandle: ReadonlyMap<string, string>
): string | undefined {
  const parentPaneKey = row.activationPaneKey
  return parentPaneKey && parentPaneKey !== row.paneKey && rowsByPaneKey.has(parentPaneKey)
    ? parentPaneKey
    : undefined
}

export function buildAgentRowLineageTree<T extends DashboardAgentRow>(
  rows: readonly T[]
): AgentRowLineageTree<T> {
  const rowsByPaneKey = new Map(rows.map((row) => [row.paneKey, row]))
  const childrenByParentPaneKey = new Map<string, T[]>()
  const childPaneKeys = new Set<string>()
  for (const row of rows) {
    const parentPaneKey = resolveAgentRowParentPaneKey(row, rowsByPaneKey, new Map())
    if (!parentPaneKey) {
      continue
    }
    childPaneKeys.add(row.paneKey)
    const children = childrenByParentPaneKey.get(parentPaneKey) ?? []
    children.push(row)
    childrenByParentPaneKey.set(parentPaneKey, children)
  }
  return {
    rootRows: rows.filter((row) => !childPaneKeys.has(row.paneKey)),
    childrenByParentPaneKey,
    childPaneKeys
  }
}
