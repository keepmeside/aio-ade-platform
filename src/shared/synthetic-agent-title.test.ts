import { describe, expect, it } from 'vitest'
import {
  getSyntheticAgentTerminalTitle,
  shouldDriveSyntheticAgentTitleFromHook
} from './synthetic-agent-title'

describe('synthetic agent titles', () => {
  it('provides terminal-state titles for Codex hook completion', () => {
    expect(getSyntheticAgentTerminalTitle('codex', 'done')).toBe('Codex ready')
    expect(getSyntheticAgentTerminalTitle('codex', 'waiting')).toBe('Codex - action required')
  })

  it('does not synthesize Codex working titles over Codex native spinner titles', () => {
    expect(shouldDriveSyntheticAgentTitleFromHook('codex', 'working')).toBe(false)
    expect(shouldDriveSyntheticAgentTitleFromHook('codex', 'done')).toBe(true)
  })

  // Why: Claude sets its own OSC titles for every state, so it has no profile —
  // synthesizing over them would fight the CLI.
  it('does not synthesize titles for agents that own their terminal title', () => {
    expect(getSyntheticAgentTerminalTitle('claude', 'done')).toBeNull()
    expect(getSyntheticAgentTerminalTitle('claude', 'waiting')).toBeNull()
    expect(shouldDriveSyntheticAgentTitleFromHook('claude', 'working')).toBe(false)
    expect(shouldDriveSyntheticAgentTitleFromHook('claude', 'done')).toBe(false)
    expect(shouldDriveSyntheticAgentTitleFromHook('claude', 'waiting')).toBe(false)
  })
})
