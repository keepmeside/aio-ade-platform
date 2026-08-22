# Coupling map: accounts, credentials and auth paths (phase 05 + 06 prep)

Generated 2026-08-22 at commit `0304a365`. Read-only inventory.

Two findings drive everything below:

1. The account subsystem is **large and already built** — phase 06 extends a seam, it does not build
   from zero. There is even an existing `src/main/orca-profiles/` subsystem (profile cloud auth,
   PKCE, org members), so "profile" is an occupied word in this codebase.
2. Every storage location is keyed by an `orca`-branded name or marker. Phase 05's rename touches all
   of them, and a rename without a dual-read reader logs the user out or orphans their per-account
   runtime home.

## Subsystem storage map

| Subsystem | Storage location | Evidence | Rename-safe? | Migration reader exists? |
|---|---|---|---|---|
| Claude managed accounts | `<userData>/claude-accounts/` | `claude-accounts/managed-auth-path.ts:9` `getClaudeManagedAccountsRoot()` | Directory name is unbranded → **yes** | n/a |
| Claude managed-auth ownership marker | `.orca-managed-claude-auth` (30 occurrences) | `managed-auth-path.ts:6` `MANAGED_AUTH_MARKER` | **No** — ownership proof for a directory we then trust and write | `adoptLegacyMarker` option exists in `resolveOwnedClaudeManagedAuthPath` — a real seam to extend |
| Claude active credentials (macOS) | Keychain service `Claude Code-credentials`, optionally suffixed `-${sha256(CLAUDE_CONFIG_DIR).slice(0,8)}` | `claude-accounts/keychain.ts:4,87-92` | **No — upstream-owned.** Claude Code 2.1+ defines this scheme; we must match it exactly | Reads scoped **and** unscoped service (`getActiveClaudeServices`) |
| Claude managed credentials (macOS) | Keychain service `Orca Claude Code Managed Credentials` | `keychain.ts:5,67-78` | **No** — dual-read required or accounts vanish | **None yet.** This is the gap phase 05 must fill |
| Claude runtime config dir | `CLAUDE_CONFIG_DIR` or `~/.claude`; config at `<dir>/.claude.json` falling back to `~/.claude.json`; creds at `<dir>/.credentials.json` | `claude-accounts/runtime-paths.ts:15-32` | Unbranded upstream paths → **do not touch** | Colocated-vs-home config fallback already handled |
| Claude WSL accounts | isolated by a Linux `CLAUDE_CONFIG_DIR` (`wslLinuxAuthPath`) | `runtime-auth-service.ts:292,622` | n/a | Comment notes materializing into Windows `~/.claude` would mix two auth stores |
| Codex managed accounts | `<userData>/codex-accounts/` | `codex-accounts/runtime-home-service.ts:1251` | **Yes** (unbranded) | `runtime-home-service-per-account-migration.ts` |
| Codex runtime-home metadata | `<userData>/codex-runtime-home/` | `runtime-home-service.ts:1233` | **Yes** | same |
| Codex managed-home marker | `.orca-managed-home` (27 occurrences) | grep | **No** — same ownership-proof role as the Claude marker | `host-codex-managed-home-ownership.ts` guards ownership |
| Codex legacy shared auth | pre-per-account `auth.json` | `legacy-shared-auth-migration.ts:8` marker `per-account-auth-migration-v1.json` | n/a | **Yes** — a good precedent for the versioned-marker pattern phase 05 should copy |
| Codex home env | `CODEX_HOME` (132 files / 742 occurrences), plus `ORCA_CODEX_HOME` (195) and a managed `config.toml` | grep; `wsl-codex-command.ts` | `CODEX_HOME` unbranded → keep. `ORCA_CODEX_HOME` is class F of the brand map | — |
| Encrypted secret stores | `safeStorage` across 10 non-test modules: `persistence.ts`, `integration-credential-file.ts`, `jira/client.ts`, `linear/client.ts`, `minimax-cookie-store.ts`, `orca-profiles/profile-cloud-session-store.ts`, `plugins/plugin-secrets-store.ts`, `speech/openai-api-key-store.ts`, `startup/dev-instance-identity.ts`, `index.ts` | grep | Ciphertext is keyed to the OS account, not to the app name; but `appId`/`productName` changes affect the **userData directory**, so the files must move with the profile | Each site branches on `isEncryptionAvailable()` with its own fallback — not uniform |
| Legacy home stores under `~/.orca` | `jira-sites.json`, minimax cookie store, `keybindings.json`, `claude-agent-teams-bin`, `agent-hooks/*.sh` | `jira/client.ts:94`, `minimax-cookie-store.ts:18`, `keybindings/keybinding-file.ts:26`, `claude-agent-teams-shim-env.ts:72` | **No** — dual-read | **None.** Pinned by `legacy-orca-data-path-preflight.test.ts` |
| Desktop profile file | `<userData>/orca-data.json` | `persistence.ts:340,348` | **No** — this is the whole user profile | `getCanonicalUserDataPath()` exists because `app.setName()` already caused case-sensitivity data loss once (`persistence.ts:333,438-445`) |

## The userData rename is the sharpest edge

`persistence.ts:333` carries a warning from a past incident: resolving `app.getPath('userData')`
per-call *after* `app.setName('Orca')` "flips path case and loses data on case-sensitive FS", which is
why `initDataPath()` must be called at exactly the right moment and why `getCanonicalUserDataPath()`
exists.

Phase 05 changes `productName` **and** `appId`, which changes the userData directory on all three
platforms. That is the same class of failure as the incident that produced this guard, at larger
scale: an unmigrated userData move loses the profile, every account marker, and every `safeStorage`
ciphertext file at once.

Recommended: a one-way copy keyed by a versioned marker (mirroring
`per-account-auth-migration-v1.json`), executed before any subsystem reads, with the old directory
left intact until an explicit later cleanup.

## Marker inventory (ownership proofs — none are rename-safe)

`.orca-managed-claude-auth` (30), `.orca-managed-home` (27), `.orca-relay` (12), `.orca-remote` (11),
`.orca-omp-overlay-migration-complete` (8), `.orca-session-copies` (7), `.orca-resource-copies` (3).

`.orca-relay` and `.orca-remote` live on **remote** machines (relay install dirs under the remote
`$HOME`), so renaming them orphans every already-deployed relay and forces a full redeploy on hosts
the user may not control. Treat as `keep-legacy-forever` unless a deliberate remote GC is designed.

## Naming collision to resolve before phase 06

`src/main/orca-profiles/` already means "profile cloud" (org auth, PKCE, session store). Phase 06
introduces `profiles` meaning "API/base-URL configuration". Two different things called profile in
one codebase will produce real bugs. Recommend naming the phase-06 concept explicitly (e.g.
`api-credential-profiles`) rather than overloading `profiles`.

## What phase 06 can build on

- Account/OAuth machinery exists for both providers (`claude-accounts/service.ts`,
  `codex-accounts/service.ts`), including duplicate-account detection, live-PTY gating and OAuth refresh.
- Per-account runtime isolation exists: Claude via `CLAUDE_CONFIG_DIR` env patch, Codex via a managed
  `CODEX_HOME` + TOML. This is exactly the "shared schema, separate runtime resolver" shape the
  approved decision calls for.
- WSL isolation is already modeled (`wsl-codex-command.ts`, `wslLinuxAuthPath`).
- A versioned one-way migration precedent exists (`legacy-shared-auth-migration.ts`).

Absent: a vault abstraction. `safeStorage` is called directly from 10 modules with per-site fallbacks,
so the phase-06 "dedicated IPC/vault" work is genuinely new code, not a refactor.
