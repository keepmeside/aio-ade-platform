import { execFile } from 'node:child_process'
import { readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const WINDOWS_PATH_CLEANUP_TIMEOUT_MS = 10_000
const WSL_CLEANUP_TIMEOUT_MS = 15_000
const WSL_REGISTRY_FILE = 'wsl-cli-registrations.json'

export type PowerShellRunner = (script: string) => Promise<string>
export type WslCleanupRunner = (distro: string, script: string) => Promise<string>

export async function cleanupLegacyWindowsCliPath(
  resourcesPath: string,
  runPowerShell: PowerShellRunner = runPowerShellScript
): Promise<string[]> {
  const legacyPathDirectory = join(resourcesPath, 'bin')
  const output = await runPowerShell(buildWindowsUserPathCleanupScript(legacyPathDirectory))
  return output.trim() === 'removed' ? [legacyPathDirectory] : []
}

export async function cleanupLegacyWslCliRegistrations(
  userDataPath: string,
  runWslCommand: WslCleanupRunner = runWslCleanupScript
): Promise<string[]> {
  const registryPath = join(userDataPath, WSL_REGISTRY_FILE)
  let content: string
  try {
    content = await readFile(registryPath, 'utf8')
  } catch (error) {
    if (isMissingError(error)) {
      return []
    }
    throw error
  }

  const distros = parseRegisteredDistros(content)
  for (const distro of distros) {
    await runWslCommand(distro, LEGACY_WSL_CLI_CLEANUP_SCRIPT)
  }
  await unlink(registryPath)
  return distros
}

function buildWindowsUserPathCleanupScript(pathDirectory: string): string {
  const encodedTarget = Buffer.from(pathDirectory, 'utf8').toString('base64')
  return [
    `$target = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedTarget}'))`,
    "$current = [Environment]::GetEnvironmentVariable('Path', 'User')",
    "if ([String]::IsNullOrEmpty($current)) { Write-Output 'unchanged'; exit 0 }",
    '$target = [IO.Path]::GetFullPath($target).TrimEnd([char[]]"\\/")',
    '$removed = $false',
    '$kept = foreach ($entry in $current.Split([char]";")) {',
    '  if ([String]::IsNullOrWhiteSpace($entry)) { $entry; continue }',
    '  try {',
    '    $expanded = [Environment]::ExpandEnvironmentVariables($entry)',
    '    $normalized = [IO.Path]::GetFullPath($expanded).TrimEnd([char[]]"\\/")',
    '  } catch { $entry; continue }',
    '  if ([String]::Equals($normalized, $target, [StringComparison]::OrdinalIgnoreCase)) {',
    '    $removed = $true',
    '  } else { $entry }',
    '}',
    "if (-not $removed) { Write-Output 'unchanged'; exit 0 }",
    "$next = [String]::Join(';', [string[]]$kept)",
    "[Environment]::SetEnvironmentVariable('Path', $next, 'User')",
    "Write-Output 'removed'"
  ].join('\n')
}

function parseRegisteredDistros(content: string): string[] {
  const parsed = JSON.parse(content) as { registeredDistros?: unknown }
  if (!Array.isArray(parsed.registeredDistros)) {
    return []
  }
  const seen = new Set<string>()
  const distros: string[] = []
  for (const value of parsed.registeredDistros) {
    if (typeof value !== 'string' || !value.trim()) {
      continue
    }
    const distro = value.trim()
    const key = distro.toLocaleLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      distros.push(distro)
    }
  }
  return distros
}

const LEGACY_WSL_CLI_CLEANUP_SCRIPT = `set -euo pipefail
remove_managed_file() {
  path="$1"
  marker="$2"
  if [ ! -L "$path" ] && [ -f "$path" ] && grep -Fq "$marker" "$path"; then
    rm -f "$path"
  fi
}
remove_managed_file "$HOME/.local/bin/orca-ide" '# Orca managed WSL CLI launcher'
remove_managed_file "$HOME/.local/bin/orca" '# Orca managed WSL CLI launcher'
remove_managed_file "$HOME/.local/share/orca/orca-wsl-bridge.ps1" '# Orca managed WSL CLI PowerShell bridge'
`

function runPowerShellScript(script: string): Promise<string> {
  return runCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    timeout: WINDOWS_PATH_CLEANUP_TIMEOUT_MS,
    windowsHide: true
  })
}

function runWslCleanupScript(distro: string, script: string): Promise<string> {
  const encoded = Buffer.from(script, 'utf8').toString('base64')
  const command = `set -o pipefail; printf %s '${encoded}' | base64 -d | bash`
  return runCommand('wsl.exe', ['-d', distro, '--', 'bash', '-lc', command], {
    timeout: WSL_CLEANUP_TIMEOUT_MS,
    windowsHide: true
  })
}

function runCommand(
  executable: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean }
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { ...options, encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }
      resolve(stdout)
    })
  })
}

function isMissingError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}
