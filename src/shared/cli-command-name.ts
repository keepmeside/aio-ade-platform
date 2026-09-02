/* The single command name this app installs on PATH. One name on every platform: the previous
 * brand needed a Linux-specific variant because a bare `orca` collided with the GNOME Orca
 * screen reader, and `aio-ade` has no such collision. */
export const CLI_COMMAND_NAME = 'aio-ade'
export const DEV_CLI_COMMAND_NAME = 'aio-ade-dev'

/* Why: pre-rebrand installs put two different names on PATH — `orca` on macOS/Windows and
 * `orca-ide` on Linux. Nothing writes these any more; uninstall and repair still read them so a
 * symlink this app once managed gets reclaimed instead of being left dangling on PATH. */
export const LEGACY_CLI_COMMAND_NAMES: readonly string[] = ['orca-ide', 'orca']
export const LEGACY_DEV_CLI_COMMAND_NAME = 'orca-dev'

export function getCliCommandNameForPlatform(platform: NodeJS.Platform): string {
  return platform === 'win32' ? `${CLI_COMMAND_NAME}.cmd` : CLI_COMMAND_NAME
}
