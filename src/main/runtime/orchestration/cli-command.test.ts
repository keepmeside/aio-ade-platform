import { describe, expect, it } from 'vitest'
import { resolveTerminalOrchestrationCliCommand } from './cli-command'
import { CLI_COMMAND_NAME } from '../../../shared/cli-command-name'

/* This resolver used to choose between two installed names per host. The rebrand ships one name
 * everywhere, so the only property left worth pinning is that the preamble is fed the same command
 * this app actually installs on PATH — a mismatch here teaches agents a command that does not
 * exist, and fails at agent runtime rather than at build time. */

describe('resolveTerminalOrchestrationCliCommand', () => {
  it('returns the command this app installs on PATH', () => {
    expect(resolveTerminalOrchestrationCliCommand()).toBe(CLI_COMMAND_NAME)
  })

  it('is host-independent, so no caller has to resolve WSL or SSH context for it', () => {
    // Guards the seam against regrowing per-host branching without a decision to do so.
    expect(resolveTerminalOrchestrationCliCommand.length).toBe(0)
  })
})
