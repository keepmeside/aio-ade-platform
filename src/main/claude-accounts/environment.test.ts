import { describe, expect, it } from 'vitest'
import { CLAUDE_AUTH_ENV_VARS, applyClaudeEnvPatch, hasClaudeAuthEnvConflict } from './environment'

describe('claude auth env strip list', () => {
  it('covers the credential vars and the credential-flow base URL', () => {
    expect(CLAUDE_AUTH_ENV_VARS).toContain('ANTHROPIC_API_KEY')
    expect(CLAUDE_AUTH_ENV_VARS).toContain('ANTHROPIC_AUTH_TOKEN')
    expect(CLAUDE_AUTH_ENV_VARS).toContain('CLAUDE_CODE_OAUTH_TOKEN')
    expect(CLAUDE_AUTH_ENV_VARS).toContain('AWS_BEARER_TOKEN_BEDROCK')
    // Why: base URL redirects where the CLI sends its credentials; an
    // inherited value would silently point managed-auth traffic elsewhere.
    expect(CLAUDE_AUTH_ENV_VARS).toContain('ANTHROPIC_BASE_URL')
  })

  it('applyClaudeEnvPatch strips every auth var when stripAuthEnv', () => {
    const env = {
      ANTHROPIC_API_KEY: 'k',
      ANTHROPIC_AUTH_TOKEN: 't',
      CLAUDE_CODE_OAUTH_TOKEN: 'o',
      AWS_BEARER_TOKEN_BEDROCK: 'b',
      ANTHROPIC_BASE_URL: 'https://evil.example.test',
      ANTHROPIC_MODEL: 'glm-4.6',
      PATH: '/usr/bin'
    }
    const patched = applyClaudeEnvPatch(env, {}, { stripAuthEnv: true })
    expect(patched.ANTHROPIC_API_KEY).toBeUndefined()
    expect(patched.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(patched.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined()
    expect(patched.AWS_BEARER_TOKEN_BEDROCK).toBeUndefined()
    expect(patched.ANTHROPIC_BASE_URL).toBeUndefined()
    // Model is not credential-flow: a profile patch overwrites it and a null
    // model means inherit, so it is never stripped.
    expect(patched.ANTHROPIC_MODEL).toBe('glm-4.6')
    expect(patched.PATH).toBe('/usr/bin')
  })

  it('applyClaudeEnvPatch strips only auth-like custom headers', () => {
    const authLike = applyClaudeEnvPatch(
      { ANTHROPIC_CUSTOM_HEADERS: 'Authorization: Bearer x' },
      {},
      { stripAuthEnv: true }
    )
    expect(authLike.ANTHROPIC_CUSTOM_HEADERS).toBeUndefined()

    const benign = applyClaudeEnvPatch(
      { ANTHROPIC_CUSTOM_HEADERS: 'x-title: my-app' },
      {},
      { stripAuthEnv: true }
    )
    expect(benign.ANTHROPIC_CUSTOM_HEADERS).toBe('x-title: my-app')
  })

  it('applyClaudeEnvPatch keeps auth env and applies the patch without stripAuthEnv', () => {
    const env = {
      ANTHROPIC_API_KEY: 'user-own-key',
      ANTHROPIC_BASE_URL: 'https://user.example.test'
    }
    const patched = applyClaudeEnvPatch(env, {
      CLAUDE_CONFIG_DIR: '/managed/auth/dir',
      ANTHROPIC_CUSTOM_HEADERS: 'x-title: app'
    })
    expect(patched.ANTHROPIC_API_KEY).toBe('user-own-key')
    expect(patched.ANTHROPIC_BASE_URL).toBe('https://user.example.test')
    expect(patched.CLAUDE_CONFIG_DIR).toBe('/managed/auth/dir')
    expect(patched.ANTHROPIC_CUSTOM_HEADERS).toBe('x-title: app')
  })

  it('hasClaudeAuthEnvConflict flags every strip-list var and auth-like headers', () => {
    for (const key of CLAUDE_AUTH_ENV_VARS) {
      expect(hasClaudeAuthEnvConflict({ [key]: 'x' })).toBe(true)
    }
    expect(hasClaudeAuthEnvConflict({ ANTHROPIC_CUSTOM_HEADERS: 'x-api-key: k' })).toBe(true)
    expect(hasClaudeAuthEnvConflict(undefined)).toBe(false)
    expect(hasClaudeAuthEnvConflict({})).toBe(false)
    expect(hasClaudeAuthEnvConflict({ ANTHROPIC_MODEL: 'glm-4.6' })).toBe(false)
    expect(hasClaudeAuthEnvConflict({ ANTHROPIC_CUSTOM_HEADERS: 'x-title: my-app' })).toBe(false)
  })
})
