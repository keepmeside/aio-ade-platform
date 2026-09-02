// Why: local PTYs and the daemon/SSH path must use identical ZDOTDIR discovery;
// small drift here breaks different terminal transports in different ways.

function quotePosixSingle(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function getZshEnvTemplate(zshDir: string, headerPrefix = ''): string {
  const header = headerPrefix
    ? `AIO-ADE ${headerPrefix} zsh shell-ready wrapper`
    : 'AIO-ADE zsh shell-ready wrapper'
  return `# ${header}
# Why: capture the runtime wrapper dir before it is unset below. On WSL this
# file is generated with a Windows path but sourced via /mnt/c, so the baked
# literal is unusable there and ZDOTDIR must be restored from this value.
# Derive it from the file being sourced (%x, zsh's internal script name) rather
# than the env-imported $ZDOTDIR: zsh corrupts environment values whose UTF-8
# bytes fall in its 0x84-0x9D token range (e.g. a non-ASCII Windows username
# such as a Korean login), which would make the self-check below fail and fall
# back to the unusable baked literal, so the user's .zshrc never loads (#8003).
# %x is not subject to that corruption; keep $ZDOTDIR as a fallback for the
# rare shell where %x prompt expansion yields nothing.
_aio_ade_wrapper_zdotdir_self="\${\${(%):-%x}:h}"
if [[ -z "\${_aio_ade_wrapper_zdotdir_self:-}" ]]; then
  _aio_ade_wrapper_zdotdir_self="\${ZDOTDIR:-}"
fi
while [[ "\${_aio_ade_wrapper_zdotdir_self:-}" == */ ]]; do
  _aio_ade_wrapper_zdotdir_self="\${_aio_ade_wrapper_zdotdir_self%/}"
done
_aio_ade_spawn_orig_zdotdir="\${AIO_ADE_ORIG_ZDOTDIR:-}"
_aio_ade_user_zdotdir="\${_aio_ade_spawn_orig_zdotdir:-$HOME}"
_aio_ade_zshenv_source_dir="\${AIO_ADE_ZSHENV_SOURCE_DIR:-$HOME}"
_aio_ade_zshenv_path=""
unset AIO_ADE_ZSHENV_SOURCE_DIR

# Normalize fallback and source roots before reading user .zshenv so nested
# AIO-ADE PTYs never source another AIO-ADE wrapper recursively.
while [[ "\${_aio_ade_user_zdotdir}" == */ ]]; do
  _aio_ade_user_zdotdir="\${_aio_ade_user_zdotdir%/}"
done
case "\${_aio_ade_user_zdotdir}" in
  ""|*/shell-ready/zsh) _aio_ade_user_zdotdir="$HOME" ;;
esac
while [[ "\${_aio_ade_zshenv_source_dir}" == */ ]]; do
  _aio_ade_zshenv_source_dir="\${_aio_ade_zshenv_source_dir%/}"
done
case "\${_aio_ade_zshenv_source_dir}" in
  ""|*/shell-ready/zsh) _aio_ade_zshenv_source_dir="$HOME" ;;
esac

# Why: source at wrapper top level, not in a function/subshell, so .zshenv
# exports, functions, path/fpath typesets, and zsh options keep normal scope.
unset ZDOTDIR
if [[ -n "\${_aio_ade_zshenv_source_dir:-}" && -f "\${_aio_ade_zshenv_source_dir}/.zshenv" ]]; then
  _aio_ade_zshenv_path="\${_aio_ade_zshenv_source_dir}/.zshenv"
fi
if [[ -n "\${_aio_ade_zshenv_path:-}" ]]; then
  source "\${_aio_ade_zshenv_path}"
fi

_aio_ade_discovered_zdotdir="\${ZDOTDIR:-}"

while [[ "\${_aio_ade_discovered_zdotdir}" == */ ]]; do
  _aio_ade_discovered_zdotdir="\${_aio_ade_discovered_zdotdir%/}"
done

case "\${_aio_ade_discovered_zdotdir}" in
  *[![:space:]]*) ;;
  *) _aio_ade_discovered_zdotdir="" ;;
esac

if [[ -n "\${_aio_ade_discovered_zdotdir}" && ! -d "\${_aio_ade_discovered_zdotdir}" ]]; then
  [[ "\${AIO_ADE_DEBUG:-0}" == "1" ]] && echo "[aio-ade-shell-ready] Discovered ZDOTDIR '\${_aio_ade_discovered_zdotdir}' does not exist, falling back" >&2
  _aio_ade_discovered_zdotdir=""
fi

export AIO_ADE_ORIG_ZDOTDIR="\${_aio_ade_discovered_zdotdir:-\${_aio_ade_user_zdotdir:-$HOME}}"

while [[ "\${AIO_ADE_ORIG_ZDOTDIR}" == */ ]]; do
  AIO_ADE_ORIG_ZDOTDIR="\${AIO_ADE_ORIG_ZDOTDIR%/}"
done

case "\${AIO_ADE_ORIG_ZDOTDIR}" in
  ""|*/shell-ready/zsh) export AIO_ADE_ORIG_ZDOTDIR="$HOME" ;;
esac

# Why: use :- after user .zshenv — a pathological unset under set -u must not
# abort the wrapper; empty falls through to the baked-literal branch.
if [[ -n "\${_aio_ade_wrapper_zdotdir_self:-}" && -f "\${_aio_ade_wrapper_zdotdir_self:-}/.zshenv" ]]; then
  export ZDOTDIR="\${_aio_ade_wrapper_zdotdir_self:-}"
else
  export ZDOTDIR=${quotePosixSingle(zshDir)}
fi
unset _aio_ade_spawn_orig_zdotdir _aio_ade_user_zdotdir _aio_ade_zshenv_source_dir _aio_ade_zshenv_path _aio_ade_discovered_zdotdir _aio_ade_wrapper_zdotdir_self
`
}

export function getZshStartupFileSourceBlock(options: {
  fileName: '.zprofile' | '.zshrc' | '.zlogin'
  homeExpression?: string
  interactiveOnly?: boolean
  skipWhenHomeIsCurrentZdotdir?: boolean
}): string {
  const homeExpression = options.homeExpression ?? '"${AIO_ADE_ORIG_ZDOTDIR:-$HOME}"'
  const checks = [
    options.skipWhenHomeIsCurrentZdotdir ? '"$_aio_ade_home" != "$ZDOTDIR"' : null,
    options.interactiveOnly ? '-o interactive' : null,
    `-f "$_aio_ade_home/${options.fileName}"`
  ].filter(Boolean)

  return `_aio_ade_home=${homeExpression}
case "\${_aio_ade_home%/}" in
  */shell-ready/zsh) _aio_ade_home="$HOME" ;;
esac
if [[ ${checks.join(' && ')} ]]; then
  _aio_ade_wrapper_zdotdir="$ZDOTDIR"
  # Why: user startup files resolve plugin/config paths from their own ZDOTDIR;
  # AIO-ADE restores its wrapper dir afterward so zsh still loads wrapper files.
  export ZDOTDIR="$_aio_ade_home"
  source "$_aio_ade_home/${options.fileName}"
  export ZDOTDIR="$_aio_ade_wrapper_zdotdir"
  unset _aio_ade_wrapper_zdotdir
fi
`
}

// Why: zsh precmd fires before zle switches the PTY into line-editing mode,
// so the marker must be emitted from zle-line-init. Registering it through
// add-zle-hook-widget is unsafe: the azhw dispatcher aborts its hook chain
// when an earlier hook exits non-zero, and a pre-existing raw user widget
// (e.g. oh-my-zsh vi-mode without VI_MODE_SET_CURSOR) is preserved as the
// first hook and fails — silently suppressing the marker and stalling every
// startup command on the pre-ready timeout. Instead, own zle-line-init: emit
// the marker first, then chain to whatever widget was installed before.
export function getZshShellReadyMarkerRegistrationBlock(escapedMarker: string): string {
  return `if [[ "\${AIO_ADE_SHELL_READY_MARKER:-0}" == "1" ]]; then
  # Why: capture the prior zle-line-init so the marker chains to it. On a
  # re-source we are already the bound widget, so keep the function captured
  # the first time instead of clobbering it to empty (which would silently
  # drop the user's widget on every prompt after the second source). Only
  # user-defined widgets are chainable as plain functions; builtin/completion
  # forms (rare for zle-line-init) are left unchained.
  if [[ "\${widgets[zle-line-init]:-}" == "user:__aio_ade_prompt_mark" ]]; then
    :
  elif (( \${+widgets[zle-line-init]} )) && [[ "\${widgets[zle-line-init]}" == user:* ]]; then
    __aio_ade_prev_line_init_fn="\${widgets[zle-line-init]#user:}"
  else
    __aio_ade_prev_line_init_fn=""
  fi
  __aio_ade_prompt_mark() {
    printf "${escapedMarker}"
    # Why: call the prior hook as a plain function, not an aliased widget, so
    # $WIDGET stays zle-line-init for add-zle-hook-widget dispatchers.
    if [[ -n "\${__aio_ade_prev_line_init_fn:-}" ]]; then
      "\${__aio_ade_prev_line_init_fn}" "$@"
    fi
  }
  zle -N zle-line-init __aio_ade_prompt_mark
fi
`
}

export function getZshFinalZdotdirRestoreBlock(
  homeExpression = '"${AIO_ADE_ORIG_ZDOTDIR:-$HOME}"'
) {
  return `_aio_ade_home=${homeExpression}
case "\${_aio_ade_home%/}" in
  */shell-ready/zsh) _aio_ade_home="$HOME" ;;
esac
# Why: after AIO-ADE's last wrapper file has loaded, the interactive shell should
# expose the same ZDOTDIR a normal zsh startup would expose.
export ZDOTDIR="$_aio_ade_home"
unset _aio_ade_home
`
}
