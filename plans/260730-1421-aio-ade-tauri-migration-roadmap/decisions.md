# Decision log: aio-ade Tauri migration

Ngày khóa: 2026-07-30. Authors: Keepmeside, SalyyS1.

| Gate | Quyết định | Lý do/giới hạn | Rollback trigger |
|---|---|---|---|
| Brand | `aio-ade` viết thường là display/package/binary; giữ alias Orca chỉ ở compatibility boundary | tránh mất auth/workspace/plugin cũ | migration làm mất dữ liệu hoặc artifact identity |
| Agents | Chỉ `claude` và `codex`; Fable là model Claude `--model fable` trong transport model-blind | giảm roster nhưng không tạo Fable renderer riêng | picker/session/PTY parity fail |
| Delete | Xóa `mobile/`, `src/cli/`, Agent Teams, orchestration bridge, headless `serve`, installer/shim | user-approved scope; giữ generic PTY/SSH/file runtime | desktop/SSH/WSL behavior bị mất |
| Shell | Tauri v2 strangler; Electron baseline đến phase 12 | tránh big-bang; có oracle để so sánh | bất kỳ parity/release gate P1 fail |
| Runtime | Node/TypeScript sidecar production đầu; Rust chỉ candidate sau parity | node-pty/ssh2 đã proven, Rust thay thế là hai failure domains | byte/lifecycle/SSH gate fail |
| IPC | Tauri invoke/events/channels cho control; stdio JSON-RPC framed cho PTY/SSH bytes | events không phù hợp high-throughput; không thêm Axum/REST | protocol loss/reorder/backpressure |
| Terminal | Giữ React 19, xterm.js, headless emulator, snapshots, OSC, Kitty, paste, resize | WebView/terminal behavior là public contract | cross-platform fixture mismatch |
| Profiles | `accounts` cho OAuth/subscription; `profiles` cho API key/base URL/model; vault encrypted | không nhập plaintext CCS runtime | secret leak/corrupt recovery |
| CCS | Import read-only, one-way, version-pinned, dry-run, redacted; không chạy CCS | lấy schema/policy, không thêm runtime dependency | import ghi ngược hoặc lộ secret |
| SSH secrets | Không forward secret local sang SSH; remote vault/provisioning là tranche sau | host boundary là security invariant | secret xuất hiện ở remote env/log |
| Canvas | Excalidraw MIT duy nhất; tldraw excluded; XYFlow deferred | license-safe, giảm bundle/runtime duplication | offline/SSH/a11y/bundle gate fail |
| Build tools | ScriptC/Bun deferred; Node TypeScript sidecar | tránh thêm toolchain ngoài scope | sidecar cần Bun-specific behavior |
| Git | Dùng Git binary host và compatibility fallbacks; không git2 phase đầu | Git 2.25 là baseline; remote/WSL khác version | command mismatch hoặc lost host behavior |
| Secrets | safeStorage/OS keyring + encrypted fallback có explicit consent; không plaintext fallback | giữ secure-file/ACL/atomic writes | no-keyring path silently downgrades |
| Telemetry | Disabled/inert mặc định; chỉ bật khi fork-owned endpoint/privacy/redaction tests tồn tại | không gửi upstream traffic | upstream URL hoặc PII xuất hiện |
| Release/update | Workflows, updater, signing/notarization inert đến khi fork credentials/feed sẵn sàng | tránh publish/tag/mutate main ngoài ý muốn | artifact unsigned hoặc feed upstream |

## Non-goals

- Không rewrite toàn bộ Rust PTY/SSH trong shell cutover.
- Không đưa desktop server Axum/REST, ScriptC, Bun, git2, tldraw SDK, XYFlow MVP, CLIProxyAPI hay Agent Teams trở lại.
- Không đồng thời cho Rust và Node làm authority của cùng PTY/session/credential.

## Source decisions

- Baseline: old plan, decision log, audits and feature catalog under `plans/260730-0117-aio-ade-rebrand-and-integration/`.
- Tauri/Rust option report: `plans/260730-1421-aio-ade-tauri-migration-roadmap/reports/tauri-rust-runtime-options-report.md`.
- tldraw license: https://tldraw.dev/community/license; Excalidraw/XYFlow selected as MIT alternatives.
