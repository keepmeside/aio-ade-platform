# Headless `serve` dependency inventory (phase 03 step 4)

Generated 2026-08-22. Required by phase 03: *"Ghi inventory những gì `serve` cần để phase 09 có dữ liệu
quyết định xoá."*

Status after this phase: **feature-flagged OFF**, code intact. `src/cli/serve-feature-flag.ts` gates the
handler on `ORCA_ENABLE_SERVE`; failing closed means only `1`/`true` opts in. The spec stays registered
so `registry-parity` and help output stay coherent and the command explains itself rather than vanishing.

## Naming trap

`serve-sim-*` under `src/main/emulator/` (12 files) is the **Android simulator**, not headless serve.
A `git ls-files | grep serve` sweep pulls them in and overstates the delete surface by roughly half.
Phase 09 must exclude them.

## What `serve` actually reaches

Entry chain: `orca serve` → `CORE_HANDLERS.serve` (`src/cli/handlers/core.ts:94`) →
`serveOrcaApp` (`src/cli/runtime/launch.ts:77`) → spawns the **desktop binary** with `--serve` →
`src/main/index.ts` takes the headless path.

So `serve` is not a separate server implementation. It is a launcher that re-executes the packaged app
with a flag, which is why deleting it is cheaper than it looks on the CLI side and more entangled on the
main-process side.

### CLI side (delete candidates, phase 09)

| Module | Role | Shared with the keep-set? |
|---|---|---|
| `src/cli/specs/serve.ts` | the command spec | no |
| `CORE_HANDLERS.serve` in `src/cli/handlers/core.ts` | flag validation + launch | file is shared with `open`/`status`/`claude-teams`, so only the entry is removable |
| `src/cli/runtime/serve-update-supervisor.ts` | `readServeUpdateHandoffSync`, `resumeInterruptedServeUpdate`, `superviseForegroundServe` | serve-only |
| `src/cli/runtime/serve-signal-exit-diagnostic.ts` | signal-exit diagnostics | serve-only |
| `src/cli/runtime/mac-app-update-bundle.ts` (`getMacAppBundlePath`) | decides whether to write an update handoff | serve-only on this path |
| `src/shared/serve-update-handoff.ts` | `SERVE_UPDATE_HANDOFF_PATH_ENV`, `getServeUpdateHandoffPath` | shared with `src/main/serve-update-handoff.ts` |
| `serveOrcaApp` in `src/cli/runtime/launch.ts` | the launcher itself | **file is shared**: `launchOrcaApp` (used by `open`) lives here too, along with `resolveForegroundOrcaExecutable`, `getExecutableAppArgs`, `stripElectronRunAsNode`, `resolveAppRoot`, `spawnDetached` |

`launch.ts` is the entanglement: `open` and `serve` share the executable-resolution and spawn helpers.
Deleting `serve` means extracting the shared helpers, not deleting the file.

### Main-process side (delete candidates, phase 09)

| Module | Role |
|---|---|
| `src/main/server/serve-readiness.ts` | readiness signalling for the headless path |
| `src/main/server/serve-stdout-boundary.ts` | keeps stdout to the ready-JSON contract so automation can parse it |
| `src/main/serve-update-handoff.ts` | the main-process half of the update handoff |
| `src/main/startup/serve-desktop-activation.ts` | activation wiring when a headless instance is later attached to a desktop window |
| the `--serve*` argv branch in `src/main/index.ts` | `--serve`, `--serve-json`, `--serve-port`, `--serve-pairing-address`, `--serve-no-pairing`, `--serve-mobile-pairing`, `--serve-recipe-json`, `--serve-project-root` |

Nothing outside these imports `src/main/server/`, so that directory is a clean unit.

### Adjacent, do **not** pull into the bridge keep-set

Phase 03 calls these out explicitly, and they stay out:

- `src/main/ssh/ssh-remote-cli-host-passthrough.ts` — references serve but belongs to SSH remote hosting.
- The Electron update supervisor and packaging paths reached via `getMacAppBundlePath`.
- The web client bundle: `serve` prints a browser URL when it is present, which couples serve to
  `build:web-from-renderer` output. The web client has other consumers, so this is a serve→web
  dependency, not the reverse.
- Mobile pairing: `--serve-mobile-pairing` prints a mobile-scoped pairing link. That path survives
  phase 02 because the paired **web** client still uses scope `mobile`.

### Ephemeral VM recipes

`serveOrcaApp` imports `getEphemeralVmRecipeResultConnection` and `parseEphemeralVmRecipeResult` from
`src/shared/ephemeral-vm-recipes.ts`. `--recipe-json` is how a VM recipe gets its result connection
back, so **deleting `serve` deletes the recipe result channel** unless the `vm` command group provides
another. Phase 09 must check this before deciding; it is the least obvious consumer.

### Docs and scripts

| Path | Note |
|---|---|
| `docs/reference/headless-linux-server.md` | the whole guide is about `orca serve`; needs deleting or rewriting with the decision |
| `config/scripts/serve-headless-fresh-profile-pairing.mjs` | repro/verification script |
| `tests/e2e/*serve*` | 1 spec |
| skill guides | 17 references to `orca serve` |

## Recommendation for phase 09

The CLI half is a clean delete once `launch.ts` is split. The main-process half is clean except the
`--serve*` argv branch in `index.ts`. The two real blockers to check first:

1. **VM recipe result channel** — does anything else provide it?
2. **`docs/reference/headless-linux-server.md` and 17 guide references** — deleting the command means
   these ship stale instructions, and `verify:bundled-skill-guides` runs inside `pnpm lint`.

Rough scale: ~10 CLI/main modules plus 1 doc plus 1 script, minus the 12 `serve-sim-*` emulator files
that only look related.
