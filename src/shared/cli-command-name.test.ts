/* The installed CLI command is a PATH contract with three independent readers: the dispatch
 * preamble that teaches agents the binary name, the packaged launcher that electron-builder
 * places on PATH, and `package.json` `bin`. A rename that lands in only some of them leaves the
 * app instructing agents to run a command that is not installed — that fails at agent runtime,
 * not at build time, so the compiler never sees it. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CLI_COMMAND_NAME,
  DEV_CLI_COMMAND_NAME,
  LEGACY_CLI_COMMAND_NAMES,
  LEGACY_DEV_CLI_COMMAND_NAME
} from './cli-command-name'

function source(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('CLI command name', () => {
  it('is one machine token on every platform', () => {
    expect(CLI_COMMAND_NAME).toBe('aio-ade')
    expect(DEV_CLI_COMMAND_NAME).toBe('aio-ade-dev')
  })

  /* Pre-rebrand installs put two different names on PATH: `orca` on macOS/Windows and
   * `orca-ide` on Linux, where bare `orca` is GNOME's screen reader. Uninstall and repair must
   * still recognize both to reclaim a symlink this app once managed. */
  it('remembers both pre-rebrand spellings for uninstall reclaim', () => {
    expect(LEGACY_CLI_COMMAND_NAMES).toContain('orca')
    expect(LEGACY_CLI_COMMAND_NAMES).toContain('orca-ide')
    expect(LEGACY_CLI_COMMAND_NAMES).not.toContain(CLI_COMMAND_NAME)
    expect(LEGACY_DEV_CLI_COMMAND_NAME).not.toBe(DEV_CLI_COMMAND_NAME)
  })

  it('declares exactly the canonical bin entries in the manifest', () => {
    const bin = JSON.parse(source('package.json')).bin as Record<string, string>

    expect(Object.keys(bin).sort()).toEqual([CLI_COMMAND_NAME, DEV_CLI_COMMAND_NAME].sort())
  })

  /* The Linux executable and package name doubled as the installed command, which is why the
   * two names diverged in the first place. Keep them equal to the one token so the desktop
   * entry, the PATH symlink and the preamble cannot drift apart again. */
  it('names the Linux executable and package after the same token', () => {
    const builder = source('config/electron-builder.config.cjs')

    expect(builder).toContain(`executableName: '${CLI_COMMAND_NAME}'`)
    expect(builder).toContain(`packageName: '${CLI_COMMAND_NAME}'`)
  })

  it('installs and teaches the same command', () => {
    expect(source('src/main/cli/cli-installer.ts')).toContain('cli-command-name')
    expect(source('src/main/runtime/orchestration/cli-command.ts')).toContain('cli-command-name')
  })
})
