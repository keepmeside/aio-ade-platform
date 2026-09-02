import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

/* Environment-variable prefix contract.
 *
 * These names cross a process boundary into PTYs, agent hook scripts, WSL interop lists and
 * shim wrappers. A half-finished rename is invisible to the compiler: the writer sets one
 * spelling and the reader looks for the other, so the hook simply never fires and no test fails.
 * This scan is the guard that the prefix stayed uniform. */

// Assembled at runtime so this file does not itself contain the token it forbids.
const FORBIDDEN_PREFIX = `${'ORCA'}_`
const CANONICAL_PREFIX = `${'AIO_ADE'}_`

const SEARCH_ROOTS = ['src', 'config', 'tests', 'tools', 'skills', 'skill-guides', 'resources']

/* Not environment variables:
 *  - `bundled-skill-guides.ts` derives SCREAMING_CASE constant names from skill guide FILE names
 *    (`orca-linear.md` -> `ORCA_LINEAR_MARKDOWN`); those follow the skill rename, and the file is
 *    regenerated from `skill-guides/`, which this scan does cover.
 *  - the vendored node-pty patch adds C preprocessor macros; editing a vendored patch to rename
 *    an internal macro risks the patch no longer applying, for no runtime benefit.
 *  - the WSL launcher scripts: a registration written by a pre-rename build sets `ORCA_*` shell
 *    variables inside itself, and repair has to read that file to recognize its own leftovers. The
 *    old names are input here, never something this app writes. */
const NON_ENVIRONMENT_SOURCES = [
  'src/cli/bundled-skill-guides.ts',
  'config/patches/',
  'src/shared/environment-prefix-contract.test.ts',
  'src/main/cli/wsl-cli-scripts.ts',
  'src/main/cli/wsl-cli-installer.test.ts'
]

function grepTokens(pattern: string): string[] {
  try {
    return execFileSync(
      'git',
      ['grep', '-InE', pattern, '--', ...SEARCH_ROOTS.map((root) => `${root}/`)],
      { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 }
    )
      .split('\n')
      .filter(Boolean)
  } catch (error) {
    // git grep exits 1 with no output when nothing matches, which is the passing case.
    const status = (error as { status?: number }).status
    if (status === 1) {
      return []
    }
    throw error
  }
}

describe('environment variable prefix', () => {
  it('has no surviving pre-rebrand environment token in shipped source', () => {
    const hits = grepTokens(`\\b${FORBIDDEN_PREFIX}[A-Z0-9_]*`).filter(
      (line) => !NON_ENVIRONMENT_SOURCES.some((source) => line.startsWith(source))
    )

    expect(hits).toEqual([])
  })

  it('still routes the high-traffic names that reach a PTY or an installed hook', () => {
    // Each of these is written by the host and read back by a shell script, a WSL interop list
    // or a shim; losing one silently breaks agent status reporting rather than failing a build.
    const required = [
      'PANE_KEY',
      'TERMINAL_HANDLE',
      'USER_DATA_PATH',
      'AGENT_HOOK_PORT',
      'AGENT_HOOK_TOKEN',
      'CODEX_HOME',
      'CLI_COMMAND',
      'ORIG_ZDOTDIR'
    ]

    for (const suffix of required) {
      expect(grepTokens(`\\b${CANONICAL_PREFIX}${suffix}\\b`).length).toBeGreaterThan(0)
    }
  })
})
