/* Guard: the React Native companion tree stays deleted.
 *
 * The success criterion is written as `Test-Path mobile` = false, which is PowerShell and
 * only runs on one OS. This is the portable form, and it checks the thing that actually matters:
 * the React Native companion tree is gone AND nothing left behind still points at it.
 *
 * A dangling reference here is not cosmetic. `audit:code-quality:native` passes `mobile` to oxlint
 * as a literal path and `check-reliability-gates` asserts every declared `testFiles` entry exists
 * on disk, so a missed reference fails `pnpm lint` rather than surfacing as a clear error.
 *
 * Scope note: desktop-side modules named "mobile" (pairing, E2EE, QR, emulator pane) run in
 * Electron and are deliberately NOT covered by this guard. Only the RN tree is. */
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Why process.cwd(): vitest runs from the repo root, and src/shared compiles into the
// CommonJS CLI target where `import.meta` is a type error (TS1470).
const ROOT = process.cwd()

function repoFile(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf-8')
}

/** Tracked paths, so an untracked local scratch dir named `mobile/` cannot fail the suite. */
function trackedPaths(pathspec: string): string[] {
  const stdout = execFileSync('git', ['ls-files', '--', pathspec], {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  return stdout.split('\n').filter(Boolean)
}

describe('the React Native companion tree is gone', () => {
  it('tracks no files under mobile/', () => {
    expect(trackedPaths('mobile/**')).toEqual([])
  })

  it('has no mobile release workflows', () => {
    for (const workflow of ['mobile.yml', 'mobile-android-release.yml', 'mobile-ios-release.yml']) {
      expect(existsSync(join(ROOT, '.github', 'workflows', workflow))).toBe(false)
    }
  })
})

describe('nothing points at the deleted tree', () => {
  it('does not pass a literal mobile path to oxlint', () => {
    // `oxlint … src config tests mobile` exits non-zero on a nonexistent path, taking `pnpm lint` with it.
    const pkg = JSON.parse(repoFile('package.json')) as { scripts: Record<string, string> }

    expect(pkg.scripts['audit:code-quality:native']).not.toMatch(/\bmobile\b/)
  })

  it('declares no package script that builds or tests the companion app', () => {
    const pkg = JSON.parse(repoFile('package.json')) as { scripts: Record<string, string> }
    // `test:e2e:floating-mobile-emulator` is deliberately allowed: the emulator pane is a desktop
    // Electron surface that streams an Android emulator, and it never needed the companion app.
    const desktopEmulatorScript = 'test:e2e:floating-mobile-emulator'
    const offenders = Object.entries(pkg.scripts)
      .filter(([name]) => name !== desktopEmulatorScript)
      .filter(
        ([name, command]) => name.includes('mobile') || /--dir mobile|(^| )mobile\//.test(command)
      )
      .map(([name]) => name)

    expect(offenders).toEqual([])
  })

  it('has no max-lines ratchet entry under mobile/', () => {
    const baseline = repoFile('config/max-lines-baseline.txt')

    expect(baseline).not.toMatch(/(^|\s)mobile\//m)
  })

  it('declares no reliability-gate test file under mobile/', () => {
    // check-reliability-gates.mjs asserts each testFiles entry exists, so a stale entry fails lint.
    const manifest = repoFile('config/reliability-gates.jsonc')

    expect(manifest).not.toMatch(/"mobile\//)
  })

  it('keeps no mobile companion download links in the README', () => {
    const readme = repoFile('README.md')

    expect(readme).not.toMatch(/testflight/i)
    expect(readme).not.toMatch(/app-release\.apk/)
    expect(readme).not.toMatch(/apps\.apple\.com/)
  })
})

describe('the desktop web and remote runtime survive', () => {
  it.each(['build:web', 'build:web-from-renderer', 'dev:web', 'build:desktop'])(
    'keeps the %s script',
    (script) => {
      // Deleting the companion app must not be confused with deleting the generic web build,
      // the renderer web client, or the SSH/relay remote transport that still have consumers.
      const pkg = JSON.parse(repoFile('package.json')) as { scripts: Record<string, string> }

      expect(pkg.scripts[script]).toBeTruthy()
    }
  )

  it.each([
    'vite.web.config.ts',
    'config/scripts/project-renderer-web-client.mjs',
    'src/main/runtime/mobile-pairing-qr.ts',
    'src/main/runtime/rpc/mobile-e2ee-v2-desktop-session.ts'
  ])('keeps %s', (path) => {
    expect(existsSync(join(ROOT, path))).toBe(true)
  })
})
