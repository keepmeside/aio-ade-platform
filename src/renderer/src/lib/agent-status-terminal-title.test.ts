import { describe, expect, it } from 'vitest'
import { resolveAgentStatusTerminalTitle } from './agent-status-terminal-title'

describe('resolveAgentStatusTerminalTitle', () => {
  it('replaces stale Codex spinner titles when hook state finishes', () => {
    expect(resolveAgentStatusTerminalTitle({ agentType: 'codex', state: 'done' }, '⠋ Codex')).toBe(
      'Codex ready'
    )
  })

  it('replaces bare native agent titles when hook state finishes', () => {
    expect(resolveAgentStatusTerminalTitle({ agentType: 'codex', state: 'done' }, 'Codex')).toBe(
      'Codex ready'
    )
  })

  it('keeps descriptive completed titles that are already non-working', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'codex', state: 'done' }, 'AIO-ADE Codex Done')
    ).toBe('AIO-ADE Codex Done')
  })

  it('uses permission titles for Codex when hook state waits on user input', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'codex', state: 'waiting' }, '⠋ Codex')
    ).toBe('Codex - action required')
  })

  it('clears stale permission titles when hook state finishes', () => {
    expect(
      resolveAgentStatusTerminalTitle(
        { agentType: 'codex', state: 'done' },
        'Codex - action required'
      )
    ).toBe('Codex ready')
  })

  it('preserves native OpenCode titles through hook status transitions', () => {
    expect(
      resolveAgentStatusTerminalTitle(
        { agentType: 'opencode', state: 'done' },
        'OC | Native Stable Session'
      )
    ).toBe('OC | Native Stable Session')
    expect(
      resolveAgentStatusTerminalTitle(
        { agentType: 'opencode', state: 'waiting' },
        'OC | Native Stable Session'
      )
    ).toBe('OC | Native Stable Session')
  })

  it('does not invent an OpenCode title when no native title exists', () => {
    expect(
      resolveAgentStatusTerminalTitle({ agentType: 'opencode', state: 'done' }, undefined)
    ).toBeUndefined()
  })
})
