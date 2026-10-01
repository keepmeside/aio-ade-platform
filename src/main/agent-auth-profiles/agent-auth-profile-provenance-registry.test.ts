import { describe, expect, it } from 'vitest'
import type { AgentAuthProfileLaunchProvenance } from '../../shared/agent-auth-profile-bindings'
import { AgentAuthProfileProvenanceRegistry } from './agent-auth-profile-provenance-registry'

function makeProvenance(
  sessionId: string,
  overrides: Partial<AgentAuthProfileLaunchProvenance> = {}
): AgentAuthProfileLaunchProvenance {
  return {
    sessionId,
    provider: 'claude',
    level: 'provider-default',
    profileId: 'profile-work',
    accountId: null,
    resolvedAt: 1_700_000_000_000,
    ...overrides
  }
}

describe('agent auth profile provenance registry', () => {
  it('records and resolves per-session provenance', () => {
    const registry = new AgentAuthProfileProvenanceRegistry()
    const provenance = makeProvenance('session-1')
    registry.record(provenance)
    expect(registry.resolve('session-1')).toEqual(provenance)
    expect(registry.resolve('session-unknown')).toBeNull()
  })

  it('overwrites the record when a session relaunches', () => {
    const registry = new AgentAuthProfileProvenanceRegistry()
    registry.record(makeProvenance('session-1', { level: 'worktree' }))
    const relaunch = makeProvenance('session-1', { level: 'session', resolvedAt: 2 })
    registry.record(relaunch)
    expect(registry.resolve('session-1')).toEqual(relaunch)
  })

  it('deletes records for ended sessions', () => {
    const registry = new AgentAuthProfileProvenanceRegistry()
    registry.record(makeProvenance('session-1'))
    registry.delete('session-1')
    expect(registry.resolve('session-1')).toBeNull()
    registry.delete('session-never-recorded')
  })

  it('reports recorded sessions that are no longer live', () => {
    const registry = new AgentAuthProfileProvenanceRegistry()
    registry.record(makeProvenance('session-live'))
    registry.record(makeProvenance('session-gone-1'))
    registry.record(makeProvenance('session-gone-2'))
    expect(registry.staleSessionIds(new Set(['session-live']))).toEqual([
      'session-gone-1',
      'session-gone-2'
    ])
    expect(registry.staleSessionIds(new Set(['session-live', 'session-gone-1']))).toEqual([
      'session-gone-2'
    ])
  })

  it('rejects records without a session id', () => {
    const registry = new AgentAuthProfileProvenanceRegistry()
    expect(() => registry.record(makeProvenance(''))).toThrow(/session id/)
  })
})
