import { execFile } from 'node:child_process'
import { lstat } from 'node:fs/promises'
import { promisify } from 'node:util'

export type MacPrivilegedRunner = (command: string) => Promise<void>

type RemoveManagedMacSymlinkOptions = {
  commandPath: string
  linkTarget: string
  unlinkPath: (path: string) => Promise<void>
  privilegedRunner: MacPrivilegedRunner
}

const execFileAsync = promisify(execFile)

export async function removeManagedMacSymlink(
  options: RemoveManagedMacSymlinkOptions
): Promise<boolean> {
  try {
    await options.unlinkPath(options.commandPath)
    return true
  } catch (error) {
    if (!isPermissionError(error)) {
      throw error
    }
  }

  await options.privilegedRunner(
    `if [ -L ${quoteShell(options.commandPath)} ] && [ "$(readlink ${quoteShell(options.commandPath)})" = ${quoteShell(options.linkTarget)} ]; then rm -- ${quoteShell(options.commandPath)}; fi`
  )
  try {
    await lstat(options.commandPath)
    return false
  } catch (error) {
    if (isMissingError(error)) {
      return true
    }
    throw error
  }
}

export async function runMacPrivilegedCommand(command: string): Promise<void> {
  await execFileAsync('osascript', [
    '-e',
    `do shell script ${quoteAppleScript(command)} with administrator privileges`
  ])
}

function isPermissionError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code
  return code === 'EACCES' || code === 'EPERM'
}

function isMissingError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

function quoteAppleScript(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}
