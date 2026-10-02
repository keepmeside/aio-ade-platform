import { describe, expect, it } from 'vitest'
import { CODEX_AUTH_ENV_VARS, applyCodexEnvPatch, hasCodexAuthEnvConflict } from './environment'

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

describe('codex profile env patch', () => {
  it('strips inherited auth env then applies the patch — delete-then-set wins', () => {
    const patched = applyCodexEnvPatch(
      { OPENAI_API_KEY: 'inherited-key', OPENAI_BASE_URL: 'https://inherited.example.test' },
      { OPENAI_API_KEY: 'profile-key', OPENAI_BASE_URL: 'https://profile.example.test' },
      { stripAuthEnv: true }
    )
    expect(patched.OPENAI_API_KEY).toBe('profile-key')
    expect(patched.OPENAI_BASE_URL).toBe('https://profile.example.test')
  })

  it('keeps inherited env when stripping is off and the patch is partial', () => {
    const patched = applyCodexEnvPatch(
      { OPENAI_API_KEY: 'user-own-key', OPENAI_LOG: 'debug' },
      { OPENAI_BASE_URL: 'https://profile.example.test' }
    )
    expect(patched.OPENAI_API_KEY).toBe('user-own-key')
    expect(patched.OPENAI_BASE_URL).toBe('https://profile.example.test')
    expect(patched.OPENAI_LOG).toBe('debug')
  })

  it('strips inherited auth env without a patch', () => {
    const patched = applyCodexEnvPatch(
      { OPENAI_API_KEY: 'inherited-key', OPENAI_LOG: 'debug' },
      {},
      { stripAuthEnv: true }
    )
    expect(patched.OPENAI_API_KEY).toBeUndefined()
    expect(patched.OPENAI_LOG).toBe('debug')
  })
})
