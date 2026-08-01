import { describe, expect, it } from 'vitest'
import { buildDashboardSnapshot, type DashboardSnapshotState } from './build-dashboard-snapshot'
import {
  AGENT_STATUS_STALE_AFTER_MS,
  type AgentStatusEntry
} from '../../../../shared/agent-status-types'
import { DASHBOARD_MAX_LABEL_LENGTH } from '../../../../shared/dashboard-snapshot'
import { makePaneKey } from '../../../../shared/stable-pane-id'
import type { TerminalTab, Worktree } from '../../../../shared/types'

const NOW = 1_000_000_000
const TAB_ID = 'tab1'
const LEAF_ID = '11111111-1111-4111-8111-111111111111'
const GONE_LEAF_ID = '22222222-2222-4222-8222-222222222222'
const PANE_KEY = makePaneKey(TAB_ID, LEAF_ID)

function entry(overrides: Partial<AgentStatusEntry>): AgentStatusEntry {
  return {
    paneKey: PANE_KEY,
    state: 'working',
    prompt: 'do the thing',
    updatedAt: NOW,
    stateStartedAt: NOW - 5000,
    stateHistory: [],
    agentType: 'claude',
    tabId: TAB_ID,
    worktreeId: 'w1',
    ...overrides
  }
}

function tab(id = TAB_ID, worktreeId = 'w1'): TerminalTab {
  return {
    id,
    ptyId: 'pty1',
    worktreeId,
    title: 'agent',
    customTitle: null,
    color: null,
    sortOrder: 0,
    createdAt: NOW
  }
}

function worktree(id = 'w1', displayName = 'wt-one'): Worktree {
  return {
    id,
    repoId: 'r1',
    path: `/r1/${id}`,
    head: 'abc123',
    branch: 'main',
    isBare: false,
    isMainWorktree: false,
    displayName,
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: NOW
  }
}

function baseState(overrides: Partial<DashboardSnapshotState>): DashboardSnapshotState {
  return {
    repos: [{ id: 'r1', path: '/r1', displayName: 'Repo One', badgeColor: '#000' }],
    worktreesByRepo: { r1: [worktree()] },
    tabsByWorktree: { w1: [tab()] },
    agentStatusByPaneKey: {},
    retainedAgentsByPaneKey: {},
    migrationUnsupportedByPtyId: {},
    terminalLayoutsByTabId: {
      [TAB_ID]: {
        root: { type: 'leaf', leafId: LEAF_ID },
        activeLeafId: LEAF_ID,
        ptyIdsByLeafId: { [LEAF_ID]: 'pty1' }
      }
    },
    ptyIdsByTabId: { [TAB_ID]: ['pty1'] },
    runtimePaneTitlesByTabId: {},
    acknowledgedAgentsByPaneKey: {},
    ...overrides
  } as unknown as DashboardSnapshotState
}

describe('buildDashboardSnapshot', () => {
  it('publishes project and workspace-status filters without agent cards', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        repos: [
          { id: 'r1', path: '/r1', displayName: 'Repo One', badgeColor: '#000' },
          { id: 'r2', path: '/r2', displayName: 'Repo Two', badgeColor: '#000' }
        ],
        worktreesByRepo: {
          r1: [worktree()],
          r2: [worktree('w2', 'wt-two')]
        },
        workspaceStatuses: [
          { id: 'planned', label: 'Planned', color: 'neutral' },
          { id: 'active', label: 'Active', color: 'blue' }
        ]
      } as unknown as Partial<DashboardSnapshotState>),
      NOW
    )

    expect(snapshot.cards).toEqual([])
    expect(snapshot.filterOptions).toEqual({
      projects: [
        { id: 'r1', label: 'Repo One' },
        { id: 'r2', label: 'Repo Two' }
      ],
      workspaceStatuses: [
        { id: 'planned', label: 'Planned', color: 'neutral' },
        { id: 'active', label: 'Active', color: 'blue' }
      ]
    })
  })

  it('maps a live working agent to the working bucket with a resolved ptyId', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        agentStatusByPaneKey: {
          [PANE_KEY]: entry({ state: 'working', lastAssistantMessage: 'Working on it now' })
        }
      }),
      NOW
    )
    expect(snapshot.cards).toHaveLength(1)
    const card = snapshot.cards[0]
    expect(card.bucket).toBe('working')
    expect(card.dotState).toBe('working')
    expect(card.ptyId).toBe('pty1')
    expect(card.worktreeName).toBe('wt-one')
    expect(card.repoName).toBe('Repo One')
    expect(card.leafId).toBe(LEAF_ID)
    expect(card.lastUserMessage).toBe('do the thing')
    expect(card.lastAgentMessage).toBe('Working on it now')
    // Column ordering key: when the agent entered its current state.
    expect(card.stateChangedAt).toBe(NOW - 5000)
    // No ack yet → unseen, mirroring the sidebar's unvisited signal.
    expect(card.unseen).toBe(true)
  })

  it('carries the tab conversation name and drops status-only titles', () => {
    const named = buildDashboardSnapshot(
      baseState({
        agentStatusByPaneKey: { [PANE_KEY]: entry({}) },
        tabsByWorktree: { w1: [{ ...tab(), customTitle: 'Sparse-checkout parser' }] }
      }),
      NOW
    )
    expect(named.cards[0].conversationName).toBe('Sparse-checkout parser')

    // The fixture tab's title is the 'agent' placeholder — not a name.
    const unnamed = buildDashboardSnapshot(
      baseState({ agentStatusByPaneKey: { [PANE_KEY]: entry({}) } }),
      NOW
    )
    expect(unnamed.cards[0].conversationName).toBeUndefined()
  })

  // Why: `orca terminal rename --title` is unbounded, and the main-process
  // validator drops any card whose label exceeds the shared bound.
  it('truncates labels to the length the snapshot validator accepts', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        agentStatusByPaneKey: { [PANE_KEY]: entry({}) },
        tabsByWorktree: { w1: [{ ...tab(), customTitle: 'x'.repeat(5_000) }] }
      }),
      NOW
    )

    expect(snapshot.cards[0].conversationName).toHaveLength(DASHBOARD_MAX_LABEL_LENGTH)
  })

  // Why: filterOptions is snapshot-level, so an over-long project label is not
  // recoverable by dropping a card — it invalidates the entire board.
  it('truncates the project filter label the whole snapshot rides on', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        repos: [
          { id: 'r1', path: '/r1', displayName: 'x'.repeat(5_000), badgeColor: '#000', addedAt: 0 }
        ]
      }),
      NOW
    )

    expect(snapshot.filterOptions?.projects[0].label).toHaveLength(DASHBOARD_MAX_LABEL_LENGTH)
  })

  it('withholds generated titles until the setting enables them', () => {
    const tabs = { w1: [{ ...tab(), generatedTitle: 'Fix the flaky pty test' }] }
    const off = buildDashboardSnapshot(
      baseState({ agentStatusByPaneKey: { [PANE_KEY]: entry({}) }, tabsByWorktree: tabs }),
      NOW
    )
    expect(off.cards[0].conversationName).toBeUndefined()

    const on = buildDashboardSnapshot(
      baseState({
        agentStatusByPaneKey: { [PANE_KEY]: entry({}) },
        tabsByWorktree: tabs,
        settings: { tabAutoGenerateTitle: true }
      } as unknown as Partial<DashboardSnapshotState>),
      NOW
    )
    expect(on.cards[0].conversationName).toBe('Fix the flaky pty test')
  })

  it('ships one icon per card-bearing repo, and none for repos without cards', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        repos: [
          {
            id: 'r1',
            path: '/r1',
            displayName: 'Repo One',
            badgeColor: '#000',
            repoIcon: { type: 'lucide', name: 'Rocket' }
          },
          { id: 'r2', path: '/r2', displayName: 'Repo Two', badgeColor: '#000' }
        ],
        worktreesByRepo: { r1: [worktree()], r2: [worktree('w2', 'wt-two')] },
        agentStatusByPaneKey: { [PANE_KEY]: entry({}) }
      } as unknown as Partial<DashboardSnapshotState>),
      NOW
    )
    // r2 has a worktree but no agent card, so its icon never ships.
    expect(snapshot.repoIconsByRepoId).toEqual({ r1: { type: 'lucide', name: 'Rocket' } })
  })

  it('records a null icon for a card-bearing repo that has none', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({ agentStatusByPaneKey: { [PANE_KEY]: entry({}) } }),
      NOW
    )
    expect(snapshot.repoIconsByRepoId).toEqual({ r1: null })
  })

  it('nulls ptyId when the layout entry points at a dead pty', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        agentStatusByPaneKey: { [PANE_KEY]: entry({}) },
        // Layout still remembers pty1 (it survives restarts), but the live
        // set says that pty is gone — e.g. a parked tab after an app restart.
        ptyIdsByTabId: { [TAB_ID]: [] }
      }),
      NOW
    )
    expect(snapshot.cards[0].ptyId).toBeNull()
  })

  it('mutes unseen once the agent is acknowledged after its state change', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        agentStatusByPaneKey: { [PANE_KEY]: entry({}) },
        acknowledgedAgentsByPaneKey: { [PANE_KEY]: NOW - 1000 }
      }),
      NOW
    )
    // ack (NOW-1000) is after stateStartedAt (NOW-5000) → seen.
    expect(snapshot.cards[0].unseen).toBe(false)
  })

  it('does not mark title-derived rows unseen from synthetic timestamps', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        agentStatusByPaneKey: {},
        runtimePaneTitlesByTabId: {
          [TAB_ID]: { 1: '⠋ Claude Code' }
        }
      }),
      NOW
    )

    expect(snapshot.cards).toHaveLength(1)
    expect(snapshot.cards[0].startedAt).toBe(0)
    expect(snapshot.cards[0].unseen).toBe(false)
  })

  it.each(['blocked', 'waiting'] as const)(
    'routes %s agents to the attention bucket with an ask summary',
    (state) => {
      const snapshot = buildDashboardSnapshot(
        baseState({
          agentStatusByPaneKey: {
            [PANE_KEY]: entry({ state, interactivePrompt: 'Approve deploy?' })
          }
        }),
        NOW
      )
      expect(snapshot.cards[0].bucket).toBe('attention')
      expect(snapshot.cards[0].dotState).toBe(state)
      expect(snapshot.cards[0].askSummary).toBe('Approve deploy?')
    }
  )

  it('decays a stale working agent to the idle bucket', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        agentStatusByPaneKey: {
          [PANE_KEY]: entry({
            state: 'working',
            updatedAt: NOW - AGENT_STATUS_STALE_AFTER_MS - 1000
          })
        }
      }),
      NOW
    )
    expect(snapshot.cards[0].bucket).toBe('idle')
    expect(snapshot.cards[0].dotState).toBe('idle')
  })

  it('routes retained done agents to the done bucket', () => {
    const donePaneKey = makePaneKey(TAB_ID, GONE_LEAF_ID)
    const snapshot = buildDashboardSnapshot(
      baseState({
        retainedAgentsByPaneKey: {
          [donePaneKey]: {
            entry: entry({ paneKey: donePaneKey, state: 'done' }),
            worktreeId: 'w1',
            tab: tab() as never,
            agentType: 'claude',
            startedAt: NOW - 60_000
          } as never
        }
      }),
      NOW
    )
    const done = snapshot.cards.find((c) => c.dotState === 'done')
    expect(done).toBeDefined()
    expect(done?.bucket).toBe('done')
  })

  it('includes collapsed subagents and workspace status metadata on the parent card', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        workspaceStatuses: [
          { id: 'todo', label: 'Todo', color: 'neutral' },
          { id: 'reviewing', label: 'Reviewing', color: 'emerald' }
        ],
        worktreesByRepo: {
          r1: [{ ...worktree(), workspaceStatus: 'reviewing' }]
        },
        agentStatusByPaneKey: {
          [PANE_KEY]: entry({
            subagents: [
              {
                id: 'child-1',
                state: 'working',
                startedAt: NOW - 1000,
                description: 'Review loop'
              }
            ]
          })
        }
      }),
      NOW
    )

    expect(snapshot.cards).toHaveLength(1)
    expect(snapshot.cards[0]).toMatchObject({
      workspaceStatusId: 'reviewing',
      workspaceStatusLabel: 'Reviewing',
      workspaceStatusColor: 'emerald',
      subagents: [{ name: 'Review loop', dotState: 'working' }]
    })
  })

  it('skips card-only context for count snapshots', () => {
    let linkedReviewReads = 0
    const countWorktree = worktree()
    Object.defineProperty(countWorktree, 'linkedPR', {
      enumerable: true,
      get: () => {
        linkedReviewReads += 1
        return null
      }
    })
    const snapshot = buildDashboardSnapshot(
      baseState({
        worktreesByRepo: { r1: [countWorktree] },
        agentStatusByPaneKey: { [PANE_KEY]: entry({}) }
      }),
      NOW,
      { includeCardDetails: false, includeFilterOptions: false }
    )

    expect(snapshot.cards[0].workspaceStatusId).toBeUndefined()
    expect(snapshot.cards[0].subagents).toBeUndefined()
    // Why: the card has a live pty, so only the count-path gate keeps the
    // host-input resolution off the sidebar's per-status-tick rebuild.
    expect(snapshot.cards[0].ptyId).toBe('pty1')
    expect(snapshot.cards[0].terminalInput).toBeUndefined()
    expect(linkedReviewReads).toBe(0)
  })

  it("resolves a live pty's host-input profile for card snapshots", () => {
    const snapshot = buildDashboardSnapshot(
      baseState({ agentStatusByPaneKey: { [PANE_KEY]: entry({}) } }),
      NOW
    )

    expect(snapshot.cards[0].terminalInput?.windowsShiftEnterEncoding).toBe('alt-enter')
    expect(snapshot.cards[0].terminalInput?.kittyKeyboardAdvertised).toBe(true)
  })

  it('relays the idle-column setting in the serialized snapshot', () => {
    const snapshot = buildDashboardSnapshot(
      baseState({
        settings: { experimentalAgentDashboardShowIdle: true } as never
      }),
      NOW
    )

    expect(snapshot.showIdle).toBe(true)
  })
})
