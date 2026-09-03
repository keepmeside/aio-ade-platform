import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/* Brand-token scan.
 *
 * A rebrand of this size has one failure mode the compiler cannot see: the token survives in a
 * string that a user reads, or it gets rewritten in a string that identifies persisted data.
 * Both are silent. So every surviving occurrence has to name which of these it is:
 *
 *   - `legacy-data-read`   a name this app no longer writes but must still read, or an existing
 *                          install loses its account, workspace or plugin.
 *   - `wire-compat`        a token another process or an already-installed artifact sends us.
 *   - `upstream-owned`     a name upstream owns: copyright lines, third-party services, vendored
 *                          patches.
 *   - `screen-reader`      GNOME Orca, an unrelated program this app must avoid colliding with.
 *   - `generated`          a file regenerated from a source this scan already covers.
 *
 * Anything else is a bug. The allowlist below is the classification; a new entry is a decision
 * someone made on purpose, not a scan that got quieter. */

// Assembled at runtime so this file is not itself a hit in the scan it defines.
const LEGACY_TOKEN = `${'orc'}a`
const CANONICAL_MACHINE_TOKEN = `${'aio'}-ade`
const CANONICAL_DISPLAY_TOKEN = `${'AIO'}-ADE`

/* Case-sensitive alternation of the three spellings the brand actually used, rather than a
 * case-insensitive match on the letters. `errorCategory`, `onErrorCallback` and `forCache` all
 * contain those four letters in some case and none of them are the brand; matching insensitively
 * makes the scan permanently red for reasons no rename can fix. */
const LEGACY_TOKEN_PATTERN = [
  LEGACY_TOKEN,
  `${LEGACY_TOKEN.charAt(0).toUpperCase()}${LEGACY_TOKEN.slice(1)}`,
  LEGACY_TOKEN.toUpperCase()
].join('|')

/* Trees whose contents ship to a user: source, packaging, agent-facing guides, bundled
 * resources. `plans/` is excluded — it is internal operating history that records the old brand
 * deliberately, and it is not shipped. */
const SHIPPED_ROOTS = [
  'src',
  'config',
  'tests',
  'tools',
  'resources',
  'skills',
  'skill-guides',
  'docs',
  '.github',
  'native',
  'examples'
]

type Classification =
  | 'legacy-data-read'
  | 'wire-compat'
  | 'upstream-owned'
  | 'screen-reader'
  | 'generated'

/* Path prefixes whose legacy-token occurrences are accounted for, with the reason. Matching is
 * by path prefix, so a directory entry covers its subtree. */
const CLASSIFIED_PATHS: readonly { prefix: string; why: Classification }[] = [
  // A one-way reader for the pre-rebrand home directory, keychain service and plugin manifest.
  // These are the modules the phase-01 preflight test pins; the old spelling IS the contract.
  { prefix: 'src/shared/app-home-paths.ts', why: 'legacy-data-read' },
  { prefix: 'src/shared/repo-app-paths.ts', why: 'legacy-data-read' },
  { prefix: 'src/shared/cli-command-name.ts', why: 'legacy-data-read' },
  { prefix: 'src/shared/plugins/plugin-brand-tokens.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/legacy-app-home-adoption.ts', why: 'legacy-data-read' },
  { prefix: 'src/shared/user-data-dir-names.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/legacy-user-data-adoption.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/legacy-user-data-adoption.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/orca-profiles/profile-storage-paths.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/remote-project-config-read.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/claude-accounts/keychain.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/claude-accounts/managed-auth-marker.ts', why: 'legacy-data-read' },

  // The content hash of an installed plugin is its directory name and its lockfile entry, so the
  // domain tag is a preimage: changing it makes every installed plugin unaddressable. The packaging
  // verifier recomputes the same hash, so it spells the tag too.
  { prefix: 'src/main/plugins/plugin-content-hash.ts', why: 'wire-compat' },
  { prefix: 'config/scripts/verify-packaged-plugin-resources.cjs', why: 'wire-compat' },

  /* A plugin key is `publisher.id` and it is persisted: it names the install directory and is what
   * `disabledPlugins` stores. The three bundled plugins were published under the previous publisher
   * token, so their keys, the release-hash index that addresses them, and the fixtures that assert
   * against them all keep that spelling. Renaming a key orphans an installed copy.
   *
   * The whole tree is covered rather than one file because every occurrence in it is one of the same
   * three things: a persisted plugin key, the upstream repository a bundled plugin is fetched from,
   * or prose describing plugins that upstream published and still owns. */
  { prefix: 'resources/plugins/launch/', why: 'wire-compat' },
  { prefix: 'src/main/plugins/plugin-launch-content.test.ts', why: 'wire-compat' },
  { prefix: 'config/scripts/verify-packaged-plugin-resources.test.mjs', why: 'wire-compat' },
  { prefix: 'tests/e2e/plugin-marketplace-content.spec.ts', why: 'wire-compat' },
  // Reads both publisher/prefix families so an installed official plugin stays recognized.
  { prefix: 'src/shared/plugins/plugin-marketplace.ts', why: 'legacy-data-read' },
  // Accepts the pre-rebrand panel message dialect and replies in the dialect it was asked in.
  { prefix: 'src/shared/plugins/plugin-panel-bridge.ts', why: 'wire-compat' },
  // Pins that the pre-rebrand panel dialect is still the one an old panel may send.
  { prefix: 'src/shared/plugins/plugin-panel-bridge-brand.test.ts', why: 'wire-compat' },
  // Pins the in-repo `.orca/` directory and `orca.yaml` a pre-rebrand checkout still has on disk.
  { prefix: 'src/shared/repo-app-paths.test.ts', why: 'legacy-data-read' },

  /* The pre-rebrand PATH names, and the WSL/Codex registrations written under them. An upgrade has
   * to recognize what an older build left on disk in order to reclaim or repair it; matching only
   * the current spelling silently classifies its own leftovers as user-owned. */
  { prefix: 'src/main/cli/wsl-cli-installer.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/cli/wsl-cli-scripts.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/cli/wsl-cli-installer.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/cli/cli-installer.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/codex/hook-service.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/codex/hook-service.test.ts', why: 'legacy-data-read' },
  /* A captured Codex `/hooks` approval: the asserted digest is a hash OF the pre-rebrand path
   * string beside it, so editing the input would fabricate the pair it exists to verify. */
  { prefix: 'src/main/codex/config-toml-trust.test.ts', why: 'wire-compat' },
  /* These assert the preamble never emits a pre-rebrand command name, so they must name it. */
  { prefix: 'src/main/runtime/orchestration/preamble.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/runtime/rpc/methods/orchestration.test.ts', why: 'legacy-data-read' },
  {
    prefix: 'src/main/runtime/rpc/methods/orchestration-workers-new-worktree.test.ts',
    why: 'legacy-data-read'
  },
  /* A golden HKDF vector whose comment records that the transcript was recomputed when the protocol
   * label changed, and why that is safe here (no shipped peer speaks the old label). The old label
   * has to be named for the recomputation to be auditable. */
  { prefix: 'src/shared/mobile-e2ee-v2-fixtures.ts', why: 'wire-compat' },

  // Upstream's own copyright and license text.
  { prefix: 'NOTICE', why: 'upstream-owned' },
  { prefix: 'LICENSE', why: 'upstream-owned' },

  // A vendored patch: renaming an internal C macro risks the patch no longer applying, for no
  // runtime benefit.
  { prefix: 'config/patches/', why: 'upstream-owned' },

  // Regenerated from `skill-guides/` and `skill-stubs/`, which this scan covers.
  { prefix: 'src/cli/bundled-skill-guides.ts', why: 'generated' },
  { prefix: 'skills/', why: 'generated' },

  // Tests that assert the legacy spelling on purpose — the guards for everything above.
  { prefix: 'src/main/legacy-orca-data-path-preflight.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/shared/brand-token-contract.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/shared/environment-prefix-contract.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/shared/cli-command-name.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/shared/app-home-paths.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/shared/plugins/plugin-brand-tokens.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/legacy-app-home-adoption.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/claude-accounts/managed-auth-marker.test.ts', why: 'legacy-data-read' },
  { prefix: 'src/main/claude-accounts/keychain.test.ts', why: 'legacy-data-read' },

  /* GNOME Orca is an unrelated screen reader at /usr/bin/orca. The pre-rebrand CLI collided with it
   * on Linux and needed a second binary name; `aio-ade` does not. Every one of these names the
   * collision to explain why one name is now safe everywhere — deleting the explanation is how a
   * later change reintroduces the collision without noticing. */
  { prefix: 'config/electron-builder.config.cjs', why: 'screen-reader' },
  { prefix: 'src/main/cli/cli-installer.ts', why: 'screen-reader' },
  { prefix: 'src/main/cli/linux-bare-aio-ade-dispatcher.ts', why: 'screen-reader' },
  { prefix: 'src/main/cli/linux-terminal-aio-ade-cli-shim.ts', why: 'screen-reader' },
  { prefix: 'src/main/ipc/pty.ts', why: 'screen-reader' },
  { prefix: 'src/main/ipc/pty.test.ts', why: 'screen-reader' },
  { prefix: 'src/main/runtime/orchestration/cli-command.ts', why: 'screen-reader' },
  { prefix: 'src/shared/agent-launch-remote.ts', why: 'screen-reader' },
  { prefix: 'src/shared/tui-agent-config.ts', why: 'screen-reader' },
  { prefix: 'src/shared/tui-agent-startup.test.ts', why: 'screen-reader' },
  { prefix: 'skill-guides/aio-ade-cli.md', why: 'screen-reader' },
  { prefix: 'skill-stubs/', why: 'screen-reader' },
  { prefix: 'config/scripts/aio-ade-cli-skill-guidance.test.mjs', why: 'screen-reader' },
  { prefix: 'config/scripts/aio-ade-linear-skill-guidance.test.mjs', why: 'screen-reader' },
  { prefix: 'config/scripts/computer-use-skill-guidance.test.mjs', why: 'screen-reader' },
  { prefix: 'config/scripts/orchestration-skill-guidance.test.mjs', why: 'screen-reader' },
  { prefix: 'config/scripts/generate-bundled-skill-guides.test.mjs', why: 'screen-reader' }
]

/* The modules that must literally spell the legacy name, because they are the ones that define it.
 * Every other reader imports from these, so this is the whole set that a sweep could quietly empty
 * — and emptying it is what strands an existing install. */
const TOKEN_OWNING_READERS: readonly string[] = [
  'src/shared/app-home-paths.ts',
  'src/shared/repo-app-paths.ts',
  'src/shared/cli-command-name.ts',
  'src/shared/user-data-dir-names.ts',
  'src/shared/plugins/plugin-brand-tokens.ts',
  'src/main/claude-accounts/keychain.ts',
  'src/main/plugins/plugin-content-hash.ts'
]

function grepLegacyToken(roots: readonly string[]): string[] {
  try {
    return execFileSync('git', ['grep', '-Iln', '-E', LEGACY_TOKEN_PATTERN, '--', ...roots], {
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024
    })
      .split('\n')
      .filter(Boolean)
  } catch (error) {
    // git grep exits 1 with no output when nothing matches, which is the passing case.
    if ((error as { status?: number }).status === 1) {
      return []
    }
    throw error
  }
}

function isClassified(path: string): boolean {
  return CLASSIFIED_PATHS.some((entry) => path.startsWith(entry.prefix))
}

/* A citation of upstream's issue tracker classifies itself.
 *
 * These issues exist only in the repository upstream owns, so the URL has to name it; the rebrand
 * rewrote 195 of them into this fork's slug, which was syntactically clean and pointed every reader
 * at a tracker holding two issues. Recognising the shape rather than allowlisting the eleven files
 * that hold them means a new citation needs no new entry, and — unlike a path allowlist — a file
 * carrying a citation is still scanned for every other occurrence. */
const UPSTREAM_ISSUE_CITATION = /https?:\/\/github\.com\/stablyai\/orca\/(?:issues|pull)\/\d+/gu

function hasUnclassifiedOccurrence(path: string): boolean {
  const withoutCitations = readFileSync(path, 'utf-8').replace(UPSTREAM_ISSUE_CITATION, '')
  return new RegExp(LEGACY_TOKEN_PATTERN, 'u').test(withoutCitations)
}

describe('brand token scan', () => {
  it('leaves no unclassified legacy token in a shipped tree', () => {
    const unclassified = grepLegacyToken(SHIPPED_ROOTS)
      .filter((path) => !isClassified(path))
      .filter(hasUnclassifiedOccurrence)

    expect(unclassified).toEqual([])
  })

  it('subtracts only the citation, so a real miss beside one still fails', () => {
    /* The citation filter is the one place this scan removes text before deciding. If it stripped a
     * line rather than a URL, a genuine occurrence sharing a file with a citation would vanish and
     * the scan would get quieter for the wrong reason. */
    const citation = 'see https://github.com/stablyai/orca/issues/8457 for the report'
    const strip = (text: string) => text.replace(UPSTREAM_ISSUE_CITATION, '')
    const stillMatches = (text: string) => new RegExp(LEGACY_TOKEN_PATTERN, 'u').test(strip(text))

    expect(stillMatches(citation)).toBe(false)
    expect(stillMatches(`${citation}\nconst dir = '~/.orca'`)).toBe(true)
    expect(stillMatches(`${citation} and Orca Profiles`)).toBe(true)
    // A repository URL that is not an issue citation is not self-classifying.
    expect(stillMatches('https://github.com/stablyai/orca.git')).toBe(true)
  })

  it('keeps every legacy-data reader that an existing install depends on', () => {
    /* The inverse guard: a later sweep that "finishes the rename" by deleting these readers would
     * strand existing users, and the scan above would get quieter, not louder. Read from disk
     * rather than `git grep` so a reader still staged as untracked also counts. */
    const missing = TOKEN_OWNING_READERS.filter(
      (path) => !new RegExp(LEGACY_TOKEN_PATTERN).test(readFileSync(path, 'utf-8'))
    )

    expect(missing).toEqual([])
  })
})

describe('user-visible product identity', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf-8')) as {
    name?: string
    productName?: string
    homepage?: string
  }

  it('names the package with the machine token', () => {
    // `name` also decides the Electron userData directory, so it moves together with the
    // migration that adopts the old one.
    expect(manifest.name).toBe(CANONICAL_MACHINE_TOKEN)
  })

  it('names the product with the display token', () => {
    expect(manifest.productName).toBe(CANONICAL_DISPLAY_TOKEN)
  })

  it('points its homepage at this fork', () => {
    expect(manifest.homepage).toContain('keepmeside/aio-ade-platform')
  })
})
