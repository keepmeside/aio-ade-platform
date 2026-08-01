# Codebase Summary

## Current Shape

The application remains an Electron desktop baseline with a React renderer and
Node main/runtime services. Phase 03 removed the product CLI and orchestration
surface; `src/cli`, main CLI services, Agent Teams, orchestration bridge,
headless `serve`, installers, and shims are no longer part of the product.

## Retained Runtime

The desktop runtime still owns generic terminal and remote-workspace behavior:

- PTY and xterm/headless terminal emulation, including snapshot/serialization.
- Local, daemon, SSH, and WSL providers plus remote runtime/file editing.
- Native Computer Use and Linear runtime integrations.
- External agents continue to run through the generic terminal/runtime path;
  product orchestration is not replaced with a fake Electron IPC command.

Phase 03 also removed obsolete mobile/CLI manifest and package references and
kept platform-specific legacy CLI cleanup for existing installations.

## Verification and Follow-up

The Phase 03 report records passing typecheck, lint/reliability/localization
gates, desktop build, focused reviewer suites, cleanup/worktree tests, and
`git diff --check`. Known baseline and release-roundtrip limitations remain
documented in that report.

Phase 04 (provider reduction to Claude and Codex while retaining Fable) is
pending. Tauri/Rust feasibility and later migration phases are not implemented
in this summary.

See the [roadmap](./project-roadmap.md), [Phase 03 plan](../plans/260730-1421-aio-ade-tauri-migration-roadmap/phase-03-delete-product-cli-and-orchestration.md),
and [Phase 03 report](../plans/260730-1421-aio-ade-tauri-migration-roadmap/reports/phase-03-product-cli-orchestration-removal.md).
