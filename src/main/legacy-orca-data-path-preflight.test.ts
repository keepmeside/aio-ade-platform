/* Safety net: the pre-rebrand data paths an existing install still depends on.
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
import {
  ADOPTED_LEGACY_HOME_ENTRIES,
  REGENERATED_LEGACY_HOME_ENTRIES
} from './legacy-app-home-adoption'
import { getUserKeybindingsPath } from './keybindings/keybinding-file'
import { LEGACY_APP_HOME_DIR_NAME } from '../shared/app-home-paths'
import {
  getRepoAppPathCandidates,
  getRepoProjectConfigCandidates,
  LEGACY_PROJECT_CONFIG_FILE_NAME,
  LEGACY_REPO_APP_DIR_NAME,
  PROJECT_CONFIG_FILE_NAME,
  REPO_APP_DIR_NAME
} from '../shared/repo-app-paths'

function source(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('legacy Orca data paths are compatibility contracts', () => {
  it('writes user keybindings under the canonical home directory', () => {
    expect(getUserKeybindingsPath('/home/tester')).toBe('/home/tester/.aio-ade/keybindings.json')
  })

  it('still names the pre-rebrand home directory so existing data stays reachable', () => {
    expect(LEGACY_APP_HOME_DIR_NAME).toBe('.orca')
  })

  it.each([
    ['user keybindings', 'keybindings.json'],
    ['jira site index', 'jira-sites.json'],
    ['jira credential store', 'jira-tokens'],
    ['linear credential store', 'linear-tokens'],
    ['speech api key', 'openai-speech-token.enc'],
    ['remote workspace sessions', 'sessions']
  ])('adopts the pre-rebrand %s instead of stranding it', (_label, entry) => {
    expect(ADOPTED_LEGACY_HOME_ENTRIES).toContain(entry)
  })

  it.each([
    ['managed agent hook scripts', 'agent-hooks'],
    ['claude agent-teams shim', 'claude-agent-teams-bin']
  ])('regenerates %s rather than copying it forward', (_label, entry) => {
    expect(REGENERATED_LEGACY_HOME_ENTRIES).toContain(entry)
  })

  it('routes every home-directory store through the shared resolver', () => {
    // A store that rebuilds the path itself is the failure this net exists for: it would follow
    // the rename and leave the pre-rebrand copy unreachable with nothing failing.
    for (const path of [
      'src/main/jira/client.ts',
      'src/main/linear/client.ts',
      'src/main/speech/openai-api-key-store.ts',
      'src/main/keybindings/keybinding-file.ts',
      'src/main/agent-hooks/installer-utils.ts',
      'src/main/agent-hooks/managed-hook-install-lock.ts',
      'src/main/runtime/claude-agent-teams-shim-env.ts'
    ]) {
      expect(source(path)).toContain('app-home-paths')
      expect(source(path)).not.toContain("'.orca'")
    }
  })

  it('reads the pre-rebrand in-repo directory and project config, and writes the current ones', () => {
    // The in-repo directory holds per-user issue-command overrides and markdown templates, and
    // the project yaml is committed — a rename that drops either read makes an existing repo
    // look unconfigured, with nothing failing.
    expect(REPO_APP_DIR_NAME).toBe('.aio-ade')
    expect(LEGACY_REPO_APP_DIR_NAME).toBe('.orca')
    expect(PROJECT_CONFIG_FILE_NAME).toBe('aio-ade.yaml')
    expect(LEGACY_PROJECT_CONFIG_FILE_NAME).toBe('orca.yaml')

    expect(getRepoAppPathCandidates('/work/repo', 'templates')).toEqual([
      '/work/repo/.aio-ade/templates',
      '/work/repo/.orca/templates'
    ])
    expect(getRepoProjectConfigCandidates('/work/repo')).toEqual([
      '/work/repo/aio-ade.yaml',
      '/work/repo/orca.yaml'
    ])
  })

  it.each([
    ['in-repo hook and issue-command resolution', 'src/main/hooks.ts'],
    ['markdown templates', 'src/renderer/src/lib/markdown-document-templates.ts'],
    [
      'terminal drop staging',
      'src/renderer/src/components/terminal-pane/terminal-drop-worktree-path.ts'
    ]
  ])('routes %s through the shared repo path module', (_label, path) => {
    expect(source(path)).toContain('repo-app-paths')
    expect(source(path)).not.toContain("'.orca")
  })
})

describe('legacy Keychain service names', () => {
  it('pins the managed-credentials service string that phase 05 must dual-read', () => {
    const keychain = source('src/main/claude-accounts/keychain.ts')

    expect(keychain).toContain("'Orca Claude Code Managed Credentials'")
    // Claude Code's own service name is upstream-owned and must NOT be rebranded.
    expect(keychain).toContain("'Claude Code-credentials'")
  })
})

describe('orchestration CLI command contract', () => {
  /* This assertion used to pin the literal two-member union `'orca' | 'orca-ide'`, so that
   * collapsing it had to be a deliberate edit rather than a side effect of a token sweep. That
   * change has now happened: one name is installed on every host. What still needs guarding is the
   * property the old pin was protecting — the name the preamble teaches an agent must be the name
   * the PATH installer actually installs. A mismatch fails at agent runtime, not at build time. */
  it('feeds the preamble the same command the installer puts on PATH', () => {
    const resolver = source('src/main/runtime/orchestration/cli-command.ts')

    expect(resolver).toContain("from '../../../shared/cli-command-name'")
    expect(resolver).toContain('export type OrchestrationCliCommand = typeof CLI_COMMAND_NAME')
    // No literal command name of its own: the shared constant is the single source.
    expect(resolver).not.toMatch(/'aio-ade'|"aio-ade"/)
  })

  it('keeps the installer reclaiming both pre-rebrand PATH names', () => {
    // `orca` shadowed GNOME Orca on Linux and `orca-ide` was the Linux-specific name; an upgrade
    // that reclaims only one leaves a dangling symlink to a launcher this app no longer ships.
    expect(source('src/main/cli/cli-installer.ts')).toContain('LEGACY_CLI_COMMAND_NAMES')
  })
})
