# Feature Comparison: Maverick vs Aio-IDE (Orca fork)

Mode: `--compare` (no feature named in the request, intent ambiguous → compare per xia rules)
Date: 2026-08-21

## Source manifest

- Source: `https://github.com/Justmalhar/maverick` (Justmalhar/maverick), branch `main`, commit SHA not resolved (no clone performed; README fetched over HTTPS)
- Scope: whole-repo feature inventory from README + documented project layout
- License: MIT (c) Malhar Ujawane
- Stack: Tauri v2 (Rust shell) + React 19 webview + Bun sidecar (JSON-RPC over stdio) + bun:sqlite

## Local project

- `orca` v1.4.162-rc.0, Electron + electron-vite + React + pnpm, TS in `src/{main,renderer,preload,cli,relay,shared}`
- Currently mid-rebrand to Aio-IDE per `plans/260730-0117-aio-ide-rebrand-and-integration/`
- Approved direction narrows native agents to Claude Code + Codex, everything else via ACP (phase 10)

Both projects solve the same problem: a desktop workbench running multiple AI coding CLIs, each in its own git worktree. Maverick is the younger, smaller implementation; Orca already covers most of its surface with deeper platform handling (WSL, SSH, remote hosts, folder workspaces).

## Head-to-head

| Aspect | Maverick | Aio-IDE / Orca (verified locally) | Recommendation |
| --- | --- | --- | --- |
| Runtime shell | Tauri v2 + Bun sidecar | Electron (Electrobun only a gated spike, phase 11) | No change; nothing to port |
| Agent roster | claude-code, codex, gemini, aider, ollama, custom | `src/main/{claude,codex,gemini,copilot,cursor,droid,amp,grok,devin,...}`, being reduced to Claude+Codex+ACP | Keep local roster decision; Maverick's "custom CLI" slot is weaker than ACP |
| Worktree isolation | `worktree-manager.ts` | `src/main/local-worktree-filesystem.ts` + removal-recovery + git compat baseline 2.25 | Local is stronger |
| PTY terminals + splits | xterm.js, binary SplitNode tree, ⌘D/⌘⇧D, 6 panes | `TabGroupSplitLayout`, keep-alive tabs, floating terminal, ghostty dir | Parity |
| Usage / cost tracking | reads CLI logs, per-backend breakdown | `src/main/claude-usage`, `codex-usage`, `stats/*UsagePane`, `UsageBreakdownSection`, `ShareUsageCard` | Local is stronger |
| Sleep prevention | caffeinate | `agent-awake-service.ts` with `powerSaveBlocker` + macOS/Linux lid assertions | Local is stronger |
| Large paste → attachment | pastes >5000 chars detached to file | `large-text-control-paste.ts`, `monaco-large-text-paste`, `native-chat-attachment-upload` | Parity |
| Instruction injection | MAVERICK.md → CLAUDE.md → AGENTS.md, plus global | `src/shared/agent-prompt-injection.ts` | Verify fallback chain covers global-level file; small gap at most |
| Skills | YAML prompt templates with `{{file}}/{{selection}}/{{diff}}` interpolation, per-skill backend | `src/main/skills/*` + `components/skills/*` are a *discovery/freshness/update* system for Claude-style skill packages, not an inline prompt-template engine with variable interpolation | **Real gap.** Best candidate to port |
| Workspace layout presets | `⌘⇧Space` saved layouts, global `presets.yaml` | no `savedLayout`/`layoutPreset` hits; only agent-trust and browser-viewport presets | **Real gap.** Second candidate |
| Kanban task board | per-project board, drag-drop, agent-linked workspaces | `TaskPage` + provider issue lists (GitHub/GitLab/Jira/Linear); Kanban exists only as an experimental pop-out dashboard flag | Partial gap; local model is provider-backed issues, not a local board. Prefer extending TaskPage over transplanting |
| Per-message Rewind (git checkpoint + conversation fork) | yes | `agent-session-fork-context.ts`, `shutdown-checkpoint-guard.ts` exist but no per-message worktree-restore rewind | Partial gap; worth a scoped design, not a copy |
| Embedded browser + element inspector | `⌘⇧B` webview, click element → inject HTML into agent context | `src/main/browser`, `browser-pane`, `browser-annotation-viewport-bridge` | Parity |
| MCP lifecycle | `mcp-manager.ts` | `src/shared/mcp-config.ts`, `mcp-server-inspection.ts` | Parity |
| Themes | 14 bundled themes | `warp-themes`, `terminal-custom-themes`, tokens in `main.css` per STYLEGUIDE | Parity |
| Remote / SSH / WSL | not documented | relay, SSH providers, WSL git capability scoping | Local far stronger |

## Challenge questions

1. Is Maverick's Skills engine actually additive, or does it collide with the existing skill-discovery system? Source treats "skill" as a prompt template in `maverick.yaml`; local treats "skill" as an installed Claude skill package with freshness/update tracking. Risk if conflated: naming collision and a confusing second meaning of "skill" in UI and settings. Mitigation: name it prompt templates / commands, not skills.
2. Do saved layout presets survive the local keep-alive tab model and remote hosts? Maverick presets assume local PTYs and a single machine; Orca tabs can be backed by SSH/WSL/relay sessions. Risk if assumed local: a preset restores tabs against an unreachable host and hangs launch.
3. Should the Kanban board own tasks, or mirror a provider? Maverick stores tasks in its own SQLite. Orca's TaskPage is provider-truth (GitHub/GitLab/Jira/Linear). Risk of transplanting: two competing task stores and sync ambiguity.
4. Is per-message Rewind safe with worktree state Orca already guards? Maverick checkpoints the worktree per message. Orca has shutdown-checkpoint guards and removal-recovery logic. Risk: silent destructive restore over uncommitted user work outside the agent's edits.
5. Does anything here need a Bun sidecar or Rust boundary to work? No. Every candidate is business logic that fits `src/main` + IPC. Risk if assumed otherwise: pulling architecture that conflicts with the Electrobun gate.
6. Does adopting source config files (`maverick.json/yaml`) conflict with `orca.yaml` and the rebrand? Yes. Any port must land in the existing config surface under the new Aio-IDE naming, not add a second config format.

## Decision matrix

| Decision | Maverick's way | Our way | Recommendation |
| --- | --- | --- | --- |
| Prompt templates | `maverick.yaml` skills with `{{var}}` interpolation | none; skills = installed packages | Adopt the *idea* as "prompt templates" in `orca.yaml`, reuse existing prompt-injection seam |
| Layout presets | `presets.yaml` + `⌘⇧Space` | absent | Adopt, but host-aware: persist provider/host per tab and degrade when unreachable |
| Task board | own SQLite Kanban | provider-backed TaskPage | Do not transplant; extend TaskPage grouping into board columns |
| Rewind | per-message git checkpoint | fork context + shutdown guards | Design separately with explicit dirty-state refusal |
| Runtime/architecture | Tauri + Bun sidecar | Electron | Ignore |
| Agent roster breadth | 5 named backends + custom | Claude + Codex + ACP | Ignore; ACP supersedes |

## Risk score

Overall port value: low-to-moderate. Two clean wins (prompt templates, layout presets), two designs that need local rethinking (board, rewind), and the rest is already covered or better locally.

- Prompt templates: risk 3/10 (naming collision is the main hazard)
- Layout presets: risk 5/10 (remote/SSH host resolution)
- Kanban board: risk 7/10 (dual source of truth)
- Rewind: risk 8/10 (destructive worktree restore)

## Recommendation

Do not port Maverick as a feature set. Take exactly two ideas, in this order:

1. Prompt templates with variable interpolation (`{{file}}`, `{{selection}}`, `{{diff}}`, `{{branch}}`, `{{project}}`) wired into `src/shared/agent-prompt-injection.ts` and `orca.yaml`, named to avoid colliding with the existing skills system.
2. Host-aware workspace layout presets, persisting the execution host alongside each tab so SSH/WSL/folder workspaces restore correctly.

Everything else is either already implemented locally at higher fidelity or conflicts with approved decisions in the rebrand plan. Note this comparison used the README and documented layout rather than a cloned tree, so file-level claims about Maverick are from its own documentation, not verified source.

To turn either idea into an implementation plan, re-run scoped:
`/ak:xia https://github.com/Justmalhar/maverick "yaml prompt template engine" --port`
