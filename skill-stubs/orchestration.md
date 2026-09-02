# AIO-ADE Orchestration

This file is a discovery stub, not the usage guide. The full, version-matched AIO-ADE
orchestration reference is served by the `aio-ade` binary itself — kept out of this file on
purpose so it can never drift from the binary that will actually run your commands.

Engage AIO-ADE orchestration whenever you need structured multi-agent coordination: threaded
messages, blocking ask/reply flows, task dispatch, worker_done/escalation waits, task DAGs,
decision gates, coordinator loops, or decomposing work across agents. Use the aio-ade-cli skill
instead for full ownership handoffs ("hand off", "handoff", "handover", "give this to
another agent", "another worktree") when the user did not ask to supervise, monitor, wait
for results, or coordinate a DAG — and for ordinary terminal control, shell commands,
worktree management, and the built-in browser. Coordination requires real AIO-ADE runtime
state; never substitute a non-AIO-ADE subagent tool.

## Resolve the CLI for this session

Choose the executable once and reuse it for every later command:

- If the `AIO_ADE_CLI_COMMAND` environment variable is set, use its value. AIO-ADE exports this
  for managed WSL sessions.
- Otherwise, in a dev checkout whose session exposes `AIO_ADE_DEV_REPO_ROOT`, use `aio-ade-dev`.
- Otherwise, use `aio-ade`. It is the same name on every platform: the pre-rebrand CLI needed a
  separate Linux name because a bare `orca` collided with the GNOME Orca screen reader
  (`/usr/bin/orca`), and `aio-ade` does not.
- Otherwise, use `aio-ade`.

Below, `AIO_ADE` is a placeholder for the executable you resolved. Substitute it before
running anything; do not create a shell variable or run `AIO_ADE` literally. This works the
same way in POSIX shells, PowerShell, and cmd.exe.

If the selected executable cannot run, report its exact error and stop. Do not fall through
to another executable, which could silently target a different AIO-ADE build.

## Load the full guide before running AIO-ADE commands

```text
AIO_ADE skills get orchestration
```

That prints the complete, version-matched guide for the exact binary that will handle your
next commands — task creation and dispatch, injected lifecycle preambles, worker_done
authority, decision gates, and coordinator loops. Read it first, then run the specific
command you need.

Don't guess subcommands or flags from memory or from a cached copy of this stub. They
change between AIO-ADE releases, and this file deliberately no longer lists them. Confirm the
app is up with `AIO_ADE status --json` (start it with `AIO_ADE open --json` if needed), and
prefer `--json` for agent-driven calls.

## If an older AIO-ADE does not recognize `skills get`

Use this fallback only when the selected binary explicitly reports that `skills get` is an
unknown command. Another failure is not proof of an older binary; report it rather than
guessing or changing executables. For a confirmed pre-guide binary, use only this bounded,
read-only bootstrap to orient. Do not dead-end and do not invent commands:

```text
AIO_ADE status --json
AIO_ADE orchestration task-list --json
AIO_ADE terminal list --json
```

Then tell the user that updating AIO-ADE restores the full, version-matched guide via
`AIO_ADE skills get orchestration`. Beyond these commands, ask the user rather than guessing a
command surface this older binary may not support.
