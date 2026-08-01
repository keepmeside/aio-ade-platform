import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../shared/agent-status-types'
import { collectAgentMetadataForTerminal } from './workspace-tab-agent-metadata'

function makeEntry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'working',
    prompt: 'You are working inside Orca, a multi-agent IDE.',
    updatedAt: 1000,
    stateStartedAt: 900,
    paneKey: 'tab-1:leaf-1',
    worktreeId: 'wt-1',
    stateHistory: [],
    ...overrides
  }
}

describe('collectAgentMetadataForTerminal', () => {
  it('indexes prompt text for tab search snippets', () => {
    const [metadata] = collectAgentMetadataForTerminal({
      terminalTabId: 'tab-1',
      worktreeId: 'wt-1',
      agentStatusByPaneKey: {
        'tab-1:leaf-1': makeEntry({ prompt: 'Fix checkout race' })
      },
      retainedAgentsByPaneKey: {},
      sleepingAgentSessionsByPaneKey: {}
    })

    expect(metadata?.textParts).toContain('Fix checkout race')
    expect(metadata?.snippetCandidates).toContain('Fix checkout race')
  })
})
