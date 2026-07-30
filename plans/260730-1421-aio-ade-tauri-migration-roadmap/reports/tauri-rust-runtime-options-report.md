---
title: Aio-ADE Tauri v2 and Rust Runtime Options
type: research-report
date: 2026-07-30T14:35:00+07:00
status: complete-with-concerns
scope: Tauri v2 shell, Rust core, and TypeScript/Node sidecar migration
---

# Aio-ADE Tauri v2 and Rust Runtime Options

Research timestamp: 2026-07-30 14:35 ICT

## Executive Summary

The lowest-risk migration is a staged hybrid, not a full Rust rewrite. Keep the React renderer and xterm.js terminal UI; replace the Electron shell with Tauri v2; keep the existing TypeScript/Node runtime as a signed sidecar for PTY and SSH; move low-risk, stable services into Rust first (control commands, local persistence, secure-store adapters, filesystem/process primitives). This preserves the current behavior while creating a measured path to Rust PTY and SSH.

The current repository is already coupled to `node-pty` 1.1.0, patched xterm beta packages, and `ssh2` 1.17.0 across PTY, SFTP, agent, forwarding, relay, reconnect, and terminal-history code. Replacing those surfaces during the shell migration would combine two independent failure domains. Tauri events are explicitly not intended for low-latency/high-throughput streams; terminal bytes should remain on a dedicated binary IPC path owned by one runtime authority.

## Research Methodology

- Sources: official Tauri v2 docs, Microsoft ConPTY documentation, SQLite documentation, Node.js documentation, upstream GitHub repositories, crates.io metadata, npm metadata, and local Aio-ADE source/package inventory.
- Recency: upstream metadata and documentation checked 2026-07-30; current package versions are recorded where relevant. Version/maturity claims can change and must be rechecked at implementation time.
- Key terms: `Tauri v2 commands events channels sidecar capabilities updater signing`, `portable-pty ConPTY resize`, `russh SSH SFTP forwarding agent`, `rusqlite SQLx WAL`, `Tauri SQL Stronghold keyring`, `xterm WebView2 WebKitGTK`, and `Node single executable native addon`.
- Source policy: official documentation and upstream repositories take precedence over secondary summaries; no benchmark claim is used unless it is a migration gate to be measured in this repository.

Stability markers used in this report:

- **Unstable for this migration:** the repository's patched xterm beta builds and a Node Single Executable Application containing `node-pty`; preserve/pin the former and spike the latter.
- **Watch:** `russh` is an active 0.x low-level library, and application-level OpenSSH compatibility remains Aio-ADE's responsibility.
- **Empirical gate:** `portable-pty` exposes the needed primitives, but byte, process-tree, and reconnect parity are not claimed until the cross-platform spike passes.

Recommended first-cutover ownership:

| Concern | First cutover owner | Later Rust option | Decision |
| --- | --- | --- | --- |
| Window, capabilities, updater, signing | Tauri v2/Rust | N/A | Adopt immediately |
| React/xterm.js renderer | Existing TypeScript | N/A | Preserve initially |
| PTY, terminal daemon, scrollback authority | Node sidecar (`node-pty` + headless xterm) | `portable-pty` | Keep Node until byte/lifecycle parity passes |
| SSH, SFTP, agent, forwarding | Node sidecar (`ssh2`) | `russh` + `russh-sftp` | Keep Node for first cutover |
| App metadata/persistence | Rust-owned `rusqlite` worker | SQLx only if async/query needs justify it | Prefer Rust native over renderer SQL |
| Secrets | OS keyring plus existing secure-file semantics | Stronghold for selected vault records | Do not introduce plaintext fallback |
| PTY/SSH transport IPC | Sidecar local binary framed protocol | Same protocol for Rust runtime | Commands for control; not JSON events for bytes |

## Table of Contents

- [Current architecture implications](#current-architecture-implications)
- [Target architecture](#target-architecture)
- [Tauri v2 shell and IPC](#tauri-v2-shell-and-ipc)
- [PTY options and byte-path parity](#pty-options-and-byte-path-parity)
- [SSH options](#ssh-options)
- [SQLite options](#sqlite-options)
- [Secrets and secure files](#secrets-and-secure-files)
- [React and xterm.js continuity](#react-and-xtermjs-continuity)
- [Packaging and platform constraints](#packaging-and-platform-constraints)
- [Licensing](#licensing)
- [Feasibility spike and release gates](#feasibility-spike-and-release-gates)
- [No-go assumptions](#no-go-assumptions)
- [Actionable next steps](#actionable-next-steps)
- [Unresolved questions](#unresolved-questions)

## Current Architecture Implications

Repository evidence that affects migration order:

- `package.json` pins `node-pty` 1.1.0, `ssh2` 1.17.0, `@xterm/headless`, xterm serialization, WebGL, fit, Unicode, search, ligature, and web-link addons. Several are patched locally.
- `src/main/daemon/pty-subprocess.ts`, `src/main/providers/local-pty-provider.ts`, and PTY tests use `node-pty`; there are ConPTY warmup, descriptor-leak, process-group, and terminal lifecycle tests.
- `src/main/ssh/` and provider/agent-hook code use `ssh2` for interactive channels, SFTP, agent identities, port forwarding, relay deployment, and remote file operations. This is a broad public behavior surface, not a replaceable adapter with one call site.
- `src/main/daemon/` uses `@xterm/headless` for terminal emulation and scrollback/serialization. Renderer and daemon must continue to use the same terminal protocol and snapshot rules.
- `src/shared/secure-file.ts`, `bounded-secure-json-file.ts`, and `secure-file-windows-acl.ts` implement secure-file behavior, including Windows ACL hardening. `plugin-secrets-store.ts` explicitly rejects plaintext fallback. Preserve this contract.
- Updater code has custom timing, feed, prerelease, and Windows signature checks. Treat updater migration as a separate compatibility project; do not assume the Tauri updater is behaviorally equivalent to `electron-updater`.

## Target Architecture

```text
React + xterm.js (Tauri WebView)
        |
        | Tauri commands/events/channels: control, metadata, lifecycle
        v
Tauri Rust shell/core
  - capability ACLs and window lifecycle
  - path/process/filesystem policy
  - local DB worker and secret adapters
  - sidecar supervisor and protocol versioning
        |
        | local binary framed IPC (stdio, named pipe, Unix socket)
        v
Node/TypeScript sidecar (first cutover)
  - PTY daemon + node-pty + headless xterm
  - SSH/SFTP/agent/forwarding via ssh2
  - reconnect, history, orphan and process lifecycle authority

Future, only after parity:
  replace one sidecar domain at a time with Rust services.
```

There must be one authority for each PTY, session record, and credential. During migration, a Rust PTY and Node PTY must not both own the same process or scrollback. Every stream and lifecycle message needs a protocol version and runtime incarnation identifier.

## Tauri v2 Shell and IPC

### What Tauri provides

- Commands are typed Rust functions invoked from JavaScript and can return serialized values/errors: <https://v2.tauri.app/develop/calling-rust/>.
- Events are bidirectional, but Tauri states that events are not designed for low-latency or high-throughput use and payloads are JSON-oriented: <https://v2.tauri.app/develop/calling-frontend/>.
- Channels are the more controlled streaming primitive, but terminal throughput must still be benchmarked. Use them for bounded control/progress streams, not as an untested replacement for a raw byte transport.
- Sidecars are configured under `bundle.externalBin`, require a target-triple-suffixed executable, and require explicit shell permissions and argument ACLs: <https://v2.tauri.app/develop/sidecar/> and <https://v2.tauri.app/security/capabilities/>.
- Capabilities merge per window/webview; least-privilege capability files should expose only the commands and sidecar arguments needed by the active desktop window: <https://v2.tauri.app/security/capabilities/>.
- Tauri updater signatures cannot be disabled. Update artifacts include a signature, while platform code signing remains a separate requirement: <https://v2.tauri.app/plugin/updater/> and <https://v2.tauri.app/distribute/>.

### Recommended bridge

1. Tauri command: start/stop/status, resize, input admission, reconnect, snapshot request, and error acknowledgement.
2. Tauri event/channel: lifecycle metadata, diagnostics, bounded progress, and state changes.
3. Sidecar local IPC: raw PTY/SSH bytes and high-rate acknowledgements. Use a framed binary protocol with `session_id`, `incarnation`, monotonic sequence, message kind, payload length, and checksum/validation where useful.
4. Backpressure: bound every queue; do not silently drop terminal bytes. Apply admission control to input and snapshot requests, and persist/replay history from the daemon rather than asking the renderer to be the source of truth.

## PTY Options and Byte-Path Parity

### Current Node option

`node-pty` is already proven in this repository and supports Linux, macOS, and Windows ConPTY. Its upstream README states that Windows 10 version 1809/build 18309 or later is required because winpty support was removed: <https://github.com/microsoft/node-pty>. The current app has targeted warmup and leak tests, so retaining it minimizes the first-cutover risk.

### Rust option: `portable-pty`

`portable-pty` 0.9.0 is MIT licensed and maintained in the active WezTerm repository (<https://crates.io/crates/portable-pty>, <https://github.com/wezterm/wezterm>). Its API exposes a native PTY system, `MasterPty::try_clone_reader`, `take_writer`, `resize`, and `Child`/`ChildKiller` lifecycle interfaces: <https://github.com/wezterm/wezterm/blob/main/pty/src/lib.rs>.

Important behavior to validate rather than infer:

- `Read`/`Write` are blocking standard-I/O traits. Run reader and writer loops away from the Tokio executor, and make shutdown cancellation explicit.
- `resize(PtySize)` is the correct terminal geometry operation. Coalesce resize storms and make the last accepted size observable.
- Unix child termination sends `SIGHUP` first and may escalate; the exposed process-group leader is optional. A direct child kill is not equivalent to killing an entire descendant tree.
- Windows termination uses a process handle/`TerminateProcess` path in the current implementation. If Aio-ADE requires descendant cleanup, add an explicit Windows Job Object strategy and test it.
- ConPTY uses synchronous communication channels. Microsoft recommends servicing input and output on separate threads because servicing both on one thread can deadlock when a pipe buffer fills: <https://learn.microsoft.com/en-us/windows/console/creating-a-pseudoconsole-session>.
- Do not decode PTY output into `String` in the transport. ConPTY/PTY output is a byte stream containing terminal control sequences; preserve the bytes and let the existing xterm parser decode/render them.

### Fable PTY byte-path contract

The Rust spike is a **fail-closed** replacement candidate only if all of these hold:

| Contract | Required behavior | Test evidence |
| --- | --- | --- |
| Raw bytes | No UTF-8 lossy conversion, newline normalization, or control-sequence rewriting in transport | Invalid UTF-8 and binary/OSC fixture hash equality |
| Ordering | One monotonic sequence per PTY incarnation; concurrent readers never reorder chunks | Concurrent burst test and sequence audit |
| Resize | Rows/columns arrive in order; stale resizes cannot overwrite a newer size | Resize storm and prompt-width fixture |
| Backpressure | Bounded memory; no dropped terminal bytes; reader, parser, renderer, and history queues have explicit limits | Sustained 100 MB burst, latency and RSS thresholds |
| Reconnect/history | Daemon retains the authoritative scrollback/snapshot and replays from a known cursor; reconnect is idempotent | Kill/restart WebView while process continues; replay hash |
| Exit semantics | Distinguish process exit, PTY EOF, signal, and transport failure; emit one terminal exit record | Shell exit, child signal, descendant, and disconnect matrix |
| Ownership | Exactly one runtime may write input or retire a PTY | Deliberate stale-incarnation writes are rejected |

The existing `@xterm/headless`/renderer parity fixtures should be the oracle. A Rust PTY can be accepted only after the same output and snapshot fixtures pass on Windows, macOS, Linux, and WSL scenarios.

## SSH Options

### Recommendation: keep `ssh2` in the Node sidecar for first cutover

The current `ssh2` 1.17.0 integration spans interactive PTY channels, SFTP, agent identities, remote hook installation, forwarding, relay deployment, reconnect, and host-specific behavior. Keeping it avoids a simultaneous transport and shell migration. The sidecar API should expose the same existing typed protocol, so future Rust can replace the implementation without changing React.

### Rust option: `russh`

`russh` 0.62.4 is Apache-2.0, active, Tokio-based, and explicitly low-level. Its upstream README lists interactive PTY examples, SFTP through the separate `russh-sftp` crate, local/remote forwarding, OpenSSH certificates, keepalive handling, agent forwarding, and multiple cipher/MAC algorithms: <https://github.com/warp-tech/russh> and <https://crates.io/crates/russh>.

That feature list makes a future replacement feasible, but not automatically compatible. The application must prove parity for:

- OpenSSH config parsing, aliases, `Include`, `ProxyJump`, command/socket proxies, and WSL path/socket mapping.
- Host-key policy, known-hosts canonicalization, changed-key errors, keyboard-interactive prompts, agent fallback order, encrypted keys, and PKCS#11/OS-agent behavior.
- SFTP metadata, symlink/stat behavior, partial transfer recovery, cancellation, and error wording used by current UI/tests.
- PTY request/resize, channel window flow control, keepalive/rekey, forwarding cancellation, and reconnect semantics.

`russh` requires an explicit crypto backend feature (`ring` or `aws-lc-rs`) and its SFTP implementation is a separate crate. Treat current API and feature churn as a risk; pin versions and run an OpenSSH interoperability matrix before considering migration. Keep `ssh2` as the production authority until that matrix passes.

## SQLite Options

### Tauri SQL plugin

`tauri-plugin-sql` 2.4.0 is dual Apache-2.0/MIT and supports SQLite, PostgreSQL, and MySQL. It uses Tauri permissions, with potentially dangerous commands blocked until explicitly allowed: <https://v2.tauri.app/plugin/sql/>. It is suitable for a small settings database or a migration spike, but exposing general SQL execution to a renderer increases the capability surface. Keep schema operations behind narrow Rust commands if the database contains session, credential, or process authority.

### Rust-native database

- `rusqlite` 0.40.1 is MIT, synchronous, and offers a `bundled` feature that is useful on Windows where relying on a system SQLite can complicate packaging: <https://github.com/rusqlite/rusqlite>.
- `sqlx` 0.9.0 is dual licensed and async with compile-time checked queries, but its current MSRV and larger async surface make it a poor reason to increase migration scope: <https://github.com/launchbadge/sqlx>.

Recommendation: a Rust-owned `rusqlite` connection worker with versioned migrations, busy timeout, and explicit transaction boundaries. The renderer calls typed commands; no second Node writer is enabled once Rust owns the database. Use SQLx only if a later service already requires async DB access and the MSRV/build cost is accepted.

### WAL and workspace constraints

SQLite WAL allows readers and a writer to proceed concurrently, but there is still one writer, and WAL does not work over a network filesystem: <https://sqlite.org/wal.html>. Keep Aio-ADE's application DB under OS app-data, not inside a folder workspace, git worktree, SSH mount, or WSL-mounted network path. Configure checkpoints and avoid long-lived read transactions. External provider databases (for example, Opencode session SQLite files) remain read-only scanner inputs and should not share the app's writer.

## Secrets and Secure Files

The migration must preserve current secure-file guarantees: atomic writes, Windows ACL hardening, no plaintext fallback, and explicit size limits for structured records.

### OS keyring

`keyring` 4.1.5 is dual MIT/Apache and wraps native secure stores on macOS, Windows, and Unix-like systems; its ecosystem separates credential-store backends so applications can select only the stores they need: <https://github.com/open-source-cooperative/keyring-rs>. Use it for account/API tokens and small credentials. Linux/SSH/WSL hosts may lack a desktop Secret Service; failure must be explicit and actionable, not a downgrade to plaintext.

### Tauri Stronghold

`tauri-plugin-stronghold` 2.3.1 is dual Apache-2.0/MIT and exposes encrypted vault/client/store operations with Tauri permissions: <https://v2.tauri.app/plugin/stronghold/>. The documented default hash requires exactly 32 bytes for the password. Stronghold can be useful for a portable encrypted vault, but Aio-ADE still needs a safe bootstrap/key-unlock policy and must decide whether vault-file ACL behavior matches existing secure-file expectations.

Recommendation: first preserve secure files and add an OS-keyring adapter for new account profiles. Evaluate Stronghold only for records that need portable encrypted storage; do not migrate all credentials until recovery, lock/unlock, corruption, and headless-host behavior are tested.

## React and xterm.js Continuity

Tauri can host the existing Vite/React frontend without a renderer rewrite. Keep xterm.js, headless xterm, serialization, fit, Unicode, search, web links, ligatures, and WebGL addon versions initially; the current patched beta versions are part of the terminal behavior contract.

The important difference is the WebView runtime. Tauri uses WebView2/Chromium on Windows and the OS WebKit on macOS and Linux; it does not ship one Chromium runtime: <https://v2.tauri.app/reference/webview-versions/> and <https://v2.tauri.app/concept/architecture/>. WebView2 is updateable; macOS WebKit follows OS updates; Linux WebKitGTK varies by distribution.

Continuity checklist:

- Run the existing xterm ANSI, Unicode, IME, clipboard, resize, drag/drop, and font fixtures on WebView2, WKWebView, and WebKitGTK.
- Treat WebGL as optional. Keep a DOM/canvas fallback and handle WebGL context loss; do not make startup depend on the WebGL addon.
- Preserve binary input/output transport outside the DOM and avoid `TextDecoder` on PTY bytes.
- Keep platform shortcut detection runtime-based (`metaKey` on macOS, `ctrlKey` elsewhere) and use `CmdOrCtrl` for Tauri menu accelerators.
- Test file URLs, asset loading, clipboard permissions, and focus/IME behavior separately from Electron.

## Packaging and Platform Constraints

### Sidecar shape

Tauri requires each bundled sidecar executable to be target-triple suffixed (for example `my-sidecar-x86_64-pc-windows-msvc`) and explicitly permitted in capabilities: <https://v2.tauri.app/develop/sidecar/>. A practical first-cutover package is:

```text
Tauri app
  resources/sidecar/index.cjs       # bundled TS/JS protocol daemon
  resources/node/<target>/node      # target Node runtime
  resources/node_modules/<target>/  # node-pty native binding and ssh2 deps
  externalBin/aio-ade-sidecar-*     # signed launcher or Node executable
```

Use a small target-specific launcher if invoking a resource Node binary directly makes signing, argument ACLs, or path discovery ambiguous. Node Single Executable Applications can embed a bundled CommonJS script and assets, but native-addon packaging is an active area in Node's documentation; do not make Node SEA the first production path for `node-pty` without a spike: <https://nodejs.org/api/single-executable-applications.html>.

### Windows

- WebView2 is required for Tauri development and is normally present on supported Windows; the Tauri installer can install it on older supported systems: <https://v2.tauri.app/start/prerequisites/>.
- ConPTY requires Windows 10 1809+ for the current node-pty path. Test Windows Terminal/PowerShell/cmd, process trees, code pages, and WSL launches.
- Sign the Tauri executable, installer, and sidecar/native modules as required by the release pipeline. Test NSIS/MSI upgrades with a running sidecar and locked files.
- Keep `x86_64-pc-windows-msvc` and `aarch64-pc-windows-msvc` artifacts distinct. Preserve Windows ACL hardening for secure files.

### macOS

- Tauri uses the OS WKWebView, so rendering behavior follows macOS updates. Test Intel and Apple Silicon separately.
- Nested sidecars and native addons must be included in the app bundle, code-signed, and notarized under the hardened-runtime policy. Verify that updater replacement preserves signatures.
- Validate fork/exec PTY process-group behavior, login shell environment, keychain prompts, and SSH agent socket discovery.

### Linux

- Tauri uses WebKitGTK; development/distribution requires distro-specific WebKitGTK and GTK dependencies: <https://v2.tauri.app/start/prerequisites/> and <https://v2.tauri.app/reference/webview-versions/>.
- Preserve the project's Ubuntu 20.04/glibc 2.31 floor. Build Rust, Node native addons, and any C/C++ dependency against that floor; never copy a newer-host binary into the release.
- Test AppImage and DEB, executable bits, Wayland/X11, fonts, GPU/WebGL, and Secret Service availability. A headless Linux host may not provide a keyring or a usable WebKit display.

### SSH, WSL, folder workspaces, and git

- SSH targets can be local, WSL, or remote. Keep provider-specific path, shell, agent, and socket logic in runtime checks; do not assume POSIX paths or a local git binary.
- WSL may expose Windows agent sockets and paths differently from native Linux. The first sidecar should reuse existing WSL/SSH adapters.
- Application SQLite belongs in app-data, while workspace/worktree metadata references paths. Continue using `path.join` and retain the Git 2.25-compatible command fallbacks documented by the project.

## Licensing

Verify exact transitive licenses from the lockfile and release artifacts at implementation time. The table below records current upstream SPDX/README evidence gathered 2026-07-30.

| Component | Version observed | License | Source / note |
| --- | --- | --- | --- |
| Tauri core | 2.11.5 | Apache-2.0 (repo SPDX) | <https://github.com/tauri-apps/tauri> |
| Tauri official plugins | v2 line | Apache-2.0 repo; crate metadata varies | <https://github.com/tauri-apps/plugins-workspace> |
| `portable-pty` | 0.9.0 | MIT | <https://crates.io/crates/portable-pty> |
| `russh` | 0.62.4 | Apache-2.0 | <https://crates.io/crates/russh> |
| `russh-sftp` | companion crate | Verify release metadata | <https://crates.io/crates/russh-sftp> |
| `rusqlite` | 0.40.1 | MIT | <https://github.com/rusqlite/rusqlite> |
| `sqlx` | 0.9.0 | MIT OR Apache-2.0 | <https://github.com/launchbadge/sqlx> |
| `keyring` | 4.1.5 | MIT OR Apache-2.0 | <https://github.com/open-source-cooperative/keyring-rs> |
| `tauri-plugin-sql` | 2.4.0 | Apache-2.0 OR MIT | <https://crates.io/crates/tauri-plugin-sql> |
| `tauri-plugin-stronghold` | 2.3.1 | Apache-2.0 OR MIT | <https://crates.io/crates/tauri-plugin-stronghold> |
| `node-pty` | 1.1.0 | MIT | <https://github.com/microsoft/node-pty> |
| `ssh2` | 1.17.0 | Verify package/repository SPDX at lock time | <https://github.com/mscdex/ssh2> |
| xterm.js | 6.1 beta in repository | MIT | <https://github.com/xtermjs/xterm.js> |
| Node.js runtime | target release | MIT and bundled third-party notices | <https://nodejs.org/> |
| SQLite | bundled/system | Public domain upstream; bundled extras vary | <https://sqlite.org/copyright.html> |

Do not ship a sidecar or native addon without collecting its license notices in the Tauri bundle and release SBOM.

## Feasibility Spike and Release Gates

Run the spike before deleting Electron runtime code. Every gate is pass/fail; a failed gate keeps the current Node implementation as the authority.

1. **Tauri shell boot:** React loads in dev and packaged builds on Windows/macOS/Linux; capability ACL rejects an unauthorized command.
2. **Binary sidecar IPC:** target-triple packaging, launch, crash detection, restart, shutdown, and protocol-version negotiation work without shell-specific paths.
3. **PTY byte parity:** raw bytes, ANSI/OSC, invalid UTF-8, Unicode, resize, prompt width, and xterm snapshots match the Node oracle.
4. **PTY stress/backpressure:** sustained burst has zero loss/reorder, bounded RSS, no deadlock, and deterministic reconnect replay.
5. **PTY lifecycle:** shell exit, signal, EOF, descendant cleanup, stale-incarnation writes, and WSL behavior match existing tests.
6. **SSH interoperability:** OpenSSH matrix covers password/key/agent/keyboard-interactive auth, host-key changes, PTY, SFTP, forwarding, keepalive/rekey, ProxyJump/proxy sockets, reconnect, and WSL.
7. **SQLite:** migrations are idempotent, WAL/concurrency tests pass, interrupted writes recover, and no DB lives on a network filesystem.
8. **Secrets:** keyring/Stronghold/secure-file tests cover locked stores, headless Linux, ACLs, corruption, migration, deletion, and no-plaintext-fallback behavior.
9. **WebView renderer:** WebView2, WKWebView, and WebKitGTK pass xterm input, IME, clipboard, WebGL fallback, font, drag/drop, and keyboard shortcut tests.
10. **Release pipeline:** Windows code signing, macOS signing/notarization, Linux glibc floor, sidecar signatures, updater signature verification, rollback, and interrupted update tests pass.

## No-Go Assumptions

- Do not assume Tauri JSON events can carry terminal throughput; the official docs say they are not for low-latency/high-throughput streams.
- Do not assume Tauri's WebView is Electron's Chromium. WebKitGTK and WKWebView require separate compatibility testing.
- Do not perform a full Rust PTY and SSH rewrite in the shell cutover.
- Do not run Rust and Node as concurrent authorities for one PTY, session row, or credential.
- Do not decode/re-encode PTY bytes as UTF-8 in a transport layer.
- Do not put the application SQLite database in a workspace, git worktree, SSH mount, or WSL network filesystem.
- Do not fall back to plaintext credentials when OS keyring/Stronghold is unavailable.
- Do not assume a portable Node sidecar is just JavaScript: `node-pty` has target-specific native bindings and every target must be built, packaged, signed, and tested.
- Do not assume `russh` feature names imply application parity; config parsing, host-key policy, auth fallback, SFTP semantics, and proxy behavior must be demonstrated.

## Actionable Next Steps

1. Create a Tauri v2 shell spike with the existing Vite/React build and a no-op signed sidecar.
2. Extract the current Node daemon behind a versioned binary IPC adapter without changing PTY/SSH behavior.
3. Port the existing PTY byte/snapshot/reconnect fixtures into a cross-runtime parity harness; keep Node as oracle.
4. Add a Rust `rusqlite` worker and typed migration commands, initially for non-secret app metadata only.
5. Add an OS-keyring adapter while retaining secure-file storage for existing records; test headless Linux and WSL explicitly.
6. Build a target matrix in CI for Windows x64/ARM64, macOS x64/ARM64, and Linux against Ubuntu 20.04/glibc 2.31.
7. Revisit `portable-pty` and `russh` only after gates 3-6 pass and the sidecar protocol is implementation-neutral.

## Unresolved Questions

- Which exact Tauri updater feed/channel semantics must remain compatible with the current prerelease and rollback behavior?
- Is Aio-ADE's required Linux desktop baseline guaranteed to provide WebKitGTK 4.1 and a Secret Service, or must the installer/documentation support degraded headless mode?
- Does the product require descendant process-tree termination stronger than current `node-pty`/shell semantics on Windows and WSL?
- Which SSH features are contractual for the first Tauri release: ProxyJump, PKCS#11, agent forwarding, remote port forwarding, and SFTP symlink/permission fidelity?
- Should portable encrypted credentials be recoverable across machines (favoring a vault) or bound to the OS account (favoring keyring/secure-file semantics)?

Status: DONE_WITH_CONCERNS
Summary: Staged Tauri v2 plus Rust control/persistence with Node PTY and SSH sidecar is feasible and recommended. Rust PTY/SSH replacement remains gated by byte, lifecycle, interoperability, and packaging parity.
Concerns/Blockers: WebView variance, ConPTY process-tree/backpressure behavior, native sidecar signing, Linux glibc/keyring floors, and russh application-level SSH parity require feasibility-spike evidence.
