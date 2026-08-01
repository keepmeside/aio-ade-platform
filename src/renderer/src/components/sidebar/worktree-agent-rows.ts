import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { isExplicitAgentStatusFresh } from '@/lib/agent-status'
import type { RetainedAgentEntry } from '@/store/slices/agent-status'
import {
  AGENT_STATUS_STALE_AFTER_MS,
  type AgentType,
  type AgentStatusEntry
} from '../../../../shared/agent-status-types'
import {
  makePaneKey,
  parseLegacyNumericPaneKey,
  parsePaneKey
} from '../../../../shared/stable-pane-id'
import type {
  TerminalLayoutSnapshot,
  TerminalPaneLayoutNode,
  TerminalTab
} from '../../../../shared/types'
import { resolveRuntimePaneTitleLeafId } from '@/lib/runtime-pane-title-leaf-id'
import {
  buildTitleDerivedAgentRows,
  resolveAgentTypeFromTerminalTitle
} from './worktree-title-derived-agent-rows'
import { buildSubagentChildRows } from './worktree-subagent-child-rows'
import { resolveCompatibleAgentTypeForOwner } from '../../../../shared/agent-title-owner'
import { compareWorktreeAgentRows } from './worktree-agent-row-order'
import {
  effectiveWorktreeAgentRowStartedAt,
  tabFromWorktreeAttributedStatusEntry
} from './worktree-agent-row-fallback-tab'

/**
 * Resolves the sidebar row agent type, prioritizing launch agent configuration
 * and normalizing compatible agent kinds.
 */
function resolveRowAgentType(entry: AgentStatusEntry, tab?: TerminalTab | null): AgentType {
  const entryAgentType = resolveCompatibleAgentTypeForOwner(entry.agentType, tab?.launchAgent)
  if (entryAgentType && entryAgentType !== 'unknown') {
    return entryAgentType
  }
  return (
    resolveAgentTypeFromTerminalTitle(entry.terminalTitle ?? tab?.title, tab?.launchAgent) ??
    tab?.launchAgent ??
    entryAgentType ??
    'unknown'
  )
}

function countTerminalLayoutLeaves(node: TerminalPaneLayoutNode | null | undefined): number {
  if (!node) {
    return 0
  }
  if (node.type === 'leaf') {
    return 1
  }
  return countTerminalLayoutLeaves(node.first) + countTerminalLayoutLeaves(node.second)
}

function seenStablePaneKeysForTab(seenPaneKeys: Set<string>, tabId: string): string[] {
  const keys: string[] = []
  for (const paneKey of seenPaneKeys) {
    const parsed = parsePaneKey(paneKey)
    if (parsed?.tabId === tabId) {
      keys.push(paneKey)
    }
  }
  return keys
}

function isRetainedLegacyAliasOfSeenStablePane(args: {
  paneKey: string
  terminalLayoutsByTabId?: Record<string, TerminalLayoutSnapshot | undefined>
  seenPaneKeys: Set<string>
}): boolean {
  const legacy = parseLegacyNumericPaneKey(args.paneKey)
  if (!legacy) {
    return false
  }
  const stablePaneKeys = seenStablePaneKeysForTab(args.seenPaneKeys, legacy.tabId)
  if (stablePaneKeys.length === 0) {
    return false
  }

  const layout = args.terminalLayoutsByTabId?.[legacy.tabId]
  const leafId = resolveRuntimePaneTitleLeafId(layout, legacy.numericPaneId)
  if (leafId) {
    return args.seenPaneKeys.has(makePaneKey(legacy.tabId, leafId))
  }

  // Why: old PaneManager ids can advance across remounts/updates even for a
  // single physical pane. Once the tab has exactly one current stable pane,
  // retained numeric rows under that tab are stale aliases of it.
  return countTerminalLayoutLeaves(layout?.root) === 1 && stablePaneKeys.length === 1
}

export function buildWorktreeAgentRows(args: {
  tabs: TerminalTab[]
  entries: AgentStatusEntry[]
  retained: RetainedAgentEntry[]
  runtimePaneTitlesByTabId?: Record<string, Record<number, string>>
  ptyIdsByTabId?: Record<string, string[]>
  terminalLayoutsByTabId?: Record<string, TerminalLayoutSnapshot | undefined>
  now: number
}): DashboardAgentRow[] {
  const rows: DashboardAgentRow[] = []
  const seenPaneKeys = new Set<string>()

  const entriesByTabId = new Map<string, AgentStatusEntry[]>()
  for (const entry of args.entries) {
    const parsed = parsePaneKey(entry.paneKey)
    if (!parsed) {
      continue
    }
    const bucket = entriesByTabId.get(parsed.tabId)
    if (bucket) {
      bucket.push(entry)
    } else {
      entriesByTabId.set(parsed.tabId, [entry])
    }
  }

  for (const tab of args.tabs) {
    const explicitEntries = entriesByTabId.get(tab.id) ?? []
    for (const entry of explicitEntries) {
      const rowEntry = entry
      const isFresh = isExplicitAgentStatusFresh(rowEntry, args.now, AGENT_STATUS_STALE_AFTER_MS)
      const shouldDecay =
        !isFresh &&
        (rowEntry.state === 'working' ||
          rowEntry.state === 'blocked' ||
          rowEntry.state === 'waiting')
      const startedAt = effectiveWorktreeAgentRowStartedAt(rowEntry)
      rows.push({
        paneKey: rowEntry.paneKey,
        entry: rowEntry,
        tab,
        agentType: resolveRowAgentType(rowEntry, tab),
        rowSource: 'live',
        state: shouldDecay ? 'idle' : rowEntry.state,
        startedAt
      })
      rows.push(...buildSubagentChildRows({ parentEntry: rowEntry, tab, parentIsFresh: isFresh }))
      seenPaneKeys.add(rowEntry.paneKey)
    }
  }

  rows.push(...buildTitleDerivedAgentRows({ ...args, seenPaneKeys }))

  // Worktree-attributed status can arrive before its tab is present in this renderer.
  for (const entry of args.entries) {
    if (seenPaneKeys.has(entry.paneKey)) {
      continue
    }
    const rowEntry = entry
    const startedAt = effectiveWorktreeAgentRowStartedAt(rowEntry)
    const tab = tabFromWorktreeAttributedStatusEntry(rowEntry, startedAt)
    if (!tab) {
      continue
    }
    const isFresh = isExplicitAgentStatusFresh(rowEntry, args.now, AGENT_STATUS_STALE_AFTER_MS)
    const shouldDecay =
      !isFresh &&
      (rowEntry.state === 'working' || rowEntry.state === 'blocked' || rowEntry.state === 'waiting')
    rows.push({
      paneKey: rowEntry.paneKey,
      entry: rowEntry,
      tab,
      agentType: resolveRowAgentType(rowEntry, tab),
      rowSource: 'live',
      state: shouldDecay ? 'idle' : rowEntry.state,
      startedAt
    })
    rows.push(...buildSubagentChildRows({ parentEntry: rowEntry, tab, parentIsFresh: isFresh }))
    seenPaneKeys.add(rowEntry.paneKey)
  }

  for (const ra of args.retained) {
    if (seenPaneKeys.has(ra.entry.paneKey)) {
      continue
    }
    if (
      isRetainedLegacyAliasOfSeenStablePane({
        paneKey: ra.entry.paneKey,
        terminalLayoutsByTabId: args.terminalLayoutsByTabId,
        seenPaneKeys
      })
    ) {
      continue
    }
    const rowEntry = ra.entry
    rows.push({
      paneKey: rowEntry.paneKey,
      entry: rowEntry,
      tab: ra.tab,
      agentType: resolveRowAgentType(rowEntry, ra.tab),
      rowSource: 'retained',
      state: 'done',
      startedAt: ra.startedAt
    })
  }

  // Why: hook pings can rebuild the live entry list in a different iteration
  // order. Equal-start agents still need a deterministic sidebar order.
  rows.sort(compareWorktreeAgentRows)
  return rows
}
