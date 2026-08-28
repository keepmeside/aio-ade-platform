import { describe, expect, it } from 'vitest'
import {
  normalizeDefaultTuiAgent,
  normalizeHostScopedTuiAgentKeyedRecord,
  normalizeTuiAgentKeyedRecord
} from './tui-agent-settings-normalization'

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

describe('normalizeDefaultTuiAgent', () => {
  it('keeps an agent this build can launch', () => {
    expect(normalizeDefaultTuiAgent('claude')).toBe('claude')
    expect(normalizeDefaultTuiAgent('codex')).toBe('codex')
    expect(normalizeDefaultTuiAgent('claude-agent-teams')).toBe('claude-agent-teams')
  })

  it('keeps the explicit no-agent choice', () => {
    expect(normalizeDefaultTuiAgent('blank')).toBe('blank')
  })

  it('clears an agent this build cannot launch so the picker auto-picks', () => {
    // A profile written by an older build names an agent that now has no launch config;
    // honoring it would try to spawn a binary the app no longer knows how to configure.
    expect(normalizeDefaultTuiAgent('gemini')).toBeNull()
    expect(normalizeDefaultTuiAgent('cursor')).toBeNull()
    expect(normalizeDefaultTuiAgent('droid')).toBeNull()
  })

  it('clears missing and non-string values', () => {
    expect(normalizeDefaultTuiAgent(undefined)).toBeNull()
    expect(normalizeDefaultTuiAgent(null)).toBeNull()
    expect(normalizeDefaultTuiAgent(42)).toBeNull()
    expect(normalizeDefaultTuiAgent({ agent: 'claude' })).toBeNull()
  })
})

describe('normalizeTuiAgentKeyedRecord', () => {
  it('drops entries keyed by an agent this build cannot launch', () => {
    expect(
      normalizeTuiAgentKeyedRecord({ claude: 'a', gemini: 'b', codex: 'c' }, asString)
    ).toEqual({ claude: 'a', codex: 'c' })
  })

  it('keeps every surviving entry byte-for-byte', () => {
    const overrides = { claude: 'claude --settings ~/.claude/work.json', droid: 'droid' }

    expect(normalizeTuiAgentKeyedRecord(overrides, asString)).toEqual({
      claude: 'claude --settings ~/.claude/work.json'
    })
  })

  it('drops entries whose value fails its own normalizer', () => {
    expect(normalizeTuiAgentKeyedRecord({ claude: 5, codex: 'ok' }, asString)).toEqual({
      codex: 'ok'
    })
  })

  it('returns an empty record for anything that is not an object', () => {
    expect(normalizeTuiAgentKeyedRecord(undefined, asString)).toEqual({})
    expect(normalizeTuiAgentKeyedRecord('claude', asString)).toEqual({})
    expect(normalizeTuiAgentKeyedRecord(['claude'], asString)).toEqual({})
  })

  it('cannot be used to reach Object.prototype', () => {
    const normalized = normalizeTuiAgentKeyedRecord(
      JSON.parse('{"__proto__": {"polluted": true}, "claude": "ok"}'),
      asString
    )

    expect(normalized).toEqual({ claude: 'ok' })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('normalizeHostScopedTuiAgentKeyedRecord', () => {
  it('normalizes each host independently', () => {
    expect(
      normalizeHostScopedTuiAgentKeyedRecord(
        { 'ssh:build-box': { claude: 'm1', gemini: 'm2' }, local: { codex: 'm3' } },
        asString
      )
    ).toEqual({ 'ssh:build-box': { claude: 'm1' }, local: { codex: 'm3' } })
  })

  it('drops a host whose only entries named agents this build cannot launch', () => {
    expect(
      normalizeHostScopedTuiAgentKeyedRecord({ 'ssh:old-box': { gemini: 'm' } }, asString)
    ).toEqual({})
  })

  it('drops hosts with an unsafe key or a non-object value', () => {
    const normalized = normalizeHostScopedTuiAgentKeyedRecord(
      JSON.parse('{"__proto__": {"claude": "ok"}, "constructor": {"claude": "ok"}, "": {}}'),
      asString
    )

    expect(normalized).toEqual({})
    expect(normalizeHostScopedTuiAgentKeyedRecord({ 'ssh:box': 'claude' }, asString)).toEqual({})
  })

  it('returns an empty record for anything that is not an object', () => {
    expect(normalizeHostScopedTuiAgentKeyedRecord(null, asString)).toEqual({})
    expect(normalizeHostScopedTuiAgentKeyedRecord(7, asString)).toEqual({})
  })
})
