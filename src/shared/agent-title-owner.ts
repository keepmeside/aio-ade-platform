import type { AgentStatusEntry, AgentType } from './agent-status-types'

/* Identity functions on purpose. These re-owned title frames between agents sharing a
 * `titleIdentityGroup`; no profile sets one since the roster narrowed, so every branch was dead and
 * the field is gone. Kept as no-ops rather than inlined into 31 call sites across 8 files: an agent
 * that shares a title identity with another would need exactly this seam back. */

export function resolveCompatibleAgentTypeForOwner(
  incomingAgentType: AgentType | null | undefined,
  _ownerAgentType: AgentType | null | undefined
): AgentType | undefined {
  // `||`, not `??`: an empty agent type is absent, same as the removed guard treated it.
  return incomingAgentType || undefined
}

export function normalizeCompatibleAgentTitleForOwner(
  title: string,
  _ownerAgentType: AgentType | null | undefined
): string {
  return title
}

export function normalizeCompatibleAgentStatusEntryForOwner(
  entry: AgentStatusEntry,
  _ownerAgentType: AgentType | null | undefined
): AgentStatusEntry {
  return entry
}
