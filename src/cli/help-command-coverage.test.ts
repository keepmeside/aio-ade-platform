/* Phase-03 guard (plans/260730-0117-aio-ade-rebrand-and-integration/phase-03).
 *
 * Help text is the CLI's contract with agents: the orchestration preamble points them at it, and
 * `orca --help` is how an agent discovers what it may call. Nothing type-checks it, so a carve can
 * leave help advertising commands that no longer dispatch — the agent then burns turns on a command
 * that returns "Unknown command".
 *
 * This asserts the invariant directly: every `$ orca <command>` example and every command line in a
 * help section must resolve to a registered spec. */
import { describe, expect, it } from 'vitest'
import { COMMAND_SPECS } from './specs'
import { isCommandGroup } from './args'
import { ROOT_HELP_TEXT } from './help'

/** Canonical paths plus declared aliases plus group headers — everything help may legitimately name. */
function registeredKeys(): Set<string> {
  const keys = new Set<string>()
  for (const spec of COMMAND_SPECS) {
    keys.add(spec.path.join(' '))
    for (const alias of spec.aliases ?? []) {
      keys.add(alias.join(' '))
    }
  }
  return keys
}

/** Longest registered command that prefixes the given words, so `terminal send --text x` matches. */
function resolveCommand(words: string[], keys: Set<string>): string | null {
  for (let length = Math.min(words.length, 4); length > 0; length -= 1) {
    const candidate = words.slice(0, length).join(' ')
    if (keys.has(candidate)) {
      return candidate
    }
  }
  return null
}

describe('phase-03: help text only advertises commands that exist', () => {
  it('resolves every `$ orca ...` example to a registered command', () => {
    const keys = registeredKeys()
    const unresolved: string[] = []

    for (const line of ROOT_HELP_TEXT.split('\n')) {
      const match = /^\s*\$ orca ([a-z][a-z0-9 -]*)/.exec(line)
      if (!match) {
        continue
      }
      const words = match[1]!.trim().split(/\s+/)
      if (!resolveCommand(words, keys)) {
        unresolved.push(words.join(' '))
      }
    }

    expect(unresolved).toEqual([])
  })

  it('resolves every command listed in a help section to a registered command', () => {
    const keys = registeredKeys()
    const unresolved: string[] = []

    for (const line of ROOT_HELP_TEXT.split('\n')) {
      // Section entries are "  <command>  <two-or-more spaces>  <description>".
      const match = /^ {2}([a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)*) {2,}\S/.exec(line)
      if (!match) {
        continue
      }
      const words = match[1]!.trim().split(/\s+/)
      // A bare group header (e.g. `linear`) is a legitimate help entry: `orca linear` prints the
      // group's subcommands rather than dispatching.
      if (!resolveCommand(words, keys) && !isCommandGroup(words)) {
        unresolved.push(words.join(' '))
      }
    }

    expect(unresolved).toEqual([])
  })
})
