# System Architecture

## Current Electron Baseline

The current product is still an Electron desktop application. The React
renderer communicates with Node main/runtime services for terminal sessions,
workspace files, and remote providers. Electron remains the migration oracle;
Tauri is a later target, not an active shell in Phase 03.

## Runtime Boundary

The retained boundary is the generic runtime rather than a product CLI:

- Main/runtime services own PTY lifecycle, xterm/headless emulation, snapshots,
  and serialized restore behavior.
- Local, daemon, SSH, and WSL providers support terminal and remote workspace
  operations, including file editing.
- External CLI agents execute in generic PTY sessions; there is no product CLI,
  orchestration bridge, Agent Teams command, or headless `serve` endpoint.
- Native Computer Use and Linear runtime remain available as app integrations.

CLI installers, shims, and related PATH mutation surfaces were removed. Legacy
cleanup is retained only to remove artifacts from previous installations, with
platform-specific handling for macOS/Linux and Windows/WSL.

## Migration Boundary

Phase 03 is complete. Phase 04 remains pending and will reduce the provider
roster to Claude and Codex while retaining Fable. Tauri feasibility, Rust
control-plane candidates, the Node sidecar, bridge/parity work, secure profiles,
and final release cutover belong to later phases and must not be inferred from
the current Electron architecture.

References: [Phase 03 plan](../plans/260730-1421-aio-ade-tauri-migration-roadmap/phase-03-delete-product-cli-and-orchestration.md),
[completion report](../plans/260730-1421-aio-ade-tauri-migration-roadmap/reports/phase-03-product-cli-orchestration-removal.md).
