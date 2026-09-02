/* eslint-disable max-lines -- Why: this module owns the daemon-side shell
   wrapper generation for zsh, bash, and PowerShell plus the launch-config
   plumbing; keeping them together lets the wrapper/marker contract be
   reviewed as a unit (mirrors src/main/providers/local-pty-shell-ready.ts). */
import { tmpdir } from 'node:os'
import { basename, dirname, join, win32 as pathWin32 } from 'node:path'
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import {
  encodePowerShellCommand,
  getPowerShellOsc133Bootstrap,
  isPowerShellExecutableName
} from '../powershell-osc133-bootstrap'
import {
  getZshEnvTemplate,
  getZshFinalZdotdirRestoreBlock,
  getZshShellReadyMarkerRegistrationBlock,
  getZshStartupFileSourceBlock
} from '../shell-templates'

const AIO_ADE_USER_DATA_PATH_ENV = 'AIO_ADE_USER_DATA_PATH'
const SHELL_READY_MARKER = '\\033]777;aio-ade-shell-ready\\007'

let didEnsureShellReadyWrappers = false

function getShellReadyWrapperRoot(): string {
  const userDataPath = process.env[AIO_ADE_USER_DATA_PATH_ENV]
  // Why: older/test launchers may not seed AIO_ADE_USER_DATA_PATH. Keep a
  // fallback so daemon startup does not fail before the parent can be fixed.
  return join(userDataPath || tmpdir(), userDataPath ? 'shell-ready' : 'aio-ade-shell-ready')
}

// Why: if our own process inherited ZDOTDIR from a parent shell that was
// itself an AIO-ADE PTY (e.g. the user launched AIO-ADE from a terminal inside a
// running AIO-ADE), that ZDOTDIR points at an AIO-ADE shell-ready wrapper dir.
// Propagating it as the new PTY's AIO_ADE_ORIG_ZDOTDIR makes the wrapper's
// `source "$AIO_ADE_ORIG_ZDOTDIR/.zshenv"` line source itself recursively —
// zsh gives "job table full or recursion limit exceeded" and the shell
// never reaches a usable prompt.
//
// Any path component ending in `/shell-ready/zsh` is an AIO-ADE wrapper dir
// (regardless of whether it came from this daemon's userData, a packaged
// AIO-ADE, or a different dev build). Treat it as if ZDOTDIR were unset so the
// caller falls back to HOME for the user's real config root.
function normalizeOriginalZdotdirCandidate(value: string | undefined): string | null {
  if (!value) {
    return null
  }
  // Why: tolerate trailing slashes — some shell startup scripts export
  // `ZDOTDIR="$dir/"`, and without normalization the suffix check would
  // miss the self-loop path and restore the recursion bug. Also collapses
  // a pathological `ZDOTDIR=/` to empty so we fall back to HOME rather than
  // sourcing `/.zshenv` (which is never the user's real config).
  const normalized = value.replace(/\/+$/, '')
  if (!normalized || normalized.endsWith('/shell-ready/zsh')) {
    return null
  }
  return value
}

function resolveOriginalZdotdir(): string {
  return (
    normalizeOriginalZdotdirCandidate(process.env.ZDOTDIR) ||
    normalizeOriginalZdotdirCandidate(process.env.AIO_ADE_ORIG_ZDOTDIR) ||
    process.env.HOME ||
    ''
  )
}

function resolveOriginalZshenvSourceDir(): string {
  return normalizeOriginalZdotdirCandidate(process.env.ZDOTDIR) || process.env.HOME || ''
}

function getRequiredShellReadyWrapperPaths(root = getShellReadyWrapperRoot()): string[] {
  return [
    join(root, 'zsh', '.zshenv'),
    join(root, 'zsh', '.zprofile'),
    join(root, 'zsh', '.zshrc'),
    join(root, 'zsh', '.zlogin'),
    join(root, 'bash', 'rcfile')
  ]
}

function shellReadyWrappersExist(): boolean {
  return getRequiredShellReadyWrapperPaths().every((path) => existsSync(path))
}

export function getDaemonBashShellReadyRcfileContent(): string {
  return `# AIO-ADE daemon bash shell-ready wrapper
[[ -f /etc/profile ]] && source /etc/profile
if [[ -f "$HOME/.bash_profile" ]]; then
  source "$HOME/.bash_profile"
elif [[ -f "$HOME/.bash_login" ]]; then
  source "$HOME/.bash_login"
elif [[ -f "$HOME/.profile" ]]; then
  source "$HOME/.profile"
fi
# Why: enable bracketed paste so AIO-ADE can deliver a multiline startup prompt as
# a single literal paste (ESC[200~…ESC[201~); without it, older readline builds
# treat each embedded newline as Enter and mangle the prompt into PS2
# continuation. Modern readline defaults this on; force it for the rest.
[[ $- == *i* ]] && bind 'set enable-bracketed-paste on' 2>/dev/null
__aio_ade_restore_attribution_path() {
  [[ -n "\${AIO_ADE_ATTRIBUTION_SHIM_DIR:-}" ]] || return 0
  case "$PATH" in
    "\${AIO_ADE_ATTRIBUTION_SHIM_DIR}"|"\${AIO_ADE_ATTRIBUTION_SHIM_DIR}:"*) return 0 ;;
  esac
  export PATH="\${AIO_ADE_ATTRIBUTION_SHIM_DIR}:$PATH"
}
__aio_ade_restore_attribution_path
__aio_ade_restore_agent_teams_path() {
  [[ -n "\${AIO_ADE_AGENT_TEAMS_SHIM_DIR:-}" ]] || return 0
  case "$PATH" in
    "\${AIO_ADE_AGENT_TEAMS_SHIM_DIR}"|"\${AIO_ADE_AGENT_TEAMS_SHIM_DIR}:"*) return 0 ;;
  esac
  export PATH="\${AIO_ADE_AGENT_TEAMS_SHIM_DIR}:$PATH"
}
__aio_ade_restore_agent_teams_path
# Why: Codex must keep using AIO-ADE's runtime CODEX_HOME after profile scripts.
[[ -n "\${AIO_ADE_CODEX_HOME:-}" ]] && export CODEX_HOME="\${AIO_ADE_CODEX_HOME}"
# Why: emit OSC 133 C/D so terminal-command-lifecycle can drop stale agent
# status when the foreground command exits — mirrors the zsh daemon wrapper.
# Without this, bash users (default on most Linux distros) keep a stuck
# 'working' spinner after the CLI exits without a Stop/SessionEnd hook.
__aio_ade_osc133_precmd() {
  local exit_code=$?
  __aio_ade_in_prompt_command=1
  if [[ -n "\${__aio_ade_in_command:-}" ]]; then
    printf "\\033]133;D;%s\\007" "$exit_code"
    unset __aio_ade_in_command
  fi
  printf "\\033]133;A\\007"
  # Why: emit the shell-ready marker here (not a trailing PROMPT_COMMAND entry)
  # so a framework that must be last in PROMPT_COMMAND — bash-preexec — is not
  # displaced by one of AIO-ADE's own hooks.
  [[ "\${AIO_ADE_SHELL_READY_MARKER:-0}" == "1" ]] && printf "${SHELL_READY_MARKER}"
}
__aio_ade_run_user_debug_trap() {
  if [[ -n "\${__aio_ade_user_debug_trap:-}" ]]; then
    eval "$__aio_ade_user_debug_trap" || true
  fi
}
__aio_ade_osc133_preexec() {
  __aio_ade_run_user_debug_trap
  # Why: a framework (bash-preexec/starship) may replace our DEBUG trap at the
  # first prompt; __aio_ade_osc133_epilogue re-takes it each prompt and stores the
  # framework's trap here, so the framework's own preexec still runs while our
  # command-start C survives its re-arm.
  if [[ -n "\${__aio_ade_chained_debug_trap:-}" ]]; then
    eval "$__aio_ade_chained_debug_trap" || true
  fi
  [[ -z "\${__aio_ade_in_prompt_command:-}" ]] || return
  # Why: a chained trap can invoke us more than once for a single command, so
  # emit C only on the first fire (the __aio_ade_in_command gate), and never for a
  # prompt-time hook — ours or bash-preexec's __bp_* helpers.
  [[ -z "\${__aio_ade_in_command:-}" ]] || return
  case "$BASH_COMMAND" in
    *__aio_ade_osc133_*|*__bp_*) return ;;
  esac
  printf "\\033]133;C\\007"
  __aio_ade_in_command=1
}
# Why: runs LAST every prompt — closes the prompt window (so command starts emit
# C) and re-arms our single DEBUG trap. A framework that replaced DEBUG at the
# first prompt is captured and chained rather than discarded, so it keeps working
# while its re-arm can no longer silence AIO-ADE's command-start signal.
__aio_ade_osc133_epilogue() {
  unset __aio_ade_in_prompt_command
  local __aio_ade_spec="$(trap -p DEBUG)"
  case "$__aio_ade_spec" in
    "" | *__aio_ade_osc133_preexec* ) __aio_ade_chained_debug_trap="" ;;
    * )
      __aio_ade_spec="\${__aio_ade_spec#trap -- }"
      __aio_ade_spec="\${__aio_ade_spec% DEBUG}"
      eval "__aio_ade_chained_debug_trap=$__aio_ade_spec"
      ;;
  esac
  trap '__aio_ade_osc133_preexec' DEBUG
}
# Why: normalize an array PROMPT_COMMAND (bash 5.1+) to a string so prepend/append
# below is uniform, and capture $? in precmd before the user's chain mutates it.
__aio_ade_normalize_prompt_command() {
  local __aio_ade_joined="" __aio_ade_prompt_part
  if [[ "$(declare -p PROMPT_COMMAND 2>/dev/null)" == "declare -a"* ]]; then
    for __aio_ade_prompt_part in "\${PROMPT_COMMAND[@]}"; do
      [[ -n "$__aio_ade_prompt_part" ]] || continue
      if [[ -n "$__aio_ade_joined" ]]; then
        __aio_ade_joined="$__aio_ade_joined;$__aio_ade_prompt_part"
      else
        __aio_ade_joined="$__aio_ade_prompt_part"
      fi
    done
    PROMPT_COMMAND="$__aio_ade_joined"
  fi
}
__aio_ade_normalize_prompt_command
PROMPT_COMMAND="__aio_ade_osc133_precmd\${PROMPT_COMMAND:+;\${PROMPT_COMMAND}};__aio_ade_osc133_epilogue"
__aio_ade_debug_trap_spec="$(trap -p DEBUG)"
if [[ -n "$__aio_ade_debug_trap_spec" ]]; then
  __aio_ade_debug_trap_command="\${__aio_ade_debug_trap_spec#trap -- }"
  __aio_ade_debug_trap_command="\${__aio_ade_debug_trap_command% DEBUG}"
  eval "__aio_ade_user_debug_trap=$__aio_ade_debug_trap_command"
fi
unset __aio_ade_debug_trap_spec __aio_ade_debug_trap_command
unset -f __aio_ade_normalize_prompt_command
# Why: arm DEBUG after wrapper setup; otherwise bash treats our own rcfile
# commands as a foreground command and emits a fake C/D before the first prompt.
trap '__aio_ade_osc133_preexec' DEBUG
`
}

export function getDaemonZshShellReadyRcfileContent(): string {
  return `# AIO-ADE daemon zsh shell-ready wrapper
${getZshStartupFileSourceBlock({
  fileName: '.zshrc',
  interactiveOnly: true,
  skipWhenHomeIsCurrentZdotdir: true
})}
__aio_ade_restore_attribution_path() {
  [[ -n "\${AIO_ADE_ATTRIBUTION_SHIM_DIR:-}" ]] || return 0
  case "$PATH" in
    "\${AIO_ADE_ATTRIBUTION_SHIM_DIR}"|"\${AIO_ADE_ATTRIBUTION_SHIM_DIR}:"*) return 0 ;;
  esac
  export PATH="\${AIO_ADE_ATTRIBUTION_SHIM_DIR}:$PATH"
}
[[ ! -o login ]] && __aio_ade_restore_attribution_path
__aio_ade_restore_agent_teams_path() {
  [[ -n "\${AIO_ADE_AGENT_TEAMS_SHIM_DIR:-}" ]] || return 0
  case "$PATH" in
    "\${AIO_ADE_AGENT_TEAMS_SHIM_DIR}"|"\${AIO_ADE_AGENT_TEAMS_SHIM_DIR}:"*) return 0 ;;
  esac
  export PATH="\${AIO_ADE_AGENT_TEAMS_SHIM_DIR}:$PATH"
}
[[ ! -o login ]] && __aio_ade_restore_agent_teams_path
if [[ ! -o login ]]; then
  [[ -n "\${AIO_ADE_CODEX_HOME:-}" ]] && export CODEX_HOME="\${AIO_ADE_CODEX_HOME}"
fi
__aio_ade_osc133_precmd() {
  local exit_code=$?
  if [[ -n "\${__aio_ade_in_command:-}" ]]; then
    printf "\\033]133;D;%s\\007" "$exit_code"
    unset __aio_ade_in_command
  fi
  printf "\\033]133;A\\007"
}
__aio_ade_osc133_preexec() {
  printf "\\033]133;C\\007"
  __aio_ade_in_command=1
}
# Why: prepend so AIO-ADE captures $? before user prompt hooks can overwrite it.
precmd_functions=(__aio_ade_osc133_precmd \${precmd_functions[@]})
preexec_functions=(__aio_ade_osc133_preexec \${preexec_functions[@]})
if [[ ! -o login ]]; then
${getZshFinalZdotdirRestoreBlock()}
fi
`
}

function ensureShellReadyWrappers(): void {
  if (process.platform === 'win32') {
    return
  }
  if (didEnsureShellReadyWrappers && shellReadyWrappersExist()) {
    return
  }
  didEnsureShellReadyWrappers = true

  const root = getShellReadyWrapperRoot()
  const zshDir = join(root, 'zsh')
  const bashDir = join(root, 'bash')

  const zshEnv = getZshEnvTemplate(zshDir, 'daemon')
  const zshProfile = `# AIO-ADE daemon zsh shell-ready wrapper
${getZshStartupFileSourceBlock({ fileName: '.zprofile' })}
`
  const zshRc = getDaemonZshShellReadyRcfileContent()
  const zshLogin = `# AIO-ADE daemon zsh shell-ready wrapper
${getZshStartupFileSourceBlock({ fileName: '.zlogin', interactiveOnly: true })}
__aio_ade_restore_attribution_path() {
  [[ -n "\${AIO_ADE_ATTRIBUTION_SHIM_DIR:-}" ]] || return 0
  case "$PATH" in
    "\${AIO_ADE_ATTRIBUTION_SHIM_DIR}"|"\${AIO_ADE_ATTRIBUTION_SHIM_DIR}:"*) return 0 ;;
  esac
  export PATH="\${AIO_ADE_ATTRIBUTION_SHIM_DIR}:$PATH"
}
__aio_ade_restore_attribution_path
__aio_ade_restore_agent_teams_path() {
  [[ -n "\${AIO_ADE_AGENT_TEAMS_SHIM_DIR:-}" ]] || return 0
  case "$PATH" in
    "\${AIO_ADE_AGENT_TEAMS_SHIM_DIR}"|"\${AIO_ADE_AGENT_TEAMS_SHIM_DIR}:"*) return 0 ;;
  esac
  export PATH="\${AIO_ADE_AGENT_TEAMS_SHIM_DIR}:$PATH"
}
__aio_ade_restore_agent_teams_path
# Why: .zlogin is the final login startup file before the prompt is shown.
[[ -n "\${AIO_ADE_CODEX_HOME:-}" ]] && export CODEX_HOME="\${AIO_ADE_CODEX_HOME}"
${getZshShellReadyMarkerRegistrationBlock(SHELL_READY_MARKER)}
${getZshFinalZdotdirRestoreBlock()}
`
  const bashRc = getDaemonBashShellReadyRcfileContent()

  const files = [
    [join(zshDir, '.zshenv'), zshEnv],
    [join(zshDir, '.zprofile'), zshProfile],
    [join(zshDir, '.zshrc'), zshRc],
    [join(zshDir, '.zlogin'), zshLogin],
    [join(bashDir, 'rcfile'), bashRc]
  ] as const

  try {
    for (const [path, content] of files) {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, content, 'utf8')
      chmodSync(path, 0o644)
    }
  } catch (error) {
    // Why: wrapper file creation can fail due to read-only filesystems, permission
    // issues, or disk space. Rather than crashing, log the error and continue.
    // The shell will launch without the wrapper, which means no shell-ready marker
    // but at least the PTY is usable.
    const errorMessage =
      error instanceof Error
        ? `${error.message} (${(error as NodeJS.ErrnoException).code || 'unknown'})`
        : String(error)
    console.error(`[daemon/shell-ready] Failed to create wrapper files in ${root}: ${errorMessage}`)
    console.error('[daemon/shell-ready] Shell will launch without wrapper (no shell-ready marker)')
    // Reset the flag so next attempt will try again
    didEnsureShellReadyWrappers = false
  }
}

export function resolvePtyShellPath(env: Record<string, string>): string {
  if (process.platform === 'win32') {
    return env.AIO_ADE_TERMINAL_WINDOWS_SHELL || 'powershell.exe'
  }
  return env.SHELL || process.env.SHELL || '/bin/zsh'
}

export function shellPathSupportsPtyStartupBarrier(shellPath: string): boolean {
  const shellName = pathWin32.basename(basename(shellPath)).toLowerCase()
  return shellName === 'zsh' || shellName === 'bash'
}

export function supportsPtyStartupBarrier(env: Record<string, string>): boolean {
  if (process.platform === 'win32') {
    return false
  }
  return shellPathSupportsPtyStartupBarrier(resolvePtyShellPath(env))
}

type ShellLaunchConfig = {
  args: string[] | null
  env: Record<string, string>
  supportsReadyMarker: boolean
}

function getWrappedShellLaunchConfig(
  shellPath: string,
  options: { emitReadyMarker: boolean }
): ShellLaunchConfig {
  const shellName = pathWin32.basename(basename(shellPath)).toLowerCase()

  if (shellName === 'zsh') {
    ensureShellReadyWrappers()
    const root = getShellReadyWrapperRoot()
    return {
      args: ['-l'],
      env: {
        AIO_ADE_ORIG_ZDOTDIR: resolveOriginalZdotdir(),
        AIO_ADE_ZSHENV_SOURCE_DIR: resolveOriginalZshenvSourceDir(),
        ZDOTDIR: join(root, 'zsh'),
        AIO_ADE_SHELL_READY_MARKER: options.emitReadyMarker ? '1' : '0'
      },
      supportsReadyMarker: options.emitReadyMarker
    }
  }

  if (shellName === 'bash') {
    ensureShellReadyWrappers()
    const root = getShellReadyWrapperRoot()
    return {
      args: ['--rcfile', join(root, 'bash', 'rcfile')],
      env: {
        AIO_ADE_SHELL_READY_MARKER: options.emitReadyMarker ? '1' : '0'
      },
      supportsReadyMarker: options.emitReadyMarker
    }
  }

  if (isPowerShellExecutableName(shellName)) {
    return {
      args: [
        '-NoLogo',
        '-NoExit',
        '-EncodedCommand',
        encodePowerShellCommand(getPowerShellOsc133Bootstrap())
      ],
      env: {},
      supportsReadyMarker: false
    }
  }

  return {
    args: null,
    env: {},
    supportsReadyMarker: false
  }
}

export function getShellReadyLaunchConfig(shellPath: string): ShellLaunchConfig {
  return getWrappedShellLaunchConfig(shellPath, { emitReadyMarker: true })
}

export function getAttributionShellLaunchConfig(shellPath: string): ShellLaunchConfig {
  return getWrappedShellLaunchConfig(shellPath, { emitReadyMarker: false })
}
