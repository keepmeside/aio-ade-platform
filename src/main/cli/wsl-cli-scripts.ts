const MANAGED_MARKER = '# AIO-ADE managed WSL CLI launcher'
const BRIDGE_MANAGED_MARKER = '# AIO-ADE managed WSL CLI PowerShell bridge'

/* The marker a pre-rebrand build wrote into the same scripts.
 *
 * Ownership detection reads this: the installer only rewrites or removes a WSL registration whose
 * content carries one of its own markers, and never touches a script a user wrote. A distro that
 * was registered before the rename still has the old marker on disk, so recognizing only the
 * current one would classify that registration as user-owned and leave it forwarding to a launcher
 * path this app no longer installs. */
const LEGACY_MANAGED_MARKERS = [
  '# Orca managed WSL CLI launcher',
  '# Orca managed WSL CLI PowerShell bridge'
] as const

/** True when the script was written by this app, under either brand's marker. */
export function isManagedWslScript(content: string, marker: string): boolean {
  return content.includes(marker) || LEGACY_MANAGED_MARKERS.some((old) => content.includes(old))
}

export function buildWslLauncher(
  windowsLauncherPath: string,
  bridgePath = '${XDG_DATA_HOME:-$HOME/.local/share}/aio-ade/aio-ade-wsl-bridge.ps1'
): string {
  const encodedTarget = Buffer.from(windowsLauncherPath, 'utf8').toString('base64')
  return `#!/usr/bin/env bash
set -euo pipefail
${MANAGED_MARKER}
# AIO_ADE_WIN_LAUNCHER_B64=${encodedTarget}
AIO_ADE_WIN_LAUNCHER=${quoteShell(windowsLauncherPath)}
AIO_ADE_BRIDGE_PS1=${quoteShell(bridgePath)}
if command -v powershell.exe >/dev/null 2>&1; then
  AIO_ADE_POWERSHELL=powershell.exe
elif [ -x /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ]; then
  AIO_ADE_POWERSHELL=/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe
else
  echo "AIO-ADE WSL CLI requires Windows interop and could not find powershell.exe." >&2
  exit 1
fi
# Why: a shell can outlive a deleted worktree; keep explicit CLI selectors and
# help usable, and repair cwd before any WSL interop tool tries to resolve it.
AIO_ADE_WSL_CWD=$(pwd -P 2>/dev/null) || {
  AIO_ADE_WSL_CWD=/
  cd /
}
AIO_ADE_BRIDGE_PS1_WIN=$(wslpath -w "$AIO_ADE_BRIDGE_PS1")
AIO_ADE_WSL_CWD_WIN=$(wslpath -w "$AIO_ADE_WSL_CWD")
exec "$AIO_ADE_POWERSHELL" -NoProfile -ExecutionPolicy Bypass -File "$AIO_ADE_BRIDGE_PS1_WIN" "$AIO_ADE_WIN_LAUNCHER" -WslCwd "$AIO_ADE_WSL_CWD_WIN" "$@"
`
}

export function buildWslBridgeScript(): string {
  return `${BRIDGE_MANAGED_MARKER}
[CmdletBinding(PositionalBinding=$false)]
param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$AioAdeLauncher,

  [string]$WslCwd,

  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$ForwardArgs
)

$exitCode = 0
try {
  if ([string]::IsNullOrEmpty($WslCwd)) {
    Remove-Item Env:AIO_ADE_CLI_CWD -ErrorAction SilentlyContinue
  } else {
    $env:AIO_ADE_CLI_CWD = $WslCwd
  }
  Push-Location -LiteralPath (Split-Path -Parent $AioAdeLauncher)
  & $AioAdeLauncher @ForwardArgs
  if ($null -eq $LASTEXITCODE) {
    if (-not $?) {
      $exitCode = 1
    } else {
      $exitCode = 0
    }
  } else {
    $exitCode = $LASTEXITCODE
  }
} catch {
  Write-Error $_
  $exitCode = 1
}
exit $exitCode
`
}

export function getBridgePathFromCommandPath(commandPath: string): string {
  // Why: both the current Linux command and the legacy pre-rename command
  // share one WSL bridge under ~/.local/share/aio-ade.
  return `${commandPath.replace(/\/\.local\/bin\/(?:aio-ade|aio-ade)$/, '/.local/share/aio-ade')}/aio-ade-wsl-bridge.ps1`
}

export function buildSafeReplaceGuard(path: string, managedMarker: string): string {
  const quotedPath = quoteShell(path)
  const quotedMarker = quoteShell(managedMarker)
  return [
    `if [ -L ${quotedPath} ]; then`,
    '  echo "__AIO_ADE_CONFLICT__"',
    '  exit 23',
    `elif [ -e ${quotedPath} ] && { [ ! -f ${quotedPath} ] || ! grep -Fq ${quotedMarker} ${quotedPath}; }; then`,
    '  echo "__AIO_ADE_CONFLICT__"',
    '  exit 23',
    'fi'
  ].join('\n')
}

export function buildRegistrationLockPrelude(commandPath: string): string {
  const lockDir = getPosixDirname(getBridgePathFromCommandPath(commandPath))
  // Why: the per-distro queue only serializes one AIO-ADE process; flock covers
  // a second install (e.g. stable + nightly) mutating the same distro files.
  return [
    `if command -v flock >/dev/null 2>&1 && mkdir -p ${quoteShell(lockDir)} 2>/dev/null; then`,
    `  exec 9>${quoteShell(`${lockDir}/.aio-ade-wsl-cli.lock`)}`,
    '  flock -x -w 30 9',
    'fi'
  ].join('\n')
}

export function buildManagedLegacyRemoveCommand(quotedLegacyCommandPath: string): string {
  /* Remove only a wrapper this app wrote; a user-owned command or symlink at the same path must
   * survive. The marker to grep for is the PRE-REBRAND one: the file being removed was written by a
   * pre-rename build, so it carries that marker and not the current one. */
  const quotedLegacyMarker = quoteShell(LEGACY_MANAGED_MARKERS[0])
  return `if [ ! -L ${quotedLegacyCommandPath} ] && [ -f ${quotedLegacyCommandPath} ] && { grep -Fq ${quoteShell(MANAGED_MARKER)} ${quotedLegacyCommandPath} || grep -Fq ${quotedLegacyMarker} ${quotedLegacyCommandPath}; }; then rm -f ${quotedLegacyCommandPath}; fi`
}

export function buildSafeRemoveCommand(commandPath: string, legacyCommandPath?: string): string {
  const bridgePath = getBridgePathFromCommandPath(commandPath)
  return [
    'set -euo pipefail',
    buildRegistrationLockPrelude(commandPath),
    buildSafeReplaceGuard(commandPath, MANAGED_MARKER),
    buildSafeReplaceGuard(bridgePath, BRIDGE_MANAGED_MARKER),
    `rm -f ${quoteShell(commandPath)} ${quoteShell(bridgePath)}`,
    // Why: leaving a managed legacy `aio-ade` behind lets startup reconciliation
    // re-adopt it as opt-in proof and silently undo this removal.
    ...(legacyCommandPath ? [buildManagedLegacyRemoveCommand(quoteShell(legacyCommandPath))] : [])
  ].join('\n')
}

export function parseManagedLauncherTarget(content: string): string | null {
  /* Accept either brand's variable name: this parses a script already on disk, and a registration
   * written before the rename spells it `ORCA_WIN_LAUNCHER_B64`. Failing to read it reports the
   * target as unknown, which presents a stale registration as unmanaged. */
  const encoded = content.match(/^# (?:AIO_ADE|ORCA)_WIN_LAUNCHER_B64=([A-Za-z0-9+/=]+)$/m)?.[1]
  if (encoded) {
    try {
      return Buffer.from(encoded, 'base64').toString('utf8')
    } catch {
      return null
    }
  }

  const legacyTarget = content.match(/^(?:AIO_ADE|ORCA)_WIN_LAUNCHER='((?:[^']|'"'"')*)'$/m)?.[1]
  return legacyTarget ? legacyTarget.replaceAll(`'"'"'`, "'") : null
}

export function getPosixDirname(path: string): string {
  return path.slice(0, path.lastIndexOf('/')) || '/'
}

export function getWslLauncherMarker(): string {
  return MANAGED_MARKER
}

export function getWslBridgeMarker(): string {
  return BRIDGE_MANAGED_MARKER
}

export function quoteShell(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}
