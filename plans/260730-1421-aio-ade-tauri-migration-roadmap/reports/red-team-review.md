---
title: "Red-team review: aio-ade Tauri migration roadmap"
status: completed
created: 2026-07-30
reviewer: controller
---

# Red-team review: aio-ade Tauri migration roadmap

## Scope

Adversarial pass over `plan.md`, all 12 phase files, architecture/decision/matrix docs, and the two codebase reports. The CLI bundled in this environment exposes no `ak plan red-team` subcommand, so this review records the same evidence filter and whole-plan sweep manually.

## Findings and disposition

| ID | Severity | Finding with evidence | Disposition |
|---|---|---|---|
| RT-01 | High | Root `package.json` still makes `build:desktop` depend on `build:cli` (`package.json:76`), while Phase 03 deletes CLI and Phase 11 adds Excalidraw. Multiple phases could edit the same manifest/lockfile. | **Accept.** Phase 03 is now the manifest steward; later phases submit versioned requests only. |
| RT-02 | High | The Electron shell is broad: `src/main/index.ts:5` and `src/main/index.ts:1866` own startup, while browser/CDP/offscreen code is explicitly Electron-bound (`reports/tauri-codebase-seams-report.md:35-37`). A Tauri cutover without a browser decision silently drops behavior. | **Accept.** Phase 06 now classifies browser/CDP/emulator surfaces; unresolved P1 items block cutover. |
| RT-03 | High | `TERM_PROGRAM=Orca` is emitted by `src/main/daemon/pty-subprocess.ts:566-569`; changing it as part of rebrand can break TUI capability detection and hyperlinks. | **Accept.** Phase 05 preserves the token for one compatibility window and Phase 12 documents the exception. |
| RT-04 | High | Electron persistence currently uses `safeStorage` (`src/main/persistence.ts:2,262-282`). Tauri keyring parity, reset behavior and Linux/headless availability are not verified. | **Accept.** Phase 06 adds a compatibility probe; Phase 10 gates vault claims on its report and fails closed. |
| RT-05 | High | The roadmap size is understated for 223 direct Electron seams, a 3,628-line preload contract and 698 IPC registrations (codebase seam report:10,26-30). | **Accept.** Total effort is changed to a gated 14-20 week range, not a promise. |
| RT-06 | Medium | Rust and sidecar directories do not exist yet (`src-tauri` and `src/sidecar` absent at review time). Treating them as proven seams would hide bootstrap risk. | **Accept.** Phase 06 owns an isolated spike; Phase 07 is explicitly candidate-only and Phase 08 preserves Node authority. |
| RT-07 | Medium | Removing `src/main/runtime/orchestration/preamble.ts` without tracing its CLI injection can strand worker prompts (`src/main/runtime/orchestration/preamble.ts:42-119`). | **Accept.** Phase 03 now requires generic runtime contract extraction and prompt/PTY regression gates before deletion. |
| RT-08 | Low | Full feature inventory could be lost when the old plan is superseded. | **Accept.** Canonical `feature-catalog.md` is copied into this plan and its provenance is linked. |
| RT-09 | Medium | Immediate Rust PTY/SSH rewrite, Axum/REST backend, ScriptC/Bun adoption, and tldraw embedding increase blast radius or licensing risk. | **Reject as scope change.** Existing decisions keep Node/`node-pty`/`ssh2` authority, exclude Axum/REST/ScriptC/Bun, and use Excalidraw only. |

## Verification summary

- **Claims checked:** 24 sampled paths, symbols, scripts, and contracts.
- **Verified:** 19
- **Failed:** 0
- **Unverified by design:** 5 Tauri/Rust/platform claims, all marked as feasibility gates rather than facts.
- **Primary evidence:** `reports/tauri-codebase-seams-report.md`, `reports/tauri-rust-runtime-options-report.md`, `src/main/index.ts:5`, `src/main/persistence.ts:2`, `src/main/daemon/pty-subprocess.ts:566`, `package.json:76`, `src/preload/api-types.ts`, `src/shared/agent-session-option-catalog-claude-codex.ts:71-94`.

## Whole-plan consistency sweep

- Files reread: `plan.md`, `architecture.md`, `decisions.md`, `execution-matrix.md`, `feature-catalog.md`, all `phase-*.md` files.
- Decision deltas checked: 8 (manifest stewardship, browser parity, safeStorage probe, `TERM_PROGRAM` compatibility, effort range, phase 07 filename/authority, feature catalog link, old-plan supersession).
- Stale references reconciled: 11 (`pending_review`, `phase-01-start.md`, old Phase 07 filename, direct later-phase manifest ownership, unqualified browser cutover, immediate Rust PTY wording).
- Unresolved contradictions: 0.

## Residual risks

- Tauri capability, sidecar signing, WebView variance, keyring behavior, ConPTY process trees, `russh` interoperability, and GitHub Pages remain external/implementation gates.
- GitHub Pages remains blocked by private-repository capability/billing; the plan does not make the repository public.
