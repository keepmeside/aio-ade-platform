# Kiến trúc đích: aio-ade strangler migration

## Luồng authority

```text
React 19 + xterm.js
        │  Tauri invoke/events/channels (control, state, bounded progress)
        ▼
Tauri v2 shell/core (capabilities, window, app-data, supervisor)
        │  stdio framed JSON-RPC/binary payloads
        ▼
Node/TypeScript sidecar (authority phase đầu)
  node-pty + @xterm/headless + ssh2 + SFTP/WSL/remote runtime
        │
        └── future Rust runtime candidate (chỉ sau parity gate)
```

## Authority rules

- Một PTY/session/credential chỉ có một owner; runtime incarnation + monotonic sequence chống stale writes.
- Renderer không giữ raw PTY làm source of truth; sidecar giữ scrollback/snapshot và replay cursor.
- Tauri command trả typed result/error; Tauri events chỉ dành lifecycle/diagnostics bounded. PTY bytes đi framed sidecar path.
- Electron và Tauri chạy cùng React/xterm contract trong giai đoạn strangler; Electron là oracle.

## Runtime contract

Protocol envelope gồm `version`, `runtime`, `session_id`, `incarnation`, `seq`, `kind`, `payload`, `error`. Bytes không UTF-8 decode/re-encode, không newline normalization, không drop khi backpressure. Commands: start/stop/status/resize/input/reconnect/snapshot/ack. Events: lifecycle/progress/error; sidecar stream: output/input ack/history.

## Tauri capabilities

Capability files tối thiểu theo window. Chỉ expose command cần thiết, sidecar binary và argument allowlist. Không mở arbitrary shell, filesystem root hoặc URL navigation. Sidecar target-triple-suffixed, được ký cùng artifact. Updater giữ disabled cho tới release gate.

## Profiles và secrets

```text
Account (OAuth/subscription) ─┐
                              ├─ main-owned resolver ── launch spec ── PTY
API Profile (key/base/model) ─┘
```

Launch spec chỉ chứa opaque `profileRef`, agent/model/argv/env patch đã redacted và host scope. Secret nằm safeStorage/OS keyring hoặc encrypted fallback explicit-consent. Claude dùng managed `CLAUDE_CONFIG_DIR`; Codex dùng managed `CODEX_HOME`/`config.toml`; SSH không nhận local secret ngầm.

## Canvas

Excalidraw là lazy editor surface trong React renderer, file `.excalidraw` lưu qua host-aware filesystem (`connectionId`) cho git worktree, folder workspace, WSL và SSH. `onChange` debounce + conflict/mtime guard. Export PNG/SVG + structural text context gửi Claude/Codex. Không thêm tldraw; XYFlow chỉ là lazy topology tranche sau usage evidence.

## Compatibility boundary

- Brand migration đọc old Orca paths/markers/plugin manifests/wire tokens một release window, ghi canonical `aio-ade` sau backup marker/version.
- Git luôn đi host binary; command mới phải có Git 2.25 fallback/capability cache.
- WSL/SSH path, shell, agent socket và SFTP do existing runtime adapters sở hữu; Tauri không tự đoán POSIX/Windows path.

## Data flow và failure policy

```text
workspace/host ── fs API(connectionId) ── board/profile/artifact
app-data ── Rust DB worker ── metadata/session index
PTY sidecar ── framed stream ── Tauri bridge ── xterm renderer
```

Boundary failure phải hiển thị và retry/rollback được; không âm thầm fallback plaintext, local secret forward, dropped terminal bytes, hoặc switch authority giữa Rust/Node.

## Platform matrix

Windows: WebView2, ConPTY, PowerShell/cmd, WSL, x64/ARM64, ACL. macOS: WKWebView, Intel/Apple Silicon, Keychain, notarization. Linux: WebKitGTK, X11/Wayland, Secret Service/headless, Ubuntu 20.04/glibc 2.31 floor. Mọi nền tảng đều test local git, folder workspace, WSL và SSH khi khả dụng.
