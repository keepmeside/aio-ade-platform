---
title: "Aio-IDE rebrand, strip and integration roadmap"
status: awaiting-approval
created: 2026-07-30
updated: 2026-07-30
authors: [Keepmeside, SalyyS1]
repository: keepmeside/aio-ade-platform
blockedBy: []
blocks: []
---

# Aio-IDE: roadmap rebrand, strip and integration

> **Artifact chính:** [plan.html](plan.html). File này là mục lục để review và handoff, còn phase files giữ chi tiết thực thi.

## Mục tiêu

Chuyển fork Orca thành **Aio-IDE**, tác giả hiển thị là **Keepmeside** và **SalyyS1**. Sản phẩm cuối là desktop orchestrator chỉ hỗ trợ **Claude Code** và **Codex**, bỏ mobile companion, thu gọn hoặc xoá CLI theo quyết định được duyệt, thêm chuyển đổi account và API profile, rồi tuyển chọn các ý tưởng có giá trị từ CCS, tldraw và 7 nguồn đã nghiên cứu.

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
| [03 Thu gọn CLI thành agent bridge hoặc xoá có điều kiện](phase-03-carve-the-cli-agent-bridge.md) | pending | 1.5 đến 2.5 ngày | 01, 02, quyết định CLI |
| [04 Chỉ giữ Claude và Codex](phase-04-reduce-agent-roster-to-claude-and-codex.md) | pending | 2 đến 3 ngày | 02, 03 |
| [05 Rebrand Orca thành Aio-IDE](phase-05-rebrand-orca-to-aio-ide.md) | pending | 3 đến 5 ngày | 04 |
| [06 Account và API profile switcher](phase-06-account-and-api-profile-switcher.md) | pending | 5 đến 6 tuần, chia 06A/06B | 04, 05 |
| [07 Tích hợp tính năng chọn lọc từ upstream](phase-07-upstream-feature-integrations.md) | staged | theo tranche | 05, 06 |
| [08 HTML review và GitHub Pages](phase-08-docs-html-plan-and-github-pages.md) | awaiting-user-choice | 0.5 đến 1 ngày | 01; GitHub billing/Pages capability |

## Gate cần người dùng duyệt

1. **CLI:** khuyến nghị giữ agent bridge tối thiểu để không làm hỏng orchestration qua process boundary. Nếu bắt buộc xoá toàn bộ `src/cli/`, phải xoá cả orchestration, Claude Agent Teams và các e2e phụ thuộc nó.
2. **tldraw:** không đưa SDK tldraw vào bản phân phối nếu chưa có production/downstream license phù hợp. Mặc định dùng Excalidraw MIT; `@xyflow/react` chỉ thêm ở tranche topology sau usage validation.
3. **Pages:** repo hiện private. Workflow manual đã được push, nhưng GitHub chặn run trước build vì billing/payment/spending limit; Pages API trả `404` và credential hiện tại chỉ có `WRITE`, không có `ADMIN`. Owner phải sửa billing + bật Pages, hoặc duyệt repo public riêng chỉ chứa static plan; không tự ý public repo chính.
4. **Scope integrations:** phase 07 chia must-have, next, later, skip để tránh biến plan thành danh sách copy vô hạn.
5. **Pasted text #1:** nội dung không có trong transcript, nên chưa thể trích tính năng từ phần đó.
6. **Release/telemetry:** giữ release workflow, updater, telemetry và diagnostics inert/disabled cho tới khi có fork-owned endpoints, signing, privacy policy và approval rõ ràng.

## Acceptance criteria cấp chương trình

- `pnpm lint`, `pnpm typecheck`, `pnpm test` xanh sau mỗi tranche; build desktop xanh trước release.
- Agent picker và persisted settings chỉ còn Claude/Codex, không reset profile cũ khi đọc lần đầu.
- Không còn `orca` trong user-visible strings, binary name, artifact name; alias legacy chỉ tồn tại trong migration/uninstall compatibility.
- Account OAuth hiện tại sống sót; API profile có secret isolation, redaction và binding theo workspace/session.
- Không copy code từ nguồn BUSL/GPL/không có LICENSE; mọi phần MIT được ghi NOTICE/attribution.
- HTML plan tự chứa, tiếng Việt, responsive, keyboard-accessible, không cần network assets.

## Tài liệu liên quan

- [Decision log](decisions.md)
- [Research digest](digest-audits.md)
- [Parallel validation synthesis](reports/parallel-validation-synthesis.md)
- [Full feature catalog: 176 rows](feature-catalog.md)
- [Research reports](research/)
- [Aio-IDE HTML plan](plan.html)

## Handoff

Plan này chỉ tạo roadmap và artifact review. Sau khi duyệt gate, chạy `/ak:cook D:\Project\.15_Ai0-IDE\plans\260730-0117-aio-ide-rebrand-and-integration\plan.md` để bắt đầu implementation theo phase.

## Câu hỏi chưa giải quyết

- Chọn CLI bridge tối thiểu hay xoá toàn bộ CLI?
- Pages dùng repo public riêng hay private Pages theo gói GitHub hiện có?
- Có giấy phép thương mại tldraw hay dùng mặc định Excalidraw + XYFlow?
- Nội dung `[Pasted text #1 +5 lines]` là gì?
- SSH remote có được nhận secret từ vault local, hay remote profile phải có vault riêng?
- Cần importer một chiều từ CCS hay không cần interoperability?
