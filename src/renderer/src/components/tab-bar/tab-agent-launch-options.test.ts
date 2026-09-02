import { describe, expect, it } from 'vitest'
import {
  buildTabAgentLaunchOptions,
  findMatchingTabAgentLaunchOptions,
  orderTabLaunchAgents
} from './tab-agent-launch-options'

describe('tab agent launch options', () => {
  it('orders detected agents by the configured default first', () => {
    expect(orderTabLaunchAgents('codex', ['claude', 'codex', 'claude-agent-teams'])).toEqual([
      'codex',
      'claude',
      'claude-agent-teams'
    ])
  })

  it('matches detected agents by id, label, command, and command override', () => {
    const options = buildTabAgentLaunchOptions(['claude', 'codex', 'claude-agent-teams'], {
      codex: 'codex-beta'
    })

    expect(
      findMatchingTabAgentLaunchOptions('Codex', options).map((option) => option.agent)
    ).toEqual(['codex'])
    expect(findMatchingTabAgentLaunchOptions('openai codex', options)).toEqual([])
    expect(
      findMatchingTabAgentLaunchOptions('codex-beta', options).map((option) => option.agent)
    ).toEqual(['codex'])
    // Agent Teams launches through the AIO-ADE CLI, so its command is not its id.
    expect(
      findMatchingTabAgentLaunchOptions('claude-teams', options).map((option) => option.agent)
    ).toEqual(['claude-agent-teams'])
  })

  it('matches agents on a partial prefix so the launcher actually searches', () => {
    const options = buildTabAgentLaunchOptions(['claude', 'codex', 'claude-agent-teams'])

    // Each is one character short of the full agent name.
    expect(findMatchingTabAgentLaunchOptions('code', options).map((o) => o.agent)).toEqual([
      'codex'
    ])
    expect(findMatchingTabAgentLaunchOptions('clau', options).map((o) => o.agent)).toEqual([
      'claude',
      'claude-agent-teams'
    ])
    expect(findMatchingTabAgentLaunchOptions('team', options).map((o) => o.agent)).toEqual([
      'claude-agent-teams'
    ])
  })

  it('ranks an exact alias above weaker prefix matches', () => {
    const options = buildTabAgentLaunchOptions(['claude-agent-teams', 'claude'])

    // "claude" prefixes both; the exact alias must lead even when listed last.
    expect(findMatchingTabAgentLaunchOptions('claude', options)[0]?.agent).toBe('claude')
    expect(findMatchingTabAgentLaunchOptions('clau', options).map((o) => o.agent)).toEqual(
      expect.arrayContaining(['claude', 'claude-agent-teams'])
    )
  })

  it('does not match on a mid-string substring that would hijack file results', () => {
    const options = buildTabAgentLaunchOptions(['codex', 'claude'])

    // "ode" is inside "codex" but not a prefix — agents rank above files, so
    // a noisy mid-string hit must not surface.
    expect(findMatchingTabAgentLaunchOptions('ode', options)).toEqual([])
  })

  it('requires at least two characters before a prefix matches (no single-key flood)', () => {
    const options = buildTabAgentLaunchOptions(['claude', 'codex', 'claude-agent-teams'])

    // A lone "c" must not surface (and auto-launch) an agent.
    expect(findMatchingTabAgentLaunchOptions('c', options)).toEqual([])
    // Two characters is enough to start searching.
    expect(findMatchingTabAgentLaunchOptions('cl', options).map((o) => o.agent)).toEqual(
      expect.arrayContaining(['claude', 'claude-agent-teams'])
    )
  })
})
