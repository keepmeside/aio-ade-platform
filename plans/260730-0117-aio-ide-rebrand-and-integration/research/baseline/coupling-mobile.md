# Coupling map: `mobile/` deletion (phase 02 prep)

Generated 2026-08-22 at commit `0304a365`. Read-only inventory — no files modified.

## The distinction that governs this phase

`mobile/` is the **React Native companion app** (1,048 tracked files, 9.7 MB, own lockfile and
`pnpm-workspace.yaml`). It is *not* the same thing as:

- the generic web build (`build:web`, `vite.web.config.ts`, `build:web-from-renderer`),
- the renderer web client projection (`config/scripts/project-renderer-web-client.mjs`),
- the SSH / relay / runtime-RPC remote transport,
- the 162 **desktop-side** `src/**` modules whose names contain "mobile" — these implement
  pairing, E2EE, QR, notification replay and the emulator pane, and they run in the Electron main
  and renderer processes, not in the RN app.

Deleting `mobile/` does not by itself delete any of the above. Which desktop-side mobile modules also
go is a scope question phase 02 must answer explicitly: the plan's requirement is "xoá bridge IPC/preload
nếu chỉ phục vụ mobile companion", i.e. delete only what has no surviving consumer.

## Verified: no source-level import crosses the boundary

| Direction | Result |
|---|---|
| `src/**`, `config/**`, `tests/**`, `tools/**` → `mobile/**` | **zero** imports. The only near-misses are `src/renderer/src/components/settings/*.tsx` importing `../mobile/*`, which resolves to `src/renderer/src/components/mobile/`, a desktop renderer directory (30 files) |
| `mobile/**` → `src/**` | none via relative path; `mobile/` has its own dependency graph and lockfile |

The RN tree is therefore removable without breaking the TypeScript build. Every coupling below is a
*config, script, gate or doc* reference, not a code import.

## Couplings by class

| # | Location | Evidence | Class |
|---|---|---|---|
| 1 | `package.json:16` `audit:code-quality:native` passes literal path `mobile` to oxlint | `oxlint … src config tests mobile --deny-warnings` | `edit-to-drop-mobile-ref` — oxlint fails on a nonexistent path, so this must change in the same commit as the delete |
| 2 | `package.json:90` `test:e2e:floating-mobile-emulator` | runs `tests/e2e/floating-mobile-emulator-tab.spec.ts` | `needs-decision` — the emulator pane is desktop-side (16 files in `src/renderer/src/components/emulator-pane`); it streams an Android emulator and does not require the RN app |
| 3 | `.github/workflows/mobile.yml`, `mobile-android-release.yml`, `mobile-ios-release.yml` | 3 of 24 workflows | `delete-with-mobile` |
| 4 | `config/reliability-gates.jsonc` | 53 gates total; **4** have mobile-prefixed ids (`mobile-ui.*`, `mobile-relay.*`, plus `terminal-query.*` / `terminal-runtime.*` entries whose ids contain "mobile"); a further **12** non-mobile gates *mention* mobile in their body (surfaces/platforms/coverage notes) | mixed: the 4 id-scoped ones are `delete-with-mobile`; the 12 are `edit-to-drop-mobile-ref` — dropping the whole gate would silently remove desktop coverage |
| 5 | `config/max-lines-baseline.txt` | 1 of 358 entries under `mobile/` | `delete-with-mobile` |
| 6 | `config/electron-builder.config.cjs:78` | `'!mobile{,/**/*}'` exclusion in `files` | `edit-to-drop-mobile-ref` — the exclusion becomes dead once the tree is gone |
| 7 | `tests/e2e/mobile-banner.spec.ts`, `tests/e2e/floating-mobile-emulator-tab.spec.ts` | 2 specs | `needs-decision` — both drive the **desktop** UI (a banner, an emulator tab), not the RN app |
| 8 | `config/scripts/mobile-agent-status-projection-benchmark.mjs`, `mobile-pairing-qrcode-import-plugin.test.mjs`, `serve-headless-fresh-profile-pairing.mjs` | mobile-named scripts | `needs-decision` — these exercise desktop pairing/projection code |
| 9 | ~17 other `config/scripts/*.mjs` mention `mobile` incidentally (ratchet, changed-code-quality, locale policy, release scripts, electron-builder config test) | e.g. `check-max-lines-ratchet.mjs`, `locale-translation-policy.mjs`, `create-draft-release.test.mjs` | `edit-to-drop-mobile-ref` — each needs its mobile path/keys pruned, and the release scripts need mobile release tags dropped |
| 10 | `README.md:39,232,233` | App Store link, TestFlight join link, `Android APK 0.0.32` release-asset link | `delete-with-mobile` — the plan's success criterion is no APK/iOS download link in the user-facing README |
| 11 | `pnpm-workspace.yaml` | `packages: []` with a comment explaining it exists *because* `mobile/` is a separate workspace | `edit-to-drop-mobile-ref` — the plan says keep `packages: []` unless removal is proven safe; the comment must be rewritten since its stated reason disappears |
| 12 | `mobile/.oxlintrc.json` | per-tree lint config with its own `max-lines` bumps | `delete-with-mobile` (AGENTS.md forbids adding new `max-lines` bumps there; deleting the file is fine) |
| 13 | Localization catalogs (`src/renderer/src/i18n/locales/*.json` + `config/scripts/locale-*.mjs` override maps) | mobile-specific keys | `edit-to-drop-mobile-ref` — `verify:localization-catalog` and `verify:localization-coverage` are part of `pnpm lint`, so key removal must be catalog-consistent |
| 14 | `Casks/orca.rb`, `Casks/orca@rc.rb` | no mobile references found | `keep-desktop-consumer` (no action) |

## Desktop-side "mobile" module inventory (deletion candidates require per-area decisions)

| Area | Files | Notes |
|---|---:|---|
| `src/renderer/src/components/mobile` | 30 | pairing UI, QR, firewall notice, brand icons, onboarding slides; imported by `settings/MobilePane.tsx` |
| `src/renderer/src/components/settings` (mobile-named) | 24 | settings panes for pairing + emulator |
| `src/shared` (mobile-named) | 23 | E2EE fixtures/contracts shared by desktop and RN |
| `src/main/runtime` (+ `/rpc`, `/relay`) | 36 | pairing files, QR, presence lock, RPC allowlist, E2EE v1/v2 desktop session, socket wiring |
| `src/renderer/src/components/emulator-pane` | 16 | Android emulator streaming — independent product surface |
| `src/renderer/src/components/terminal-pane`, `lib/pane-manager`, `runtime`, `lib` | 20 | mobile session/tab retirement paths |
| `src/main/ipc`, `src/main/window` | 4 | `ipc/mobile.ts`, markdown request relay |

`src/main/persistence.ts:455` exports `migrateMobilePairingDataToCanonicalUserDataPath()` — a data
migration, so it is a compatibility contract, not dead code.

## Recommended phase 02 sequencing

1. Delete the RN tree + its 3 workflows + its 1 ratchet entry + README download links.
2. In the *same* commit, fix the things that break on a missing path: `audit:code-quality:native`,
   the electron-builder exclusion, the ratchet/changed-code-quality scripts, `pnpm-workspace.yaml` comment.
3. Prune the 4 mobile-id reliability gates; **edit** rather than delete the 12 that merely mention mobile.
4. Leave every desktop-side `src/**` mobile module in place in this phase. Removing the desktop pairing /
   E2EE / emulator surfaces is a separate scope decision with its own acceptance criteria, and mixing it
   into the tree delete makes the commit unrevertable in practice.
5. Gate: `pnpm lint` (which runs the localization + ratchet + reliability-gate checks), `pnpm typecheck`, `pnpm test`.
