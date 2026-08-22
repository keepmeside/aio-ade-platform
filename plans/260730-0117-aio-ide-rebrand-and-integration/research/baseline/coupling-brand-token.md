# Coupling map: `orca` brand-token surface (phase 05 prep)

Generated 2026-08-22 at commit `0304a365`. Read-only inventory.

Scale: **3,496 files / 43,466 occurrences** of `orca` in any case across tracked files
(2,346 files `orca`, 1,923 `Orca`, 828 `ORCA`), plus **448 files / 2,024 occurrences** of `stablyai`.

A blind find-and-replace over that surface is the single highest-risk action in the whole roadmap:
several of these occurrences are **data and wire contracts** where a rename silently strands existing
users' accounts and workspaces, with nothing failing. This map sorts the surface by rename strategy so
phase 05 knows which token may be rewritten and which must be dual-read.

Target tokens (approved 2026-08-21): display **`AIO-ADE`**, machine **`aio-ade`**, org `stablyai` → `keepmeside`.

## Risk classes

| Class | What | Size | Strategy |
|---|---|---:|---|
| **A** | User-visible display strings + localization catalogs | **3,050 values** across 5 locales (en 610, es 614, ja 606, ko 605, zh 615) | `mechanical-rename` — but through the catalog tooling. `verify:localization-catalog` and `verify:localization-coverage` run inside `pnpm lint` and enforce 11,548-key parity across all five locales, so edits must be catalog-consistent or lint fails |
| **B** | Binary / CLI / PATH names | `package.json` `bin`: `orca` → `./out/cli/index.js`, `orca-dev` → `config/scripts/orca-dev.mjs`; `config/scripts/verify-cli-bin.mjs`; `config/scripts/install-dev-cli.mjs`; `OrchestrationCliCommand = 'orca' \| 'orca-ide'` | `mechanical-rename` + **no alias** (approved). Note the Linux constraint: do not install bare `orca` (GNOME Orca screen reader conflict) |
| **C** | Artifact + installer identity | `config/electron-builder.config.cjs`: `appId = 'com.stablyai.orca'` (L21), `productName: 'Orca'` (L66), `orca-windows-setup.${ext}` (L276), `orca-macos-${arch}` (L364), `orca-linux[-arm64]` (L403), `orca-ide_${version}_${arch}` (L407), `orca-ide-${version}.${arch}` (L429) | `mechanical-rename` → `com.keepmeside.aio-ade`, `AIO-ADE`, `aio-ade-*`. **Verification is deferred to phase 12** (D4/D5) since only Linux targets build here |
| **D** | **Filesystem data paths — DUAL-READ, DO NOT RENAME** | `~/.orca` (321 files / 1,255 occurrences of `.orca`): `keybindings.json`, `jira-sites.json`, minimax cookie store, `claude-agent-teams-bin`, `agent-hooks/*.sh`; in-repo `.orca/drops`, `.orca/templates`, `.orca/issue-command`, `.orca/agent-hooks`; `orca.yaml`; userData profile `orca-data.json` | `dual-read-migration`. The 2026-08-21 decision is explicit: no-alias applies to **binary/PATH only**, never to data migration. Pinned by `src/main/legacy-orca-data-path-preflight.test.ts` |
| **E** | **Keychain / secret-store service names — DUAL-READ** | `src/main/claude-accounts/keychain.ts`: `ORCA_CLAUDE_SERVICE = 'Orca Claude Code Managed Credentials'` (L5). Separately `ACTIVE_CLAUDE_SERVICE = 'Claude Code-credentials'` (L4) is **upstream-owned** — Claude Code 2.1+ scopes it as `sha256(CLAUDE_CONFIG_DIR).slice(0,8)` | `dual-read-migration` for the Orca-named service; `keep-legacy-forever` for the Claude Code one. Renaming either logs the user out |
| **F** | `ORCA_*` env var prefix | **636 distinct names**. Highest-traffic: `ORCA_PANE_KEY` (272), `ORCA_ORIG_ZDOTDIR` (253), `ORCA_USER_DATA_PATH` (229), `ORCA_AGENT_HOOK_PORT` (197), `ORCA_TERMINAL_HANDLE` (195), `ORCA_CODEX_HOME` (195), `ORCA_AGENT_HOOK_TOKEN` (183), `ORCA_CLI_COMMAND` (40) | `needs-decision`. These cross a process boundary into **already-running** PTYs, installed agent hook shell scripts on remote/WSL hosts, and shim wrappers. A rename is a wire break for any live session and any previously installed remote hook. Recommend `keep-legacy-forever` for hook/PTY vars and rename only build-time-internal ones — but this must be an explicit decision, not a default |
| **G** | Plugin manifest + panel-bridge contracts | `stablyai.orca*` publisher-qualified plugin keys: **113 occurrences / 38 files**, incl. `resources/plugins/launch/bundled-plugins.json`, `orca-marketplace.json`, and a bundled locale plugin `stablyai.orca-portuguese` | `dual-read-migration`. Plugin keys are `publisher.id` identifiers persisted in `disabledPlugins` settings and referenced by installed third-party manifests |
| **H** | Endpoints, org tokens, repo guards | `stablyai/orca` **1,255 occurrences**; `onorca.dev` **320**; PostHog references **~47**; workflow guards `if: github.repository == 'stablyai/orca'` in `readme-downloads-badge.yml:23`, `release-cut.yml:68`, `release-mac-build.yml:26`; Homebrew `Casks/orca.rb` + `Casks/orca@rc.rb` | `mechanical-rename` → `keepmeside/aio-ade-platform`. Telemetry/diagnostics move to a Keepmeside endpoint and the update check is dropped (approved). `Casks/orca@rc.rb` should be **deleted**, not renamed — the stable-only decision removes the RC channel |
| **I** | Code-internal identifiers | `src/main/runtime/orca-runtime.ts` and siblings, type names, test helper names | `mechanical-rename` — compiler-verified, lowest risk. Do this last so the compiler is not flooded while riskier classes are in flight |
| **J** | Test fixtures and snapshots | e.g. `orca-worktree-*` temp dir prefixes, `orca-bundle-` in `bundle.test.ts`, `pluginKey: 'stablyai.orca-e2e-skills'` in e2e specs | `mechanical-rename`, with one caveat: the gitleaks allowlist in `research/baseline/proposed.gitleaks.toml` matches some of these literals and must be updated in the same commit |

## Ordering recommendation

Classes D, E, F and G are where a rebrand actually breaks users, and none of them are visible in a
diff review of a 43k-occurrence replacement. So:

1. Land the dual-read readers for **D**, **E** and **G** *first*, with tests, while the old names are
   still the only names. Then a later rename cannot orphan data because the reader already handles both.
2. Resolve **F** as an explicit decision before touching any env var. Default to keeping the `ORCA_`
   prefix for anything that reaches a PTY, an installed remote hook, or a shim.
3. Only then do **A**, **B**, **C**, **H**, **I**, **J** — the compiler, the localization gates and the
   packaging config make these self-checking.

## Already pinned by tests

`src/main/legacy-orca-data-path-preflight.test.ts` (phase 01) asserts class D paths and class E service
names against their real call sites, plus the `OrchestrationCliCommand` union from class B. If phase 05
rewrites any of them, that suite fails and forces the change to be a deliberate migration.

## Not covered here

Whether `serve` and its `onorca.dev` docs links survive at all is a phase 09 decision. The
`docs/reference/headless-linux-server.md` guide references `stablyai/orca` release URLs and
`/opt/orca` paths, which follow whatever phase 09 decides.
