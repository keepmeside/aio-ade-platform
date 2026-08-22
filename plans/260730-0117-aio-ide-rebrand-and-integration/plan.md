---
title: "AIO-ADE rebrand, strip and integration roadmap"
status: approved-gates-updated
created: 2026-07-30
updated: 2026-08-21
authors: [Keepmeside, SalyyS1]
repository: keepmeside/aio-ade-platform
blockedBy: []
blocks: []
---

# AIO-ADE: roadmap rebrand, strip and integration

> **Trạng thái artifact:** [plan.html](plan.html) được generate 2026-07-30 và **đã stale** — chưa có phase 09/10/11/12, brand mới (`aio-ade`) và các quyết định 2026-08-21. File `plan.md` + phase files là source of truth hiện tại; regenerate `plan.html` ở phase 08 step 2 trước khi publish.

> **Lưu ý naming:** token `aio-ide` còn xuất hiện trong **tên file và tên thư mục** (`260730-0117-aio-ide-...`, `phase-05-rebrand-orca-to-aio-ide.md`, `.github/workflows/aio-ide-plan-pages.yml`) là **di sản lịch sử**, không phải brand thứ hai. Token được duyệt là `aio-ade` (machine) và `AIO-ADE` (display). Không rename các path này: chúng bị reference chéo khắp plan và bởi Pages workflow.

## Mục tiêu

Chuyển fork Orca thành **AIO-ADE** (machine token `aio-ade`; org/author token `stablyai` → `keepmeside`), tác giả hiển thị là **Keepmeside** và **SalyyS1**. Sản phẩm cuối là desktop orchestrator với **Claude Code** và **Codex** native, **các agent khác hỗ trợ qua ACP** (Agent Client Protocol, chỉ local native host), bỏ mobile companion, CLI thu gọn thành agent bridge tối thiểu, thêm chuyển đổi account và API profile (schema chung Claude/Codex, runtime resolver riêng), canvas Excalidraw, dọn dẹp codebase sau rebrand, repo public sau rebrand, và đánh giá thay runtime Electron sang **Rust + Tauri v2 + Node sidecar** qua feasibility spike có go/no-go gate.

## Quyết định user 2026-08-21

1. CLI: giữ bridge tối thiểu (phase 03 Option A). **Không alias legacy** — chỉ ship `aio-ade`.
2. Canvas: Excalidraw (tldraw/XYFlow không vào default build).
3. Profile Claude + Codex: schema chung, runtime resolver riêng (phase 06). **SSH secret: cả hai option (forward hoặc remote vault) làm user setting per-host**, mặc định không forward.
4. Repo đổi sang **public, flip sau phase 05** (phase 08 — pre-publication gate bắt buộc). Phase 01-05 verify local-only; phase 12 là gate CI đầu tiên.
5. Agent roster: chỉ Claude Code + Codex native; agent khác qua **ACP** (phase 10), **chỉ local native host — chấp nhận lâu dài**. **Agent Teams được giữ**.
6. Runtime: **chọn Rust + Tauri v2 + Node sidecar.** Electrobun và GPUI-cho-UI bị loại. Phase 11 là Tauri feasibility spike có go/no-go; fallback là Rust sidecar giữ Electron, rồi giữ Electron nguyên trạng.
7. Brand: display **`AIO-ADE`**, machine token **`aio-ade`**; `stablyai` → `keepmeside`.
8. OS floor: nâng Linux lên **Ubuntu 22.04 / webkit2gtk-4.1**; macOS/Windows không thu hẹp.
9. Signing: **chưa có cert — ship unsigned, chấp nhận cảnh báo OS**, ký sau khi mua. Không dùng SignPath.
10. Release: **không auto-update**, GitHub Releases tải thủ công, **chỉ stable channel**, manual dispatch.
11. Telemetry + diagnostics/crash reports: **chuyển sang endpoint Keepmeside**; **bỏ update check**. Cần privacy policy + opt-in UI + redaction tests trước khi bật.
12. `serve`: feature-flagged OFF ở bản đầu, quyết định xoá ở phase 09. CCS: chỉ nguồn ý tưởng, không importer. `[Pasted text #1]`: xoá khỏi scope.

## Repo baseline đã xác minh

| Hạng mục | Giá trị |
|---|---:|
| Remote | `https://github.com/keepmeside/aio-ade-platform.git` |
| Tổng file | 11,056 |
| Token `orca` | 3,475 file, 42,835 lần xuất hiện |
| `mobile/` | 1,048 file, khoảng 9.7 MB |
| `src/cli/` | 146 file |
| Agent roster | 35 xuống 2 native (`claude`, `codex`) + generic ACP slot (phase 10) |
| Workflow CI | 23 |
| Upstream LICENSE | MIT, Copyright (c) 2026 Lovecast Inc. (fork redistribution hợp lệ khi giữ notice) |
| Trạng thái Pages | Repo còn private tại thời điểm viết; Actions/Pages bị chặn bởi billing + thiếu ADMIN. Quyết định: flip public sau pre-publication gate (phase 08) |

## Phase roadmap

| Phase | Trạng thái | Effort | Phụ thuộc |
|---|---|---:|---|
| [01 Preflight và gate baseline](phase-01-preflight-and-gate-baseline.md) | **completed** 2026-08-22 | 0.5 ngày | - |
| [02 Xoá mobile và web companion](phase-02-delete-mobile-and-web-companion.md) | **completed** 2026-08-22 (Option A: chỉ RN tree) | 1 đến 1.5 ngày | 01 |
| [03 Thu gọn CLI thành agent bridge tối thiểu](phase-03-carve-the-cli-agent-bridge.md) | **in-progress** — `serve` flag OFF, neutrality guard, **browser carve xong (216→139 command)**; còn Linear/emulator/computer chờ user quyết (A/B/C) | 1.5 đến 2.5 ngày | 01, 02 |
| [04 Chỉ giữ Claude và Codex native](phase-04-reduce-agent-roster-to-claude-and-codex.md) | pending | 2 đến 3 ngày | 02, 03 |
| [05 Rebrand Orca thành aio-ade](phase-05-rebrand-orca-to-aio-ide.md) | pending | 3 đến 5 ngày | 04 |
| [06 Account và API profile switcher](phase-06-account-and-api-profile-switcher.md) | pending | 5 đến 6 tuần, chia 06A/06B | 04, 05, **12** |
| [07 Tích hợp tính năng chọn lọc từ upstream (canvas: Excalidraw)](phase-07-upstream-feature-integrations.md) | staged | theo tranche | 05, 06 |
| [08 HTML review, repo public sau rebrand và Pages](phase-08-docs-html-plan-and-github-pages.md) | pending (public đã duyệt, flip sau phase 05) | 2 đến 4 ngày | 05; pre-publication gate |
| [12 Post-flip CI matrix và regression triage](phase-12-post-flip-ci-matrix-and-regression-triage.md) | pending — **chạy ngay sau 08** | 2 đến 5 ngày (mở theo số regression) | 08 |
| [09 Codebase cleanup sau rebrand](phase-09-codebase-cleanup-sau-rebrand.md) | pending | 2 đến 3 ngày | 05, 12 |
| [10 ACP generic agent support](phase-10-acp-generic-agent-support.md) | pending | 3 đến 5 engineer-weeks | 04, 06A (milestone trong phase 06) |
| [11 Runtime migration: Tauri v2 feasibility spike + go/no-go](phase-11-runtime-migration-comparative-spike.md) | pending | spike 2 đến 3 tuần | 05, 12 (cần CI cho 3 OS) |

**Điểm serialize:** phase 08 → 12 là gate CI đầu tiên của chương trình (phase 12 đứng cuối theo số file nhưng chạy ngay sau 08). Vì phase 01-05 chỉ verify local (repo còn private, Actions bị billing-block), mọi phase sau phải chờ 12 xác nhận code của 01-05 xanh trên CI matrix 3 OS. Không phase nào ngoài 08 được bắt đầu song song với 08.

## Gate — trạng thái sau quyết định 2026-08-21

1. **CLI (đã đóng):** giữ agent bridge tối thiểu (Option A). Xem `decisions.md`.
2. **Canvas (đã đóng):** Excalidraw MIT; tldraw không vào default build; `@xyflow/react` chỉ thêm ở tranche topology sau usage validation.
3. **Repo visibility/Pages (đã duyệt, còn gate kỹ thuật):** đổi repo chính sang public, **flip sau phase 05**. Upstream `LICENSE` là MIT (Copyright 2026 Lovecast Inc.) nên redistribution fork hợp lệ khi giữ notice. Trước khi owner flip: pre-publication gate ở phase 08 (history secret scan mọi ref, NOTICE/attribution, PII + issues/PR content, workflow/self-hosted-runner audit, re-verify upstream telemetry/updater inert từ phase 05) phải pass. Agent không tự flip visibility.
4. **Scope integrations (mở):** phase 07 chia must-have, next, later, skip để tránh biến plan thành danh sách copy vô hạn.
5. **Runtime migration (đã chọn hướng):** Rust + Tauri v2 + Node sidecar. Phase 11 là feasibility spike có go/no-go; Electrobun và GPUI-cho-UI đã bị loại. Full migration chỉ sau khi GO và có migration plan riêng được duyệt. NO-GO là kết quả hợp lệ, fallback là Rust sidecar giữ Electron rồi giữ Electron nguyên trạng.
6. **Release/telemetry (đã đóng):** không auto-update ở bản đầu, chỉ stable channel, manual dispatch, ship unsigned tới khi có cert. Telemetry + diagnostics chuyển sang endpoint Keepmeside, bỏ update check; chỉ bật sau khi có privacy policy, opt-in UI và redaction tests.

## Acceptance criteria cấp chương trình

- `pnpm lint`, `pnpm typecheck`, `pnpm test` xanh sau mỗi tranche; build desktop xanh trước release.
- Agent picker và persisted settings chỉ còn Claude/Codex native (cộng generic ACP slot sau phase 10), không reset profile cũ khi đọc lần đầu.
- Không còn `orca` trong user-visible strings, binary name, artifact name; alias legacy chỉ tồn tại trong migration/uninstall compatibility.
- Account OAuth hiện tại sống sót; API profile có secret isolation, redaction và binding theo workspace/session.
- Không copy code từ nguồn BUSL/GPL/không có LICENSE; mọi phần MIT được ghi NOTICE/attribution.
- HTML plan tự chứa, tiếng Việt, responsive, keyboard-accessible, không cần network assets.

## Tài liệu liên quan

- [Decision log](decisions.md)
- [Phase 01 baseline evidence](research/baseline/) — `local-verification-baseline.md` (gate thay CI, **yêu cầu Node 24**), `secret-scan-triage.md` (0 secret cần rotate trên 17.537 commit), `deferred-verification.md` (19 tiêu chí defer sang phase 12/owner), `decisions-audit.md`, 4 coupling map cho phase 02/03/05/06, `phase-02-delete-manifest.md`, `serve-dependency-inventory.md` (dữ liệu cho quyết định xoá `serve` ở phase 09)
- [Research digest](digest-audits.md)
- [Parallel validation synthesis](reports/parallel-validation-synthesis.md)
- [Full feature catalog: 176 rows](feature-catalog.md)
- [Research reports](research/) — gồm `electrobun-migration-feasibility.md`, `rust-gpui-hybrid-migration.md`, `tauri-v2-migration-feasibility.md`, `acp-generic-agent-support.md`
- [aio-ade HTML plan](plan.html)

## Handoff

Plan này chỉ tạo roadmap và artifact review. Sau khi duyệt gate, chạy `/ak:cook plans/260730-0117-aio-ide-rebrand-and-integration/plan.md` để bắt đầu implementation theo phase.

## Câu hỏi cần user quyết định

**Đang chặn (2026-08-22): scope carve CLI ở phase 03 — chỉ còn Linear.** Xem row `CLI carve scope` trong [decisions.md](decisions.md).

- **browser (77 command) đã xoá** — 0 consumer, 0 guide ref. CLI: 216 → **139 command**.
- **emulator + computer: audit đã đảo khuyến nghị, nên GIỮ.** `computer` có consumer runtime thật (RPC error path phát hướng dẫn `orca computer …` cho agent); `emulator` được UI desktop quảng cáo + locale 5 thứ tiếng.
- **Linear (27 command)** là candidate duy nhất còn lại, blocker thuần docs: 115 guide ref, `verify:bundled-skill-guides` nằm trong `pnpm lint` nên phải regenerate guide và workflow agent đang dùng sẽ chết.

Các gate khác đã đóng — xem [decisions.md](decisions.md). Các quyết định phát sinh trong lúc thực thi:

- **Phase 01:** kết quả history secret scan (17.537 commit). Nếu có secret upstream không rotate được → chạy nhánh contingency đã duyệt.
- **Phase 09:** xoá thật `serve` hay giữ.
- **Phase 11:** verdict Tauri GO/NO-GO. Nếu bundle size xấu >10% (khả năng cao vì Node sidecar) → cần quyết định user riêng.
- **Sau khi mua cert:** bật signing + notarization, rồi mới bật auto-update.
- Ai sở hữu release channel, signing và notarization credentials?
