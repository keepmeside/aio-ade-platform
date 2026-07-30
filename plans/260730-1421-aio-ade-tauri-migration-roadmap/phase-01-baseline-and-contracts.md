---
phase: 1
title: "Preflight, baseline và runtime contracts"
status: completed
priority: P1
effort: "1-2 ngày"
dependencies: []
---

# Phase 01: Preflight, baseline và runtime contracts

## Overview

Đóng băng baseline Electron/Node hiện tại, inventory mọi coupling sẽ xóa/migrate và tạo oracle có thể lặp lại. Không thay product behavior.

## Requirements

- Ghi baseline: Windows 11, Node `24.12.0`, pnpm `10.24.0`, Git `2.52.0.windows.1`; verify Git 2.25 compatibility contract.
- Ghi rõ `rustc`/`cargo` chưa có trên PATH; tạo bootstrap/checklist toolchain, không coi đây là failure kiến trúc.
- Inventory `mobile/`, `src/cli/`, Agent Teams, orchestration, headless serve, installers/shims, agent roster, brand tokens, profiles, telemetry/updater/release.
- Snapshot Electron PTY/xterm/SSH behavior: Fable `--model fable`, hidden/reveal, snapshot, alternate screen, OSC 10/11, Kitty, paste, resize, IME, reconnect.
- Không đọc/ghi secret vào report; giữ nguyên dirty worktree và thay đổi agent khác.

## Architecture và ownership

- Exclusive: baseline/preflight scripts, migration fixtures, gate snapshots và plan-local reports.
- Read-only: product source, package/build manifests, old plan/reports.
- Conflict: phase 01 không chỉnh file thuộc 02-12; mọi phát hiện trở thành contract/fixture cho owner tương ứng.

## Related Code Files

- Create: `config/scripts/aio-ade-preflight-baseline.mjs`, `tests/fixtures/aio-ade-migration/**`.
- Read: `package.json`, `pnpm-lock.yaml`, `.github/**`, `config/reliability-gates.jsonc`, `config/max-lines-baseline.txt`, PTY/SSH/xterm tests.
- Record: plan-local baseline report, không chứa env/token/path cá nhân.

## Tests Before

- Chạy focused PTY/xterm/SSH/Fable tests và lưu command/result/hash fixtures.
- Chạy `pnpm typecheck`, `pnpm test`, `pnpm lint`; phân loại pre-existing red, không che hoặc weaken test.
- Packaged Electron smoke trên Windows; lên lịch macOS/Linux oracle trên CI/máy phù hợp.

## Refactor

1. Thêm script read-only kiểm tra tool versions, file counts, couplings và upstream endpoints.
2. Thêm fixtures raw byte/snapshot/resize/OSC/Kitty/alternate-screen và stale persisted settings.
3. Tạo capability checklist Rust/Tauri/WebView/platform signer; không cài toolchain âm thầm trong app.

## Tests After

- Script baseline deterministic, redacts secrets và không mutate repo/user config.
- Fixture replay trên local git worktree, folder workspace, WSL và SSH khi có host.
- Verify script hoạt động với path có space và Windows/macOS/Linux path syntax.

## Regression Gate

`pnpm typecheck && pnpm test && pnpm lint && pnpm build:desktop`; Electron oracle artifacts được version/tag theo commit. Gate Rust chỉ là bootstrap check cho tới phase 06.

## Security, risks và rollback

- Risk: baseline chứa secret/PII hoặc kết luận sai do pre-existing red. Mitigation: allowlist output, redact, lặp lại từ clean fixture.
- Rollback: xóa script/fixtures phase 01; không có product migration để reverse.
- Stop nếu worktree thay đổi ngoài ownership trong lúc chạy; báo controller thay vì revert.

## Success Criteria

- [x] Baseline commands, fixtures, platform gaps và pre-existing failures có timestamp.
- [x] Every destructive scope item có reverse-import inventory và owner phase.
- [x] Electron PTY/Fable/SSH oracle có thể chạy lại và so hash/snapshot.
- [x] Rust/toolchain blocker được ghi như prerequisite phase 06, không làm đổi kiến trúc.
