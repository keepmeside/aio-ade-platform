// Ephemeral session-level profile pins. In-memory like the provenance
// registry: a session id only names a live PTY, so pins die with the app
// session and never persist to disk.
export class AgentAuthProfileSessionBindings {
  private readonly bySessionId = new Map<string, string>()

  set(sessionId: string, profileId: string): void {
    if (!sessionId) {
      throw new Error('Agent auth profile session binding requires a session id.')
    }
    this.bySessionId.set(sessionId, profileId)
  }

  clear(sessionId: string): void {
    this.bySessionId.delete(sessionId)
  }

  resolve(sessionId: string): string | null {
    return this.bySessionId.get(sessionId) ?? null
  }

  // Returns the session ids whose pins referenced the deleted profile so the
  // caller can surface the change; the pins themselves are gone.
  deleteProfile(profileId: string): string[] {
    const affected: string[] = []
    for (const [sessionId, boundProfileId] of this.bySessionId) {
      if (boundProfileId === profileId) {
        this.bySessionId.delete(sessionId)
        affected.push(sessionId)
      }
    }
    return affected
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
