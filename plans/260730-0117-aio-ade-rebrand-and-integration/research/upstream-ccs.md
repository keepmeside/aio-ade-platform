# CCS (Claude Code Switch) — kaitranntt/ccs

- **URL**: https://github.com/kaitranntt/ccs (docs: https://docs.ccs.kaitran.ca, site: https://ccs.kaitran.ca, npm: `@kaitranntt/ccs`)
- **One-liner**: Multi-provider profile + runtime manager for Claude Code and compatible CLIs — swaps between multiple Claude subscription accounts, OAuth providers, API-key profiles, and local models without hand-editing config.
- **Stack**: TypeScript (Node >= 18, built/tested with Bun 1.3.9), Express web server + WS for the dashboard, React + Vite + Tailwind v4 dashboard (`ui/`), YAML config (`js-yaml`), TOML for Codex (`smol-toml`), `chokidar` watchers, `proper-lockfile` for config write safety, `bcrypt` for dashboard auth, `undici` for HTTP, `ora`/`chalk`/`boxen`/`cli-table3`/`listr2` for CLI UX. Docker image `ghcr.io/kaitranntt/ccs:latest`. Optional macOS menu-bar app (`macos-bar/`).
- **License**: **MIT** (confirmed via GitHub API `license: MIT` and a top-level `LICENSE` file). Vendoring into an MIT Electron app is fine — MIT-to-MIT, just retain the copyright notice (Tam Nhu Tran / "Kai") in any copied file or a NOTICE/third-party licenses section.
- **Activity**: Very active. Last push `2026-07-29T18:53:49Z` (one day before this report). ~2,762 stars, 247 forks, ~4,637 commits, repo size ~45 MB. Version `8.8.1` on npm, `semantic-release` + conventional commits, self-hosted CI runner. This is NOT a thin wrapper or abandoned script — it is a large, mature product with its own docs site, Docker distribution, and dashboard.

## Architecture

Monorepo-ish single package with a fat `src/` tree. Verified paths:

- **Entry point**: `src/ccs.ts` → built to `dist/ccs.js`. Additional bins in `package.json`:
  - `ccs` → `dist/ccs.js`
  - `ccs-droid` / `ccsd` → `dist/bin/droid-runtime.js`
  - `ccs-codex` / `ccsx` → `dist/bin/codex-runtime.js`
  - `ccsxp` → `dist/bin/ccsxp-runtime.js`
  So each *target CLI* gets its own thin runtime launcher binary. Source lives under `src/bin/`.
- **Top-level `src/` modules** (all verified to exist): `api`, `auth`, `bin`, `channels`, `cliproxy`, `codex-auth`, `commands`, `config`, `copilot`, `cursor`, `delegation`, `dispatcher`, `docker`, `errors`, `glmt`, `management`, `proxy`, `services/logging`, `shared`, `targets`, `types`, `utils`, `web-server`.
- **Config layer** — `src/config/`:
  - `unified-config-loader.ts`, `config-loader-facade.ts`, `migration-manager.ts`, `feature-flags.ts`, `reserved-names.ts`, `unified-config-types.ts` (now just a barrel re-export of `src/config/schemas/index.ts`).
  - `src/config/schemas/` splits the schema by domain: `auth.ts`, `cliproxy.ts`, `providers.ts`, `proxy-server.ts`, `quota.ts`, `runtime.ts`, `thinking.ts`, `websearch.ts`, `browser.ts`, `channels.ts`, `logging.ts`, `copilot-cursor.ts`, `unified-config.ts`, `version.ts`.
  - **Storage**: a single `~/.ccs/config.yaml` (root type `UnifiedConfig`, integer `version` field). Comment in `unified-config-types.ts` states v2 consolidated three older files — `config.json` (API profiles), `profiles.json` (account metadata), `*.settings.json` (env vars) — into one YAML. **API-profile env vars are still kept in separate `~/.ccs/<name>.settings.json` files**, deliberately mirroring Claude Code's own `settings.json` shape so users can hand-edit them.
- **Two distinct switching mechanisms**, cleanly separated in the schema (this is the key design insight):
  1. `accounts: Record<string, AccountConfig>` — **isolated Claude instances via `CLAUDE_CONFIG_DIR`**. Same technique the target already uses. Metadata only (created/last_used + sharing flags).
  2. `profiles: Record<string, ProfileConfig>` — **API-key/base-URL profiles via env-var injection**, pointing at an external settings file.
- **Targets abstraction** — `src/targets/`: `target-adapter.ts` (the `TargetType` union), `target-registry.ts`, `target-resolver.ts`, `target-metadata.ts`, `target-runtime-compatibility.ts`, plus per-CLI adapters `claude-adapter.ts`, `codex-adapter.ts`, `droid-adapter.ts` and detectors `codex-detector.ts`, `droid-detector.ts`. A profile declares `target?: TargetType`, so the same profile system drives Claude Code, Codex CLI, and Factory Droid. `codex-cliproxy-provider-config.ts` handles writing Codex provider config.
- **Codex auth** — dedicated `src/codex-auth/` module, separate from `src/auth/` (Codex uses `~/.codex/auth.json` + `config.toml`, hence the `smol-toml` dependency).
- **Auth/profile runtime** — `src/auth/`: `account-context.ts`, `profile-registry.ts`, `profile-detector.ts`, `profile-continuity-inheritance.ts`, `shared-resource-policy.ts`, `account-profile-diagnostics.ts`, `resume-lane-diagnostics.ts`, `resume-lane-warning.ts`, `auth-commands.ts`.
- **Proxy layer** — two separate proxies:
  - `src/cliproxy/` wraps **CLIProxyAPI** (an external Go OAuth proxy, default port 8317) which holds OAuth credentials for Codex, xAI/Grok, Kiro, Claude, Kimi, legacy Copilot. `.gitmodules` exists, so CLIProxyAPI is likely a submodule/downloaded binary rather than vendored TS. Supports a community `CLIProxyAPIPlus` fork as opt-in backend (`cliproxy.backend: 'original' | ...`).
  - `src/proxy/` is a **local Anthropic-compatible proxy** that fronts OpenAI-compatible providers, so Claude Code (which speaks Anthropic wire format) can talk to any OpenAI-style endpoint. README explicitly credits `musistudio/claude-code-router`'s transformer architecture for the SSE/transform work.
- **Routing**: `CLIProxyRoutingConfig` with `strategy: 'round-robin' | fill-first`, `session_affinity`, `session_affinity_ttl: '1h'`. Request-time model selection uses `profile:model` selectors; scenario routing under `proxy.routing`.
- **Dashboard** — `src/web-server/` (Express + `express-session` + `express-rate-limit` + `ws`) serving the built `ui/` React app on port 3000. `dashboard_auth` is bcrypt-hashed username/password, **disabled by default**, session timeout in hours.
- **Command surface** — `src/commands/` with `root-command-router.ts`, `named-command-router.ts`, `command-catalog.ts`, `command-execution-contract.ts`, `completion-backend.ts`. Verb files seen: `api-command/`, `bar/`, `browser-command.ts`, `cleanup-command.ts`, `cliproxy-command.ts`, `config-command.ts` (+ `config-auth/`, `config-channels-command.ts`, `config-dashboard-host.ts`, `config-image-analysis-command.ts`, `config-thinking-command.ts`), `copilot-command.ts`, `cursor-command.ts`, `docker-command.ts`, `doctor-command.ts`, `env-command.ts`, `help-command.ts`, `install-command.ts`, `migrate-command.ts`, `persist-command.ts`, `proxy-command.ts`, `setup-command.ts`, `shell-completion-command.ts`, `sync-command.ts`, `tokens-command.ts`, `update-command.ts`, `version-command.ts`.
- **Windows**: `package.json` declares `"os": ["darwin", "linux", "win32"]`. Windows is officially supported. (`ccs bar` is macOS-only; `eval "$(ccs proxy activate)"` is a POSIX-shell idiom, so the env-export path likely needs a PowerShell equivalent.)
- **Install lifecycle**: `preinstall`, `postinstall`, `postuninstall` node scripts — meaning `npm i -g @kaitranntt/ccs` executes local scripts. Relevant if considering it as a dependency.
- **Docs the project keeps** (`docs/`): `system-architecture/`, `codebase-summary.md`, `code-standards.md`, `codex-auth.md`, `openai-compatible-providers.md`, `dashboard-auth-cli.md`, `browser-automation.md`, `websearch.md`, `image-analysis.md`, `cursor-integration.md`, `ccs-bar.md`, `logging-contract.md`, `i18n-dashboard.md`, `release-process.md`, `hardening-debt-burndown.md`, `session-sharing-technical-analysis.md`, `project-overview-pdr.md`, `project-roadmap.md`.

### Real config example (reconstructed from the verified `UnifiedConfig` / `AccountConfig` / `ProfileConfig` types)

`~/.ccs/config.yaml`:

```yaml
version: 11
setup_completed: true
default: work
accounts:
  work:
    created: '2026-03-04T09:12:00Z'
    last_used: '2026-07-29T18:20:11Z'
    context_mode: isolated
    shared_resource_mode: shared
  personal:
    created: '2026-04-18T22:41:03Z'
    last_used: null
    context_mode: shared
    context_group: main
    continuity_mode: deeper
  scratch:
    created: '2026-06-01T10:00:00Z'
    last_used: null
    bare: true
profiles:
  glm:
    type: api
    settings: ~/.ccs/glm.settings.json
    target: claude
  kimi:
    type: api
    settings: ~/.ccs/kimi.settings.json
  gpt5-codex:
    type: api
    settings: ~/.ccs/gpt5-codex.settings.json
    target: codex
cliproxy:
  backend: original
  oauth_accounts:
    kai: kai@example.com
    alt: alt@example.com
  providers: [codex, claude, gemini, kiro, kimi, xai]
  variants: {}
  logging: { enabled: false, request_log: false }
  auto_sync: true
  routing:
    strategy: round-robin
    session_affinity: false
    session_affinity_ttl: 1h
proxy:
  port: 8318
  profile_ports: {}
  routing: {}
global_env:
  enabled: true
  env:
    # DEFAULT_GLOBAL_ENV — applied to all non-Claude-subscription profiles
preferences:
  theme: system
  telemetry: false
  auto_update: true
quota_management: { ... }
thinking: { ... }
dashboard_auth:
  enabled: false
  username: ''
  password_hash: ''
  session_timeout_hours: 24
```

`~/.ccs/glm.settings.json` (shape matches Claude Code's own `settings.json` `env` block — **GAP: not byte-verified, inferred from the schema comment "Settings are stored in separate *.settings.json files (matching Claude's pattern)" plus how Claude Code reads env**):

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "<key>",
    "ANTHROPIC_MODEL": "glm-4.6"
  }
}
```

### Answers to the specific questions asked

| Question | Answer |
|---|---|
| File-swap or env-injection? | **Both, but never destructive file-swapping of live credential files.** Subscription accounts = `CLAUDE_CONFIG_DIR` pointed at an isolated dir (so `~/.claude/.credentials.json` and `~/.claude.json` are per-account by *location*, not swapped in place). API profiles = env-var injection sourced from a per-profile `*.settings.json`. Codex handled by a dedicated `src/codex-auth/` module writing `~/.codex` artifacts (TOML config + auth.json). |
| Third-party Anthropic-compatible gateways? | **Yes, first-class.** That is the entire `profiles` + `global_env` + `src/proxy/` story: GLM, Kimi, OpenRouter, Novita, Fireworks, Alibaba Coding Plan, HuggingFace (`ccs api create --preset hf`), Ollama, llama.cpp. Non-Anthropic-shaped providers get bridged by the local Anthropic-compatible proxy. |
| Secrets at rest | Plaintext on disk: API keys live in `~/.ccs/*.settings.json`; OAuth tokens live inside CLIProxyAPI's own store. No OS keychain usage found. The only hashed secret is the dashboard password (`bcrypt`, `password_hash`). CLIProxy defaults are weak-by-design placeholders: `api_key: 'ccs-internal-managed'`, `management_secret: 'ccs'`. **The target's macOS Keychain integration is strictly better here.** |
| Migration/backup | `src/config/migration-manager.ts` + `ccs migrate` verb + integer `version` on the config root + a deliberately **relaxed** `isUnifiedConfig()` type guard (only requires `version >= 1`; all sections optional and merged against defaults). `proper-lockfile` guards concurrent writes. `ccs cleanup` and `ccs doctor` exist for repair. |
| CLI verb surface | Bare `ccs` (default profile), `ccs <profile>` (e.g. `ccs glm`, `ccs ollama`), `ccs codex`, `ccs xai`/`ccs grok`, `ccs --target droid glm`, `ccs config`, `ccs setup`, `ccs install`, `ccs api create --preset hf`, `ccs proxy start|activate`, `ccs cliproxy`, `ccs sync`, `ccs persist`, `ccs env`, `ccs tokens`, `ccs doctor`, `ccs cleanup`, `ccs migrate`, `ccs update`, `ccs version`, `ccs bar install`, `ccs browser`, `ccs copilot`, `ccs cursor`, `ccs docker`. Shell completion via `ccs shell-completion`. |
| Sibling/related projects | `musistudio/claude-code-router` (credited as the basis of the proxy transformer layer — worth researching separately for the API-profile routing), **CLIProxyAPI** (the Go OAuth proxy backend) and its community fork **CLIProxyAPIPlus** / CPAMC dashboard fork, `opencode-ccs-sync` by @JasonLandbridge (syncs CCS providers into OpenCode). |

## Features

| # | Feature | What it does | How it works (real files/APIs/mechanism) | Value for aio-ade | Effort | Approach | Priority |
|---|---|---|---|---|---|---|---|
| 1 | Two-kind profile model: `accounts` vs `profiles` | Separates "isolated subscription account" from "API key + base URL config" as distinct first-class types instead of one blurred concept | `src/config/schemas/auth.ts`: `AccountConfig` (created/last_used/context flags) vs `ProfileConfig` (`type:'api'`, `settings` path, `target`) | This is the single most valuable idea. Target already does per-account dirs but "barely supports" API/base-URL profiles — adopting this split gives a clean data model for both without special-casing | S | reimplement | must-have |
| 2 | API-profile settings in separate hand-editable files | Each API profile's env block lives in `~/.ccs/<name>.settings.json` mirroring Claude Code's own settings shape, not buried in app state | `ProfileConfig.settings` path; loader resolves `~` | Lets aio-ade users paste a gateway config from a vendor's docs verbatim, and lets the same file be reused by their bare `claude` CLI outside the IDE | S | reimplement | must-have |
| 3 | `global_env` layer | Env vars applied to *all* non-subscription profiles, merged under per-profile env | `GlobalEnvConfig` + `DEFAULT_GLOBAL_ENV` in `src/config/schemas/providers.ts`; `unified-config.ts` factory | Target injects env per spawn already but (likely) has no global layer — one place to set a corporate proxy, `ANTHROPIC_BASE_URL`, telemetry opt-outs across every agent spawn | S | reimplement | must-have |
| 4 | Anthropic-compatible local proxy for OpenAI-shaped providers | Runs a localhost server speaking Anthropic wire format, translating to OpenAI-compatible upstreams, incl. SSE streaming | `src/proxy/`, `OpenAICompatProxyConfig` (`port`, `profile_ports`, `routing`); credits `musistudio/claude-code-router` transformers | Unlocks "run Claude Code against GLM/OpenRouter/Ollama" inside aio-ade. Big feature, big cost — the SSE transform is where all the bugs live | XL | inspiration-only (or spawn-subprocess) | nice-to-have |
| 5 | Per-profile proxy port map | Each profile gets a stable localhost port so several gateways can be live simultaneously | `proxy.profile_ports: Record<string, number>`; `get-port` dependency for allocation | Directly relevant: aio-ade runs many worktrees in parallel, so any proxy must be multi-tenant by profile, not a single global port | S | reimplement | nice-to-have |
| 6 | Multi-upstream routing strategy | `round-robin` vs `fill-first` across several accounts of the same provider, with session affinity + TTL | `CLIProxyRoutingConfig` in `src/config/schemas/cliproxy.ts`: `strategy`, `session_affinity`, `session_affinity_ttl: '1h'` | High value for parallel worktrees: spread N concurrent agents across M accounts to dodge rate limits. `fill-first` = burn one sub before touching the next. Session affinity keeps one agent pinned to one account mid-task | M | reimplement | must-have |
| 7 | Quota management + auto-switch on exhaustion | Tracks subscription quota and can auto-rotate accounts; manual and automatic modes plus a runtime monitor | `src/config/schemas/quota.ts`: `QuotaManagementMode`, `AutoQuotaConfig`, `ManualQuotaConfig`, `RuntimeMonitorConfig`, `DEFAULT_QUOTA_MANAGEMENT_CONFIG` | Target has usage/rate-limit *tracking*; the missing half is *acting* on it. "Agent hit the 5h limit → transparently switch account and resume" is a killer IDE feature | M | reimplement | must-have |
| 8 | `context_mode: isolated \| shared` + context groups | Per-account choice of whether project workspace data (history/sessions) is isolated or shared across a named group | `AccountConfig.context_mode`, `context_group`, `continuity_mode: 'standard' \| 'deeper'` | Solves a real pain the target's strict per-account isolation creates: switch account mid-project without losing conversation history. Very relevant to worktree-per-task workflows | M | reimplement | nice-to-have |
| 9 | Cross-profile continuity inheritance | A new profile can inherit conversation continuity from another profile | `ContinuityConfig` in schemas/providers.ts; `src/auth/profile-continuity-inheritance.ts`; `resume-lane-diagnostics.ts`, `resume-lane-warning.ts` | "Resume this session but on a different account/provider" — the exact thing users want when an account runs dry mid-task. Also the warning/diagnostic UX is worth copying | M | inspiration-only | nice-to-have |
| 10 | `shared_resource_mode` / `bare` profiles | Chooses whether commands/skills/agents/plugins/`settings.json` are symlinked from a shared dir into each account dir, or kept profile-local; `bare` = no symlinks at all | `AccountConfig.shared_resource_mode`, `bare`; `src/auth/shared-resource-policy.ts` | Directly fills a gap created by `CLAUDE_CONFIG_DIR` isolation: today each managed dir needs its own copy of skills/agents. Symlink-from-shared means one edit propagates to all accounts | M | vendor-code | must-have |
| 11 | Thinking/reasoning budget config | Per-tier default reasoning effort applied when launching | `src/config/schemas/thinking.ts`: `ThinkingMode`, `ThinkingTierDefaults`, `DEFAULT_THINKING_CONFIG` | Cheap UI win: an effort selector per agent profile in aio-ade, translated to Claude thinking budget / Codex reasoning effort at spawn | S | reimplement | nice-to-have |
| 12 | Output-limit env mapping | Opt-in caps on CLI output size, expressed as a fixed env-key map | `src/config/schemas/runtime.ts`: `OUTPUT_LIMITS_ENV_KEYS`, `buildOutputLimitsEnv()`, `OutputLimitsConfig` | Small and directly liftable: xterm.js terminals in the target choke on huge tool output; a documented env map is a two-hour fix | S | vendor-code | nice-to-have |
| 13 | Target adapter registry (multi-CLI) | One profile system drives Claude Code, Codex CLI, and Factory Droid, each with a detector + adapter + compatibility matrix | `src/targets/target-adapter.ts`, `target-registry.ts`, `target-resolver.ts`, `target-runtime-compatibility.ts`, `claude-adapter.ts`, `codex-adapter.ts`, `droid-adapter.ts`, `codex-detector.ts` | Target is stripping 34 agents to exactly 2 — this is the reference shape for a clean 2-adapter abstraction that stays open to a 3rd, with per-target profile compatibility validation | M | inspiration-only | nice-to-have |
| 14 | Config migration manager + tolerant schema guard | Integer `version` on config root; `ccs migrate`; `isUnifiedConfig()` only requires `version >= 1` and merges missing sections against defaults | `src/config/migration-manager.ts`, `src/config/schemas/unified-config.ts` (`createEmptyUnifiedConfig`, `isUnifiedConfig`) | Direct pattern for the rebrand: Orca→aio-ade settings migration needs exactly this forward-compatible merge-with-defaults approach so downgrades don't nuke config | S | reimplement | must-have |
| 15 | Locked config writes | `proper-lockfile` around config mutation | dependency `proper-lockfile` ^4.1.2 | Target spawns many agents concurrently; if any of them touch shared account/profile state, an advisory lock avoids a corrupted JSON write. Cheap insurance | S | npm-dependency | nice-to-have |
| 16 | `ccs doctor` diagnostics | Health check across auth state, provider readiness, config validity | `src/commands/doctor-command.ts`; `src/auth/account-profile-diagnostics.ts` | An IDE-native "Diagnose agent setup" panel — the top support-cost reducer for a tool whose failures are all auth/path/env problems | M | reimplement | must-have |
| 17 | Live auth + provider health monitoring | Continuously surfaces token validity and provider reachability, watched via `chokidar` | `src/config/` loaders + `chokidar` watchers + dashboard over `ws` | Target has OAuth refresh but (per brief) no live health surface. Showing "account X token expires in 12m" before an agent dies mid-run is high value | M | reimplement | nice-to-have |
| 18 | Usage analytics per profile | Usage, cost, session tracking broken down by profile | dashboard views + `src/management/` | Target already tracks usage/rate limits — value is only the *per-profile/per-account* breakdown dimension and cost rollup | M | inspiration-only | nice-to-have |
| 19 | React dashboard with bcrypt-protected sessions | Web dashboard on :3000 for profiles, providers, quota, routing | `src/web-server/` (Express, `express-session`, `express-rate-limit`, `ws`), `ui/` (React 19-era + Vite 7 + Tailwind 4), `DashboardAuthConfig` bcrypt `password_hash` | aio-ade *is* the UI, so skip the server. But the dashboard's information architecture (accounts / providers / quota / routing tabs) is a ready-made spec for the settings screens | L | inspiration-only | skip |
| 20 | CLIProxyAPI OAuth broker | External Go proxy holding OAuth creds for Codex, Claude, xAI/Grok, Kiro, Kimi, Copilot; CCS drives + syncs it | `src/cliproxy/`, `CLIProxyConfig` (`backend: 'original'`, `providers`, `variants`, `auto_sync`), `.gitmodules`; default port 8317 | Adds a Go binary to ship and a network daemon to secure. Target only needs Claude + Codex and already owns their OAuth. Not worth it | XL | skip | skip |
| 21 | Managed WebSearch fallback | Provisions a WebSearch tool for CLIs that lack one, across 9 backends (DuckDuckGo default, Brave, Exa, Tavily, SearXNG, Gemini, Grok, agy, opencode) | `src/config/schemas/websearch.ts`; `docs/websearch.md` | Real gap-filler for Codex, which has no built-in web search. DuckDuckGo default means zero-key operation. Medium effort, clear user-visible win | M | inspiration-only | nice-to-have |
| 22 | Managed browser automation + image analysis provisioning | Injects browser-automation and vision tooling into third-party launches, with a tool policy | `src/config/schemas/browser.ts` (`BrowserToolPolicy`, `BrowserEvalMode`, `BrowserClaudeConfig`, `BrowserCodexConfig`), `ImageAnalysisConfig`; `docs/browser-automation.md` | Out of scope for a rebrand+strip release; the `BrowserToolPolicy` shape is worth a glance if aio-ade ever ships managed MCP tools | L | skip | skip |
| 23 | Shell completion + `ccs env` export | Generates shell completions; `eval "$(ccs proxy activate)"` exports the env for an external shell | `src/commands/shell-completion-command.ts`, `env-command.ts`, `proxy-command.ts` | Minor. Useful only if aio-ade keeps a CLI. Note the POSIX-only `eval` idiom — a Windows-first target needs a PowerShell path | S | inspiration-only | skip |
| 24 | macOS menu-bar quota app | Native menu bar showing subscription quota, daily spend, account controls | `macos-bar/`, `src/commands/bar/`; `ccs bar install` | Electron tray icon showing per-account quota is a nice touch, but the target is Windows-first. Concept only | M | inspiration-only | skip |
| 25 | Docker distribution | Whole thing as `ghcr.io/kaitranntt/ccs:latest` + compose (dashboard 3000, CLIProxy 8317) | `docker/`, `src/docker/`, `src/commands/docker*` | Irrelevant to a desktop Electron IDE | — | skip | skip |

## Reusable pointers

- `src/config/schemas/auth.ts` — the `AccountConfig` / `ProfileConfig` split. Smallest, highest-leverage file to copy the *design* of. ~110 lines, well-commented.
- `src/config/schemas/unified-config.ts` — `createEmptyUnifiedConfig()` + deliberately loose `isUnifiedConfig()`. Exact template for a forward-compatible versioned settings file during the Orca→aio-ade rename.
- `src/config/migration-manager.ts` — config version migration logic; pair with the above.
- `src/config/schemas/quota.ts` — quota mode/threshold data model for "auto-switch account when limit hit".
- `src/config/schemas/cliproxy.ts` — `CLIProxyRoutingConfig` (`round-robin` / `fill-first`, session affinity + TTL). Copy the *policy* shape, not the CLIProxy plumbing.
- `src/config/schemas/runtime.ts` — `OUTPUT_LIMITS_ENV_KEYS` / `buildOutputLimitsEnv()`. Literally liftable.
- `src/auth/shared-resource-policy.ts` — symlink/share policy for skills, agents, commands, plugins, `settings.json` across isolated `CLAUDE_CONFIG_DIR` dirs. Solves a problem the target's existing isolation creates.
- `src/auth/profile-continuity-inheritance.ts` + `resume-lane-diagnostics.ts` / `resume-lane-warning.ts` — cross-account session resume, plus how they warn the user when a resume lane is unsafe.
- `src/targets/target-adapter.ts` + `target-registry.ts` + `target-runtime-compatibility.ts` — clean 3-CLI adapter abstraction; good reference for the Claude+Codex-only rewrite.
- `src/codex-auth/` and `docs/codex-auth.md` — Codex-specific `CODEX_HOME` / `auth.json` / `config.toml` handling; useful cross-check against the target's existing implementation.
- `docs/openai-compatible-providers.md` — the provider preset catalog (base URLs, model names, quirks per gateway). Documentation value even if no code is taken.
- `src/config/schemas/websearch.ts` — 9-backend WebSearch config shape, DuckDuckGo keyless default.

## Integration risks

- **License**: MIT, clean. Copying files requires preserving the copyright line; add a third-party notices entry. No copyleft, no CLA problem. Note CCS itself vendors ideas from `claude-code-router` (also check that project's license before following its transformer design closely) and depends on external CLIProxyAPI (**GAP: CLIProxyAPI's own license unverified**).
- **Windows**: `os` field includes `win32` so the core works, but three things are POSIX-shaped: `eval "$(ccs proxy activate)"`, `ccs bar` (macOS only), and — critically — **`shared_resource_policy` symlinks**. On Windows, `fs.symlink` needs Developer Mode or admin rights; a Windows implementation must fall back to junctions (dirs only) or hardlinks/copies. Test this before committing to feature #10.
- **Security**: API keys and gateway tokens sit in plaintext `~/.ccs/*.settings.json`. Do NOT copy that at-rest model — the target already has Keychain integration and should extend it (plus DPAPI/`safeStorage` on Windows) to cover API-key profiles. Also note the shipped CLIProxy defaults `api_key: 'ccs-internal-managed'` / `management_secret: 'ccs'` are placeholder-grade; any bundled localhost proxy in an Electron app must bind 127.0.0.1 only and use a per-install random secret, or it becomes a local credential-exfil surface for any process on the machine.
- **Bundle size**: repo is ~45 MB and pulls Express, bcrypt (**native module — needs electron-rebuild per Electron ABI and per platform**), undici, ws, chokidar, js-yaml, smol-toml, plus a full React dashboard. Taking CCS as an npm dependency would drag a whole competing web server and UI into an Electron app that already has both. Cherry-pick source instead.
- **Install-script side effects**: `preinstall`/`postinstall`/`postuninstall` node scripts make it a poor candidate as a bundled dependency (would run during the target's own install and in CI).
- **Architectural mismatch**: CCS's `~/.ccs/config.yaml` is a global singleton owned by a CLI. The target is an Electron app with its own settings store and per-spawn env injection. Adopting CCS's file layout wholesale would create two competing sources of truth; better to adopt the *schema shape* inside the target's existing store. If interop with a user's real `ccs` install is ever wanted, that's a separate read-only importer.
- **Scope creep**: CCS has grown far past account switching — Copilot bridge, Cursor daemon, browser automation, image analysis, Docker, macOS bar, 9 WebSearch backends, delegation, channels. Copying its breadth would blow up a rebrand+strip release. Take features 1, 2, 3, 6, 7, 10, 14, 16 and stop.
- **Moving target**: 4,637 commits and a push yesterday. Any vendored file is an immediate fork with no upgrade path. Vendor only small, stable, schema-ish files.

## Verdict

**Mostly reimplement, with narrow vendor-code on two or three small files — do not take it as an npm dependency.** CCS is the real deal: 2.8k stars, ~4.6k commits, actively pushed yesterday, MIT, and it has clearly already solved the problem the user is describing. But it solves it as a *global CLI + web dashboard + Go OAuth proxy* stack, which is architecturally redundant with an Electron IDE that already owns per-account `CLAUDE_CONFIG_DIR`/`CODEX_HOME` injection, OAuth refresh, and Keychain storage. The genuinely new material is the **data model**: the crisp `accounts` (subscription, dir-isolated) vs `profiles` (API key + base URL, env-injected, settings in a hand-editable Claude-shaped file) split, layered `global_env`, versioned config with a deliberately tolerant migration guard, multi-upstream routing policy (`round-robin` / `fill-first` + session affinity), quota-triggered auto-switching, and `shared_resource_mode` symlinks that fix the skills/agents duplication that per-account isolation inevitably causes. Those are a few hundred lines of schema and policy in the target, not a dependency. Deliberately skip the CLIProxyAPI broker, the Docker/dashboard/web-server layer, and the Anthropic-compatible transform proxy for now — the last one is genuinely valuable but is XL-effort SSE-translation work that belongs in a later milestone (and if it ever happens, research `musistudio/claude-code-router` directly rather than CCS's wrapper).

## Gaps

- **GAP**: Exact byte contents of a real `~/.ccs/<name>.settings.json` not fetched. The example above is inferred from the schema comment plus Claude Code's known `env` block. Verify by reading `src/commands/api-command/` or `config/` presets before implementing.
- **GAP**: Did not read `src/targets/claude-adapter.ts` / `codex-adapter.ts` bodies, so the precise env-var set injected per target (`CLAUDE_CONFIG_DIR`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN` vs `ANTHROPIC_API_KEY`, `CODEX_HOME`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`) is not directly confirmed from source — only from the schema comments and README claims.
- **GAP**: `ANTHROPIC_AUTH_TOKEN` vs `ANTHROPIC_API_KEY` precedence handling unverified (matters for gateways that need the former).
- **GAP**: Whether accounts are physically stored at `~/.ccs/accounts/<name>/` and the exact dir layout — inferred, not seen. `config.yaml` stores metadata only.
- **GAP**: `DEFAULT_GLOBAL_ENV` contents (which env vars ship on by default) not read from `src/config/schemas/providers.ts`.
- **GAP**: Backup logic beyond migration — whether `ccs migrate` snapshots the old config before rewriting. Not verified.
- **GAP**: Windows symlink strategy in `shared-resource-policy.ts` — not read. This is the single most important gap for the target, since the dev machine is Windows 11.
- **GAP**: `src/delegation/`, `src/channels/`, `src/glmt/`, `src/dispatcher/`, `src/management/` purposes not investigated.
- **GAP**: CLIProxyAPI's license and whether it is a git submodule vs downloaded binary (`.gitmodules` exists but was not read).
- **GAP**: Stars/last-commit are confirmed via API, but no release cadence or open-issue-count check was done; issue #1251 (docker image rename) is the only issue seen.
- **GAP**: `src/proxy/` transform implementation depth — whether it handles tool-use blocks and thinking blocks correctly across the Anthropic↔OpenAI boundary. This determines whether feature #4 is realistically reusable at all.
