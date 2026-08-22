# Electrobun Migration Feasibility — Research (2026-08-21)

Scope: assess Electrobun (https://github.com/blackboardsh/electrobun) maturity + feasibility of migrating this Electron app (~11k files, TS, node-pty terminals, safeStorage, IPC, auto-updater, electron-builder, native modules, macOS/Linux/Windows + SSH/WSL). Web research only.

## 1. Version / activity / readiness

- Latest stable npm: **1.18.1** (~May 2026); active beta channel **2.0.1-beta.31 published 2026-08-21** — multiple betas/day this week ([npm versions](https://www.npmjs.com/package/electrobun?activeTab=versions)). v1.18.0 released 2026-05-03 ([changelog](https://docs.electrobunny.ai/electrobun/guides/changelog/v1-18-0/)).
- **12.7k stars**, 356 forks, ~2,356 commits ([repo](https://github.com/blackboardsh/electrobun)). Effectively a **single-maintainer** project (Blackboard Technologies / YoavCodes). README explicitly: "Issues and PRs can be used to share ideas, but there should be no expectation that I will review, respond to, or merge them" — maintainer "optimizing for focus and execution" ([README](https://github.com/blackboardsh/electrobun/blob/main/README.md)).
- Not pre-1.0 anymore (past the 2024-era "very early stages, ARM Mac only, memory leaks, no tests" phase), but **mid 2.0 rewrite**: new `Hutch` CLI, runtime decoupled from npm package, main process now runs on **Cottontail** (their own JSC-based Bun fork) or Bun ([BETA_RELEASE.md](https://github.com/blackboardsh/electrobun/blob/main/BETA_RELEASE.md), [BUILD.md](https://github.com/blackboardsh/electrobun/blob/main/BUILD.md)). No explicit "production-ready" claim in README. InfoWorld still calls it "experimental" ([InfoWorld first look](https://www.infoworld.com/article/4137964/first-look-electrobun-for-typescript-powered-desktop-apps.html)).
- Verdict: **post-1.0 version numbers, pre-production stability posture**. Rapid churn (daily 2.0 betas) = unstable API surface right now.

## 2. Platform support

Per README support table + cross-platform guide ([README](https://github.com/blackboardsh/electrobun/blob/main/README.md), [cross-platform guide](https://framework.blackboard.sh/electrobun/guides/cross-platform-development/)):

| Platform | Status | Notes |
|---|---|---|
| macOS 14+ (x64/arm64, universal) | Official | most mature |
| Windows 11+ (x64 only; arm64 via emulation) | Official | v1.18 fixed frameless/DWM issues; big DirectComposition perf work — recent, still settling |
| Ubuntu 24.04+ | Official | GTK + WebKitGTK default |
| Other Linux (gtk3, webkit2gtk-4.1) | Community | user must install deps |
| Raspberry Pi | Unofficial fork (kortexa-ai) | |

Linux caveats: **ApplicationMenu unsupported on Linux**; WebKitGTK "severe limitations", can't do advanced webview layering/masking — docs **strongly recommend bundling CEF on Linux** (kills the size advantage). Tray on Linux AppIndicator: icon clicks don't work, menu only. Behavior divergence: hidden webviews auto-passthrough on Win/Linux but not macOS. Builds are host-native only — need CI matrix per OS.

Floor mismatch with this repo: our glibc floor is Ubuntu 20.04 / glibc 2.31 (docs/reference/linux-glibc-compatibility.md); Electrobun's official floor is **Ubuntu 24.04** and **Windows 11+** (we presumably support Win10). That alone shrinks our supported-OS matrix.

## 3. Architecture vs Electron

- Main process: Bun/Cottontail (JSC, Zig). Renderer: **system webviews by default** — WKWebView (macOS), WebView2/Edge (Windows), WebKitGTK (Linux) — with opt-in `bundleCEF` to pin Chromium ([README](https://github.com/blackboardsh/electrobun/blob/main/README.md), [code-signing guide notes WebView2 default on Windows](https://framework.blackboard.sh/electrobun/guides/code-signing/)).
- Implications vs Electron's bundled Chromium:
  - **Rendering inconsistency**: three engines (WebKit x2 + Chromium) = Safari-class CSS/JS divergence on macOS/Linux, Chromium-version drift on Windows (WebView2 evergreen, user-machine dependent). Electron gives one pinned Chromium everywhere.
  - `bundleCEF` restores consistency but forfeits the ~14MB-bundle selling point and adds CEF-vs-Chromium API deltas.
  - JSC main process ≠ Node/V8: no V8-ABI native addons, different perf profile, `Bun.*` APIs instead of Node in places.
  - Small bundles (~14MB system-webview) + 4KB bsdiff patches are real advantages ([README](https://github.com/blackboardsh/electrobun/blob/main/README.md)).

## 4. API parity vs Electron

Sources: [API docs nav](https://blackboard.sh/electrobun/docs/apis/utils/), [DeepWiki system integration](https://deepwiki.com/blackboardsh/electrobun/3.4-system-integration-apis), [Better Stack guide](https://betterstack.com/community/guides/scaling-nodejs/electrobun-desktop-apps-typescript/).

| Electron feature | Electrobun equivalent | Status |
|---|---|---|
| IPC (ipcMain/ipcRenderer) | Typed RPC between main and webview | Yes, arguably nicer (typed) |
| BrowserWindow / multi-window | BrowserWindow/BrowserView + multi-window template | Yes |
| `<webview>` tag | `<electrobun-webview>` element | Yes (OOPIF-style) |
| Tray | Tray API | Yes (Linux click limits) |
| Menus | ApplicationMenu, ContextMenu | Yes, **not on Linux** |
| Dialogs | `Utils` dialog (~showMessageBox) | Partial — message boxes documented; file open/save dialogs listed under system APIs |
| Auto-update | Updater (bsdiff delta + full fallback) | Yes, built-in |
| **safeStorage/keychain** | **None documented** | Gap — would need own keychain FFI/binding |
| Preload / contextIsolation | No preload model; process isolation + RPC instead | Different model; preload code must be redesigned |
| nativeTheme, protocol handlers, session, screen, etc. | Largely undocumented/missing | Gap |
| Notifications/toasts | Not supported | Gap |

## 5. Native modules / node-pty

- Historically node-pty **fails under Bun** (`_node_module_register` symbol error), issue [oven-sh/bun#7362](https://github.com/oven-sh/bun/issues/7362) **closed as not planned**.
- Bun v1.3.5 shipped **`Bun.Terminal`** — built-in PTY via `Bun.spawn({ terminal })`, eliminating node-pty need — but **POSIX-only (macOS/Linux); no Windows ConPTY** ([Bun v1.3.5 blog](https://bun.com/blog/bun-v1.3.5), [PR #25415](https://github.com/oven-sh/bun/pull/25415)). Windows would need FFI wrappers like [@skitee3000/bun-pty](https://www.npmjs.com/package/@skitee3000/bun-pty) (Rust portable-pty over `bun:ffi`) — small community packages, low bus factor.
- General N-API on Bun improved (napi fixes in 1.3.5) but native addons remain the #1 compat pain category ([Bun node compat docs](https://bun.com/docs/runtime/nodejs-compat), [DEV 2026 compat survey](https://dev.to/alexcloudstar/bun-compatibility-in-2026-what-actually-works-what-does-not-and-when-to-switch-23eb)).
- **Unknown**: whether Electrobun's default Cottontail runtime preserves Bun's N-API layer — undocumented. Must verify empirically; can select Bun as main-process runtime instead.
- Note: Anthropic acquired Bun Dec 2025 (MIT retained) — Bun-the-runtime abandonment risk down; **Electrobun-the-framework risk unchanged**.
- SSH/WSL: our terminal/Git host abstraction (native/WSL/SSH) has zero Electrobun precedent; every native-module-backed host path needs re-validation under JSC.

## 6. Packaging / distribution

- Built-in: self-extracting Zstandard bundles; **macOS codesign + notarization built into CLI** (Developer ID, App Attest, App Store Connect API key for CI) ([code-signing guide](https://framework.blackboard.sh/electrobun/guides/code-signing/)).
- **Windows signing: not documented** (self-extracting installer or zip; no Authenticode flow in docs). No MSI/NSIS/appx equivalents of electron-builder's matrix.
- Linux: `.desktop` file integration since v1.18 ([v1.18.0](https://docs.electrobunny.ai/electrobun/guides/changelog/v1-18-0/)); no deb/rpm/AppImage story documented.
- Delta updates: **strong** — Zig BSDIFF, patches as small as 4KB, full-download fallback.
- Host-native builds only → CI runner per OS (we already do this, so minor).

## 7. License

**MIT** ([repo](https://github.com/blackboardsh/electrobun)). Cottontail is a Bun fork (Bun MIT).

## 8. Known large apps

Essentially none at our scale. **Eggbun** (maintainer's own editor, being rewritten on Electrobun), planned **colab.sh** migration (maintainer's roadmap item — i.e., even the author's flagship Electron app hasn't fully migrated), plus small community utilities (audio recorder, Scaleway secrets manager) ([topic page](https://github.com/topics/electrobun), [alternativeto](https://alternativeto.net/software/electrobun)). **No third-party large production app found.**

## 9. Verdict

**Full migration is not realistic now.** The framework is mid-2.0-rewrite with daily beta churn, single maintainer with explicit no-support policy, no safeStorage equivalent, no documented Windows signing, no app at our scale shipped, and our OS floor (Ubuntu 20.04, presumably Win10) is below Electrobun's official floor. For an ~11k-file IDE with terminals as the core feature, this is a rewrite, not a migration — the process model (JSC + no preload + typed RPC) and renderer (3 webview engines or CEF) differ structurally.

Recommended: **bounded feasibility spike only** (1–2 weeks), go/no-go criteria:
1. PTY spike: interactive shell via `Bun.Terminal` (macOS/Linux) + a Windows PTY path, driving xterm.js in an Electrobun webview, including SSH remote host case.
2. Keychain spike: prove secret storage via FFI to macOS Keychain / libsecret / Windows Credential Manager, or find a maintained binding.
3. Renderer audit: run the renderer bundle in WKWebView + WebView2 + WebKitGTK; count CSS/API breakages; decide if `bundleCEF` is mandatory (if yes, size advantage gone — reassess motive).
4. Confirm Windows Authenticode signing path exists.
5. API-churn check: does 2.0 stabilize (stable release, migration guide) within the evaluation window?

**Top 5 blockers**
1. **node-pty/terminals on Windows** — no built-in Bun PTY on Windows; ConPTY story is community-FFI only. Terminals are our core feature.
2. **No safeStorage/keychain API** — secrets layer must be rebuilt on unproven bindings.
3. **Rendering fragmentation** — WKWebView/WebView2/WebKitGTK vs pinned Chromium; WebKitGTK so limited that CEF bundling is "strongly recommended", negating the main benefit.
4. **Maintainer/maturity risk** — one maintainer, no-support policy, active 2.0 rewrite, no comparable production app.
5. **Ecosystem/tooling gap** — no electron-builder equivalent (Windows signing, deb/rpm/AppImage), OS floors (macOS 14+/Win11+/Ubuntu 24.04+) above ours, and every Electron-ecosystem dependency (electron-updater, protocol handlers, session APIs) needs replacement.

## 10. Alternatives (comparison only)

**Tauri v2**: Rust backend + system webviews (WRY: WKWebView/WebView2/WebKitGTK — same rendering-fragmentation trade-off as Electrobun). Far more mature: v2 stable since Oct 2024, large team + community, audited security model, plugins for updater/tray/dialog/deep-link, mobile targets. For us the cost is different, not smaller: JS main-process logic (terminal orchestration, Git hosts) would move to Rust or a sidecar Node process; node-pty would become a Rust pty crate. Better long-term bet than Electrobun on maturity, same webview-consistency problem, bigger language shift.

**Keep Electron**: Pinned Chromium = zero rendering divergence across macOS/Linux/Windows and inside WSL/SSH-driven flows; node-pty, safeStorage, electron-builder, auto-updater all first-class and battle-tested at exactly our app class (VS Code, Cursor, Slack). Costs: ~150–250MB installs, higher RAM, Chromium-cadence security updates. It is the only option where our current native-module and packaging investments carry over unchanged; the trade is footprint for ecosystem certainty.

## Limitations of this research

- Could not verify Cottontail's N-API support (undocumented) — needs empirical test.
- Did not test Electrobun 2.0 betas hands-on (web-only constraint).
- Windows signing absence inferred from docs; a flag may exist undocumented.
- Star count/activity from GitHub page snapshot; commit-level cadence not audited.

## Unresolved questions

- Does Cottontail keep Bun's napi layer, or must main process run stock Bun for any native addon?
- Electrobun Windows PTY plan (ConPTY) — any roadmap item?
- 2.0 stable ETA and whether 1.x → 2.0 is a breaking migration for early adopters.
