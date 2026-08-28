import { describe, expect, it } from 'vitest'
import {
  agentProviderSessionsEqual,
  extractAgentProviderSession,
  getAgentResumeArgv,
  isResumableTuiAgent,
  normalizeAgentProviderSession
} from './agent-session-resume'

describe('agent session resume metadata', () => {
  it('treats the shipped agents as resumable and rejects anything else', () => {
    expect(isResumableTuiAgent('claude')).toBe(true)
    expect(isResumableTuiAgent('codex')).toBe(true)
    // Agent Teams launches through Claude Code, so it carries no resume identity of its own.
    expect(isResumableTuiAgent('claude-agent-teams')).toBe(false)
    expect(isResumableTuiAgent('devin')).toBe(false)
    expect(isResumableTuiAgent(null)).toBe(false)
  })

  it.each([
    ['claude', { session_id: 'claude-session' }, { key: 'session_id', id: 'claude-session' }],
    ['codex', { session_id: 'codex-session' }, { key: 'session_id', id: 'codex-session' }]
  ] as const)('extracts %s provider session ids', (source, payload, expected) => {
    expect(extractAgentProviderSession(source, payload)).toEqual(expected)
  })

  it.each([
    ['claude', { key: 'session_id', id: 's1' }, ['claude', '--resume', 's1']],
    ['codex', { key: 'session_id', id: 's1' }, ['codex', 'resume', 's1']]
  ] as const)('builds %s resume argv', (agent, providerSession, expected) => {
    expect(getAgentResumeArgv(agent, providerSession)).toEqual(expected)
  })

  it('refuses resume argv for a conversation-scoped locator', () => {
    const conversation = { key: 'conversation_id', id: 's1' } as const
    expect(getAgentResumeArgv('claude', conversation)).toBeNull()
    expect(getAgentResumeArgv('codex', conversation)).toBeNull()
  })

  it('rejects unsupported sources and unsafe ids', () => {
    expect(normalizeAgentProviderSession({ key: 'session_id', id: 'bad\nid' })).toBeNull()
    expect(normalizeAgentProviderSession({ key: 'session_id', id: '--last' })).toBeNull()
    expect(extractAgentProviderSession('codex', { session_id: '--last' })).toBeNull()
    expect(normalizeAgentProviderSession({ key: 'session_id', id: 'ok' })).toEqual({
      key: 'session_id',
      id: 'ok'
    })
  })

  it('identifies a provider session by its locator, not its transcript file', () => {
    const first = { key: 'session_id' as const, id: 'session-1', transcriptPath: '/tmp/first' }
    const second = { key: 'session_id' as const, id: 'session-1', transcriptPath: '/tmp/second' }

    // Why: the transcript file can be renamed or re-resolved mid-session; only key+id
    // identify the session an agent would resume.
    expect(agentProviderSessionsEqual(first, second)).toBe(true)
    expect(agentProviderSessionsEqual(first, { ...first, id: 'session-2' })).toBe(false)
    expect(agentProviderSessionsEqual(first, undefined)).toBe(false)
    expect(agentProviderSessionsEqual(undefined, undefined)).toBe(true)
  })

  it('captures the hook transcript_path for native-chat agents (claude/codex)', () => {
    expect(
      extractAgentProviderSession('claude', {
        session_id: 'cs',
        transcript_path: '/home/u/.claude/projects/slug/real.jsonl'
      })
    ).toEqual({
      key: 'session_id',
      id: 'cs',
      transcriptPath: '/home/u/.claude/projects/slug/real.jsonl'
    })
    expect(
      extractAgentProviderSession('codex', { session_id: 'xs', transcriptPath: '/x/r.jsonl' })
    ).toEqual({ key: 'session_id', id: 'xs', transcriptPath: '/x/r.jsonl' })
  })

  it('round-trips transcriptPath through normalizeAgentProviderSession', () => {
    expect(
      normalizeAgentProviderSession({ key: 'session_id', id: 'ok', transcriptPath: '/x/r.jsonl' })
    ).toEqual({ key: 'session_id', id: 'ok', transcriptPath: '/x/r.jsonl' })
    expect(
      normalizeAgentProviderSession({
        key: 'session_id',
        id: 'ok',
        transcriptPath: '/tmp/bad\npath.jsonl'
      })
    ).toEqual({ key: 'session_id', id: 'ok' })
  })
})
