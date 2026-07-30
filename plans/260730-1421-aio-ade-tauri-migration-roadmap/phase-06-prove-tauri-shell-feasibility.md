---
phase: 6
title: "Chứng minh Tauri shell và đóng băng runtime contracts"
status: pending
priority: P1
effort: "4-7 ngày"
dependencies: [5]
---

# Phase 06: Chứng minh Tauri shell và đóng băng runtime contracts

## Overview

Dựng spike Tauri v2 riêng, bootstrap Rust/platform prerequisites, chạy React 19/xterm.js trong WebView và đóng băng protocol/oracle trước khi phase 07/08 chạy song song. Electron vẫn production baseline.

## Requirements

- Baseline local: Node `24.12.0`, pnpm `10.24.0`, Git `2.52.0.windows.1`; Git behavior vẫn target 2.25.
- `rustc`/`cargo` chưa có PATH: document/install supported Rust stable + Windows MSVC/WebView2, macOS Xcode, Linux WebKitGTK/GTK prerequisites; verify targets, không coi missing toolchain là no-go.
- Tauri spike loads existing Vite/React renderer; capability ACL denies unauthorized command.
- Freeze versioned runtime contract, authority/incarnation/sequence/backpressure/error semantics và Electron oracle fixtures.
- Inventory Electron-only browser/CDP/offscreen/emulator surfaces and classify each as Tauri replacement, external-browser fallback, or explicit post-cutover blocker; do not silently remove user-visible behavior.
- Probe Tauri/Rust credential-store identity and failure semantics against Electron `safeStorage` before any persistence ownership moves.
- No production Axum/REST, no git2, no shell cutover.

## Architecture và ownership

- Exclusive: isolated Tauri feasibility spike, shared runtime contract/types/fixtures, Electron oracle adapter.
- Phase 07/08 chỉ consume frozen contract; changes require phase-06 contract version bump approved before parallel work.
- Production Tauri app/capabilities remain phase 09 ownership.

## Related Code Files

- Create: `spikes/tauri-shell/**`, `src/shared/runtime-contracts/**`, parity fixtures/tests.
- Read: renderer entry/Vite config, preload APIs, daemon/PTY/SSH interfaces, release config.
- Do not modify: production Electron entry or Tauri production manifest.

## Tests Before

- Run Electron oracle for xterm/IME/clipboard/drag-drop/WebGL fallback and PTY/SSH lifecycle.
- Add protocol schema tests: version negotiation, stale incarnation, ordering, bounded sizes, typed errors.
- Record host matrix for local git, folder workspace, WSL, SSH and Git 2.25 command fallbacks.

## Refactor

1. Bootstrap Rust stable and target prerequisites in developer/CI instructions; verify `cargo`/`rustc`/linker only.
2. Scaffold isolated Tauri v2 spike with no-op commands and least-privilege capability.
3. Render existing React/xterm shell; test focus, shortcuts, fonts, clipboard, WebGL fallback.
4. Freeze protocol/oracle contracts and define feature flags/rollback ownership.

## Tests After

- Tauri spike boots dev/package on available Windows; scheduled macOS/Linux runners validate WKWebView/WebKitGTK.
- Unauthorized command/sidecar arg denied; no remote server/port opened.
- Oracle/contract fixtures deterministic across Electron and spike boundary.
- Browser/CDP/emulator classification and secure-store compatibility report are attached to the gate; unresolved P1 items block Electron removal.

## Regression Gate

Existing Node gates plus `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` for spike after bootstrap. Failing platform prerequisite blocks that runner only; Electron baseline remains green.

## Security, risks và rollback

- Risk: WebView differences misread as runtime failure. Separate renderer/WebView gate from PTY/sidecar gate.
- Security: minimal capability, no arbitrary shell/fs, CSP/navigation guards, no network listener.
- Rollback: delete isolated spike/contract version; product still Electron.

## Success Criteria

- [ ] Rust/toolchain/platform prerequisites reproducible and documented.
- [ ] Existing React/xterm runs in Tauri spike without product cutover.
- [ ] Frozen protocol/oracle supports parallel 07/08 with no shared-file edits.
- [ ] Electron stays default and all no-go assumptions are recorded.
