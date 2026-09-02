/* Native agent roster: Claude Code + Codex only.
 *
 * Decision 2026-08-21: native support narrows to Claude Code + Codex. Every other agent returns
 * later through the generic ACP slot (phase 10), so this is not "those agents are gone forever" —
 * it is "we stop maintaining a per-agent native integration for each one".
 *
 * `claude-agent-teams` is KEPT. It is a launch mode of Claude that opens teammates as native panes,
 * not a separate binary, and the phase-03 CLI bridge keeps `claude-teams` for exactly that reason.
 *
 * Two invariants this file locks down, both of which the plan calls out as the failure modes:
 *
 *   1. The compile-time union stays at claude | claude-agent-teams | codex **permanently**. Phase 10
 *      must add ACP as its own agent-kind, NOT as a new TuiAgent member, or every roster-keyed
 *      Record and sanitizer in the codebase silently widens again.
 *   2. Telemetry kinds move in lockstep. `agent-kind.test.ts` asserts exact equality between
 *      concrete telemetry kinds and kinds mapped from shipped agents, so TuiAgent,
 *      AGENT_KIND_VALUES and TUI_AGENT_KIND_BY_AGENT are one edit — see
 *      research/baseline/phase-04-roster-narrowing-analysis.md for why no persisted telemetry queue
 *      makes this safe. */
import { describe, expect, it } from 'vitest'
import { TUI_AGENT_CONFIG, isTuiAgent } from './tui-agent-config'
import { TUI_AGENT_AUTO_PICK_ORDER } from './tui-agent-selection'
import { AGENT_KIND_VALUES } from './telemetry-events'
import { tuiAgentToAgentKind } from './agent-kind'
import type { TuiAgent } from './types'

const NATIVE_ROSTER: readonly TuiAgent[] = ['claude', 'claude-agent-teams', 'codex']

/** A sample of the ids phase 04 removes; used to prove they are no longer recognized. */
const REMOVED_IDS = [
  'gemini',
  'cursor',
  'droid',
  'opencode',
  'pi',
  'omp',
  'antigravity',
  'command-code',
  'hermes',
  'grok',
  'copilot',
  'aider',
  'continue',
  'devin'
]

describe('the native roster is exactly Claude and Codex', () => {
  it('configures only the three native entries', () => {
    expect(Object.keys(TUI_AGENT_CONFIG).sort()).toEqual([...NATIVE_ROSTER].sort())
  })

  it('keeps claude-agent-teams, which is a Claude launch mode rather than a separate agent', () => {
    expect(isTuiAgent('claude-agent-teams')).toBe(true)
  })

  it.each(REMOVED_IDS)('no longer recognizes %s as a TuiAgent', (id) => {
    expect(isTuiAgent(id)).toBe(false)
  })

  it('auto-pick order lists every configured agent and nothing else', () => {
    // A stale entry here would make the picker fall back to an agent that cannot launch.
    expect([...TUI_AGENT_AUTO_PICK_ORDER].sort()).toEqual(Object.keys(TUI_AGENT_CONFIG).sort())
  })
})

describe('telemetry kinds stay in lockstep with the roster', () => {
  it('maps each native agent to a concrete telemetry kind', () => {
    for (const agent of NATIVE_ROSTER) {
      expect(tuiAgentToAgentKind(agent)).not.toBe('other')
    }
  })

  it('keeps the deliberate claude -> claude-code product-name asymmetry', () => {
    expect(tuiAgentToAgentKind('claude')).toBe('claude-code')
  })

  it('retains `other` as the escape hatch for unknown kinds', () => {
    // Without this, a stale event from an older build has nowhere to land.
    expect(AGENT_KIND_VALUES).toContain('other')
  })

  it('drops removed agents from the telemetry enum', () => {
    const stale = REMOVED_IDS.filter((id) => (AGENT_KIND_VALUES as readonly string[]).includes(id))

    expect(stale).toEqual([])
  })
})
