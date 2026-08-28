import { isTuiAgent } from './tui-agent-config'
import type { TuiAgent } from './types'

/** Normalizers for persisted settings whose keys or values name an agent.
 *
 *  A profile written by an older build can name an agent this build has no launch config for.
 *  Honoring such a value would put the app into a state the UI cannot represent, so every read
 *  boundary — disk load and IPC/RPC update — coerces it back onto the shipped roster. These drop
 *  only the agent-named parts, so unrelated settings in the same object survive untouched. */

/** The `blank` sentinel opens a terminal with no agent, so it is a real choice rather than an
 *  agent id and must survive normalization. */
export function normalizeDefaultTuiAgent(value: unknown): TuiAgent | 'blank' | null {
  if (value === 'blank') {
    return 'blank'
  }
  // Why: null (not 'blank') so a profile pinned to a dropped agent falls back to auto-pick
  // instead of silently never launching an agent again.
  return isTuiAgent(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeHostKey(key: string): boolean {
  return key !== '' && key !== '__proto__' && key !== 'constructor' && key !== 'prototype'
}

/** Keep only entries keyed by an agent this build can launch and whose value its own normalizer
 *  accepts. `normalizeValue` returning `undefined` drops that entry. */
export function normalizeTuiAgentKeyedRecord<T>(
  value: unknown,
  normalizeValue: (candidate: unknown) => T | undefined
): Partial<Record<TuiAgent, T>> {
  const normalized: Partial<Record<TuiAgent, T>> = {}
  if (!isRecord(value)) {
    return normalized
  }
  for (const [agent, candidate] of Object.entries(value)) {
    if (!isTuiAgent(agent)) {
      continue
    }
    const normalizedValue = normalizeValue(candidate)
    if (normalizedValue !== undefined) {
      normalized[agent] = normalizedValue
    }
  }
  return normalized
}

/** Same as `normalizeTuiAgentKeyedRecord`, one level deeper: an outer map of execution host to
 *  agent-keyed values. A host left with no entries is dropped rather than kept as an empty
 *  object, so these caches shrink instead of accumulating hosts that hold nothing. */
export function normalizeHostScopedTuiAgentKeyedRecord<T>(
  value: unknown,
  normalizeValue: (candidate: unknown) => T | undefined
): Partial<Record<string, Partial<Record<TuiAgent, T>>>> {
  const normalized: Partial<Record<string, Partial<Record<TuiAgent, T>>>> = {}
  if (!isRecord(value)) {
    return normalized
  }
  for (const [host, hostValue] of Object.entries(value)) {
    if (!isSafeHostKey(host)) {
      continue
    }
    const hostEntries = normalizeTuiAgentKeyedRecord(hostValue, normalizeValue)
    if (Object.keys(hostEntries).length > 0) {
      normalized[host] = hostEntries
    }
  }
  return normalized
}

/** An empty override is meaningful — it records that the user cleared the command — so only the
 *  agent key is validated here, not the command text. */
export function normalizeTuiAgentCommandOverrides(
  value: unknown
): Partial<Record<TuiAgent, string>> {
  return normalizeTuiAgentKeyedRecord(value, (candidate) =>
    typeof candidate === 'string' ? candidate : undefined
  )
}
