# Phase 01 baseline results

- Captured: `2026-07-30T17:39:07+07:00`
- Source commit before Phase 01: `20b784a4bad9247aa37f479e20c9afe119d4554d`
- Host: Windows 11
- Runtime: Node `24.12.0`, pnpm `10.24.0`, Git `2.52.0.windows.1`
- Repository inventory: `11,140` files, normalized repo-relative paths only; mobile effective ownership: `1,180` paths across package, mobile-named desktop/config/docs surfaces
- Rust prerequisite: `rustc` and `cargo` missing from `PATH`; deferred to Phase 06 bootstrap

## Baseline gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Focused PTY/xterm/SSH/Fable oracle | pass | 7 files, 115 passed; no skip recorded in the focused result |
| Extended terminal scout oracle | pass | 22 files, 270 passed, 1 skipped |
| Phase 01 preflight and fixture contracts | pass | 4 files, 16 passed |
| `pnpm typecheck` | pass | Node, CLI, and Web TypeScript projects |
| `pnpm test` | inconclusive | Ran for more than five minutes without output and was terminated; no failure was hidden or reclassified |
| `pnpm lint` | pre-existing failure | Reached `verify:skill-bundle-manifest`; three tracked skill artifacts are stale |
| `pnpm build:desktop` | pass | Relay, CLI, Electron/Vite, and web projection built in 234 seconds; existing Vite import and CSS `::highlight` warnings only |
| Electron packaged smoke | pending | Requires the focused packaged Windows runner |
| macOS/Linux/WSL/SSH live matrix | pending | Requires matching hosts or CI credentials |

The lint failure predates Phase 01 product changes. Oxlint native/type-aware,
reliability gates, and max-lines ratchet passed before the stale generated
skill-artifact gate failed. Phase 01 does not regenerate those artifacts because
they are outside its ownership and will be removed or renamed by later scope.

The additive `aio-ade-preflight-baseline/v1` scope fields are `matchedPaths`,
`effectiveOwnedPaths`, resolver-aware `reverseImportPaths`, auditable
`couplingReferences`, and top-level `ownershipOverlaps`. Mobile ownership covers
the package, generic files inside `src/**/mobile/**`, and mobile-named
desktop/config/docs assets, while explicit
exclusions preserve Android/iOS emulator and browser/terminal mobile-driver
surfaces. Relative imports,
tsconfig aliases, `.js` specifiers targeting TypeScript, and `require.resolve`
are resolved. Each overlap emits `effectiveOwner`; the earliest owner phase
performs the destructive action and later owners consume the recorded absence.

## Artifacts

| Artifact | SHA-256 |
| --- | --- |
| `tests/fixtures/aio-ade-migration/terminal-oracle.json` | `8DE27BE7DE88402746DE51A82F7DA4101AF20BAEE55CFF0A9AF806D4CBA6EAB9` |
| `tests/fixtures/aio-ade-migration/legacy-state.json` | `2C86FE4CC880A64E3AB4BED64B2055E2AF7F368EF7342EF28D88AE6118AC81C2` |
| `reports/preflight-baseline.json` | `81494EC2EC08A6C359A77C8BC9F82A2BB6E24A40E24D6149AFD82DFE8434A670` |

The terminal fixture keeps Fable model selection provider-neutral with
`claude --model fable`, covers worktree/folder plus local/WSL/SSH routes, and
hashes the exact byte stream containing alternate-screen, Kitty, OSC 10/11,
bracketed paste, invalid UTF-8, and reconnect sequencing.

## Known gaps carried forward

- Alias inventory parses JSON tsconfig path maps and applies them repository-wide; JSONC configs and nearest-project alias precedence remain a Phase 02/04 scout check before destructive filtering.
- No single live test launches Claude Fable across all six workspace/transport combinations.
- WebView2, WKWebView, and WebKitGTK parity is unverified.
- Tauri app/sidecar signing and Linux glibc 2.31 packaged evidence do not exist yet.
- SSH and WSL live tests need configured hosts; local fixtures remain the deterministic fallback.
