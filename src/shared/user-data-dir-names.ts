/* Electron derives the userData directory from the app name, so changing `package.json` `name`
 * relocates the whole directory in one step — every store under it reads as missing at once, and
 * the app looks freshly installed rather than failing. These two names are what the migration
 * copies between; they are deliberately plain strings so a renderer or a script can name the
 * legacy directory without importing `electron`. */

/** Matches `package.json` `name`; Electron appends it to the per-OS app-data root. */
export const USER_DATA_DIR_NAME = 'aio-ade'

/** The pre-rebrand `name`. Read for one-way adoption; never written. */
export const LEGACY_USER_DATA_DIR_NAME = 'orca'

/** The settings/layout store at the userData root, and inside each profile directory. */
export const USER_DATA_FILE_NAME = 'aio-ade-data.json'

/* Why kept: `profile-storage-paths` already uses "legacy" for the pre-profile layout, so this name
 * carries the other meaning — the pre-rebrand spelling. Both readers need it: the root file is
 * adopted by name, and a profile directory copied from the previous install still holds it. */
export const LEGACY_USER_DATA_FILE_NAME = 'orca-data.json'

/* Files and directories directly under userData that hold data the app cannot rebuild. Names keep
 * their pre-rebrand spelling on the legacy side and take the canonical one on the new side, so the
 * map is explicit rather than a token substitution. */
export const ADOPTED_USER_DATA_ENTRIES: readonly { legacy: string; canonical: string }[] = [
  // Window/workspace layout and the persisted settings store, in the pre-profile root position.
  { legacy: 'orca-data.json', canonical: 'aio-ade-data.json' },
  // The profile tree carries one data file per profile under the same names; it is copied whole so
  // an existing multi-profile install keeps every profile, not just the active one.
  { legacy: 'profiles', canonical: 'profiles' },
  { legacy: 'orca-profile-index.json', canonical: 'aio-ade-profile-index.json' },
  // Per-provider usage history; losing it silently resets rate-limit accounting.
  { legacy: 'orca-claude-usage.json', canonical: 'aio-ade-claude-usage.json' },
  { legacy: 'orca-codex-usage.json', canonical: 'aio-ade-codex-usage.json' },
  { legacy: 'orca-stats.json', canonical: 'aio-ade-stats.json' },
  // Pairing identity: the keypair cannot be regenerated without re-pairing every device.
  { legacy: 'orca-devices.json', canonical: 'aio-ade-devices.json' },
  { legacy: 'orca-e2ee-keypair.json', canonical: 'aio-ade-e2ee-keypair.json' },
  { legacy: 'orca-terminal-attribution', canonical: 'aio-ade-terminal-attribution' },
  // Account subsystems whose directory names never carried the brand token.
  { legacy: 'claude-accounts', canonical: 'claude-accounts' },
  { legacy: 'codex-accounts', canonical: 'codex-accounts' },
  { legacy: 'claude-runtime-auth', canonical: 'claude-runtime-auth' },
  { legacy: 'codex-runtime-home', canonical: 'codex-runtime-home' }
]

/* Deliberately not adopted.
 *
 * `Partitions` and the browser session metadata are Chromium-owned profile state keyed to a
 * partition name; copying it across app identities risks importing a half-written profile for no
 * durable user data. Cookie-import staging and diagnostics logs are scratch.
 *
 * The `*.enc` credential stores are a special case worth naming: they are encrypted by
 * `safeStorage`, whose key on macOS is derived from the app name ("<appName> Safe Storage"). A
 * copied ciphertext therefore cannot be decrypted under the new identity, so copying it would
 * produce a decryption error instead of a missing credential — a worse failure. The app re-prompts
 * for these instead. */
export const NOT_ADOPTED_USER_DATA_ENTRIES: readonly string[] = [
  'Partitions',
  'cookie-import-staging',
  'cookie-import-diag.log'
]
