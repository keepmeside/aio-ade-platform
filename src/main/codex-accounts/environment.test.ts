import { describe, expect, it } from 'vitest'
import { CODEX_AUTH_ENV_VARS, hasCodexAuthEnvConflict } from './environment'

describe('codex auth env conflict detection', () => {
  it('covers the env a codex profile owns', () => {
    expect(CODEX_AUTH_ENV_VARS).toContain('OPENAI_API_KEY')
    expect(CODEX_AUTH_ENV_VARS).toContain('OPENAI_BASE_URL')
    expect(CODEX_AUTH_ENV_VARS).not.toContain('CODEX_HOME')
  })

  it('flags inherited profile env but not unrelated vars', () => {
    expect(hasCodexAuthEnvConflict({ OPENAI_API_KEY: 'k' })).toBe(true)
    expect(hasCodexAuthEnvConflict({ OPENAI_BASE_URL: 'https://alt.example.test' })).toBe(true)
    expect(hasCodexAuthEnvConflict(undefined)).toBe(false)
    expect(hasCodexAuthEnvConflict({})).toBe(false)
    expect(hasCodexAuthEnvConflict({ CODEX_HOME: '/user/own/home' })).toBe(false)
    expect(hasCodexAuthEnvConflict({ OPENAI_LOG: 'debug' })).toBe(false)
  })
})
