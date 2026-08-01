---
date: 2026-08-01
session: phase-03-product-cli-orchestration-removal
---

# Journal: 2026-08-01 - Phase 03 CLI and orchestration removal

## Context

Phase 03 completed the product-surface deletion required by the migration roadmap while preserving the generic desktop and remote runtime needed by later phases.

## What Happened

- Removed product CLI trees, Agent Teams, orchestration bridge, headless `serve`, installers, shims, mobile-facing CLI surfaces, and related skill/CTA/package-global references.
- Kept generic PTY/xterm and headless-emulator behavior, local/SSH/WSL providers, remote runtime, file/editor operations, and native Computer Use and Linear runtime contracts.
- Added platform-specific legacy cleanup for macOS/Linux and Windows/WSL, including startup retry handling, without installing a new `orca` alias or shadowing the Linux `orca` command.
- Treated the root manifest and lockfile as Phase 03 stewardship so later phases submit versioned dependency/script requests instead of editing them concurrently.

## Reflection

The deletion stayed contract-driven: product orchestration and control surfaces were removed, while PTY/SSH/file behavior remained the runtime boundary for the strangler migration. Cleanup is intentionally release-window based so existing installs can remove legacy artifacts without creating a replacement CLI surface.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Remove product CLI, orchestration, Agent Teams, and mobile-facing CLI surfaces | They are outside the retained desktop runtime and Tauri migration target | No product command, installer, worker prompt, or `serve` path remains |
| Preserve generic PTY/SSH/WSL/remote runtime contracts | These behaviors remain required by the desktop baseline and future sidecar/Tauri parity work | Later phases consume named runtime modules rather than CLI namespaces |
| Keep legacy uninstall cleanup for one release window | Existing PATH/symlink/shim artifacts need safe removal after upgrade | Cleanup runs per platform with retry/marker behavior; no new alias is installed |
| Keep Phase 03 as root-manifest steward | Package scripts, lockfile, reliability gates, and mobile/CLI references cross phase boundaries | Later phases send versioned change requests instead of editing shared manifests directly |

## Verification

- `pnpm typecheck`: pass.
- `pnpm lint` plus reliability, max-lines, and localization gates: pass; 46 reliability gates and 323 grandfathered suppressions, with no new bypass.
- `pnpm build:desktop`: pass for relay, Electron/Vite, and projected web client builds.
- Focused reviewer suites: 18 files, 195 passed, 5 skipped; cleanup/worktree focused tests: 231 passed.
- `git diff --check`: pass.

## Residual Risks

- Baseline Windows `git init //./nul` failure remains at `src/main/skills/skill-git-tree-identity.test.ts:54`.
- Full release roundtrip is not verified because tag `v1.4.151-rc.2` is not local.
- Advisory risks remain around stale lineage before a fresh scan, macOS privilege denial prompting again, stale Windows PATH entries, and content-based Linux bare-dispatcher markers.

## Next Steps

- Phase 04 consumes the retained runtime and reduces providers to the approved Claude/Codex roster.
- Revisit the listed residual risks if cleanup scope, packaging, or release behavior changes.

## Unresolved Questions

- None blocking Phase 03; residual risks remain recorded for later review.
