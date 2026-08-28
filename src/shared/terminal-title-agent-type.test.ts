import { describe, expect, it } from 'vitest'
import { getAgentLabel as getSharedAgentLabel } from './agent-title-identity'
import { isOpenCodeNativeTitle } from './opencode-terminal-title'
import {
  getAgentLabel,
  isClaudeAgent,
  isGrokRotatingWorkingTitle,
  resolveExplicitTerminalTitleAgentType,
  resolveTerminalTitleAgentType
} from './terminal-title-agent-type'

describe('isGrokRotatingWorkingTitle', () => {
  it('matches Grok working frames regardless of the rotating middle text', () => {
    expect(isGrokRotatingWorkingTitle('⠋ - Waiting for response… - grok')).toBe(true)
    expect(isGrokRotatingWorkingTitle('⠴ - Thinking - grok')).toBe(true)
    expect(isGrokRotatingWorkingTitle('⠦ - Sleep 2s then echo hello… - grok')).toBe(true)
    // Collapsed/stable form must stay matched so re-normalization is idempotent.
    expect(isGrokRotatingWorkingTitle('⠋ grok')).toBe(true)
    expect(isGrokRotatingWorkingTitle('⠋ Grok')).toBe(true)
  })

  it('ignores non-working, non-Grok, and lookalike titles', () => {
    expect(isGrokRotatingWorkingTitle('grok')).toBe(false) // idle bare name, no spinner
    expect(isGrokRotatingWorkingTitle('Fix the auth bug - grok')).toBe(false) // session title, no spinner
    expect(isGrokRotatingWorkingTitle('⠋ debugging grok - claude')).toBe(false) // trailing name is another agent
    expect(isGrokRotatingWorkingTitle('⠋ ~/grok-scratch/ready')).toBe(false) // path fragment, not a trailing token
    expect(isGrokRotatingWorkingTitle('⠋ grokking the plan')).toBe(false) // "grok" not a whole trailing token
    expect(isGrokRotatingWorkingTitle('⠋ Codex')).toBe(false)
    // Task text ending in "grok" is not the Grok frame shape "spinner - phrase - grok".
    expect(isGrokRotatingWorkingTitle('⠋ wire up grok')).toBe(false)
    expect(isGrokRotatingWorkingTitle('⠋ Codex is thinking about grok')).toBe(false)
    expect(isGrokRotatingWorkingTitle('⠋ support for Grok')).toBe(false)
    // Why: Claude/Codex braille + task can end with " - grok" without the
    // post-spinner delimiter that marks a real Grok Build frame.
    expect(isGrokRotatingWorkingTitle('⠋ fix the flaky suite - grok')).toBe(false)
    expect(isGrokRotatingWorkingTitle('⠋ review grok integration - claude')).toBe(false)
  })
})

describe('resolveExplicitTerminalTitleAgentType', () => {
  it('maps explicit product-name titles to their TuiAgent id', () => {
    expect(resolveExplicitTerminalTitleAgentType('✳ Claude Code')).toBe('claude')
    expect(resolveExplicitTerminalTitleAgentType('⠋ Codex')).toBe('codex')
  })

  it('treats Claude generic status prefixes as activity-only, not identity', () => {
    expect(resolveExplicitTerminalTitleAgentType('✳ investigating startup')).toBeNull()
    expect(resolveExplicitTerminalTitleAgentType('⠸ investigating startup')).toBeNull()
    expect(resolveExplicitTerminalTitleAgentType('. Compare Opencode Vs Orca')).toBeNull()
    expect(resolveExplicitTerminalTitleAgentType('* Review Codex behavior')).toBeNull()
  })

  // Why: OpenCode is not a launchable agent, but its native marker must still own the whole
  // title so session text — including another agent's glyphs — cannot rebrand the tab.
  it('resolves OpenCode native abbreviated session titles before task-text identities', () => {
    expect(getAgentLabel('OC | Understand about the plugin')).toBe('OpenCode')
    expect(getAgentLabel('OC | Compare Codex and Claude')).toBe('OpenCode')
    expect(getAgentLabel('OC | ✦ Gemini CLI')).toBe('OpenCode')
    expect(getSharedAgentLabel('OC | Compare Codex and Claude')).toBe('OpenCode')
    expect(getSharedAgentLabel('OC | ✦ Gemini CLI')).toBe('OpenCode')
    expect(getAgentLabel('tmux | OC | ses_123')).toBe('OpenCode')
    expect(getAgentLabel('OC|compact-session')).toBe('OpenCode')
    expect(getAgentLabel('oc | Understand about the plugin')).toBeNull()
    // A label Orca cannot launch carries no agent identity.
    expect(resolveExplicitTerminalTitleAgentType('OC | Compare Codex and Claude')).toBeNull()
  })

  it('does not find an OpenCode marker inside another agent task title', () => {
    expect(isOpenCodeNativeTitle('⠋ Fix foo | OC | bar')).toBe(false)
    expect(resolveExplicitTerminalTitleAgentType('⠋ Fix foo | OC | bar')).toBeNull()
  })

  // Why: adversarial coverage — native OC must not steal Claude/Codex identity, and the CLIs
  // Orca no longer launches must keep their own label instead of falling through to Claude.
  it('keeps other agents classified correctly alongside OpenCode native titles', () => {
    expect(resolveExplicitTerminalTitleAgentType('✳ Claude Code')).toBe('claude')
    expect(resolveExplicitTerminalTitleAgentType('⠋ Codex')).toBe('codex')
    expect(getAgentLabel('✦ Gemini CLI')).toBe('Gemini CLI')
    expect(getAgentLabel('Cursor Agent')).toBe('Cursor')
    expect(getAgentLabel('OpenCode ready')).toBe('OpenCode')
    expect(resolveTerminalTitleAgentType('OC | ⠋ implementing the feature')).toBeNull()
    expect(isClaudeAgent('OC | ⠋ implementing the feature')).toBe(false)
    expect(isClaudeAgent('OC | Understand about the plugin')).toBe(false)
  })

  it('still resolves Claude when the title explicitly names Claude', () => {
    expect(resolveExplicitTerminalTitleAgentType('. Claude Code compare Opencode')).toBe('claude')
  })

  it('returns null for plain shell and unknown titles', () => {
    expect(resolveExplicitTerminalTitleAgentType('Terminal 1')).toBeNull()
    expect(resolveExplicitTerminalTitleAgentType('zsh')).toBeNull()
  })

  // Why: `cursor` is ordinary editor vocabulary, so a name token is not identity.
  // A Claude/Codex tab working on cursor code must not commit to any identity.
  it('never resolves a bare cursor token as an agent identity', () => {
    expect(
      resolveExplicitTerminalTitleAgentType('⠋ preserve cursor visibility across replays')
    ).toBeNull()
    expect(resolveExplicitTerminalTitleAgentType('~/cursor-rules')).toBeNull()
  })
})

describe('resolveTerminalTitleAgentType', () => {
  // Why: the activity facet keeps Claude's braille prefix as Claude — but only when
  // the "cursor" it mentions is task text, not Cursor's own identity title.
  it('labels cursor-mentioning agent tabs by their true agent', () => {
    expect(resolveTerminalTitleAgentType('⠋ preserve cursor visibility across replays')).toBe(
      'claude'
    )
    expect(resolveTerminalTitleAgentType('⠋ Codex: fix cursor offsets')).toBe('codex')
    // Cursor's own titles keep their label, so they never fall through to Claude.
    expect(resolveTerminalTitleAgentType('⠋ Cursor Agent')).toBeNull()
    expect(resolveTerminalTitleAgentType('Cursor - action required')).toBeNull()
  })
})

// Why: this module carries its own isClaudeAgent copy parallel to agent-title-identity.ts;
// both got the identical isCursorAgentTitle guard, so pin this copy directly to catch drift.
describe('isClaudeAgent', () => {
  it('excludes real Cursor identity titles, keeps cursor-mentioning Claude braille titles', () => {
    expect(isClaudeAgent('⠋ Cursor Agent')).toBe(false)
    expect(isClaudeAgent('Cursor ready')).toBe(false)
    expect(isClaudeAgent('⠋ preserve cursor visibility across replays')).toBe(true)
    expect(isClaudeAgent('⠋ OpenClaude')).toBe(false)
  })
})
