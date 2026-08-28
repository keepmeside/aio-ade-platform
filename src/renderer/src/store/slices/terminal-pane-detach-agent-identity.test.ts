import { describe, expect, it } from 'vitest'
import { createTestStore, makeTab, makeWorktree, seedStore } from './store-test-helpers'

describe('syncPaneDetachPtyOwnership agent identity', () => {
  it('moves process, hook, launch, and resume authority to the detached leaf', () => {
    const store = createTestStore()
    const worktreeId = 'repo::/repo/worktree'
    const sourceTabId = 'tab-source'
    const targetTabId = 'tab-target'
    const detachedLeafId = '11111111-1111-4111-8111-111111111111'
    const siblingLeafId = '22222222-2222-4222-8222-222222222222'
    const sourcePaneKey = `${sourceTabId}:${detachedLeafId}`
    const targetPaneKey = `${targetTabId}:${detachedLeafId}`
    const siblingPaneKey = `${sourceTabId}:${siblingLeafId}`

    seedStore(store, {
      worktreesByRepo: {
        repo: [makeWorktree({ id: worktreeId, repoId: 'repo', path: '/repo/worktree' })]
      },
      tabsByWorktree: {
        [worktreeId]: [
          makeTab({ id: sourceTabId, worktreeId, ptyId: 'pty-detached' }),
          makeTab({ id: targetTabId, worktreeId, ptyId: null })
        ]
      },
      ptyIdsByTabId: {
        [sourceTabId]: ['pty-detached', 'pty-sibling'],
        [targetTabId]: []
      }
    })
    store.getState().setPaneForegroundAgent(sourcePaneKey, {
      agent: 'codex',
      routingTrusted: true,
      shellForeground: false
    })
    store
      .getState()
      .setPaneForegroundAgent(siblingPaneKey, { agent: 'claude', shellForeground: false })
    store
      .getState()
      .registerAgentLaunchConfig(
        sourcePaneKey,
        { agentArgs: '', agentEnv: {} },
        { agentType: 'codex', tabId: sourceTabId, leafId: detachedLeafId }
      )
    store.getState().setAgentStatus(sourcePaneKey, {
      state: 'working',
      prompt: '',
      agentType: 'codex'
    })
    store.setState({
      sleepingAgentSessionsByPaneKey: {
        [sourcePaneKey]: {
          paneKey: sourcePaneKey,
          tabId: sourceTabId,
          worktreeId,
          agent: 'codex',
          providerSession: { key: 'session_id', id: 'session-1' },
          prompt: 'continue',
          state: 'working',
          capturedAt: 1,
          updatedAt: 1
        }
      }
    })

    const epochBeforeDetach = store.getState().agentStatusEpoch

    store.getState().syncPaneDetachPtyOwnership({
      detachedLeafId,
      detachedPtyId: 'pty-detached',
      sourceLayout: {
        root: { type: 'leaf', leafId: siblingLeafId },
        activeLeafId: siblingLeafId,
        expandedLeafId: null,
        ptyIdsByLeafId: { [siblingLeafId]: 'pty-sibling' }
      },
      sourceTabId,
      targetTabId
    })

    const state = store.getState()
    expect(state.paneForegroundAgentByPaneKey[sourcePaneKey]).toBeUndefined()
    expect(state.paneForegroundAgentByPaneKey[targetPaneKey]).toEqual({
      agent: 'codex',
      routingTrusted: true,
      shellForeground: false
    })
    expect(state.agentLaunchConfigByPaneKey[sourcePaneKey]).toBeUndefined()
    expect(state.agentLaunchConfigByPaneKey[targetPaneKey]?.identity).toMatchObject({
      agentType: 'codex',
      tabId: targetTabId,
      leafId: detachedLeafId
    })
    expect(state.agentStatusByPaneKey[sourcePaneKey]).toBeUndefined()
    expect(state.agentStatusByPaneKey[targetPaneKey]).toMatchObject({
      paneKey: targetPaneKey,
      tabId: targetTabId,
      state: 'working'
    })
    expect(state.sleepingAgentSessionsByPaneKey[sourcePaneKey]).toBeUndefined()
    expect(state.sleepingAgentSessionsByPaneKey[targetPaneKey]).toMatchObject({
      paneKey: targetPaneKey,
      tabId: targetTabId,
      providerSession: { key: 'session_id', id: 'session-1' }
    })
    expect(state.retentionSuppressedPaneKeys[sourcePaneKey]).toBeUndefined()
    expect(state.retentionSuppressedPaneKeys[targetPaneKey]).toBeUndefined()
    // Why: the retention effect only reruns on an epoch bump; a moved live row must trigger it.
    expect(state.agentStatusEpoch).toBeGreaterThan(epochBeforeDetach)
    expect(state.paneForegroundAgentByPaneKey[siblingPaneKey]).toEqual({
      agent: 'claude',
      shellForeground: false
    })
  })
})
