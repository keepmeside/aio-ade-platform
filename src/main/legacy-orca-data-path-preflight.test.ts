/* Phase-01 safety net (plans/260730-0117-aio-ide-rebrand-and-integration/phase-01).
 *
 * Success criterion: "Có test fixture cho persisted removed-agent ids và legacy Orca auth path."
 *
 * The approved rebrand decision draws a hard line: the CLI alias goes away, but one-way DATA
 * migration must stay. Reading `~/.orca`, the `Orca …` Keychain service, and the `.orca/*`
 * in-repo directories is how an existing user keeps their account and workspace. A global
 * `orca` -> `aio-ade` replacement in phase 05 would silently rewrite these and strand users,
 * and nothing would fail — the app would just look freshly installed.
 *
 * These assertions read the real call sites, so if phase 05 rewrites one, this file fails and
 * forces the change to be a deliberate dual-read migration instead of a token replacement. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getUserKeybindingsPath } from './keybindings/keybinding-file'

function source(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('phase-01 safety net: legacy Orca data paths are compatibility contracts', () => {
  it('resolves user keybindings under the legacy ~/.orca directory', () => {
    expect(getUserKeybindingsPath('/home/tester')).toBe('/home/tester/.orca/keybindings.json')
  })

  it.each([
    ['jira credential store', 'src/main/jira/client.ts'],
    ['minimax cookie store', 'src/main/minimax/minimax-cookie-store.ts'],
    ['claude agent-teams shim root', 'src/main/runtime/claude-agent-teams-shim-env.ts']
  ])('%s still resolves its home directory as .orca', (_label, path) => {
    expect(source(path)).toContain("'.orca'")
  })

  it('keeps the in-repo hook directory name as .orca', () => {
    expect(source('src/main/hooks.ts')).toContain("const ORCA_DIR = '.orca'")
  })

  it.each([
    [
      'drops',
      'src/renderer/src/components/terminal-pane/terminal-drop-worktree-path.ts',
      '.orca/drops'
    ],
    ['templates', 'src/renderer/src/lib/markdown-document-templates.ts', '.orca/templates']
  ])('keeps the in-repo %s directory path', (_label, path, expected) => {
    expect(source(path)).toContain(expected)
  })
})

describe('phase-01 safety net: legacy Keychain service names', () => {
  it('pins the managed-credentials service string that phase 05 must dual-read', () => {
    const keychain = source('src/main/claude-accounts/keychain.ts')

    expect(keychain).toContain("'Orca Claude Code Managed Credentials'")
    // Claude Code's own service name is upstream-owned and must NOT be rebranded.
    expect(keychain).toContain("'Claude Code-credentials'")
  })
})

describe('phase-01 safety net: orchestration CLI command contract', () => {
  it('pins the injected CLI command names so phase 03/05 must update them together', () => {
    // The preamble teaches agents this exact binary name; the WSL variant is a separate
    // installed shim. Renaming the union without the shim, the PATH installer and the
    // packaged launcher leaves worker orchestration dead with no failing unit test.
    expect(source('src/main/runtime/orchestration/cli-command.ts')).toContain(
      "export type OrchestrationCliCommand = 'orca' | 'orca-ide'"
    )
  })
})
