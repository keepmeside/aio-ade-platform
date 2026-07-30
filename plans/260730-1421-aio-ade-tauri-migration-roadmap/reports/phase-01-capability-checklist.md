---
phase: 1
title: "Aio-ADE platform capability checklist"
type: report
date: 2026-07-30
status: baseline-recorded-spikes-pending
scope: Rust/Tauri shell feasibility and release compatibility gates
---

# Phase 01 Capability Checklist

This is a gate artifact, not a support claim. `[LOCAL]` is observed in the
current Windows worktree; `[REPO]` is backed by tracked code, tests, CI, or
project docs; `[RESEARCH]` is from the Tauri/Rust options report. Anything in
Needs Spike remains unverified until the listed evidence exists.

## Observed Baseline

| Area | Evidence | Baseline interpretation |
| --- | --- | --- |
| Rust/Tauri | `[LOCAL]` Windows 11, Node 24.12.0, pnpm 10.24.0, and Git 2.52.0.windows.1; `rustc` and `cargo` are not on `PATH`. `[REPO]` no tracked `Cargo.toml`, `Cargo.lock`, or Tauri config; `package.json` remains Electron 43/electron-builder. | Tauri/Rust bootstrap is not present locally. Per `phase-01-baseline-and-contracts.md`, this is a bootstrap gap, not an architecture failure. |
| Runtime ownership | `[REPO]` `architecture.md` and `tauri-rust-runtime-options-report.md` keep Node/TypeScript (`node-pty`, `ssh2`, headless xterm) as first-cutover PTY/SSH authority; Rust replacement is conditional on parity. | Do not run Rust and Node as concurrent owners of one PTY, session, or credential. |
| WebView2/WKWebView/WebKitGTK | `[RESEARCH]` Tauri uses WebView2 on Windows and OS WebKit on macOS/Linux. `[REPO]` current Electron oracle runs on Chromium; no Tauri WebView artifact or cross-WebView fixture is present. | Existing Electron rendering evidence does not establish WebView2, WKWebView, or WebKitGTK support. |
| Signing/notarization | `[REPO]` macOS release workflow verifies `CSC_*`/Apple notarization credentials and invokes the signed release builder. Windows SignPath rehearsal signs inner PE/native files before NSIS, then verifies the installer. | Signing flow is proven for the Electron artifact path only. It does not cover a Tauri executable, sidecar, or updater artifact. |
| Linux glibc 2.31 | `[REPO]` `docs/reference/linux-glibc-compatibility.md` defines the Ubuntu 20.04/glibc 2.31 floor; Electron `afterPack` runs `verify-linux-glibc-floor.cjs`, with a node-pty symbol-compatibility patch. | The floor is an existing packaging contract, not evidence that Rust/Tauri or a new sidecar meets it. |
| SSH, WSL, folder workspaces | `[REPO]` SSH config/agent behavior, WSL relay behavior, and folder-workspace identity/path tests exist. WSL live evidence proves Claude flow; the Codex done/Stop leg remains unproven in `docs/agent-status-over-wsl.md`. | These are existing behavior contracts with a known WSL evidence gap; no Tauri shell parity is established. |
| Git 2.25 | `[REPO]` `docs/reference/git-compatibility.md` makes Git 2.25 the host-binary baseline. CI exercises real Git 2.25.5, 2.38.1, and 2.49.1 with host-scoped capability fallback/cache rules. | The contract is established for the current runtime. A Tauri path must continue to invoke the executing host's Git binary and preserve fallbacks. |

## Needs Spike

- [ ] **Rust/Tauri bootstrap** `[UNVERIFIED]`: pin a reproducible Rust toolchain; boot a minimal Tauri v2 shell in dev and packaged modes; verify capability ACL denial and target-triple sidecar launch. Do not infer support from crate availability.
- [ ] **WebView matrix** `[UNVERIFIED]`: run the existing xterm ANSI/OSC, invalid-byte, Unicode, IME, clipboard, resize, drag/drop, font, WebGL-fallback, and shortcut fixtures on Windows WebView2, macOS WKWebView (Intel/Apple Silicon), and Linux WebKitGTK across supported X11/Wayland environments.
- [ ] **Sidecar protocol** `[UNVERIFIED]`: package, sign, launch, crash-restart, shut down, and version-negotiate the Node sidecar; prove framed binary PTY/SSH bytes, backpressure, reconnect/history replay, and single-owner/incarnation rejection.
- [ ] **Code signing and notarization** `[UNVERIFIED]`: exercise Tauri signing for the app, installer, target-specific sidecars, and native modules; exercise macOS hardened runtime/notarization and Windows SignPath inner-binary ordering; verify updater signatures and rollback on every release artifact.
- [ ] **Linux floor** `[UNVERIFIED]`: build Rust, Node native addons, and C/C++ dependencies against glibc 2.31/libstdc++ `GLIBCXX_3.4.28`; run the static gate plus a real Ubuntu 20.04 x64/arm64 load-and-spawn smoke test for packaged binaries.
- [ ] **SSH/WSL/folder-workspace matrix** `[UNVERIFIED]`: replay PTY, SFTP, agent, forwarding, reconnect, path, shell, and socket fixtures for native local, folder workspace, WSL, and SSH hosts. Include a credentialed WSL rig to close the Codex done/Stop evidence gap.
- [ ] **Git compatibility** `[UNVERIFIED]`: run the Tauri/sidecar route against native, WSL, and SSH Git binaries at 2.25.5 and newer; prove the first fallback, cached rejection, concurrent probe coalescing, and host isolation for every new command or option.

## Release Blockers

The Tauri release remains blocked until each item has repeatable CI or signed-artifact evidence. A passing Electron oracle does not waive these gates.

- [ ] Rust/Tauri shell and sidecar build reproducibly for Windows x64/ARM64, macOS x64/ARM64, and Linux targets with least-privilege capabilities.
- [ ] WebView2, WKWebView, and WebKitGTK pass the renderer/terminal fixture matrix, including a usable non-WebGL fallback.
- [ ] Every shipped executable, nested helper, native module, installer, and updater artifact is signed; macOS artifacts are notarized and verification succeeds after installation/update.
- [ ] Linux packages pass the glibc 2.31 static gate and packaged Ubuntu 20.04 x64/arm64 runtime smoke; no newer-host native binary is copied into release output.
- [ ] SSH, WSL, folder-workspace, and remote/folder path behavior preserves the existing host-aware ownership and reconnect contracts without local-secret forwarding.
- [ ] Git commands remain Git 2.25-compatible with behavior-probed fallbacks and capability state scoped to the native, WSL distro, SSH provider, or relay host that executes them.

## References

- `../phase-01-baseline-and-contracts.md`
- `../architecture.md`
- `tauri-rust-runtime-options-report.md`
- `../../../docs/reference/git-compatibility.md`
- `../../../docs/reference/linux-glibc-compatibility.md`
- `../../../docs/ssh-config-target-compatibility.md`
- `../../../docs/agent-status-over-wsl.md`
- `../../../docs/reference/plans/2026-07-27-ssh-reconnect-fanout.md`
- `../../../.github/workflows/release-mac-build.yml`
- `../../../.github/workflows/windows-signing-rehearsal.yml`

## Unresolved Questions

- Which exact Linux WebKitGTK/desktop baseline is supported for the first Tauri release?
- What is the production sidecar signing order and artifact layout for each target?
- Which Rust toolchain version and CI image provide the required glibc floor?
- Which credentialed WSL rig will close the remaining Codex completion evidence?

Status: DONE_WITH_CONCERNS
Summary: Existing Electron contracts are recorded with evidence labels; Tauri/WebView, sidecar, signing, and cross-host parity remain explicit spikes and release gates.
Concerns/Blockers: No Rust/Tauri manifest exists yet; current WebView and Tauri artifact support must not be inferred from Electron results.
