/* Guard: the CLI bridge transport must not depend on Electron APIs.
 *
 * Requirement: "bridge transport không phụ thuộc Electron API trực tiếp để tương thích go/no-go
 * Tauri v2 (phase 11)."
 *
 * The CLI is how external Claude/Codex processes reach the coordinator — that process boundary is
 * the whole reason Option A kept the bridge instead of deleting it. If the bridge ever imports
 * `electron`, the phase-11 Tauri spike has to rewrite it before it can measure anything, and the
 * spike's go/no-go stops being about the runtime and starts being about our own coupling.
 *
 * This currently holds (0 files under src/cli import electron), so the guard exists to keep it
 * true rather than to fix it. It is cheap to satisfy and expensive to rediscover. */
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// Why process.cwd(): vitest runs from the repo root, and src/cli compiles to CommonJS where
// `import.meta` is a type error (TS1470).
const ROOT = process.cwd()

/**
 * Tracked files only, so a local scratch file cannot fail the suite.
 *
 * Excludes this file: it necessarily contains the very specifier strings it searches for, and the
 * ratchet must not police itself (same reason check-max-lines-ratchet keeps a SELF_FILES set).
 */
const SELF = 'src/cli/bridge-runtime-neutrality.test.ts'

function trackedCliFilesImporting(pattern: string): string[] {
  try {
    return execFileSync('git', ['grep', '-lE', pattern, '--', 'src/cli'], {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
      .split('\n')
      .filter((file) => Boolean(file) && file !== SELF)
  } catch {
    // git grep exits 1 when nothing matches, which is the passing case here.
    return []
  }
}

describe('the CLI agent bridge stays runtime-neutral', () => {
  it('never imports the electron module', () => {
    expect(trackedCliFilesImporting("from 'electron'|require\\('electron'\\)")).toEqual([])
  })

  it('never imports an electron submodule either', () => {
    // e.g. `electron/main`, `electron/common` — same coupling, different specifier.
    expect(trackedCliFilesImporting("from 'electron/|require\\('electron/")).toEqual([])
  })

  it('reaches the app over a process-boundary transport, not an in-process API', () => {
    // node:net for the local socket, plus a WebSocket path for remote/paired runtimes. Both survive
    // a runtime swap; an Electron IPC handle would not.
    const transports = trackedCliFilesImporting("from 'node:net'")
    expect(transports).toContain('src/cli/runtime/transport.ts')
  })
})
