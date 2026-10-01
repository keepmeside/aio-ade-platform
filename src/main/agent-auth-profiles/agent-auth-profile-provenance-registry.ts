import type { AgentAuthProfileLaunchProvenance } from '../../shared/agent-auth-profile-bindings'

// Per-PTY-session record of the auth source a launch actually used — ids and
// levels only, never a profile snapshot or secret material. In-memory like the
// codex pane-account registry; the launch path records into it after the
// resolver picks the effective profile.
export class AgentAuthProfileProvenanceRegistry {
  private readonly bySessionId = new Map<string, AgentAuthProfileLaunchProvenance>()

  record(provenance: AgentAuthProfileLaunchProvenance): void {
    if (!provenance.sessionId) {
      throw new Error('Agent auth profile provenance requires a session id.')
    }
    this.bySessionId.set(provenance.sessionId, provenance)
  }

  resolve(sessionId: string): AgentAuthProfileLaunchProvenance | null {
    return this.bySessionId.get(sessionId) ?? null
  }

  delete(sessionId: string): void {
    this.bySessionId.delete(sessionId)
  }

  staleSessionIds(liveSessionIds: ReadonlySet<string>): string[] {
    const stale: string[] = []
    for (const sessionId of this.bySessionId.keys()) {
      if (!liveSessionIds.has(sessionId)) {
        stale.push(sessionId)
      }
    }
    return stale
  }
}
