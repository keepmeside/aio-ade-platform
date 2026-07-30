# Tauri v2 Strangler Scout Report

## Status

DONE_WITH_CONCERNS

## Scope and Evidence

- Read the current worktree sources, `README.md`, `AGENTS.md`, style guidance, Git/glibc compatibility guidance, the approved aio-ade roadmap, and its phases 03-06.
- `git grep` found 223 non-test TypeScript files that directly import or require `electron`; the renderer has zero direct Electron imports. The two preload runtime files are `src/preload/index.ts` and `src/preload/gitlab.ts`.
- No existing `src-tauri/`, `Cargo.toml`, or Tauri configuration was found. Any Tauri/Rust API, plugin, packaging, or performance statement below is explicitly marked unverified.
- `docs/system-architecture.md` was not present in this worktree.

## Exact Electron-Only Seams

### Process and window shell

- `src/main/index.ts:5` imports `app`, `BrowserWindow`, `dialog`, `ipcMain`, `nativeTheme`, and `Tray`; `app.whenReady()` begins startup at line 1866, and `before-quit`, `will-quit`, `window-all-closed`, and `activate` own shutdown/reopen semantics near lines 2778-2895.
- `src/main/window/createMainWindow.ts`, `src/main/window/dashboard-popout-window.ts`, `src/main/window/attach-main-window-services.ts`, `src/main/window/focus-existing-window.ts`, `src/main/window/privileged-window-navigation.ts`, and `src/main/window/window-bounds-validation.ts` are BrowserWindow/WebContents lifecycle and navigation seams.
- `src/main/menu/register-app-menu.ts`, `src/main/tray/system-tray.ts`, `src/main/app-icon.ts`, `src/main/app-relaunch.ts`, `src/main/startup/single-instance-lock.ts`, and `src/main/startup/configure-process.ts` are native application shell seams.
- `src/main/updater.ts`, `src/main/electron-updater-loader.ts`, `src/main/updater-events.ts`, `src/main/updater-mac-install.ts`, and `src/main/window/attach-main-window-services.ts` are Electron updater seams. The approved aio-ade decision keeps updater/release channels inert until fork-owned signing and endpoints exist.
- `src/main/crash-reporting/*`, `src/main/hang-watchdog/*`, `src/main/startup/*`, `src/main/telemetry/*`, `src/main/stats/*`, and `src/main/observability/*` bind diagnostics to Electron app identity, process events, and user-data paths.

### Preload and IPC contract

- `src/preload/index.ts:2` imports `contextBridge`, `ipcRenderer`, `webFrame`, and `webUtils`; it exposes `electron` and the large typed `api` surface at lines 4748-4749.
- `src/preload/index.ts:382-451` owns native file-drop path extraction via `webUtils.getPathForFile`, so this is not a renderer-only concern.
- `src/preload/api-types.ts` is the public renderer contract (including host-aware filesystem methods with `connectionId`); it should be preserved as a transport-neutral interface rather than re-created in Rust first.
- `src/main/ipc/register-core-handlers.ts:141-231` is the registration fan-in for app, filesystem, GitHub/GitLab, account, runtime, browser, shell, clipboard, updater, speech, plugin, workspace, and diagnostics handlers. Most handlers use `ipcMain` but delegate behavior to non-Electron services.
- `src/main/ipc/runtime.ts` maps `runtime:call` to the same `RpcDispatcher` used by the runtime server; this is the best existing local bridge seam for a Tauri host.
- `src/main/ipc/runtime-environments.ts` owns paired-runtime listing, pairing, subscriptions, transport generations, and remote recovery. It depends on `app.getPath('userData')` only for local metadata.

### OS integrations and browser surfaces

- Electron-only OS integrations include `src/main/ipc/shell.ts`, `src/main/window/clipboard-ipc-handlers.ts`, `src/main/window/clipboard-text-write-verify.ts`, notification handlers, `src/main/ipc/notifications.ts`, `src/main/ipc/developer-permissions.ts`, `src/main/window/window-bounds-validation.ts`, and `src/main/agent-awake-service.ts`.
- Browser automation is deeply Electron-bound: `src/main/browser/*` uses `BrowserWindow`, `BaseWindow`, `WebContentsView`, `webContents`, `session`, debugger leases, CDP, offscreen windows, and certificate/media/WebAuthn hooks. Treat this as a late migration or a capability explicitly removed from the first Tauri shell.
- `src/main/emulator/*`, `src/main/ipc/emulator-frame-stream.ts`, and `src/main/ipc/emulator-video-stream.ts` stream Electron windows/webContents and are not shell-neutral.

### Persistence and secrets

- `src/main/persistence.ts:2` imports `app` and `safeStorage`; `encrypt()`/`decrypt()` use OS-backed Electron encryption at lines 261-285, while JSON state, backup rotation, durable writes, profile paths, and terminal snapshots remain Node filesystem code.
- The same `safeStorage` dependency appears in `src/main/integration-credential-file.ts`, `src/main/jira/client.ts`, `src/main/linear/client.ts`, `src/main/minimax/minimax-cookie-store.ts`, `src/main/orca-profiles/profile-cloud-session-store.ts`, `src/main/plugins/plugin-secrets-store.ts`, and `src/main/speech/openai-api-key-store.ts`.
- The approved account/profile decision requires encrypted secret handling, no plaintext fallback without explicit consent, atomic writes, redaction, and no local-secret forwarding over SSH. Do not replace this with an unverified Rust keyring plugin during the first shell port.

### Build and packaging

- `package.json:50-87` is Electron/Vite/electron-builder driven; `build:desktop` also builds the CLI and relay. Dependencies include `electron`, `electron-updater`, `node-pty`, `ssh2`, `@xterm/headless`, `sherpa-onnx`, and native watcher modules.
- `electron.vite.config.ts:187-232` emits CommonJS main entries for `index`, `daemon-entry`, plugin host, computer sidecar, speech worker, and watchdog/worker processes; `@xterm/headless` and `@xterm/addon-serialize` are bundled specially.
- `config/electron-builder.config.cjs` unpacks the daemon, CLI, native modules, relay, plugins, and runtime dependency closure; Linux packaging enforces the glibc floor via `verifyLinuxGlibcFloor`.

## Reusable React and Transport-Neutral Boundaries

- `src/renderer/src/main.tsx` mounts the product `App`; `src/renderer/src/web/main.tsx` lazy-loads the same `../App` and installs `installWebPreloadApi()` before mounting.
- `src/renderer/src/web/web-preload-api.ts:484-489` replaces Electron preload globals with a browser-safe `window.api`; `createRuntimeApi()` routes `runtime.call` through the runtime RPC client, and `createRuntimeEnvironmentsApi()` handles paired hosts.
- `src/renderer/src/runtime/runtime-rpc-client.ts` is already host-neutral: local calls use `window.api.runtime.call`, remote calls use `callRuntimeEnvironmentWithRevision`, and compatibility/capability caching is host-scoped.
- `src/main/runtime/runtime-rpc.ts` exposes authenticated Unix/named-pipe and optional WebSocket transports. It publishes metadata, enforces auth, supports streaming/long-polls, pairing, E2EE mobile sockets, and orphan-socket cleanup. This can be the Node sidecar protocol boundary.
- `src/renderer/src/components/terminal-pane/pty-transport-types.ts` defines a provider-neutral PTY contract (connect/attach/write/resize/recovery/snapshots/host identity); `pty-transport.ts` and `remote-runtime-pty-transport.ts` implement local IPC and runtime RPC variants.
- `src/main/providers/types.ts` defines `IPtyProvider`; local, daemon, and SSH providers implement the same spawn/attach/write/resize/snapshot/stream contract.
- `src/renderer/src/components/terminal-pane/pty-transport.ts`, `remote-runtime-pty-transport.ts`, `pty-connection.ts`, and `src/renderer/src/lib/pane-manager/pane-dom-creation.ts` are reusable xterm boundaries. Keep PTY/xterm model-blind; Fable is already mapped to `--model fable` in `src/shared/agent-session-option-catalog-claude-codex.ts:71`.
- `src/renderer/src/web/web-preload-api.ts` proves the renderer can run without Electron, but its browser-local fallbacks are not a drop-in desktop replacement for dialogs, secure storage, native file paths, or privileged browser panes.

## Rust-Core and Node-Sidecar Candidates

### Rust-core candidates (all capability claims UNVERIFIED for this repository)

- **Small shell adapter:** app lifecycle, single-instance behavior, window creation/close/focus, menu/tray, native dialogs, shell-open, clipboard, notifications, and path/user-data discovery. Evidence: the Electron-only files listed above; no Rust implementation exists yet.
- **Host bridge adapter:** implement the existing `window.api` operations that are genuinely local and synchronous to the desktop shell, while forwarding runtime/file/Git calls to the sidecar. `[UNVERIFIED Tauri/Rust]` Tauri v2 can expose an equivalent invoke/event bridge with the required security and multi-window semantics.
- **Selective local persistence:** user-data path discovery, atomic file writes, backup rotation, and an OS credential store could move after a compatibility spike. `[UNVERIFIED Tauri/Rust]` A Tauri plugin/keyring combination can match Electron `safeStorage` availability, failure behavior, migration, and cross-platform keychain identity.
- **Packaging/update shell:** installer metadata, app identity, and optional updater integration are possible future Rust/Tauri responsibilities. `[UNVERIFIED Tauri/Rust]` Tauri v2 packaging can reproduce current Windows/macOS/Linux signing, native helper placement, Linux glibc constraints, and disabled-by-default updater policy without a separate release spike.

### Node-sidecar candidates (code-backed, low-risk initial ownership)

- `src/main/runtime/orca-runtime.ts`, `src/main/runtime/rpc/*`, `src/main/runtime/runtime-rpc.ts`, `src/main/runtime/relay/*`, and `src/main/ipc/runtime*.ts`: generic runtime dispatcher, local/remote routing, streaming, pairing, and host capability protocol.
- `src/main/daemon/*`, especially `daemon-entry.ts`, `daemon-init.ts`, `daemon-spawner.ts`, `daemon-pty-adapter.ts`, `daemon-pty-router.ts`, `pty-subprocess.ts`, and `headless-emulator.ts`: already designed as standalone Node processes over authenticated sockets. `daemon-entry.ts` explicitly runs under plain Node and handles native PTY faults.
- `src/main/providers/*`: `LocalPtyProvider` uses `node-pty`; SSH providers use relay requests and host-scoped identity/capability contracts.
- `src/main/ssh/*` plus `src/main/providers/ssh-*`: `ssh2`, SFTP, relay deployment/versioning, remote Git/filesystem/PTY routing, reconnect generations, and remote host boundaries. Keep in Node until remote-host parity is proven.
- `src/main/git/*`: command runner handles native/WSL routing, argument/path translation, cancellation, bounded output, GitHub/GitLab wrappers, and capability caches. Git 2.25 is the baseline; moving this to Rust must preserve behavior-probe fallbacks and host isolation.
- Provider/account/integration services (`src/main/claude-accounts/*`, `src/main/codex-accounts/*`, `src/main/rate-limits/*`, `src/main/browser/*`, `src/main/speech/*`, `src/main/plugins/*`, `src/main/emulator/*`) should remain Node initially because they depend on existing CLIs, Electron browser APIs, native helpers, or relay contracts.
- `src/main/persistence.ts` should remain Node during the first sidecar phase. Move only an explicitly versioned storage/secret subset after encrypted migration and backup/restore tests.

## Recommended Staged Migration Order

1. **Freeze and extract contracts.** Preserve `src/preload/api-types.ts`, `src/renderer/src/web/web-preload-api.ts`, `src/renderer/src/runtime/*`, `src/shared/runtime-*`, PTY transport types, and RPC schemas. Add no product behavior changes. Keep the approved aio-ade decisions: Claude/Codex only, Fable via generic PTY, Excalidraw first, updater/telemetry inert.
2. **Add a host-neutral desktop bridge.** Make the renderer depend on a small host adapter behind the existing `window.api` contract. Keep Electron preload as one adapter and make a Tauri adapter target the same local `runtime.call`, filesystem, dialog, clipboard, and lifecycle semantics. `[UNVERIFIED Tauri/Rust]` Tauri invoke/event and multi-window behavior must be proven in a packaged spike.
3. **Launch a Tauri shell with the existing React renderer.** Boot the existing `src/renderer/index.html`/`App` without changing terminal or workspace UI. Run the existing Node runtime/daemon as an authenticated sidecar and preserve Electron as a fallback build. `[UNVERIFIED Tauri/Rust]` Tauri sidecar lifecycle, restart/quit fencing, named-pipe/Unix-socket access, and Windows/macOS/Linux packaging need an executable spike.
4. **Migrate shell-only Electron services.** Move window/app lifecycle, menu/tray, dialogs, shell-open, clipboard, notifications, and single-instance behavior behind the host bridge. Keep `src/main/ipc/register-core-handlers.ts` as a Node-sidecar handler registry until every channel has a replacement and security-owner test.
5. **Apply approved aio-ade reductions at the sidecar boundary.** Execute the existing phase-03 CLI/orchestration/Agent Teams/headless `serve` deletion only after reverse-import extraction; retain internal headless xterm, daemon snapshots, hidden terminal recovery, SSH PTY, and generic runtime RPC. Then phase-04 roster narrowing and phase-05 rebrand can proceed without migrating deleted surfaces.
6. **Migrate local persistence selectively.** First keep Node `Store`/`safeStorage`; then prototype a Rust-backed storage/credential adapter with dual-read migration, atomic writes, corrupt backup recovery, and explicit unavailable-secure-storage behavior. `[UNVERIFIED Tauri/Rust]` Do not claim parity until keychain identity and failure semantics match on all three desktop OSes.
7. **Keep complex host services in Node.** PTY/daemon/xterm, SSH/SFTP/remote Git, WSL routing, browser/CDP/offscreen windows, account resolvers, plugins, speech, and native helper orchestration remain sidecar-owned. Expose only typed RPC/events to the renderer.
8. **Migrate last or retire explicitly.** Browser panes and PTY/SSH native implementations require separate parity spikes. `[UNVERIFIED Tauri/Rust]` Tauri webview/browser APIs and Rust PTY/SSH crates can match current Electron/Node behavior, recovery, query authority, and remote-host contracts. Do not remove Electron until all required parity gates pass and the fallback build has a release window.

## Exclusive File Ownership Suggestions

- **Bridge/renderer owner:** `src/preload/api-types.ts`, `src/preload/index.ts`, `src/preload/runtime-environment-subscriptions.ts`, `src/renderer/src/web/*`, `src/renderer/src/runtime/*`, and `src/shared/runtime-*`. Do not edit PTY/provider implementation files in the same tranche.
- **Tauri shell owner:** new `src-tauri/**` (or the selected Tauri root), host adapter module, and shell-only replacements for `src/main/window/*`, `src/main/menu/*`, `src/main/tray/*`, `src/main/startup/single-instance-lock.ts`, `src/main/ipc/shell.ts`, and clipboard/notification handlers. Avoid `src/main/runtime/*` edits except contract wiring.
- **Node sidecar owner:** `src/main/runtime/**`, `src/main/daemon/**`, `src/main/providers/**`, `src/main/ssh/**`, and `src/main/git/**`. This owner preserves protocol and host behavior while shell work proceeds.
- **PTY parity owner:** `src/main/ipc/pty.ts`, `src/main/daemon/pty-subprocess.ts`, `src/main/providers/*pty*`, `src/renderer/src/components/terminal-pane/pty-*`, and terminal recovery tests. No shell rename or brand token changes in this tranche.
- **Persistence/security owner:** `src/main/persistence.ts`, `src/main/integration-credential-file.ts`, `src/main/*secret*`, `src/shared/secure-file.ts`, and profile/account stores. Require security review and migration tests before any Rust replacement.
- **Release/docs owner:** `package.json`, `electron.vite.config.ts`, `config/electron-builder.config.cjs`, CI workflows, docs, and roadmap files. Edit only after the bridge and sidecar contracts are stable; never mix with PTY behavior changes.

## Parity Gates

- **Claude Code Fable:** `fable` resolves to ordinary Claude `--model fable`; verify launch, model/session-option persistence, auth env isolation, restart/defer boundary, and title/status behavior through the generic PTY path.
- **Codex:** verify managed `CODEX_HOME`, account/profile selection, trust/config sync, resume/reattach, startup command delivery, and no mutation of the user's global config.
- **xterm/PTY:** local `node-pty`, daemon reattach, hidden/headless snapshots, alternate-screen scrollback, OSC 10/11, CPR/DA/DSR/OSC color replies, resize, bracketed paste, Kitty keyboard, hyperlinks, write backpressure, renderer recovery, and `TERM_PROGRAM=Orca` compatibility. The approved rebrand phase treats `TERM_PROGRAM` as an internal protocol token until a capability matrix proves a change safe.
- **Local worktree:** spawn/attach/recover PTYs, file read/write/watch, Git status/worktree operations, persistence, and Excalidraw file save/reload/export on a local Git checkout.
- **Folder workspace:** repeat the local gates for non-git roots; preserve workspace-root scoping and host-aware file APIs.
- **WSL:** verify shell/PTY launch, path translation, Git/CLI dispatch, WSL distro isolation, environment propagation, hooks, file watcher behavior, and profile secret non-forwarding.
- **SSH:** verify connection/reconnect generations, SFTP/filesystem, remote Git, relay deployment/version mismatch, PTY spawn/reattach/resize/snapshot, remote host capability cache isolation, and no local secret crossing the host boundary.
- **Git 2.25:** run real Git 2.25.5 plus current versions; validate every capability probe, narrow fallback, cached rejection, concurrent probe coalescing, and native/WSL/SSH host isolation per `docs/reference/git-compatibility.md`.
- **Packaging/startup:** packaged offline smoke on Windows/macOS/Linux, plain Node daemon boot, native module loading, Linux glibc 2.31 floor, quit/restart cleanup, sidecar orphan cleanup, and no network calls in offline mode.
- **Approved product gates:** Claude/Codex-only picker and stale-setting sanitization; Excalidraw-only first canvas tranche; disabled upstream telemetry/updater; legacy Orca data migration without logout or workspace loss.

## Concerns and Unresolved Questions

- `[UNVERIFIED Tauri/Rust]` Which Tauri v2 webview/runtime mode will provide the required isolated host bridge, multi-window popout behavior, CSP, file-drop path access, and packaged offline asset loading?
- `[UNVERIFIED Tauri/Rust]` Can a Tauri sidecar supervise the existing Node daemon across quit, crash, update, WSL, SSH, and named-pipe/Unix-socket scenarios without changing the authenticated runtime protocol?
- `[UNVERIFIED Tauri/Rust]` Which credential-store implementation matches Electron `safeStorage` identity, availability checks, plaintext migration behavior, and explicit fallback policy on macOS, Windows, and Linux?
- `[UNVERIFIED Tauri/Rust]` Is a Rust/Tauri browser surface required, or should Electron browser/CDP/offscreen functionality be deferred/removed from the first Tauri release?
- The approved phase-03 roadmap deletes product CLI/headless `serve` but explicitly retains internal headless xterm/daemon recovery. Any migration plan must keep these meanings separate.
- `TERM_PROGRAM=Orca` is emitted by `src/main/daemon/pty-subprocess.ts`; changing it during rebrand is a compatibility decision, not a string replacement.
- No Tauri/Rust implementation or packaged spike exists in this worktree; migration order, ownership, and parity gates are recommendations based on current seams, not completed Tauri validation.

## Summary

The lowest-risk strangler path is to reuse the existing React renderer and typed `window.api`/runtime RPC contracts, put the current Node runtime/daemon/PTY/SSH/Git stack behind an authenticated sidecar, and replace Electron shell services incrementally. Electron should not be removed until the shell bridge, secure persistence, browser decision, and every Claude/Codex plus local/folder/WSL/SSH/Git-2.25 parity gate pass in packaged builds.

## Concerns

Tauri/Rust capabilities, sidecar supervision, credential-store parity, and browser/webview replacement are unverified. The existing approved aio-ade product reductions and `TERM_PROGRAM=Orca` compatibility rule must remain authoritative during migration.
