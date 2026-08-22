# Telemetry `AGENT_KIND_VALUES` under the phase-04 roster narrowing

Generated 2026-08-22. Answers the phase-04 constraint:

> "Không xoá `AGENT_KIND_VALUES` historical telemetry nếu nó còn validate queued events."

## Verdict: safe to narrow, but not for the reason the plan assumed

The constraint imagines a **persisted queue** of unsent telemetry holding old agent kinds, which a
narrowed enum would then reject on read. That queue does not exist:

| Check | Result |
|---|---|
| On-disk telemetry queue (`pendingEvents`, `eventQueue`, `queuedEvents`) | **none** |
| `agentKind` field in `persistence.ts` or `PersistedState` | **none** |
| Queue implementation | `posthog-node`'s in-memory capture queue; `waitForCaptureEnqueue` (`client.ts:130`) awaits the SDK's `capture` event as "the durable boundary". Nothing survives a restart. |
| Every `agentKindSchema.safeParse` call site | 4, all in live IPC: `ipc/pty.ts:3964,4908,5163` and `ipc/terminal-startup-color-query-replies.ts:38` — each parses `args.telemetry.agent_kind` off an **in-flight IPC message** from the renderer, then emits immediately. |

So no read path can encounter a historical value after a restart. The narrowing is safe.

## The real coupling is a parity test, not a queue

`src/shared/agent-kind.test.ts:20` asserts:

```
concrete telemetry kinds === kinds mapped from every shipped TuiAgent
```

That is an **exact** equality, so narrowing `TuiAgent` to `claude | claude-agent-teams | codex`
without also trimming `AGENT_KIND_VALUES` fails this test. The two must move together, and
`TUI_AGENT_KIND_BY_AGENT` in `src/shared/agent-kind.ts` is the third file in the same edit.

Note the deliberate asymmetry to preserve: `claude` maps to `claude-code` (product name, not the CLI
string), and `'other'` stays as the escape hatch.

## Recommendation

Trim all three together in phase 04: `TuiAgent`, `AGENT_KIND_VALUES`, `TUI_AGENT_KIND_BY_AGENT`.
Keep `'other'`. Historical values already emitted live in PostHog, not in our code, so dropping them
from the enum loses nothing.

One caveat worth stating: if telemetry ever gains a disk-backed queue — plausible, since the
2026-08-21 decision moves the endpoint to Keepmeside — this analysis expires and the constraint the
plan wrote becomes real. Re-check before adding durable buffering.

## Compiler blast radius (measured, not estimated)

Narrowing the union to `claude | claude-agent-teams | codex` and running `pnpm typecheck` produces
**223 errors across 30 files**. Top of the worklist:

| Errors | File |
|---:|---|
| 54 | `src/shared/tui-agent-startup.test.ts` |
| 34 | `src/shared/tui-agent-selection.ts` |
| 29 | `src/main/text-generation/commit-message-text-generation.test.ts` |
| 14 | `src/shared/terminal-title-agent-type.ts` |
| 14 | `src/shared/ai-vault-types.ts` |
| 10 | `src/main/runtime/orca-runtime.test.ts` |
| 9 | `src/shared/agent-session-resume.ts` |
| 8 | `src/main/persistence.test.ts` |
| 7 | `src/shared/commit-message-agent-spec.test.ts`, `src/main/runtime/orca-runtime.ts` |
| ≤5 | 21 more files |

This is the phase-04 worklist and confirms the plan's chosen method: narrow the union first, let the
compiler enumerate stale `Record` entries, then delete.

Separately, 434 files mention at least one removed agent id in a string. Most are locale catalogs,
tests and display tables that the compiler will not flag, so the string sweep is a second pass after
the type errors are clear — not the same pass.

## Per-agent modules to delete (phase 04 "Delete" list)

| Directory | Files |
|---|---:|
| `src/main/pi/` | 10 |
| `src/main/opencode/` | 8 |
| `src/main/command-code/` | 3 |
| `src/main/antigravity/` | 2 |
| `src/main/hermes/` | 2 |

`src/shared/pi-agent-kind.ts` also appears in the error list and belongs with `src/main/pi/`.
