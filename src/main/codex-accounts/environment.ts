// Conflict-bearing auth env for Codex launches, mirroring the Claude strip
// list. Codex profiles materialize OPENAI_API_KEY/OPENAI_BASE_URL (see
// AGENT_AUTH_PROFILE_ENV_KEYS.codex); CODEX_HOME stays out because it has its
// own AIO-ADE-marker ownership machinery in the PTY spawn path.
export const CODEX_AUTH_ENV_VARS = ['OPENAI_API_KEY', 'OPENAI_BASE_URL'] as const

export function hasCodexAuthEnvConflict(env: Record<string, string> | undefined): boolean {
  if (!env) {
    return false
  }
  return CODEX_AUTH_ENV_VARS.some((key) => Boolean(env[key]))
}
