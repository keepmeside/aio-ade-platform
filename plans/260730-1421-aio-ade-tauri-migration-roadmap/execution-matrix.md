# Execution matrix

## Dependency schedule

| Wave | Phase | Depends on | Parallel rule | Join gate |
|---|---:|---|---|---|
| 0 | 01 | — | sequential | baseline + toolchain decision |
| 1 | 02 | 01 | sequential | mobile deletion inventory |
| 2 | 03 | 02 | sequential | CLI/orchestration no ghosts |
| 3 | 04 | 03 | sequential | Claude/Codex roster + Fable parity |
| 4 | 05 | 04 | sequential | identity/legacy migration |
| 5 | 06 | 05 | sequential | Electron oracle + contracts |
| 6 | 07 | 06 | parallel with 08 | Rust candidate evidence |
| 6 | 08 | 06 | parallel with 07 | Node sidecar protocol |
| 7 | 09 | 07,08 | join; no cutover before both reports | Tauri bridge + parity |
| 8 | 10 | 09 | parallel with 11 | secure profile gates |
| 8 | 11 | 09 | parallel with 10 | Excalidraw gates |
| 9 | 12 | 10,11 | final join | cutover/release decision |

## Exclusive file ownership

| Phase | Exclusive ownership | Không được sửa |
|---:|---|---|
| 01 | baseline scripts, gate snapshots, migration fixtures, plan reports | product behavior |
| 02 | `mobile/`, mobile lockfile/assets/workflows/docs | package-wide CLI/manifest cleanup |
| 03 | `src/cli/`, CLI service/orchestration/Agent Teams/shims, package/build gate manifests | roster/rebrand/profile code |
| 04 | agent union/config/catalog/assets/locales/tests | identity strings outside agent scope |
| 05 | product identity, migration readers, plugin/wire compatibility, user-facing brand docs | runtime/profile implementation |
| 06 | host/runtime contract types, Electron oracle adapters, protocol test fixtures | Rust/sidecar implementation |
| 07 | `src-tauri/src/runtime/pty/**`, Rust PTY/process candidate, Rust tests | Node sidecar/protocol schema |
| 08 | `src/sidecar/**`, JSON-RPC/framing schema, sidecar packaging tests | Rust runtime and Tauri commands |
| 09 | Tauri bridge/capabilities, supervisor, renderer runtime adapter, parity harness | account/profile and canvas feature code |
| 10 | account/API profile/vault/import UI+services/tests | Tauri shell and canvas files |
| 11 | Excalidraw viewer/file serializer/export/context UI/tests | profile/bridge/runtime files |
| 12 | release configs, docs, inert telemetry/updater guards, cutover scripts | prior phase source ownership |

Shared `package.json`, lockfiles and global CI gates are owned by Phase 03 as a manifest steward for the whole roadmap: Phase 03 removes mobile/CLI entries, while later phases submit versioned dependency/script/metadata requests for the steward to apply. Phase 12 owns release-only files and requests any root manifest release fields through the same steward. If a phase needs another phase's file, it submits a contract/test change request instead of editing it.

## Conflict prevention

1. Before each phase, verify clean ownership with `git diff --name-only` and the table above.
2. Parallel phases may add only under their exclusive roots; shared protocol changes require a versioned contract PR owned by Phase 08.
3. Join phase rebases both branches, runs conflict-aware merge tests and preserves the earlier phase's tests; never use destructive reset.
4. A failed gate leaves Electron/Node authority active and rolls back only the phase branch/feature flag.

## Test matrix

| Layer | Before | After | Required platforms |
|---|---|---|---|
| Unit/schema | existing fixtures and migration snapshots | new contract/error/redaction cases | Node + Rust host |
| Renderer | xterm/React interaction and accessibility | Tauri WebView parity, Excalidraw keyboard/AT | Win WebView2, macOS WKWebView, Linux WebKitGTK |
| Runtime | PTY/SSH/WSL snapshots, OSC, resize, paste | sidecar/Rust sequence/backpressure/reconnect | local, folder, WSL, SSH |
| Integration | Electron packaged smoke/build | Tauri package, sidecar signing/capability denial | Win x64/ARM64, macOS x64/ARM64, Linux glibc 2.31 |
| Release | inert workflow assertions | cutover only after signed-artifact gates | no upstream telemetry/feed |

## Required commands by gate

Focused Vitest/Playwright first; then `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build:desktop`. Tauri phases additionally run `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` and packaged smoke only after toolchain bootstrap. Full release checks remain inert until Phase 12 capability blockers clear.
