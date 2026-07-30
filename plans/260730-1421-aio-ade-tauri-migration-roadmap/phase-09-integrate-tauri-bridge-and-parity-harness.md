---
phase: 9
title: "Tích hợp Tauri bridge và parity harness"
status: pending
priority: P1
effort: "2-3 tuần"
dependencies: [7, 8]
---

# Phase 09: Tích hợp Tauri bridge và parity harness

## Overview

Join Rust control plane candidate và production Node sidecar vào Tauri v2 shell. Renderer dùng một runtime adapter chung; Electron vẫn baseline và runtime switch fail-closed cho tới phase 12.

## Requirements

- Tauri invoke cho typed control; events/channels cho bounded lifecycle/progress; stdio framed sidecar cho PTY/SSH bytes.
- Node sidecar là default authority. Rust PTY/SSH chỉ selectable trong test/candidate mode nếu phase-07 gate pass.
- Capability ACL tối thiểu, sidecar target-triple, protocol negotiation, crash recovery, stale-incarnation rejection.
- Renderer React/xterm không biết provider/model; Fable same raw path.
- Không REST/Axum, không git2, không Electron removal.

## Architecture và ownership

- Exclusive: production `src-tauri/**` bridge/supervisor/capabilities, renderer Tauri runtime adapter, cross-runtime parity/e2e harness.
- Read-only: sidecar implementation (08), Rust candidate (07), profiles (10), canvas (11).
- Conflict: phase 09 is only join owner; it may adapt consumers but cannot rewrite candidate implementations during merge.

## Related Code Files

- Create: Tauri app manifest/capabilities/commands/supervisor, renderer runtime adapter, feature flags and parity reports.
- Modify: renderer bootstrap/API abstraction; Electron adapter remains side-by-side.
- Test: Electron-vs-Tauri byte/snapshot/lifecycle/SSH/renderer matrix.

## Tests Before

- Contract tests from phase 06 run against Node sidecar and Rust candidates independently.
- Capture Electron packaged oracle for local/folder/WSL/SSH, Claude/Codex/Fable, Git 2.25 fallbacks.
- Add capability-denial and hostile/malformed sidecar tests.

## Refactor

1. Build Tauri supervisor and least-privilege commands/capabilities.
2. Connect Node sidecar handshake/control/byte streams; keep one authority per session.
3. Add renderer adapter selecting Electron/Tauri without changing xterm components.
4. Integrate optional Rust control plane; Rust PTY/SSH candidate remains off unless gate green.
5. Add automated parity dashboard/report and deterministic failure classification.

## Tests After

- Tauri Node-sidecar path matches Electron oracle for bytes, snapshots, resize, exit, reconnect, SSH/SFTP/forwarding and renderer behavior.
- Sidecar crash/restart and WebView reload preserve process/history authority.
- Capability system denies undeclared command/path/sidecar args.

## Regression Gate

`pnpm typecheck && pnpm test && pnpm lint && pnpm build:desktop`, Rust gates, Electron/Tauri Playwright parity, packaged Tauri smoke on Windows/macOS/Linux, WSL/SSH integration and Linux glibc 2.31 check.

## Security, risks và rollback

- Risk: Tauri events accidentally carry bytes, dual authority or WebView regressions. Mitigation: architecture assertions and protocol-level tests.
- Security: CSP/navigation guards, capability allowlist, frame validation, no arbitrary shell/fs/network listener.
- Rollback: default feature flag stays Electron; Tauri package not promoted.

## Success Criteria

- [ ] Tauri + Node sidecar reaches quantified Electron parity on required matrix.
- [ ] Rust candidate selection is fail-closed and never shares PTY/SSH authority.
- [ ] React/xterm/Fable behavior unchanged across shell adapters.
- [ ] Electron remains release baseline until final gate.
