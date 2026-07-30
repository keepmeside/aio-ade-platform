---
title: "aio-ade rebrand, strip and integration roadmap"
status: cancelled
created: 2026-07-30
updated: 2026-07-30
authors: [Keepmeside, SalyyS1]
repository: keepmeside/aio-ade-platform
blockedBy: []
blocks: []
supersededBy: 260730-1421-aio-ade-tauri-migration-roadmap
---

# aio-ade: roadmap rebrand, strip and integration

> **Đã bị thay thế:** [Roadmap Tauri v2](../260730-1421-aio-ade-tauri-migration-roadmap/plan.md) là canonical plan sau đợt brainstorm kiến trúc.
>
> **Artifact chính:** [plan.html](plan.html). File này là mục lục để review và handoff, còn phase files giữ chi tiết thực thi.

## Mục tiêu

Chuyển fork Orca thành **aio-ade**, tác giả hiển thị là **Keepmeside** và **SalyyS1**. Sản phẩm cuối là desktop orchestrator chỉ hỗ trợ **Claude Code** và **Codex**, bỏ mobile companion, xoá toàn bộ CLI cùng orchestration/Agent Teams/headless `serve` phụ thuộc, thêm chuyển đổi account và API profile, tích hợp Excalidraw offline, rồi tuyển chọn các ý tưởng đã duyệt từ CCS và các nguồn nghiên cứu.

## Repo baseline đã xác minh

| Hạng mục | Giá trị |
|---|---:|
| Remote | `https://github.com/keepmeside/aio-ade-platform.git` |
| Tổng file | 11,056 |
| Token `orca` | 3,475 file, 42,835 lần xuất hiện |
| `mobile/` | 1,048 file, khoảng 9.7 MB |
| `src/cli/` | 146 file |
| Agent roster | 35 xuống 2 (`claude`, `codex`) |
| Workflow CI | 23 |
| Trạng thái Pages | Workflow manual đã push; Pages API `404`, token chỉ có `WRITE` không có `ADMIN`, Actions bị chặn bởi billing/payment/spending limit |

## Phase roadmap

| Phase | Trạng thái | Effort | Phụ thuộc |
|---|---|---:|---|
| [01 Preflight và gate baseline](phase-01-preflight-and-gate-baseline.md) | pending | 0.5 ngày | - |
| [02 Xoá mobile và web companion](phase-02-delete-mobile-and-web-companion.md) | pending | 1 đến 1.5 ngày | 01 |
| [03 Xoá CLI và orchestration phụ thuộc](phase-03-carve-the-cli-agent-bridge.md) | pending | 2 đến 4 ngày | 01, 02 |
| [04 Chỉ giữ Claude và Codex](phase-04-reduce-agent-roster-to-claude-and-codex.md) | pending | 2 đến 3 ngày | 02, 03 |
| [05 Rebrand Orca thành aio-ade](phase-05-rebrand-orca-to-aio-ade.md) | pending | 3 đến 5 ngày | 04 |
| [06 Account và API profile switcher](phase-06-account-and-api-profile-switcher.md) | pending | 5 đến 6 tuần, chia 06A/06B | 04, 05 |
| [07 Tích hợp tính năng chọn lọc từ upstream](phase-07-upstream-feature-integrations.md) | pending | theo tranche | 05, 06 |
| [08 HTML review và GitHub Pages](phase-08-docs-html-plan-and-github-pages.md) | awaiting-user-choice | 0.5 đến 1 ngày | 01; GitHub billing/Pages capability |

## Quyết định đã duyệt

1. **Brand:** canonical display/package/binary slug là `aio-ade`; author là Keepmeside và SalyyS1. Legacy Orca identifiers chỉ tồn tại ở migration compatibility boundary.
2. **CLI:** xoá toàn bộ `src/cli/`, orchestration bridge, Claude Agent Teams, headless `serve`, installer/shims và các e2e chỉ phục vụ chúng.
3. **Canvas:** Excalidraw MIT là canvas duy nhất trong tranche đầu. Không thêm canvas runtime thứ hai. XYFlow chỉ là tranche topology riêng sau usage validation.
4. **Profiles:** triển khai 06A manual secure switching, 06B quota routing/auto-recovery, read-only CCS importer; SSH không nhận local secret ngầm và remote vault là tranche riêng.
5. **Telemetry/release:** disabled/inert cho tới khi có fork-owned endpoints, privacy policy, signing và release credentials.
6. **Scope integrations:** toàn bộ feature shortlist được duyệt, nhưng vẫn ship theo tranche/PR độc lập với tests và rollback flags.

## External blockers

- **Pages:** repo hiện private. GitHub chặn Actions vì billing/payment/spending limit; Pages API trả `404`; credential chỉ có `WRITE`, không có `ADMIN`.
- **Pasted text #1:** nội dung không có trong transcript nên không thể đưa phần chưa nhận được vào scope.

## Acceptance criteria cấp chương trình

- `pnpm lint`, `pnpm typecheck`, `pnpm test` xanh sau mỗi tranche; build desktop xanh trước release.
- Agent picker và persisted settings chỉ còn Claude/Codex, không reset profile cũ khi đọc lần đầu.
- Không còn `orca` trong user-visible strings, binary name, artifact name; alias legacy chỉ tồn tại trong migration/uninstall compatibility.
- Account OAuth hiện tại sống sót; API profile có secret isolation, redaction và binding theo workspace/session.
- Claude Fable launches via the same provider-neutral PTY/xterm path on local, folder workspace, WSL và SSH; profile changes use a visible restart/defer boundary and never forward local secrets.
- Không copy code từ nguồn BUSL/GPL/không có LICENSE; mọi phần MIT được ghi NOTICE/attribution.
- HTML plan tự chứa, tiếng Việt, responsive, keyboard-accessible, không cần network assets.

## Tài liệu liên quan

- [Decision log](decisions.md)
- [Research digest](digest-audits.md)
- [Parallel validation synthesis](reports/parallel-validation-synthesis.md)
- [Full feature catalog: 176 rows](feature-catalog.md)
- [Research reports](research/)
- [aio-ade HTML plan](plan.html)

## Handoff

Plan đã được user duyệt ngày 2026-07-30. Vibe pipeline triển khai bằng `/ak:cook --tdd --auto plans/260730-0117-aio-ade-rebrand-and-integration/plan.md` trên branch `codex/aio-ade-implementation`.

## Câu hỏi chưa giải quyết

- Pages cần owner sửa billing/bật private Pages, hoặc user duyệt một public static-only repo.
- Nội dung `[Pasted text #1 +5 lines]` chưa được cung cấp.
