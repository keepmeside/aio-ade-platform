# cmux (manaflow-ai/cmux)

> STATUS: PASS 1 — initial recon written to disk. Being expanded in subsequent passes.

- **URL**: https://github.com/manaflow-ai/cmux (homepage: cmux.com)
- **One-liner**: Native macOS terminal multiplexer built on libghostty, purpose-built for supervising many parallel AI coding agents (vertical tabs, per-pane notification rings, scriptable browser, Unix-socket CLI API).
- **Stack (current / Swift era)**: Swift + AppKit (explicitly "not Electron"), libghostty as a linked library (Zig build, `ghostty/` submodule @ 80d7fb3), Xcode project + SwiftPM `Packages/`, Sparkle auto-update, Bun + Biome for the TS side (`web`, `webviews`, `agent-chat`, `cmux-tui`, `cmux-browser`), Cloudflare worker (`workers/presence`), iroh p2p relay (`services/iroh-relay-minter`), iOS companion app (`ios/`).
- **License**: **GPL-3.0-or-later**. Copyright Manaflow, Inc. (2024–). The LICENSE preamble adds that Manaflow "may offer separate commercial terms" only for material it owns, not third-party code or outside contributions. GitHub's API reports `NOASSERTION` because of that custom preamble, but the actual grant is GPL-3.
  - **Can code be vendored into an MIT Electron app? NO.** GPL-3-or-later is strong copyleft. Copying any non-trivial cmux source into aio-ade would force aio-ade (the whole distributed Electron app) under GPL-3. This is a hard blocker for vendoring. Only *inspiration-only* / clean-room reimplementation is safe. Dual-commercial licensing would require contacting founders@manaflow.com, and Manaflow explicitly cannot relicense outside contributions.
- **Activity**: Very active. 25,324 stars, 2,105 forks, ~8,100 commits on `main`, created 2026-01-28, last push 2026-07-29. Dozens of commits per day (sampled 2026-03-31: 20+ commits in one day). Not abandoned, not a thin wrapper — it is a large, fast-moving native app.

## Architecture

**Current (Swift/macOS era)** — verified from the top-level tree and README:

- `Sources/` + `Native/` — Swift/AppKit app. `cmux.xcodeproj` / `cmux.xcworkspace`, `.xcode-version`, `cmux-Bridging-Header.h` and `ghostty.h` bridge Swift to the C ABI that libghostty exposes.
- `ghostty/` — git submodule. cmux consumes libghostty **as a library**, and the README is explicit it is *not* a fork of Ghostty. Terminal rendering is GPU-accelerated by Ghostty; cmux owns tabs/splits/workspaces/notifications on top.
- `CLI/` + `cmux-tui/` — the `cmux` command-line binary. Drives the running app over a **Unix domain socket API** (create workspaces, splits, send keystrokes, drive the browser). This is the programmability surface.
- `cmux-browser/` + `webviews/` — the in-app scriptable browser, README says it is **ported from `vercel-labs/agent-browser`**. Supports cookie/session import from 20+ browsers so an agent can act as a logged-in user.
- `daemon/remote/` — remote host support behind `cmux ssh user@remote`; browser panes route through the remote network.
- `workers/presence/` (Cloudflare-style edge worker) and `services/iroh-relay-minter` (iroh p2p relay) — cloud presence / relay for the iOS companion and remote features.
- `skills/` + `skills.sh` + separate `cmux-skills` collection — a shipped library of agent skills.
- Config: `~/.config/cmux/cmux.json`, and it **reads existing `~/.config/ghostty/config`** for compatibility. Project-level custom commands live in `cmux.json`.
- State: session snapshots under `~/Library/Application Support/cmux/`; agent resume-hook mappings under `~/.cmuxterm/`.
- Notifications protocol: **OSC 9 / OSC 99 / OSC 777** escape sequences emitted by agents, plus a `cmux notify` CLI wired into agent hooks. Cmd+Shift+U jumps to newest unread.
- Session restore: on quit it persists layout, working dirs, best-effort scrollback, browser history. Live process state is *not* checkpointed; instead `cmux hooks setup` installs per-agent resume hooks (Claude Code, Codex, Grok, OpenCode, Pi, Amp, Cursor CLI, Gemini, Rovo Dev, Copilot, CodeBuddy, Factory, Qoder). Only trusted/approved command prefixes auto-run; token/API-key env vars are stripped before storage.

**Historical (TypeScript/Electron era)** — GAP, being investigated in pass 2. A blobless clone is in progress to walk history for the original orchestrator (expected: Convex backend, Docker/Morph sandboxes, worktree runner, crown/judge). Do not treat any TS-era claim in this document as verified until this section is filled in.

## Features

> PASS 1 table — covers the Swift era only. TS/Electron-era rows (parallel-run orchestration, crown/judge, diff review) are the ones the target most needs and are pending pass 2.

| # | Feature | What it does | How it works (real files/APIs/mechanism) | Value for aio-ade | Effort | Approach | Priority |
|---|---|---|---|---|---|---|---|
| 1 | Per-pane notification rings + lit tabs | A coloured ring is drawn around the pane whose agent is waiting for input; its tab lights up | OSC 9/99/777 emitted by the agent, or the `cmux notify` CLI installed into agent hooks | aio-ade already parses OSC for agent status; the missing half is the *visual grammar* — ring on the pane + tab glow + unread queue. Cheap, high-perceived-quality | S | inspiration-only | must-have |
| 2 | Notification centre with jump-to-newest-unread | A panel listing all agent notifications across all workspaces; ⌘⇧U warps to the oldest/newest unread pane | In-app panel fed by the OSC stream | With 20 parallel worktree runs, "which one needs me *now*" is the core UX problem. aio-ade has status but (assumed) no global unread queue + warp | M | reimplement | must-have |
| 3 | Sidebar rows with live git/PR/port metadata | Each workspace row shows branch, PR status, working dir, listening ports, latest notification text | Swift sidebar observers; commits like `3666f48 Scope sidebar row observation to visible workspace state`, `8378943 Avoid duplicate sidebar git metadata publishes` | Directly applicable: aio-ade's worktree list should show branch + ahead/behind + PR state + detected dev-server port. Port detection is the novel bit | M | reimplement | must-have |
| 4 | Detected listening ports per workspace | Surfaces which ports a pane's process opened, so you can click through to the dev server | Process/port inspection per pane | Each parallel worktree runs its own dev server on a different port; auto-detecting and linking them removes real friction | M | reimplement | nice-to-have |
| 5 | Agent resume hooks | Per-agent shell hooks so a restarted app can re-enter the agent session instead of losing it | `cmux hooks setup`; mappings in `~/.cmuxterm/`; `cmux surface resume set`; trusted-prefix allowlist; env secrets stripped | aio-ade restarts (Electron reloads, updates) currently likely kill agent sessions. `claude --resume` / codex resume wiring per worktree is high value | M | reimplement | must-have |
| 6 | Session restore (layout + scrollback + cwd) | Quitting saves layout, working dirs, best-effort scrollback, browser history | Snapshots in `~/Library/Application Support/cmux/` | xterm.js serialize addon can persist scrollback per worktree terminal; restoring the tab/pane tree on relaunch is table stakes for a "workspace" IDE | M | reimplement | must-have |
| 7 | Security posture on resume | Only trusted or user-approved command prefixes auto-run on restore; token/API-key env vars stripped before persisting | Allowlist + env filtering; `terminal.autoResumeAgentSessions: false` opt-out | A concrete, copyable threat model for any auto-resume feature aio-ade adds. Persisting a command line that auto-executes is an RCE vector | S | inspiration-only | must-have |
| 8 | Unix-socket CLI API | `cmux` CLI creates workspaces, splits, sends keystrokes, drives the browser, all against the running app | `CLI/`, `cmux-tui/`, Unix domain socket | aio-ade has no external control surface (unverified). A local IPC/CLI lets Claude Code itself spawn sibling runs — agent-driven orchestration | L | reimplement | nice-to-have |
| 9 | Ghostty config compatibility | Reads the user's existing `~/.config/ghostty/config` | Config parser | Cheap goodwill analogue: read the user's existing Windows Terminal / VS Code terminal profile (font, theme) instead of forcing new settings | S | inspiration-only | nice-to-have |
| 10 | In-app scriptable browser | Browser panes an agent can drive; ported from `vercel-labs/agent-browser` | `cmux-browser/`, `webviews/` | Electron already has BrowserView/WebContentsView — an agent-drivable preview pane per worktree is far cheaper here than in native macOS. Strong differentiator | L | embed-webview | nice-to-have |
| 11 | Browser cookie/session import from 20+ browsers | Imports real logged-in sessions so agents can test authenticated flows | Cookie store readers per browser | Lets a parallel agent verify a logged-in flow. Also a serious security/consent surface — treat as opt-in | L | reimplement | skip (v1) |
| 12 | `cmux ssh user@remote` remote workspaces | Full workspace on a remote host, with browser panes routed through the remote network | `daemon/remote/` | aio-ade already has SSH/WSL remote hosts — **skip**, listed only so the comparison is complete | — | — | skip |
| 13 | `cmux claude-teams` native splits | Claude Code teammate mode rendered as native splits instead of tmux | Claude Code teams integration; auto env setup | Multi-agent Claude teams is a first-class Claude Code feature; rendering teammates as a pane group in aio-ade aligns with the Claude-Code-only focus | M | reimplement | nice-to-have |
| 14 | Project-level custom commands | `cmux.json` in a repo defines commands surfaced in the UI | JSON config discovery | Per-repo "start dev server / run tests / lint" buttons available inside each worktree pane | S | reimplement | nice-to-have |
| 15 | Command palette + workspace switcher (⌘P) | Fuzzy switcher across workspaces/surfaces with fingerprinting | Commits `57e4f82 Avoid retaining workspaces in cmd-p switcher`, `d75e97f Align switcher fingerprint tests with display names` | aio-ade with 20 worktrees needs a ⌘P over worktrees+runs+files. The commits also flag a real trap: switchers that retain workspace objects leak memory | M | reimplement | must-have |
| 16 | Skills library (`skills/`, `skills.sh`, cmux-skills) | Curated agent skills shipped with the app | Skill files + installer script | A curated Claude-Code-skills catalogue installable from inside aio-ade is a plausible marketplace hook | M | inspiration-only | nice-to-have |
| 17 | Sparkle auto-update + parallel NIGHTLY build | Stable and nightly ship with different bundle IDs and can run side by side | Sparkle; separate entitlements files (`cmux.release.entitlements`, `cmux.nightly.entitlements`) | electron-updater equivalent: ship a nightly channel with a distinct app id so power users can run both. Low cost, good signal | S | npm-dependency | nice-to-have |
| 18 | 21 translated READMEs / localized UI | Localized strings via `Localizable.xcstrings`; README in 21 languages | Commit `02e5ef9 Localize tab context menu and alert strings` | Evidence that i18n drove much of the 25k stars (VN/CN/JP audiences). Relevant to a commercial product | M | inspiration-only | nice-to-have |
| 19 | "Primitive, not a solution" product philosophy | Ships terminal/browser/notifications/workspaces/splits/CLI and leaves workflow to the user | README "The Zen of cmux" | Direct strategic counter-position: aio-ade *is* opinionated (worktrees + Claude/Codex). Sharpens the pitch either way | — | inspiration-only | must-have |
| 20 | Founder's Edition paid tier | Paid tier for prioritized fixes, early access to cmux AI, iOS app, Cloud VMs, voice mode, on top of GPL-3 OSS | README funding section | Proof that open-source + paid tier monetizes in this exact niche at scale | — | inspiration-only | nice-to-have |

## Reusable pointers

**Nothing here is copy-pastable — GPL-3 plus Swift/AppKit.** Read for mechanism only:

- `README.md` (+ `docs/`) — the notification protocol (OSC 9/99/777), the resume-hook security model, and the full keyboard-shortcut tables. The shortcut tables are the cheapest thing to learn from: a proven keymap for a many-agent workspace app.
- `CLI/`, `cmux-tui/` — shape of a Unix-socket control API for a desktop terminal app (verb set: workspace / surface / split / keystroke / browser / notify).
- `cmux-browser/` → upstream **`vercel-labs/agent-browser`** — that upstream, not cmux, is the thing to evaluate for an agent-drivable browser pane; check its license separately (likely permissive).
- `THIRD_PARTY_LICENSES.md` — a model for the attribution file aio-ade needs as a fork of Orca.
- Commits `8378943` / `6e6a2c9` (duplicate sidebar git metadata publishes) and `57e4f82` / `514f6b4` (switcher retaining workspaces) — concrete perf traps for live git metadata in a many-workspace sidebar. Debounce/dedupe git publishes; do not retain workspace objects in the palette.

## Integration risks

- **License is the dominant risk.** GPL-3.0-or-later. Any vendored snippet relicenses aio-ade. Even close paraphrase of distinctive Swift code is derivative-work risk. Policy for aio-ade: read the README/docs and the *observable behaviour*, never the implementation files, when building a comparable feature. Do not clone cmux into the aio-ade working tree.
- **Platform mismatch.** cmux is macOS-only (README FAQ confirms). Dev machine is Windows 11. Swift/AppKit/libghostty (Zig) cannot be reused. Anything adopted must be re-derived on xterm.js + node-pty, where Windows ConPTY has its own quirks (port detection and process-tree inspection in particular are much harder on Windows than the macOS approach).
- **Bundle size.** N/A for vendoring since nothing is vendored. If the agent-browser pane is pursued, note Electron already ships Chromium — that is the one place aio-ade is *cheaper* than cmux.
- **Security.** Two features carry real risk if copied naively: (a) auto-resume that re-executes a persisted command line — cmux mitigates with a trusted-prefix allowlist and env-secret stripping; replicate both. (b) browser cookie/session import — reading other browsers' cookie stores is credential exfiltration by construction; needs explicit per-import consent, or skip.
- **Competitive risk, not integration risk.** 25k stars in 6 months in exactly this niche, actively shipping, free, GPL. It is macOS-only and terminal-primitive rather than an IDE — that is the gap aio-ade occupies (Windows + Linux, opinionated worktree orchestration, diff/review UX). Do not compete on terminal rendering.

## Verdict

**inspiration-only** (verging on skip for code). GPL-3.0-or-later makes vendoring impossible for an MIT Electron app, and the current codebase is Swift/AppKit against libghostty, so there is nothing technically portable even ignoring the licence. Its value to aio-ade is entirely as a design reference from the most successful product in the target's exact niche: the OSC-based notification grammar (rings + lit tabs + unread queue + warp-to-newest), the sidebar-row information architecture (branch / PR / cwd / ports / last notification), the agent resume-hook model with its explicit security mitigations, and the "one CLI + Unix socket = programmable" control surface. The TS/Electron-era history is the part that could in principle be portable code — but it is also GPL-3, so it too is inspiration-only; its worth is showing which orchestration mechanisms (sandboxes, run naming, crown/judge auto-picking a winner) they built and abandoned. Highest-leverage takeaways to act on now: global unread-notification queue with warp, worktree sidebar metadata, and agent session resume.

## Gaps

- **BIG GAP: the TypeScript/Electron era is not yet verified.** Commits page 1 (sampled to 2026-03-31) is already fully Swift. The pivot is earlier in the 8,100-commit history. Still to establish: whether parallel agents ran in Docker containers, Morph cloud sandboxes, VMs, or plain git worktrees; the agent-provider abstraction shape; the diff/review/merge "pick a winner" UX; run naming/tracking; and whether a crown/judge auto-picker existed. Pass 2 is walking a blobless clone to answer these.
- Last-commit *date on main* not directly read; inferred from `pushed_at` 2026-07-29.
- Whether aio-ade already has a global notification queue, ⌘P palette, or session restore is assumed-absent from the brief, not verified against the target codebase.
- `vercel-labs/agent-browser` licence not checked.
- Windows feasibility of per-pane listening-port detection not investigated.
