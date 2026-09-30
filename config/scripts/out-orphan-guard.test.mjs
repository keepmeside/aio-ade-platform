import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/* Orphaned files under `out/` must not ship.
 *
 * `tsc` never deletes output — when a `src/` module is deleted, its compiled `.js` stays in `out/`
 * and keeps landing in `app.asar` of every local build (files is all-negation → silence means ship).
 * CI runners start from a clean checkout so they never accumulate this; only a long-lived dev
 * checkout does. That divergence is exactly what packaged smoke and pre-publication scans run on.
 *
 * Only `out/cli` and `out/shared` map 1:1 to a `src/` root (`rootDir: src` in tsconfig.cli.json).
 * `out/main`/`out/preload`/`out/renderer` are bundled (chunks + rollup entries, no per-file mirror),
 * and `out/relay`/`out/bin`/`out/web` are platform binaries — none of those are file-by-file orphans
 * in this sense, so they are out of scope.
 *
 * The check is a no-op when `out/` does not exist (fresh clone / CI before build). */

const PROJECT_ROOT = resolve(import.meta.dirname, '../..')

// out/<sub> mirrors src/<sub> file-for-file.
const MIRRORS = [
  { outDir: 'out/cli', srcDir: 'src/cli' },
  { outDir: 'out/shared', srcDir: 'src/shared' }
]

function* walk(dir) {
  if (!existsSync(dir)) {
    return
  }
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      yield* walk(full)
    } else {
      yield full
    }
  }
}

/** A compiled `.js` is an orphan when neither its `.ts` source nor a sibling of another emitted
 *  kind (.tsx → .js still counts as having a source) exists under the mirrored src dir.
 *  `jsPath` is absolute; `outDir`/`srcDir` are project-relative. `rel` is the subpath under the
 *  out mirror, which is also the subpath under the src mirror. */
function isOrphan(jsPath, outDir, srcDir) {
  const rel = jsPath.slice(join(PROJECT_ROOT, outDir).length)
  const base = rel.replace(/\.js$/u, '')
  return (
    !existsSync(join(PROJECT_ROOT, srcDir, `${base}.ts`)) &&
    !existsSync(join(PROJECT_ROOT, srcDir, `${base}.tsx`))
  )
}

describe('out/ compiled-output orphans', () => {
  it('every .js under a src-mirrored out/ dir has a src source', () => {
    const orphans = []
    for (const { outDir, srcDir } of MIRRORS) {
      const absOut = join(PROJECT_ROOT, outDir)
      for (const jsPath of walk(absOut)) {
        if (!jsPath.endsWith('.js')) {
          continue
        }
        if (isOrphan(jsPath, outDir, srcDir)) {
          orphans.push(jsPath.slice(PROJECT_ROOT.length + 1))
        }
      }
    }
    expect(orphans).toEqual([])
  })

  it('the mirror list is non-empty so the check cannot silently no-op', () => {
    expect(MIRRORS.length).toBeGreaterThan(0)
  })
})
