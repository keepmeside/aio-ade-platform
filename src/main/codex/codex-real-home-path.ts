import { resolve } from 'node:path'
import { getSystemCodexHomePath } from './codex-home-paths'

/** True when the user points Codex outside its standard native home. */
export function hasCustomCodexHomeOverride(env: NodeJS.ProcessEnv = process.env): boolean {
  const codexHome = env.CODEX_HOME?.trim()
  const aioAdeCodexHome = env.AIO_ADE_CODEX_HOME?.trim()
  const normalizedCodexHome = codexHome ? normalizePathForComparison(codexHome) : undefined
  const normalizedAioAdeCodexHome = aioAdeCodexHome
    ? normalizePathForComparison(aioAdeCodexHome)
    : undefined
  // Why: phase 1 owns only ~/.codex and can clean that path on downgrade. A
  // custom home needs cross-home ownership tracking before AIO-ADE may mutate it.
  return Boolean(
    normalizedCodexHome &&
    normalizedCodexHome !== normalizedAioAdeCodexHome &&
    normalizedCodexHome !== normalizePathForComparison(getSystemCodexHomePath())
  )
}

function normalizePathForComparison(value: string): string {
  const normalized = resolve(value)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}
