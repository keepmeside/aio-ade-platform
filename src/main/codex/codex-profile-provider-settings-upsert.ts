import { readCodexTopLevelModelProvider } from './codex-model-provider-config'
import {
  joinPreservingTrailingNewline,
  upsertTopLevelSettingsInContent,
  withCrLine,
  withTrailingCr
} from './codex-config-settings-upsert'
import {
  createTomlLineScanState,
  getTomlTableHeader,
  isTomlStructuralLine,
  updateTomlLineScanState
} from './config-toml-line-scan'
import { parseTomlKeyPath, parseTomlTableHeaderPath } from './config-toml-key-path'

export type CodexProfileProviderSettings = {
  providerId: string
  baseUrl: string
  envKey: string
  model: string | null
}

const PROVIDER_SETTING_KEYS = ['name', 'base_url', 'env_key'] as const

type CodexProfileProviderPlacementScan = {
  bareKeyIndexes: Map<string, number>
  preambleDottedKeyIndexes: Map<string, number>
  inTableDottedKeyIndexes: Map<string, number>
  blockedAbsentKeys: Set<string>
  hasDedicatedTable: boolean
  dedicatedTableHeaderIndex: number
  dedicatedTableBodyEndIndex: number
  blocksNewTable: boolean
  lastPreambleDottedIndex: number
  lastInTableDottedIndex: number
  pinLineIndex: number
}

/**
 * Materializes a profile's provider into the system config.toml: a
 * `[model_providers."<id>"]` table (name/base_url/env_key) plus top-level pins
 * — model_provider always (the profile is the explicit source, a user pin is
 * overwritten), model only when the profile pins one. Idempotent: a second run
 * replaces in place and is byte-identical.
 */
export function upsertCodexProfileProviderSettings(
  content: string,
  settings: CodexProfileProviderSettings
): string {
  const { providerId } = settings
  const rawByKey: Record<string, string> = {
    name: JSON.stringify(providerId),
    base_url: JSON.stringify(settings.baseUrl),
    env_key: JSON.stringify(settings.envKey)
  }
  const preambleDottedPrefix = `model_providers.${JSON.stringify(providerId)}`
  const inTableIdSegment = renderTomlKeySegment(providerId)

  const lines = content.split('\n')
  const scan = scanCodexProfileProviderPlacement(lines, providerId)
  const usesCrlf = content.includes('\r\n')

  for (const key of PROVIDER_SETTING_KEYS) {
    const raw = rawByKey[key]!
    const bareIndex = scan.bareKeyIndexes.get(key)
    if (bareIndex !== undefined) {
      lines[bareIndex] = withTrailingCr(lines[bareIndex]!, `${key} = ${raw}`)
    }
    const preambleIndex = scan.preambleDottedKeyIndexes.get(key)
    if (preambleIndex !== undefined) {
      lines[preambleIndex] = withTrailingCr(
        lines[preambleIndex]!,
        `${preambleDottedPrefix}.${key} = ${raw}`
      )
    }
    const inTableIndex = scan.inTableDottedKeyIndexes.get(key)
    if (inTableIndex !== undefined) {
      lines[inTableIndex] = withTrailingCr(
        lines[inTableIndex]!,
        `${inTableIdSegment}.${key} = ${raw}`
      )
    }
  }

  const bodyInserts: string[] = []
  const preambleDottedInserts: string[] = []
  const inTableDottedInserts: string[] = []
  const newTableKeys: string[] = []
  for (const key of PROVIDER_SETTING_KEYS) {
    const found =
      scan.bareKeyIndexes.has(key) ||
      scan.preambleDottedKeyIndexes.has(key) ||
      scan.inTableDottedKeyIndexes.has(key)
    if (found || scan.blockedAbsentKeys.has(key)) {
      continue
    }
    const raw = rawByKey[key]!
    if (scan.hasDedicatedTable) {
      bodyInserts.push(`${key} = ${raw}`)
    } else if (scan.lastInTableDottedIndex !== -1) {
      inTableDottedInserts.push(`${inTableIdSegment}.${key} = ${raw}`)
    } else if (scan.lastPreambleDottedIndex !== -1) {
      preambleDottedInserts.push(`${preambleDottedPrefix}.${key} = ${raw}`)
    } else if (!scan.blocksNewTable) {
      // Why: inline/array model_providers definitions block this branch because
      // appending a plain table beside either would make the config invalid.
      newTableKeys.push(`${key} = ${raw}`)
    }
  }

  // Why: the config shape routes every absent key to the same branch, so at
  // most one insert group is non-empty; still apply EOF→body→dotted so a
  // splice never shifts a lower index a later splice depends on.
  if (newTableKeys.length > 0) {
    appendNewProviderTable(lines, providerId, newTableKeys, usesCrlf)
  }
  if (bodyInserts.length > 0) {
    const insertAt = computeProviderBodyInsertIndex(
      lines,
      scan.dedicatedTableHeaderIndex,
      scan.dedicatedTableBodyEndIndex
    )
    lines.splice(insertAt, 0, ...bodyInserts.map((line) => withCrLine(line, usesCrlf)))
  }
  if (inTableDottedInserts.length > 0) {
    lines.splice(
      scan.lastInTableDottedIndex + 1,
      0,
      ...inTableDottedInserts.map((line) => withCrLine(line, usesCrlf))
    )
  }
  if (preambleDottedInserts.length > 0) {
    lines.splice(
      scan.lastPreambleDottedIndex + 1,
      0,
      ...preambleDottedInserts.map((line) => withCrLine(line, usesCrlf))
    )
  }

  const pins = new Map<string, string>()
  if (settings.model !== null) {
    pins.set('model', JSON.stringify(settings.model))
  }
  pins.set('model_provider', JSON.stringify(providerId))
  return upsertTopLevelSettingsInContent(joinPreservingTrailingNewline(lines, usesCrlf), pins)
}

/**
 * Removes everything the profile materialized: the dedicated table (whole —
 * custom keys inside reference the gone provider), dotted keys in either form,
 * and the model_provider pin only when it still names this provider. A user
 * pin for another provider survives.
 */
export function removeCodexProfileProviderSettings(content: string, providerId: string): string {
  const lines = content.split('\n')
  const scan = scanCodexProfileProviderPlacement(lines, providerId)

  const removals = new Set<number>()
  for (const index of scan.preambleDottedKeyIndexes.values()) {
    removals.add(index)
  }
  for (const index of scan.inTableDottedKeyIndexes.values()) {
    removals.add(index)
  }
  if (scan.hasDedicatedTable) {
    for (
      let index = scan.dedicatedTableHeaderIndex;
      index < scan.dedicatedTableBodyEndIndex;
      index += 1
    ) {
      removals.add(index)
    }
  }
  if (scan.pinLineIndex !== -1 && readCodexTopLevelModelProvider(content) === providerId) {
    removals.add(scan.pinLineIndex)
  }
  if (removals.size === 0) {
    return content
  }

  for (const index of [...removals].sort((a, b) => b - a)) {
    lines.splice(index, 1)
  }
  return joinPreservingTrailingNewline(lines, content.includes('\r\n'))
}

function scanCodexProfileProviderPlacement(
  lines: string[],
  providerId: string
): CodexProfileProviderPlacementScan {
  let state = createTomlLineScanState()
  let inPreamble = true
  let hasDedicatedTable = false
  let dedicatedBodyActive = false
  let dedicatedTableHeaderIndex = -1
  let dedicatedTableBodyEndIndex = -1
  let blocksNewTable = false
  let inModelProvidersParent = false
  let lastPreambleDottedIndex = -1
  let lastInTableDottedIndex = -1
  let pinLineIndex = -1
  const bareKeyIndexes = new Map<string, number>()
  const preambleDottedKeyIndexes = new Map<string, number>()
  const inTableDottedKeyIndexes = new Map<string, number>()
  const blockedAbsentKeys = new Set<string>()

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (isTomlStructuralLine(state)) {
      const header = getTomlTableHeader(line)
      if (header) {
        if (dedicatedBodyActive) {
          dedicatedTableBodyEndIndex = index
          dedicatedBodyActive = false
        }
        const table = parseTomlTableHeaderPath(header)
        if (table && table.segments[0] === 'model_providers') {
          // Why: an array (of the parent or of this provider) already owns the
          // name, so appending a plain table would redefine it.
          if (table.isArray) {
            blocksNewTable = true
          } else if (
            !hasDedicatedTable &&
            table.segments.length === 2 &&
            table.segments[1] === providerId
          ) {
            hasDedicatedTable = true
            dedicatedBodyActive = true
            dedicatedTableHeaderIndex = index
          } else if (table.segments.length === 3 && table.segments[1] === providerId) {
            blockedAbsentKeys.add(table.segments[2]!)
          }
          inModelProvidersParent = !table.isArray && table.segments.length === 1
        } else {
          inModelProvidersParent = false
        }
        inPreamble = false
        state = updateTomlLineScanState(state, line)
        continue
      }
      const parsed = parseTomlKeyPath(line)
      const isAssignment = parsed !== null && line[parsed.end] === '='
      if (inPreamble && isAssignment && parsed.segments[0] === 'model_providers') {
        if (parsed.segments.length === 3 && parsed.segments[1] === providerId) {
          lastPreambleDottedIndex = index
          preambleDottedKeyIndexes.set(parsed.segments[2]!, index)
        } else if (parsed.segments.length > 3 && parsed.segments[1] === providerId) {
          blockedAbsentKeys.add(parsed.segments[2]!)
        } else if (parsed.segments.length === 1) {
          // Inline-table assignment: a subtable append would redefine it.
          blocksNewTable = true
        }
      } else if (
        inPreamble &&
        isAssignment &&
        parsed.segments.length === 1 &&
        parsed.segments[0] === 'model_provider' &&
        pinLineIndex === -1
      ) {
        pinLineIndex = index
      } else if (dedicatedBodyActive && isAssignment) {
        if (parsed.segments.length === 1) {
          bareKeyIndexes.set(parsed.segments[0]!, index)
        } else if (parsed.segments.length === 2) {
          // Why: a dotted key here already defines the name as a table, so a
          // bare insert of that name beside it would be invalid TOML.
          blockedAbsentKeys.add(parsed.segments[0]!)
        }
      } else if (inModelProvidersParent && isAssignment && parsed.segments[0] === providerId) {
        if (parsed.segments.length === 2) {
          lastInTableDottedIndex = index
          inTableDottedKeyIndexes.set(parsed.segments[1]!, index)
        } else if (parsed.segments.length === 3) {
          blockedAbsentKeys.add(parsed.segments[1]!)
        }
      }
    }
    state = updateTomlLineScanState(state, line)
  }
  if (dedicatedBodyActive) {
    dedicatedTableBodyEndIndex = lines.length
  }

  return {
    bareKeyIndexes,
    preambleDottedKeyIndexes,
    inTableDottedKeyIndexes,
    blockedAbsentKeys,
    hasDedicatedTable,
    dedicatedTableHeaderIndex,
    dedicatedTableBodyEndIndex,
    blocksNewTable,
    lastPreambleDottedIndex,
    lastInTableDottedIndex,
    pinLineIndex
  }
}

// Why: TOML forbids adding bare keys to a table after a subtable opens, so
// absent keys land at the body's end — before trailing blanks and before the
// next header — which is the only valid spot.
function computeProviderBodyInsertIndex(
  lines: string[],
  headerIndex: number,
  endIndex: number
): number {
  if (headerIndex === -1) {
    return -1
  }
  let insertAt = endIndex
  while (insertAt > headerIndex + 1 && (lines[insertAt - 1] ?? '').trim() === '') {
    insertAt -= 1
  }
  return insertAt
}

function appendNewProviderTable(
  lines: string[],
  providerId: string,
  keyRenders: string[],
  usesCrlf: boolean
): void {
  let appendAt = lines.length
  while (appendAt > 0 && (lines[appendAt - 1] ?? '').trim() === '') {
    appendAt -= 1
  }
  const header = `[model_providers.${JSON.stringify(providerId)}]`
  // Why: separate the new table from prior content with a blank line, unless
  // the file was empty/blank, where a leading blank would be spurious.
  const block = appendAt > 0 ? ['', header, ...keyRenders] : [header, ...keyRenders]
  lines.splice(appendAt, 0, ...block.map((line) => withCrLine(line, usesCrlf)))
}

function renderTomlKeySegment(segment: string): string {
  return /^[A-Za-z0-9_-]+$/.test(segment) ? segment : JSON.stringify(segment)
}
