# Phase 02 delete manifest: mobile companion

generated: 2026-08-22T07:29:47Z
commit before delete: c165df0308049043d51fee75eca1deec894be209

Scope decision: **Option A** — delete the React Native tree and its config/CI/doc couplings only.
The 162 desktop-side `src/**` modules whose names contain "mobile" (pairing, E2EE v1/v2, QR,
notification replay, emulator pane) stay. They run in Electron, not in the RN app, and removing
them is a separate scope decision with its own acceptance criteria. Mixing it into the tree
delete would make this commit unrevertable in practice.

## Deleted

### React Native tree

| path | tracked files |
|---|---:|
| `mobile/` | 1048 |

### Workflows

- `.github/workflows/mobile.yml`
- `.github/workflows/mobile-android-release.yml`
- `.github/workflows/mobile-ios-release.yml`

### README-only assets (no code consumer; resources/onboarding/feature-wall is a separate set)

- `docs/assets/feature-wall/mobile-companion-app-showcase.gif` (776K)
- `docs/assets/feature-wall/mobile-companion-app-showcase.jpg` (112K)

## Config, gate and doc edits

| file | change | why |
|---|---|---|
| `package.json` | dropped literal `mobile` from `audit:code-quality:native` | oxlint exits non-zero on a nonexistent path, which would fail `pnpm lint` |
| `config/reliability-gates.jsonc` | deleted gate `mobile-ui.drawer-close-continuity`; pruned 8 `testFiles`, 4 commands, 6 `assertionRefs` and 3 `evidenceRuns` from 3 surviving gates; corrected their `coverageNotes`; dropped `ios`/`android` from `mobile-relay.endpoint-recovery` platforms | 53 gates → 52. The deleted gate's only test file lived in the RN tree. `check-reliability-gates.mjs` asserts every `testFiles` path exists, so stale entries fail lint. The three survivors keep real desktop/shared coverage; their notes no longer claim RN evidence that is gone |
| `config/max-lines-baseline.txt` | 353 → 334 entries | 1 `inline mobile/…` plus 18 `mobile-config …` globs, pruned with the tool's own `--prune` |
| `config/scripts/check-max-lines-ratchet.mjs` | removed `MOBILE_CONFIG_PATH`, `collectMobileBumps()` and the mobile branch of the failure message | it read `mobile/.oxlintrc.json`, deleted with the tree. No `max-lines` bump was added anywhere (AGENTS.md) |
| `config/scripts/check-max-lines-ratchet.test.mjs` | dropped the `collectMobileBumps` suite, re-pointed a `parseBaseline` fixture | followed the removal above; 13 tests still pass |
| `config/electron-builder.config.cjs` + its test | removed `'!mobile{,/**/*}'` | dead exclusion |
| `config/scripts/marine-creatures-parity.test.mjs` | deleted | its sole assertion compared the shared corpus against the RN mirror; `src/shared/marine-creatures.ts` is kept and still used by worktree name suggestions |
| `src/main/runtime/mobile-rpc-allowlist.test.ts` | replaced the `mobile/app` + `mobile/src` source scan with the curated method lists | the scan threw ENOENT. `MOBILE_RPC_METHOD_ALLOWLIST` in `runtime-rpc.ts` is **live**: it rejects any method outside it for devices paired with scope `mobile`, which the paired web client still uses. Mutation-checked: removing one allowlist entry fails the test |
| `pnpm-workspace.yaml` | rewrote the comment, kept `packages: []` | the old comment justified the file by `mobile/` being a separate workspace. The file still matters: deleting it re-enables `pnpm -r` auto-discovery and would break `patchedDependencies` |
| `config/scripts/check-changed-code-quality.mjs` + test | generalized two comments | they cited `mobile/.oxlintrc.json` as the reason nested-config discovery stays on; the reason is generic |
| `README.md` | removed the Mobile Companion feature cell and the iOS/Android download section; fixed the hero alt text | phase-02 criterion: no APK/iOS link in the user-facing README. Table structure verified balanced |

## Deliberately kept

- **162 desktop-side `src/**` modules** named "mobile": pairing UI (30 renderer components), E2EE v1/v2, QR, notification replay, presence lock, RPC allowlist, emulator pane (16 files). These run in Electron and serve the paired **web** client.
- `test:e2e:floating-mobile-emulator` and both mobile-named e2e specs: they drive desktop UI, not the phone app.
- `config/oxlint-plugins/mobile-pairing-qrcode-import.mjs`: still guards two live desktop importers of `qrcode` (`src/main/index.ts`, `src/main/runtime/mobile-pairing-qr.ts`).
- `mobile-v*` release-tag handling in `create-draft-release`/`latest-stable-release` tests: asserts `parseDesktopReleaseTag` **rejects** non-desktop tags. Old `mobile-v*` releases still exist on GitHub, so the guard stays useful.
- `auto.components.mobile.*` locale keys (158 in en, ~3,050 values across 5 locales): consumed by surviving desktop renderer components; locale parity holds at 11,548 keys per locale.
- `migrateMobilePairingDataToCanonicalUserDataPath()` in `persistence.ts`: a data migration, not dead code.

## Verification

| Gate | Result |
|---|---|
| `pnpm lint` | exit 0 (52 gates, 334 ratchet entries, locale parity 11,548 x 5) |
| `pnpm typecheck` | exit 0 |
| `pnpm build:desktop` | exit 0 (768 files / 40.5 MiB web client) |
| `src/shared/mobile-companion-removal-guard.test.ts` | 15/15 — written **before** the delete, 7 red then green |
| Full vitest suite | **1 failed / 39,911 passed / 153 skipped** |

The single remaining failure is `project-view-wrapper-source-context-boundary.test.ts`, the same
load-only timeout already recorded as deferred in `local-verification-baseline.md`: it passes in
isolation at 19.6 s and only exceeds the 30 s cap under an unsharded full-suite run on this box. It
is unrelated to the mobile deletion — it also failed on the phase-01 baseline, before any file was
removed. CI shards this suite 16 ways, so phase 12 is the authority.

Suite totals moved from 39,869 passed to 39,911 passed. Test files went 3,788 → 3,791: the RN tree
contributed no files to this suite (it ran under its own `pnpm --dir mobile` workspace), and the net
gain is the new phase-01 and phase-02 guard suites minus the deleted marine-creatures parity test.

## Reverting

Every deletion is one commit against a clean tree, so `git revert` restores the RN app, its
workflows, its gate, its ratchet entries and the README sections together. The desktop-side pairing
and E2EE code was never touched, so a revert does not need to reconcile two halves of a split.
