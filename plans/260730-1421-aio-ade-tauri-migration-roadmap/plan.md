---
title: "aio-ade: lộ trình strangler migration sang Tauri v2"
description: "Giữ Electron làm baseline, dựng Tauri v2 có cổng parity, giữ React/xterm và Node sidecar trước khi loại Electron."
status: in-progress
priority: P1
effort: "14-20 tuần, phụ thuộc parity và platform gates"
branch: codex/aio-ade-implementation
tags: [migration, tauri, rust, sidecar, security, tdd]
blockedBy: []
blocks: []
supersedes: [260730-0117-aio-ade-rebrand-and-integration]
created: 2026-07-30
authors: [Keepmeside, SalyyS1]
---

# aio-ade: lộ trình strangler migration sang Tauri v2

> **Artifact review chính:** [plan.html](./plan.html). Markdown này là index/cook handoff; phase files giữ contract thực thi chi tiết.

**Tiến độ:** 2/12 phase hoàn thành.

## Phạm vi

Chuyển fork Orca thành `aio-ade`, giữ React 19/xterm.js và hành vi PTY/SSH hiện tại. Electron vẫn là baseline cho đến khi mọi parity gate đạt; Tauri chỉ cắt sang ở phase 12. Xóa mobile, product CLI, Agent Teams, orchestration bridge và headless serve/installers/shims; giữ PTY, xterm/headless emulator, file editing, SSH, WSL và remote runtime.

## Quyết định đã khóa

- Chỉ Claude Code và Codex; Fable chạy cùng raw PTY/xterm, model-blind, dùng `--model fable`.
- Excalidraw là canvas duy nhất; tldraw loại khỏi dependency; XYFlow để sau usage validation.
- Account và API Profile tách biệt, vault mã hóa, CCS importer read-only; không forward secret sang SSH.
- Node TypeScript sidecar là runtime production đầu tiên; Rust PTY/SSH chỉ là ứng viên có gate.
- Tauri invoke/events cho control; stdio JSON-RPC/framed protocol cho sidecar; không Axum/REST, không git2 trong desktop đầu.
- ScriptC và Bun deferred; telemetry, updater, release workflow inert cho tới khi có hạ tầng fork.

## Tài liệu thực thi

- [Kiến trúc đích](./architecture.md)
- [Decision log](./decisions.md)
- [Execution và ownership matrix](./execution-matrix.md)
- [Danh mục 176 feature rows](./feature-catalog.md)
- [Phase 01 baseline results](./reports/phase-01-baseline-results.md)
- [Phase 01 capability checklist](./reports/phase-01-capability-checklist.md)
- [Báo cáo Tauri/Rust runtime](./reports/tauri-rust-runtime-options-report.md)
- [Báo cáo codebase seams](./reports/tauri-codebase-seams-report.md)

## Phụ thuộc và execution graph

`01 → 02 → 03 → 04 → 05 → 06 → {07 ∥ 08} → 09 → {10 ∥ 11} → 12`

| Phase | Deliverable | Trạng thái | Chi tiết |
|---|---|---|---|
| 01 | Preflight, baseline, runtime contracts | completed | [Preflight](./phase-01-baseline-and-contracts.md) |
| 02 | Xóa mobile/web companion | completed | [Delete mobile](./phase-02-delete-mobile-companion.md) |
| 03 | Xóa product CLI/orchestration | pending | [Delete CLI](./phase-03-delete-product-cli-and-orchestration.md) |
| 04 | Thu roster Claude/Codex, giữ Fable | pending | [Reduce providers](./phase-04-reduce-providers-to-claude-and-codex.md) |
| 05 | Rebrand `aio-ade`, compatibility readers | pending | [Rebrand](./phase-05-rebrand-identity-and-compatibility.md) |
| 06 | Freeze host/runtime contracts và Electron oracle | pending | [Feasibility](./phase-06-prove-tauri-shell-feasibility.md) |
| 07 ∥ 08 | Rust control plane/candidates ∥ Node sidecar | pending | [Rust](./phase-07-rust-control-plane-and-runtime-candidates.md), [Sidecar](./phase-08-extract-node-typescript-sidecar.md) |
| 09 | Tauri bridge, authority, parity harness | pending | [Bridge](./phase-09-integrate-tauri-bridge-and-parity-harness.md) |
| 10 ∥ 11 | Account/API profiles ∥ Excalidraw | pending | [Profiles](./phase-10-build-secure-account-and-api-profiles.md), [Canvas](./phase-11-integrate-excalidraw-and-approved-features.md) |
| 12 | Cutover/release/docs gate | pending | [Cutover](./phase-12-cut-over-electron-release-and-documentation.md) |

## Ownership và conflict strategy

Mỗi phase có file ownership độc quyền trong phase file; không chỉnh file thuộc phase khác. `package.json`, lockfile và global gates do phase 03 giữ vai trò manifest steward xuyên suốt roadmap; phase sau gửi versioned change request. Tauri manifests/capabilities do phase 09; release/config docs do phase 12. PR song song chỉ là 07/08 và 10/11, dùng protocol/schema bất biến; conflict giải quyết bằng rebase vào phase join, không cherry-pick mù và không revert thay đổi agent khác.

## Gate chung

Mỗi phase ghi `Tests Before → Refactor → Tests After → Regression Gate`. Gate tối thiểu là focused Vitest/Playwright; gate mở rộng gồm `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build:desktop` khi ownership đã hội đủ. Mọi gate phải chạy trên local git worktree, folder workspace, WSL và SSH khi liên quan; Windows/macOS/Linux, Git 2.25 compatibility và Linux glibc 2.31 được giữ trong ma trận.

## External blockers

- Rust toolchain/targets chưa có trên baseline (Node 24.12.0, pnpm 10.24.0, Git 2.52; `rustc`/`cargo` không có PATH): phase 06 chỉ mở gate sau bootstrap toolchain.
- Signing/notarization, Tauri updater feed, fork-owned telemetry endpoint và GitHub Pages/billing chưa có capability; không bật release tự động.
- Embedded browser/CDP/offscreen/emulator parity với Tauri chưa được xác minh; phase 06 phải phân loại hoặc giữ Electron fallback trước cutover.

## Red Team Review

- Kết quả: 8 finding accepted, 1 scope-expansion finding rejected.
- Đã sửa: manifest stewardship, browser/CDP cutover gate, `TERM_PROGRAM=Orca` compatibility, secure-store probe, estimate và canonical feature catalog.
- Verification: 24 claims sampled, 19 verified, 0 failed, 5 Tauri/Rust claims unverified by design và đều có feasibility gate.
- Whole-plan consistency: 0 unresolved contradictions.
- Chi tiết: [Red-team review](./reports/red-team-review.md).

## Validation Log

- `ak plan validate`: pass.
- `ak plan parse --json`: 12 phases, 48 pending tasks, dependency metadata parse thành công.
- HTML script syntax: `node --check` pass; 12 phase detail buttons; không có external script/style/image assets.
- Whole-plan consistency sweep: zero unresolved contradictions.

## Handoff

Sau khi user review `plan.html`: `/ak:cook --parallel --tdd D:\Project\worktrees\.15_Ai0-IDE-codex-aio-ade-implementation\plans\260730-1421-aio-ade-tauri-migration-roadmap\plan.md`.
