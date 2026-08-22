# ACP (Agent Client Protocol) — Generic Agent Support Research

Date: 2026-08-21 | Researcher: web-only, no repo changes
Scope: feasibility of a generic "ACP agent" slot in an Electron multi-agent orchestrator; Claude Code + Codex stay native.

## 1. Spec status, governance, stability

- Created by Zed Industries Aug 2025; now co-maintained with JetBrains under the `agentclientprotocol` GitHub org (moved from `zed-industries`). Apache-2.0, no CLA. GOVERNANCE.md + MAINTAINERS in repo. ~4k stars, 2,095 commits. https://github.com/zed-industries/agent-client-protocol (redirects to agentclientprotocol org)
- **Stable protocol version: 1** (integer MAJOR, bumped only on breaking change; features added via capabilities, non-breaking). https://agentclientprotocol.com/protocol/v1/initialization.md
- **v2 is DRAFT** (announced 2026-07-20). Breaking changes: out-of-turn `session/update`, message-ID patch semantics, structured diff overhaul (add/delete/move/copy + `git_patch`), flexible permission subjects, `_`-prefixed unknown enum variants. Guidance: ship v1, gate v2 behind negotiation + flags; "v1-only peers will remain common for some time". No stabilization date. https://agentclientprotocol.com/announcements/acp-v2-draft
- Breaking-change history: v1 shipped once; 15+ additive RFDs since without a version bump — evidence of disciplined evolution. Registry co-launch with JetBrains Jan 2026. Sources: https://blog.jetbrains.com/ai/2025/10/jetbrains-zed-open-interoperability-for-ai-coding-agents-in-your-ide/ , https://www.docker.com/blog/docker-jetbrains-and-zed-building-a-common-language-for-agents-and-ides/
- Abandonment risk: **low** — two IDE vendors co-maintain, Docker/Google/OpenAI-adjacent adapters exist, npm SDK published 2026-08-20 (active).

## 2. Protocol shape

JSON-RPC 2.0 over stdio; agent runs as client subprocess (remote HTTP/WS "work in progress"). Markdown default text format; reuses MCP JSON types. https://agentclientprotocol.com/protocol/v1/overview.md

Method surface (v1):
- `initialize` (version negotiation + capability exchange), `authenticate`, `logout`
- `session/new` (params: absolute `cwd`, `mcpServers[]`) → `sessionId`; `session/load` (replays history as updates; needs `loadSession` cap); `session/set_mode`
- `session/prompt` → streams `session/update` notifications (message chunks, thoughts, `tool_call`/`tool_call_update`, plans, mode changes) → response with `stopReason` (`end_turn|max_tokens|max_turn_requests|refusal|cancelled`)
- `session/cancel` (notification; agent MUST answer pending prompt with `cancelled` stop reason; client MUST resolve pending permission requests as cancelled)
- **Client-implemented** (agent→client calls): `session/request_permission`, `fs/read_text_file`, `fs/write_text_file`, `terminal/create|output|wait_for_exit|kill|release`, `elicitation/create`
- Tool calls: kinds (`read/edit/execute/think/...`), statuses (`pending/in_progress/completed/failed`), content = text | **diff (`path`,`oldText`,`newText`)** | **embedded terminal (`terminalId`)**; `locations` enable follow-along. https://agentclientprotocol.com/protocol/v1/tool-calls.md
- **MCP passthrough**: client hands agent MCP server configs at `session/new` — stdio (mandatory: `command`/`args`/`env`) or http (capability-gated). So host's MCP config can be forwarded generically. https://agentclientprotocol.com/protocol/v1/session-setup.md

## 3. Agents shipping ACP today (Aug 2026)

Official list https://agentclientprotocol.com/get-started/agents.md + registry JSON https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json (39 entries, versioned, with npx/binary/uvx distribution):

| Agent | ACP path | Maturity |
|---|---|---|
| Gemini CLI | **native**, stable `--acp` flag (was `--experimental-acp`); registry `gemini@0.56.0` | mature, Google-maintained. https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/acp-mode.md |
| Claude Code / Claude Agent | **adapter**: `@agentclientprotocol/claude-agent-acp` 0.70.0 (renamed from `@zed-industries/claude-code-acp`, dep'd at 0.16.2); built on Claude Agent SDK | mature, actively published (2026-08-18) |
| Codex CLI | **adapter**: `@agentclientprotocol/codex-acp` 1.6.2 (renamed from `@zed-industries/codex-acp`); built on Codex App Server, bundles `@openai/codex`; ChatGPT login / API key / gateway auth | mature; ACP NOT native in Codex CLI. https://github.com/agentclientprotocol/codex-acp |
| OpenCode | **native** `opencode acp` command; registry `opencode@1.18.21`; "all features supported" except some slash cmds (/undo,/redo) | mature. https://open-code.ai/en/docs/acp |
| GitHub Copilot CLI | native, "public preview"; registry 1.0.80 | preview |
| Cursor CLI | native; registry `cursor@2026.08.11` | shipping |
| Others | Goose, Cline, Qwen Code, Kimi CLI, Kiro CLI, Junie, Mistral Vibe, Devin, Factory Droid, Augment, Amp, fast-agent, Stakpak, VT Code, ~25 more | varies; registry curates only agents that support authentication |

Takeaway: one ACP slot covers Gemini CLI + OpenCode + long tail. Claude/Codex ACP adapters exist too — useful later if native integrations ever get demoted, but staying native for them is fine (Zed itself uses these adapters).

## 4. Client-side libraries

- **TypeScript (official)**: `@agentclientprotocol/sdk` **1.4.0**, Apache-2.0, published 2026-08-20. Old name `@zed-industries/agent-client-protocol` deprecated at 0.4.5. Provides both client- and agent-side bindings over ndjson streams (Zed's docs call it the official SDK). (verified via npm registry API)
- **Rust (official)**: crate `agent-client-protocol` **2.0.0** (+ `agent-client-protocol-schema`), Apache-2.0, ~3.8M downloads, updated 2026-07-23. https://crates.io/crates/agent-client-protocol
- Also official Python/Kotlin/Java SDKs per repo README. Schema artifacts: `schema/v1`, `schema/v2` (v2 published as `2.0.0-alphaX`); note "wire compatibility ≠ crate/schema release version".
- For Electron main process: TS SDK is the fit. License Apache-2.0 → fine.

## 5. Minimal ACP client (host) requirements

1. **Spawn + transport**: spawn agent subprocess (command/args/env, absolute paths), wire stdin/stdout to SDK `ClientSideConnection`. stderr → logs.
2. **`initialize`**: send `protocolVersion: 1`, `clientCapabilities` (`fs.readTextFile/writeTextFile`, `terminal: true` if you can host embedded terminals, `auth.terminal` if you can relaunch agent interactively), `clientInfo`. Handle mismatched version → close + inform user.
3. **Auth**: if `authMethods` non-empty and agent returns auth-required error, run `authenticate` or the terminal auth method (relaunch same command with agent-supplied args/env in an interactive PTY; exit 0 = success, then reconnect). RFD stabilized 2026-08-20. https://agentclientprotocol.com/rfds/auth-methods.md
4. **Session lifecycle**: `session/new` with `cwd` (worktree/workspace dir) + forwarded `mcpServers`; optionally `session/load` when `loadSession` cap present; `session/set_mode` for permission modes.
5. **Prompt loop**: `session/prompt` with content blocks; consume `session/update` stream; render agent/thought chunks, plan entries, tool calls; finish on `stopReason`.
6. **Permission prompts**: implement `session/request_permission` — render options (allow-once/always/reject variants supplied by agent), respond; auto-respond `cancelled` on turn cancel.
7. **FS methods**: implement `fs/read_text_file` + `fs/write_text_file` (lets agent see unsaved-editor state; for a terminal-first host, plain disk IO is acceptable) — or omit capability and agent falls back to its own FS tools.
8. **Diff rendering**: tool-call `diff` content (`oldText`/`newText`) → your diff viewer. NOTE: agent applies edits itself (via `fs/write_text_file` or its own tools); the client renders, it does not apply patches.
9. **Terminal methods** (optional cap): create PTY-backed command execution on agent's behalf, report output/exit; embed by `terminalId` in tool calls. You already own a terminal layer — this is a strength.
10. **Cancellation**: `session/cancel` notification; tolerate late updates; expect `cancelled` stop reason.

## 6. UX model vs raw PTY agents

- ACP agents emit **structured chat-turn data** (markdown chunks, tool cards, diffs, plans, permission dialogs) — not ANSI streams. A PTY grid cannot render this; you need a **chat-style pane** per ACP session (this is Zed's Agent Panel model; JetBrains AI Assistant chat likewise).
- Implications for a terminal-centric host:
  - Keep PTY path for native Claude/Codex; add a distinct "structured session" surface for ACP agents (message list + tool-call cards + diff blocks + permission buttons + input box). Markdown rendering required, no HTML needed.
  - Terminal capability lets ACP tool executions still show live terminal output embedded in the chat card — reuse your PTY/xterm infra for those `terminalId` views.
  - Interactive agent login flows still need a real PTY (terminal-auth method relaunches the agent CLI interactively) — another reuse of existing infra.
  - Follow-along (file `locations`) is optional; skip if no editor pane.
- Cannot "fallback to PTY" for an ACP agent generically: many (Gemini CLI, OpenCode) also have TUIs, so a per-agent "run as terminal instead" toggle is possible, but then you lose structured diffs/permissions. Recommend: ACP slot = chat pane, period; agents with TUIs can still be added as plain terminal agents by the user.

## 7. Known limitations

- **Auth**: heterogenous — agent-owned (`/login` in-thread, env API keys, browser OAuth, terminal relaunch). No unified token store; host must surface per-agent auth states. Zed: agent "usually owns its own auth". https://zed.dev/docs/ai/external-agents
- **Discovery/config**: solved-ish via ACP Registry (`registry.json` with npx/binary/uvx distribution metadata + versions + auth support flag); still need local install/update plumbing. https://agentclientprotocol.com/get-started/registry.md
- **Remote agents**: HTTP/WS transport still WIP; stdio-only today (fits your SSH story poorly unless you run agent on remote host and pipe stdio over SSH — same trick as MCP; feasible since transport is plain stdio, but terminal-auth capability must be omitted when you can't relaunch interactively, per RFD).
- **Windows**: JetBrains: ACP agents **not supported under WSL**; PATH inheritance for GUI-launched apps → use absolute binary paths; npx `.cmd` shim spawn quirks apply (standard Node-on-Windows issues). https://www.jetbrains.com/help/ai-assistant/acp.html
- **v1→v2 churn**: diff format and update semantics change in v2; isolate protocol types behind an internal adapter layer.
- **fs methods are text-only** (`read_text_file`/`write_text_file`); binary handled agent-side; v2 RFDs address deleted-file diffs etc.
- Session persistence (`session/load`) optional per agent — don't assume resume works everywhere.

## 8. License compatibility

Protocol spec, TS SDK (`@agentclientprotocol/sdk`), Rust crates, and both official adapters: **Apache-2.0**. Apache-2.0 deps in an MIT app: compatible; obligations = preserve LICENSE/NOTICE in distributed bundles (standard Electron third-party-notices flow). No CLA, no copyleft. Verified via npm registry metadata + repo README.

## 9. Effort estimate: generic "ACP agent" slot in existing Electron orchestrator

Components (main process unless noted):
1. **AcpAgentProcess**: spawn/supervise agent subprocess, `ClientSideConnection` from `@agentclientprotocol/sdk`, restart/exit handling — S (~2-3 d) — mirrors existing agent-process management.
2. **Client method handlers**: permission, fs read/write, terminal/* (bridge to existing PTY layer), elicitation — M (~4-6 d); terminal bridging is the largest piece but reuses infra.
3. **Session manager**: initialize/auth/new/load/prompt/cancel state machine per agent instance, IPC to renderer — M (~3-5 d).
4. **Renderer chat pane**: message stream renderer (markdown), tool-call cards, diff viewer (reuse existing diff component if any), permission dialog, plan display, input box — M-L (~5-8 d) — biggest new UI surface.
5. **Agent config UI**: add-ACP-agent form (command/args/env/cwd) + optional registry.json-backed picker — S (~2-3 d).
6. **Auth flows**: authMethods UI + terminal-auth relaunch into a PTY tab — S-M (~2-4 d).
7. Testing (Gemini CLI `--acp`, `opencode acp`, one adapter) + Windows/SSH validation — M (~3-5 d).

**Total: roughly 3-5 engineer-weeks** for a solid v1-protocol client with permission/diff/terminal support; ~2 weeks for a bare-minimum (no terminal cap, no session/load, minimal chat UI). Comparables: community VS Code/Obsidian ACP clients are single-maintainer projects, confirming a client is tractable.

## Recommendation (ranked)

1. **Adopt ACP v1 via `@agentclientprotocol/sdk` for the generic slot** — low risk (Apache-2.0, Zed+JetBrains governance, 39-agent registry), one integration buys Gemini CLI + OpenCode + Copilot CLI + long tail. Keep Claude/Codex native as planned.
2. Defer v2 until stable; wrap protocol types in an internal adapter to absorb the diff-format change.
3. Do NOT attempt PTY-rendering of ACP output; build the chat pane. Reuse PTY infra for embedded terminals + terminal-auth.
4. Optional later: swap native Claude/Codex to the official ACP adapters if maintenance cost of native integrations grows — adapters are actively maintained by the ACP org itself.

Trade-off matrix (generic-agent approaches):
| | ACP slot | Per-agent native | PTY-only generic |
|---|---|---|---|
| Effort/agent | ~0 after slot | high each | ~0 |
| Structured diffs/permissions | yes | yes | no |
| Coverage | 39+ agents | few | any CLI |
| Maintenance | protocol tracks upstream | per-agent churn | none |
| Risk | v2 migration later | high | UX ceiling |

## Limitations of this research
- No hands-on protocol testing; behavior claims from docs/announcements only.
- Per-agent ACP quality (Gemini vs OpenCode vs Copilot) not benchmarked; docs claim feature parity but real-world fidelity varies.
- SSH-remote stdio piping asserted feasible from transport shape, not verified.
- npm download counts unavailable (npmjs.com blocked 403); adoption inferred from registry + ecosystem breadth.

## Unresolved questions
1. v2 stabilization date — none announced; affects when to build the type-adapter layer for v2.
2. Whether Gemini CLI free-tier changes (June 2026 Code Assist shutdown for free tier per third-party cheat sheet) affect ACP usage economics for users — verify against official Google docs before shipping Gemini presets.
3. Exact behavior of ACP over SSH-piped stdio (agent on remote host) — needs a spike.

## Key links
- Spec: https://agentclientprotocol.com | repo: https://github.com/agentclientprotocol/agent-client-protocol
- v2 draft: https://agentclientprotocol.com/announcements/acp-v2-draft
- Registry: https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json
- Adapters: https://github.com/agentclientprotocol/codex-acp , npm `@agentclientprotocol/claude-agent-acp`
- Zed client reference behavior: https://zed.dev/docs/ai/external-agents
- JetBrains client docs: https://www.jetbrains.com/help/ai-assistant/acp.html
