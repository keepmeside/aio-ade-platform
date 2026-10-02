import type { AgentAuthProfileLaunchProvenance } from '../../shared/agent-auth-profile-bindings'

// Ephemeral per-session records of which agent auth profile a live PTY
// launched with — the profile-side counterpart of the live-pty gate. Keyed by
// session id and cleared on PTY teardown; nothing here survives a restart.
const launchesBySessionId = new Map<string, AgentAuthProfileLaunchProvenance>()

// Records are write-once per session id: a reattach re-resolves with current
// bindings, but the session keeps the provenance of the launch that actually
// spawned it. An absent record (fresh spawn, or reattach after a restart
// cleared the in-memory registry) records the current resolution.
export function recordAgentAuthProfileLaunch(provenance: AgentAuthProfileLaunchProvenance): void {
  if (!launchesBySessionId.has(provenance.sessionId)) {
    launchesBySessionId.set(provenance.sessionId, provenance)
  }
}

export function forgetAgentAuthProfileLaunch(sessionId: string): void {
  launchesBySessionId.delete(sessionId)
}

export function lookupAgentAuthProfileLaunch(
  sessionId: string
): AgentAuthProfileLaunchProvenance | null {
  return launchesBySessionId.get(sessionId) ?? null
}

// Reverse lookup for edit/delete gating: which live sessions still run a profile.
export function sessionIdsForAgentAuthProfileLaunch(profileId: string): string[] {
  const sessionIds: string[] = []
  for (const provenance of launchesBySessionId.values()) {
    if (provenance.profileId === profileId) {
      sessionIds.push(provenance.sessionId)
    }
  }
  return sessionIds
}

export function clearAgentAuthProfileLaunchRegistryForTests(): void {
  launchesBySessionId.clear()
}
