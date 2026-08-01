# Project Roadmap

This roadmap tracks the strangler migration from the Electron baseline toward a
future Tauri shell. The migration is intentionally incremental: Electron remains
the runtime baseline until later parity gates pass.

## Phase Status

| Phase | Scope | Status |
| --- | --- | --- |
| 01 | Baseline and runtime contracts | Completed |
| 02 | Remove mobile/web companion | Completed |
| 03 | Remove product CLI and orchestration | Completed |
| 04 | Reduce providers to Claude and Codex; retain Fable | Pending |
| 05-12 | Rebrand, Tauri feasibility/bridge, sidecar, profiles, approved features, cutover | Pending |

## Phase 03 Completed

Removed the product CLI, Agent Teams, orchestration bridge, headless `serve`,
installers, and shims. The generic runtime remains: PTY/xterm and headless
emulation, local/SSH/WSL providers, remote runtime, file/editor operations, and
native Computer Use and Linear runtime. Legacy cleanup remains platform-aware;
no replacement CLI alias was added.

Verification for this phase passed typecheck, lint/reliability/localization
gates, desktop build, focused reviewer suites, cleanup/worktree tests, and
`git diff --check`. See the [Phase 03 plan](../plans/260730-1421-aio-ade-tauri-migration-roadmap/phase-03-delete-product-cli-and-orchestration.md)
and [completion report](../plans/260730-1421-aio-ade-tauri-migration-roadmap/reports/phase-03-product-cli-orchestration-removal.md).

## Next

Phase 04 is pending. Tauri feasibility, Rust/sidecar work, bridge integration,
account/profile work, approved feature integration, and final cutover remain
future phases; no Tauri cutover is implied by Phase 03.
