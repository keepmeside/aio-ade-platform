# Deferred-verification tracking list (phase 01)

Generated 2026-08-22. Phase 01 requires marking every acceptance criterion that **cannot** be
verified locally, so no phase ticks a multi-OS box on the evidence of one Linux box.

## Why this list exists

Phases 01-05 have no CI: the repo is private and Actions is billing-blocked. The flip to public is
phase 08, and the real 3-OS matrix runs at **phase 12**. Local verification on this host covers
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build:desktop` on **Ubuntu 22.04 x86_64, Node
24.19.0, git 2.34.1** — and nothing else.

Rule adopted: a criterion below **must not be checked off** during its own phase. It is checked at
the venue named in "verified instead".

## Deferred criteria

| # | Phase | Criterion (source) | Why not local | Verified instead | Blocking for |
|---|---|---|---|---|---|
| D1 | 03 | "`pnpm build:desktop` và packaged smoke không tham chiếu binary cũ" (phase-03 §Success) | Packaged smoke needs a real installed app per OS; this box builds Linux only | Phase 12 CI matrix | phase 05 rename correctness |
| D2 | 03 | "Chỉ có một binary `aio-ade` trong PATH sau install; không có `orca` hay `orca-ide`. Uninstall xoá được shim cũ" (phase-03 §Success) | PATH install/uninstall differs per OS: Windows has three independent shims, macOS/Linux use symlinks | Phase 12 | the no-alias decision |
| D3 | 03 | "PATH/uninstall migration tests cover Windows shims, macOS/Linux links, WSL và SSH host" (phase-03 §Success, already marked deferred) | Four execution hosts; this box has only native Linux. No WSL, no second SSH host | Phase 12 | phase 05 |
| D4 | 05 | "New install shows **AIO-ADE** (display) và artifacts là `aio-ade-*`" (phase-05 §Success) | Artifact naming is per-target in `config/electron-builder.config.cjs` (nsis/dmg/deb/rpm/AppImage); only Linux targets build here | Phase 12 | phase 08 flip |
| D5 | 05 | "macOS/Windows/Linux build metadata agree on one product identity; chỉ có stable channel" (phase-05 §Success) | Needs all three packagers to run | Phase 12 | release |
| D6 | 05 | Gatekeeper/SmartScreen bypass instructions are correct (phase-05 §Success, unsigned decision) | Requires a real macOS and Windows machine to confirm the warning text and the `xattr` workaround | Owner action on real hardware, post-phase-12 | first release |
| D7 | 05/release | Signing + notarization | **No certificate purchased** (2026-08-21 decision: ship unsigned) | After cert purchase; owner-held credentials | auto-update |
| D8 | 05/release | Auto-update | Decided OFF for the first release; must stay off until signed and verified on 3 OS | After D7 | — |
| D9 | 08 | "Owner là người flip visibility; `gh repo view --json visibility` = PUBLIC" | Agent must not flip visibility; the authenticated accounts have WRITE, not ADMIN | Owner action | phase 12 |
| D10 | 08 | "GitHub Pages URL trả HTTP 200" | Pages + Actions are billing-blocked while private; Pages create API returns 404 | Owner action after flip | phase 12 |
| D11 | 08 | Workflow/self-hosted-runner audit under fork-PR conditions | Fork-PR behavior only observable once public | Phase 12 | — |
| D12 | 02 | "`Test-Path mobile` false" (phase-02 §Success) | The literal check is PowerShell; the *intent* (tree gone, no scripts/workflows reference it) **is** locally verifiable | **Locally verifiable** — restate as a portable check rather than deferring | — |
| D13 | 07 | Excalidraw "package network-off smoke" and SSH-host canvas file IO (phase-07 §Implementation) | Needs a second host for the SSH path; network-off smoke is local | Partially local; SSH part at phase 12 | phase 07 tranche close |
| D14 | 06 | "WSL distro isolation" tests (phase-06 §Success) | No WSL on Linux — this is Windows-only infrastructure | Phase 12 (Windows runner) | phase 06 close |
| D15 | 06 | SSH secret provisioning options (forward vs remote vault) | Needs a real remote host to prove the `/proc/*/environ` exposure warning is accurate | Phase 12 or a dedicated test host | phase 06 close |
| D16 | 09 | "packaged smoke" in the full-verify step (phase-09 §Implementation) | Same as D1 | Phase 12 | phase 09 close |
| D17 | 11 | Tauri spike metrics: bundle size, RAM, startup, render on 3 OS | The go/no-go gate compares against Electron on each OS | Phase 12 CI + owner hardware | phase 11 verdict |
| D18 | 05 | Homebrew cask rename (`Casks/orca.rb`, `Casks/orca@rc.rb`) | Cask install verification needs macOS; also the RC cask must disappear with the stable-only decision | Phase 12 / owner macOS | release |
| D19 | 12 | Git binary compatibility matrix (2.25.5 / 2.38.1 / 2.49.1) | Needs docker images plus a source build; **docker is available on this box**, so this is *not* strictly deferred | **Locally runnable** — see below | phases touching git |

## Two items that are NOT actually deferred

Worth correcting, because deferring something verifiable weakens the list:

- **D12** — the phase-02 criterion is written as a PowerShell `Test-Path`. The underlying intent
  (tree deleted, no script/workflow/gate references a missing path) is fully checkable here via
  `pnpm lint` plus a grep sweep. Recommend rewriting the criterion portably instead of deferring it.
- **D19** — `src/shared/git-binary-compatibility.test.ts` is gated on `ORCA_GIT_COMPAT_IMAGE` /
  `ORCA_GIT_COMPAT_BINARY`. Docker is installed on this host, so the 2.38.1 and 2.49.1 legs can run
  locally today, and the 2.25.5 leg only needs a source build. This matters because this host's git
  is **2.34.1**, below the `worktree list -z` boundary at 2.36 — it naturally exercises the
  compatibility fallback that a modern-git dev machine never reaches.

## Tooling status on this host

Recorded so later phases do not re-diagnose a missing tool as a code failure.

| Tool | Status |
|---|---|
| Node | 24.19.0 via nvm — **must** be on PATH; the box default is 25.9.0, which breaks 41 renderer tests |
| pnpm | 10.24.0 (only installed under the Node 25 prefix; invoke vitest directly under Node 24) |
| git | 2.34.1 — below the 2.36 `-z` boundary |
| gitleaks | 8.30.1, checksum-verified |
| docker | present (enables D19) |
| cargo | present (needed by phase 11 Tauri spike) |
| gh | authed as `SalyyS1` and `keepmeside`, scopes `gist, read:org, repo, workflow` — **no `admin:repo_hook`, no ADMIN**, which is exactly why D9/D10 are owner actions |
| Xvfb / packaged AppImage smoke | not verified |
| macOS / Windows / WSL | unavailable |
