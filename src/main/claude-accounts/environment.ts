export const CLAUDE_AUTH_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'AWS_BEARER_TOKEN_BEDROCK',
  // Why: base URL redirects where the CLI sends its credentials, so an
  // inherited value would silently point managed-auth traffic at another
  // endpoint. ANTHROPIC_MODEL is deliberately absent: a profile patch
  // overwrites it and a null model means inherit.
  'ANTHROPIC_BASE_URL'
] as const

export type ClaudeEnvPatch = {
  CLAUDE_CONFIG_DIR?: string
  ANTHROPIC_CUSTOM_HEADERS?: string
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_AUTH_TOKEN?: string
  ANTHROPIC_BASE_URL?: string
  ANTHROPIC_MODEL?: string
}

export function applyClaudeEnvPatch(
  baseEnv: Record<string, string>,
  patch: ClaudeEnvPatch,
  options?: { stripAuthEnv?: boolean }
): Record<string, string> {
  if (options?.stripAuthEnv) {
    for (const key of CLAUDE_AUTH_ENV_VARS) {
      delete baseEnv[key]
    }
    if (isAuthLikeCustomHeaders(baseEnv.ANTHROPIC_CUSTOM_HEADERS)) {
      delete baseEnv.ANTHROPIC_CUSTOM_HEADERS
    }
  }

  if (patch.CLAUDE_CONFIG_DIR) {
    baseEnv.CLAUDE_CONFIG_DIR = patch.CLAUDE_CONFIG_DIR
  }
  if (patch.ANTHROPIC_CUSTOM_HEADERS !== undefined) {
    baseEnv.ANTHROPIC_CUSTOM_HEADERS = patch.ANTHROPIC_CUSTOM_HEADERS
  }
  if (patch.ANTHROPIC_API_KEY !== undefined) {
    baseEnv.ANTHROPIC_API_KEY = patch.ANTHROPIC_API_KEY
  }
  if (patch.ANTHROPIC_AUTH_TOKEN !== undefined) {
    baseEnv.ANTHROPIC_AUTH_TOKEN = patch.ANTHROPIC_AUTH_TOKEN
  }
  if (patch.ANTHROPIC_BASE_URL !== undefined) {
    baseEnv.ANTHROPIC_BASE_URL = patch.ANTHROPIC_BASE_URL
  }
  if (patch.ANTHROPIC_MODEL !== undefined) {
    baseEnv.ANTHROPIC_MODEL = patch.ANTHROPIC_MODEL
  }

  return baseEnv
}

export function hasClaudeAuthEnvConflict(env: Record<string, string> | undefined): boolean {
  if (!env) {
    return false
  }
  return (
    CLAUDE_AUTH_ENV_VARS.some((key) => Boolean(env[key])) ||
    isAuthLikeCustomHeaders(env.ANTHROPIC_CUSTOM_HEADERS)
  )
}

function isAuthLikeCustomHeaders(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  return /authorization|x-api-key|api-key|bearer/i.test(value)
}
