import type { AgentStatusEntry } from '../../../shared/agent-status-types'

export function getAgentRowPrimaryText(entry: Pick<AgentStatusEntry, 'prompt'>): string {
  return entry.prompt.trim()
}

export function getAgentRowGeneratedTitleText(entry: Pick<AgentStatusEntry, 'prompt'>): string {
  return entry.prompt
}
