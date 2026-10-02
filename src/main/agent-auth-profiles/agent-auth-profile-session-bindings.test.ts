import { describe, expect, it } from 'vitest'
import { AgentAuthProfileSessionBindings } from './agent-auth-profile-session-bindings'

describe('agent auth profile session bindings', () => {
  it('sets and resolves a session binding', () => {
    const bindings = new AgentAuthProfileSessionBindings()
    bindings.set('session-1', 'profile-work')
    expect(bindings.resolve('session-1')).toBe('profile-work')
    expect(bindings.resolve('session-2')).toBeNull()
  })

  it('overwrites a previous binding for the same session', () => {
    const bindings = new AgentAuthProfileSessionBindings()
    bindings.set('session-1', 'profile-work')
    bindings.set('session-1', 'profile-alt')
    expect(bindings.resolve('session-1')).toBe('profile-alt')
  })

  it('clears a session binding', () => {
    const bindings = new AgentAuthProfileSessionBindings()
    bindings.set('session-1', 'profile-work')
    bindings.clear('session-1')
    expect(bindings.resolve('session-1')).toBeNull()
  })

  it('rejects an empty session id', () => {
    const bindings = new AgentAuthProfileSessionBindings()
    expect(() => bindings.set('', 'profile-work')).toThrow(/session id/)
  })

  it('prunes every session binding when a profile is deleted', () => {
    const bindings = new AgentAuthProfileSessionBindings()
    bindings.set('session-1', 'profile-work')
    bindings.set('session-2', 'profile-alt')
    bindings.set('session-3', 'profile-work')

    const affected = bindings.deleteProfile('profile-work')
    expect(affected).toEqual(['session-1', 'session-3'])
    expect(bindings.resolve('session-2')).toBe('profile-alt')
  })

  it('sweeps bindings for sessions that are no longer live', () => {
    const bindings = new AgentAuthProfileSessionBindings()
    bindings.set('session-1', 'profile-work')
    bindings.set('session-2', 'profile-work')

    const stale = bindings.staleSessionIds(new Set(['session-2']))
    expect(stale).toEqual(['session-1'])
    for (const sessionId of stale) {
      bindings.clear(sessionId)
    }
    expect(bindings.resolve('session-1')).toBeNull()
    expect(bindings.resolve('session-2')).toBe('profile-work')
  })
})
