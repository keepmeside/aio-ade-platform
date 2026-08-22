# Coupling map: `src/cli/` reduction to a minimal agent bridge (phase 03 prep)

Generated 2026-08-22 at commit `0304a365`. Read-only inventory. Decision context: **Option A approved** —
keep a minimal bridge, **no legacy alias** (ship `aio-ade` only, not `orca`/`orca-ide` on PATH).

## Actual command surface

216 commands across 20 spec files (`src/cli/specs/`, aggregated by `COMMAND_SPECS` in `specs/index.ts`).
146 tracked files, 1.5 MB.

| Spec file | Commands | Notes |
|---|---:|---|
| `browser-advanced.ts` | 40 | cookies, viewport, intercept, capture, mouse, storage, dialogs |
| `browser-basic.ts` | 37 | snapshot/click/fill/type/tab/profile |
| `core.ts` | 26 | `open`, `status`, `claude-teams`, `repo *`, `worktree *`, `terminal *` |
| `linear.ts` | 23 | Linear issue/team/project/label/comment |
| `orchestration.ts` | 21 | run/send/check/reply/inbox/task/dispatch/ask/coordinator/gate/reset |
| `emulator.ts` | 16 | Android emulator control |
| `computer.ts` | 14 | desktop computer-use actions |
| `automations.ts` | 7 | |
| `project.ts` | 7 | |
| `orchestration-worker-specs.ts` | 5 | `worker-start/show/read/stop/abandon` |
| `environment.ts` | 4 | |
| `linear-mcp.ts` | 4 | |
| `agent-hooks.ts` | 3 | `agent hooks status/off/on` |
| `file.ts` | 3 | |
| `skills.ts` | 2 | |
| `diagnostics.ts` | 1 | `diagnostics memory` |
| `introspection.ts` | 1 | `agent-context` |
| `serve.ts` | 1 | `serve` — headless runtime |
| `vm.ts` | 1 | `vm recipe doctor` |

## Load-bearing: what the desktop itself invokes

This is the part that makes the CLI non-optional. Deleting these breaks worker orchestration, not just
a convenience surface.

| Consumer | Evidence | Commands required |
|---|---|---|
| Orchestration preamble injected into every terminal agent | `src/main/runtime/orchestration/preamble.ts:42,64` — "the dispatch preamble teaches agents about Orca's CLI commands"; "You talk to the coordinator only through the CLI commands below" | `orchestration send`, `orchestration check`, `orchestration ask`, `orchestration reply` (with `--from`, `--terminal`, `--dispatch-capability` flags) |
| Coordinator binary-name resolution | `src/main/runtime/orchestration/cli-command.ts:5` — `export type OrchestrationCliCommand = 'orca' \| 'orca-ide'`; picks `orca-ide` for WSL/UNC paths, `orca` otherwise | the bridge binary must exist on the agent's PATH inside the pane |
| Dev-mode variant | `preamble.ts:51` — `params.devMode ? 'orca-dev' : (params.cliCommand ?? 'orca')` | `orca-dev` shim |
| Claude Agent Teams (**kept** per 2026-08-21 decision) | `src/main/runtime/claude-agent-teams-shim-env.ts:65-80` resolves `orca-dev`/`orca` on PATH and falls back to a bundled launcher at `resourcesPath/bin/orca`; shim root `~/.orca/claude-agent-teams-bin` | `claude-teams` + a real binary present at a resolvable path |
| Bundled skill guides | 115 references to `orca linear`, 26 `orca terminal`, 17 `orca serve`, 11 `orca worktree`, 11 `orca orchestration check`, 9 `orca vm`/`orca status`, … | any command a shipped skill guide teaches is a de-facto contract; `verify:bundled-skill-guides` and `verify:skill-bundle-manifest` run inside `pnpm lint` |

The skill-guide dependency is the one most likely to be missed: `pnpm lint` verifies the bundled guides,
so dropping a command whose guide still references it can fail lint rather than a test.

## Proposed keep-set vs candidate-drop

Keep-set (what the orchestration round-trip and the kept launch modes actually need):

- `orchestration send | check | ask | reply | inbox` — the preamble contract.
- `orchestration run-* | task-* | dispatch* | worker-* | coordinator-* | gate-* | reset` — the coordinator/worker
  lifecycle the desktop drives; `worker-start/show/read/stop/abandon` are how panes are attached.
- `core.ts`: `open`, `status`, `claude-teams`, `terminal *` — `claude-teams` is the kept Agent Teams entry point;
  `terminal *` is how agents read/send within panes.
- `agent-context`, `agent hooks status/off/on` — hook plumbing the agents rely on.

Candidate-drop (large surfaces with no desktop-side invoker found):

| Surface | Commands | Caveat before dropping |
|---|---:|---|
| `browser-basic` + `browser-advanced` | 77 | check for skill guides and plugin docs teaching them |
| `linear` + `linear-mcp` | 27 | **115 skill-guide references** — dropping requires regenerating guides |
| `emulator` | 16 | pairs with the desktop emulator pane; the pane may not need the CLI |
| `computer` | 14 | computer-use native sidecars; `smoke:computer` / `verify:computer-native` scripts exist |
| `automations`, `project`, `environment`, `file`, `skills`, `diagnostics`, `vm` | 25 | mostly convenience; `skills`/`vm` appear in guides |
| `serve` | 1 | **decided separately**: feature-flag OFF in the first release, delete decision deferred to phase 09 |

Dropping the browser + linear + emulator + computer groups alone removes ~134 of 216 commands while leaving
every desktop-invoked path intact. That is the concrete shape of "minimal bridge".

## Build, packaging and gate couplings

| Location | Evidence | Effect of reduction |
|---|---|---|
| `package.json:8-9` `bin` | `"orca": "./out/cli/index.js"`, `"orca-dev": "./config/scripts/orca-dev.mjs"` | must become `aio-ade` (+ dev variant) with **no** `orca` alias per the approved decision |
| `package.json:71` `build:cli` | `tsc -p config/tsconfig.cli.json --outDir out … && verify-cli-bin.mjs --fix-executable --fix-package-json && install-dev-cli.mjs` | all three steps assume the bin name |
| `config/tsconfig.cli.json`, `config/tsconfig.tc.cli.json` | `typecheck:cli`, `typecheck:tsc:cli`, and the aggregate `typecheck` | file-list changes only; no rename needed |
| `config/scripts/verify-cli-bin.mjs` | `verify:cli-bin` script | asserts the bin exists and is executable — name-coupled |
| `config/scripts/install-dev-cli.mjs` | run by `build:cli` | installs the dev shim on PATH — name-coupled, and the source of the "no bare `orca` on Linux" concern (GNOME Orca conflict) |
| `package.json:76,78` `build:desktop` / `build:release` | both include `build:cli` | CLI stays in the desktop build |
| `package.json:27` `test:repro:remote-agent-session` | `build:cli && build:electron-vite && …` | keep working |
| `src/main/runtime/orchestration/cli-command.ts` + `coordinator.ts:32` + `coordinator.test.ts` | the `'orca' \| 'orca-ide'` union is a **typed** contract in three places | narrowing/renaming this union is a compile-time worklist, which is the cheap way to find every consumer |
| `src/cli/registry-parity.test.ts`, `handler-group-manifest.test.ts`, `vocabulary-policy.test.ts`, `command-suggestion.test.ts` | parity/manifest tests over the spec registry | these are the TDD lever: they fail loudly when the registry shrinks, so they should be updated *first*, deliberately |
| `ORCA_CLI_COMMAND` env var (40 occurrences) | how the injected command name reaches panes | rename lands in phase 05, not 03 |

## Recommended phase 03 sequencing

1. Update the registry-parity / manifest / vocabulary tests to the intended reduced surface **first** (they are
   the executable spec for this phase).
2. Delete dropped spec groups + their handlers together, letting `tsc` enumerate stale imports.
3. Regenerate bundled skill guides (`generate:bundled-skill-guides`, `generate:skill-bundle-manifest`) and confirm
   no guide teaches a removed command — otherwise `pnpm lint` fails.
4. Leave `serve` in place but feature-flagged off; record it as a phase 09 decision, not a phase 03 delete.
5. Leave the binary **name** alone in this phase. Renaming `orca` → `aio-ade` is phase 05 and touches
   `bin`, `verify-cli-bin.mjs`, `install-dev-cli.mjs`, the `OrchestrationCliCommand` union, the Agent Teams
   shim, and packaging artifact names all at once.

---

## Carve executed 2026-08-22: browser group removed

Scope: **browser only**. 216 → **139 commands** (-77). The Linear, emulator and computer groups are
untouched — their removal is still the open `CLI carve scope` gate in `decisions.md`.

Browser was chosen to go first and alone because it is the only large group with **no consumer at all**,
verified six ways before deleting anything:

| Check | Result |
|---|---|
| Importers outside `src/cli` | 0 |
| `orca browser` anywhere in the repo outside `src/cli` | 0 |
| Shipped skill-guide references | **0** (vs 115 for Linear) |
| e2e specs | 0 |
| Reliability gates citing its test files | 0 |
| Formatters re-exported for non-browser callers | 0 |

That third row is the one that mattered: `verify:bundled-skill-guides` runs inside `pnpm lint`, so
carving a group whose guides still teach it fails lint — and worse, silently breaks agent workflows.
`generate-bundled-skill-guides.mjs --check` reported **unchanged** after the delete, which is the proof
no shipped guide depended on it.

### Deleted (13 files)

`specs/browser-basic.ts`, `specs/browser-advanced.ts`, `browser-handler-groups.ts` (8 handler groups,
67 keys), `browser-format.ts`, `browser.test.ts`, and 8 handlers under `handlers/browser-*.ts`.

### Fallout the compiler could not catch

Deleting the group left four kinds of dangling surface. None would have failed `tsc`, and two would
have actively misled agents:

1. **`--page` advertised on 10 unrelated commands.** `supportsBrowserPageFlag` granted the flag by
   *exclusion* ("everything except these groups"), so removing browser silently extended it to `serve`,
   `claude-teams`, `environment *`, `agent hooks *` and `vm recipe doctor`. Retired the function
   entirely, along with its `help.ts` and `args.ts` call sites and its now-vacuous tests.
2. **9 stale command-group headers** in `isCommandGroup`: `tab`, `cookie`, `intercept`, `capture`,
   `mouse`, `set`, `clipboard`, `dialog`, `storage`. Each would have made `orca tab` a valid group with
   zero members. Also dropped the dead two-part `storage local|session` branch.
3. **Root help advertised 77 deleted commands** across three sections (`Browser Automation`,
   `Browser Workflow`, `Browser Options`) plus 10 worked examples. Help is how an agent discovers what
   it may call, so this was the highest-impact leftover: an agent reading it would burn turns on
   commands that answer "Unknown command".
4. **One e2e-style assertion** in `index.test.ts` about implicit remote browser targets.

### New guard

`src/cli/help-command-coverage.test.ts` asserts every `$ orca …` example and every command line in a
help section resolves to a registered spec, an alias, or a group header. Nothing type-checks help text,
so this class of drift was previously invisible. Mutation-checked: adding a `ghost command` line to a
help section fails the suite and names it.

### Verification

| Gate | Result |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm build:desktop` | exit 0 |
| `src/cli` suite | 624 passed / 4 skipped, 51 files |
| `generate-bundled-skill-guides.mjs --check` | unchanged |
| `src/cli/browser-group-removal.test.ts` | 19 assertions, written first (3 red → green) |

## Tranche 2 audit (2026-08-22): emulator and computer are NOT safe removals

Ran the same six-way audit on the remaining candidate groups. Both fail it, for different reasons —
so the earlier recommendation of "drop emulator + computer, keep Linear" was wrong on evidence.

| Check | emulator (16 cmds) | computer (14 cmds) |
|---|---:|---:|
| Importers outside `src/cli` | 0 | **1** (`config/scripts/computer-e2e-workflow.test.mjs`) |
| `orca <group>` references outside `src/cli` | **22** | **28** |
| Shipped skill-guide references | **2** | **6** |
| e2e specs | 0 | **1** (`tests/e2e/computer-mac.e2e.ts`) |
| Reliability gates | 0 | 0 |

Compare browser, which was all zeros except one dependency-name coincidence in `package.json`.

### The blocking findings

**`computer` is wired into a live runtime error path.** `src/shared/computer-use-error-recovery.ts`
returns agent-facing recovery instructions that literally say:

> "Run `orca computer list-apps --json` and retry with the exact app name or bundle ID."

That data is consumed by `src/main/runtime/rpc/errors.ts:109` and `dispatcher.ts:281`, so **the
desktop runtime tells agents to run these CLI commands whenever a `computer.*` RPC fails**. Deleting
the CLI group would leave the app handing out instructions for a command it no longer ships. This is
not a docs problem; it is a runtime contract between the RPC error surface and the CLI.

There is also a native sidecar (`native/computer-use-macos/`) and a macOS e2e spec in the same
neighbourhood.

**`emulator` is taught by the desktop UI.** `MobileEmulatorAgentSetupGuideSteps.tsx:150` describes a
setting as "Teaches agents the orca emulator commands for this worktree", and the emulator pane
(`src/main/emulator/`, `src/renderer/src/components/emulator-pane/`) survived phase 02 as a desktop
surface. Localization catalogs carry the strings in all five locales. Removing the CLI group orphans a
UI affordance that exists to advertise it.

### Revised recommendation

Only **Linear** remains a candidate whose blockers are purely documentation (115 guide references,
regenerable). Emulator and computer each have a **runtime or UI consumer** that would have to be
removed or rewritten first, which is a larger scope change than "carve the CLI" and belongs in its own
decision — or in phase 09 cleanup once the ACP work (phase 10) has settled what agents reach.

Net: the minimal bridge lands at **139 commands** rather than the ~82 originally imagined, unless the
user accepts also changing the computer-use error surface and the emulator UI copy.
