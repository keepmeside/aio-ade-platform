import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/* Every path the bundler is told to read must exist.
 *
 * This gap is why the desktop build broke silently: reducing the agent roster deleted an ai-vault
 * worker while its rollup input entry stayed behind, and nothing noticed. `pnpm test` does not bundle,
 * `pnpm typecheck` does not resolve bundler entries, and `pnpm lint` does not either — so the first
 * failure would have been a real build, which this program had deferred to a later phase. A missing
 * entry is a hard `UNRESOLVED_ENTRY` error, not a warning, so it fails the whole build.
 *
 * Matches the config text rather than importing it: the config pulls in plugins and an Electron
 * toolchain, and a guard that needs the build to load is a guard that stops running first. */

const PROJECT_ROOT = resolve(import.meta.dirname, '../..')
const CONFIG_FILES = ['electron.vite.config.ts', 'vite.web.config.ts']

/** Every `resolve('…')` argument in a config, with multi-line calls folded onto one line. */
function resolvedPaths(configPath) {
  const source = readFileSync(join(PROJECT_ROOT, configPath), 'utf8').replace(/\s+/gu, ' ')
  return [...source.matchAll(/resolve\(\s*'([^']+)'/gu)].map((match) => match[1])
}

describe('bundler entry paths', () => {
  for (const configPath of CONFIG_FILES) {
    if (!existsSync(join(PROJECT_ROOT, configPath))) {
      continue
    }

    it(`resolves every path ${configPath} hands the bundler`, () => {
      const paths = resolvedPaths(configPath)
      expect(paths.length).toBeGreaterThan(0)

      const missing = paths.filter((candidate) => !existsSync(join(PROJECT_ROOT, candidate)))

      expect(missing).toEqual([])
    })
  }

  it('reads the entry map rather than trusting the file to parse', () => {
    // A regression here would make the check above vacuous, which is worse than not having it.
    const paths = resolvedPaths('electron.vite.config.ts')

    expect(paths).toContain('src/main/index.ts')
    expect(paths).toContain('src/main/daemon/daemon-entry.ts')
    // A multi-line `resolve(` call must be folded, not skipped.
    expect(paths).toContain('src/main/hang-watchdog/main-thread-hang-watchdog-entry.ts')
  })
})
