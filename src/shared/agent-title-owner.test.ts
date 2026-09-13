import { describe, expect, it } from 'vitest'
import {
  normalizeCompatibleAgentStatusEntryForOwner,
  normalizeCompatibleAgentTitleForOwner,
  resolveCompatibleAgentTypeForOwner
} from './agent-title-owner'
import type { AgentStatusEntry, AgentType } from './agent-status-types'

/* Characterisation, written against the pre-removal code and kept green through it. These helpers
 * re-owned title frames between agents sharing an identity group; the narrowed roster left no
 * profile setting one, so the branches were unreachable and the field is gone from the profile type
 * (the compiler now enforces what an assertion would have). Pinning the identity contract makes the
 * removal provably behaviour-neutral. */

const ENTRY: AgentStatusEntry = {
  agentType: 'codex',
  state: 'working',
  terminalTitle: '⠋ Codex'
} as AgentStatusEntry

describe('agent title ownership after the roster narrowing', () => {
  it('reports the incoming agent type unchanged', () => {
    expect(resolveCompatibleAgentTypeForOwner('codex', 'claude')).toBe('codex')
    expect(resolveCompatibleAgentTypeForOwner('claude', 'codex')).toBe('claude')
    expect(resolveCompatibleAgentTypeForOwner('codex', null)).toBe('codex')
    expect(resolveCompatibleAgentTypeForOwner(null, 'codex')).toBeUndefined()
    expect(resolveCompatibleAgentTypeForOwner(undefined, 'codex')).toBeUndefined()
    // An empty type is absent, not a value to hand back — the wire normalizer should never
    // produce one, so this pins the collapse against a caller that stops trusting it.
    expect(resolveCompatibleAgentTypeForOwner('' as AgentType, 'codex')).toBeUndefined()
  })

  it('returns titles unchanged for every owner, including wrapped ones', () => {
    for (const title of [
      '⠋ Codex',
      'Codex ready',
      'Codex - action required',
      'tmux | ⠋ Codex',
      '✳ Claude Code',
      'plain shell title'
    ]) {
      expect(normalizeCompatibleAgentTitleForOwner(title, 'codex')).toBe(title)
      expect(normalizeCompatibleAgentTitleForOwner(title, 'claude')).toBe(title)
      expect(normalizeCompatibleAgentTitleForOwner(title, null)).toBe(title)
    }
  })

  it('hands back the same status entry object when nothing would change', () => {
    expect(normalizeCompatibleAgentStatusEntryForOwner(ENTRY, 'claude')).toBe(ENTRY)
    expect(normalizeCompatibleAgentStatusEntryForOwner(ENTRY, 'codex')).toBe(ENTRY)
    expect(normalizeCompatibleAgentStatusEntryForOwner(ENTRY, null)).toBe(ENTRY)
  })

  it('keeps an entry without a title untouched', () => {
    const untitled = { ...ENTRY, terminalTitle: undefined } as AgentStatusEntry
    expect(normalizeCompatibleAgentStatusEntryForOwner(untitled, 'codex')).toBe(untitled)
  })

  it('leaves a null agent type as null rather than filling it from the owner', () => {
    // Asserted on content, not reference: the removed code cloned for this one input while
    // producing the same fields, so only the fields are the contract callers ever saw.
    const ownerless = { ...ENTRY, agentType: null } as unknown as AgentStatusEntry
    expect(normalizeCompatibleAgentStatusEntryForOwner(ownerless, 'claude')).toEqual(ownerless)
  })
})
