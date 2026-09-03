---
phase: 12
title: "Post-flip CI matrix và regression triage"
status: pending
priority: P1
effort: "2-5d, mở theo số regression"
dependencies: [8]
---

<!-- Số phase là 12 (thứ tự file), nhưng vị trí thực thi là NGAY SAU phase 08. Đây là gate CI đầu tiên của chương trình: phase 01-05 chỉ verify local nên toàn bộ code đó chưa từng chạy trên CI matrix 3 OS. Phase 06, 09, 11 đều blockedBy phase này. -->

# Phase 12: Post-flip CI matrix và regression triage

## Overview

Phase 01-05 verify local-only vì repo còn private và Actions bị billing-block (quyết định flip public sau phase 05). Sau khi phase 08 flip thành công, đây là **lần đầu tiên** code của phase 02 (xoá mobile), 03 (carve CLI), 04 (roster narrowing) và 05 (rebrand) chạy trên CI matrix macOS/Windows/Linux. Phase này tách riêng khỏi 08 vì khối lượng regression là không xác định trước — nhồi nó vào một docs phase 2-4 ngày sẽ làm cả hai phase mất ý nghĩa và vi phạm nguyên tắc "một phase một chuỗi commit revert được".

## Requirements

- Functional: mọi workflow CI hiện có chạy được trên repo mới sau flip. Trạng thái re-verify 2026-09-02 (bằng `grep -r`, không phải `git grep` — xem ghi chú cuối mục):
  - **Đã đóng ở phase 05, không còn là việc của phase này:** 3 repo guard `if: github.repository == 'stablyai/orca'` giờ đã là `'keepmeside/aio-ade-platform'` (`release-cut.yml:68`, `release-mac-build.yml:26`, `readme-downloads-badge.yml:23`).
  - **Còn phải sửa:** `release-mac-build.yml:30` dùng `runs-on: blacksmith-6vcpu-macos-15` — runner pool third-party (Blacksmith), không phải GitHub-hosted. Fork owner không administer pool này → job sẽ không schedule. Phải đổi sang `macos-latest`/`macos-15` hoặc onboard Blacksmith có chủ đích. Lưu ý comment ở `:27-29` vẫn viện dẫn **SignPath**, mà `decisions.md` đã loại SignPath — sửa runner thì sửa luôn lý do cho khỏi dẫn sai.
  - **Còn phải sửa:** `track-community-prs.yaml` có **hai** reference `stablyai`, không phải một: `:27` `owner:` của app-token mint, và `:32` `PROJECT_OWNER`. Cả hai đều không resolve dưới `keepmeside`.

  **Ghi chú phương pháp:** `git grep` chỉ đọc file đã tracked, nên trong lúc phase 05 còn 29 file mới chưa `git add`, mọi audit bằng `git grep` sẽ under-report trong im lặng (lần đo đầu cho "0 occurrence `stablyai/orca`", `grep -r` cho 4 file). Dùng `grep -r` cho tới khi phase 05 được commit.
- Functional: chạy full matrix trên code của phase 01-05, triage mọi failure thành: (a) regression do phase 02-05, (b) workflow/config cần cập nhật cho fork, (c) flake sẵn có từ upstream.
- Functional: các tiêu chí 3-OS bị defer từ phase 03 và 05 (packaged smoke, PATH/uninstall trên Windows shims + macOS/Linux links + WSL + SSH host, artifact naming `aio-ade-*`, build metadata nhất quán, chỉ-một-binary-không-alias) được verify thật ở đây và tick lại vào phase gốc.
- Functional: xác nhận **artifact unsigned chạy được** trên cả 3 OS sau khi bypass (macOS: `right-click → Open` / `xattr -d com.apple.quarantine`; Windows: SmartScreen "Run anyway"). Đây là trạng thái đã duyệt cho bản đầu, không phải bug — nhưng phải verify là app thực sự khởi động được, không bị chặn cứng.
- Functional: xác nhận **updater đã tắt** và release workflow là manual-dispatch, chỉ stable channel, không auto-tag.

### Đã đóng trước phase này: git binary compatibility matrix (2026-09-02)

`deferred-verification.md` xếp D19 (matrix git 2.25.5 / 2.38.1 / 2.49.1) vào phase này, **nhưng chính nó ghi chú D19 "không thực sự deferred"** vì docker có trên máy dev. Không ai chạy. Giờ đã chạy — 4 leg, mỗi leg 5 test, **tất cả xanh**:

| Leg | Version | Nguồn | Có trong CI? |
|---|---|---|---|
| source build | **2.25.5** — baseline core-workflow theo `AGENTS.md` | build từ tarball kernel.org, checksum khớp pin trong `pr.yml:124` | có |
| host binary | **2.34.1** | git của máy này | **không** — CI chỉ test 2.25.5/2.38.1/2.49.1 |
| docker | 2.38.1 | `alpine/git:edge-2.38.1` | có |
| docker | 2.49.1 | `alpine/git:v2.49.1` | có |

Leg 2.34.1 là leg có giá trị riêng: nó nằm **dưới ngưỡng 2.36 của `worktree list -z`**, nên nó đi vào đúng nhánh fallback mà máy dev git mới và cả 3 leg CI đều không chạm. Suite gated bằng `AIO_ADE_GIT_COMPAT_IMAGE` / `AIO_ADE_GIT_COMPAT_BINARY`, nên full suite bỏ qua nó im lặng — đây là coverage đã tồn tại nhưng chưa từng chạy.

Phase này chỉ cần re-run 3 leg CI trên matrix để có evidence trên runner thật; không cần điều tra lại.
- Non-functional: fix nhóm (a) là commit riêng theo phase gốc gây ra nó, không trộn vào commit publication của phase 08.
- Non-functional: nếu một regression không sửa được trong phase này, mở issue và ghi vào `decisions.md` thay vì để tiêu chí phase cũ tick sai.

## Related Code Files

- Modify: `.github/workflows/release-mac-build.yml` (runner label + lý do SignPath đã lỗi thời), `track-community-prs.yaml` (`owner:` và `PROJECT_OWNER`). Ba repo guard đã đóng ở phase 05 — không mở lại.
- Modify: source files theo regression tìm được (scope mở, thuộc phase gốc).
- Create: `plans/260730-0117-aio-ide-rebrand-and-integration/reports/post-flip-ci-triage.md` (bảng failure → phân loại → owner → trạng thái).

## Implementation Steps

1. Sửa runner label + token owner (2 workflow, 3 chỗ) trước khi chạy matrix — nếu không, phần lớn matrix sẽ skip im lặng và cho cảm giác xanh giả. Re-verify lại 3 repo guard bằng `grep -r` để chắc phase 05 không bị revert.
2. Chạy full CI matrix trên `main` sau flip. Ghi lại mọi failure.
3. Triage theo 3 nhóm (a)/(b)/(c). Nhóm (c) đối chiếu upstream history để xác nhận không phải do fork.
4. Fix nhóm (b) trong phase này. Fix nhóm (a) theo commit gắn với phase gốc.
5. Verify các tiêu chí 3-OS bị defer từ phase 03/05; tick lại checkbox ở phase gốc kèm link CI run.
6. Viết triage report. Nhóm (a) chưa sửa được → issue + ghi `decisions.md`.

## Success Criteria

- [ ] Mọi chỗ còn chặn fork đã sửa hoặc disable có chủ đích, ghi rõ lựa chọn: Blacksmith runner label, `track-community-prs.yaml` `owner:` + `PROJECT_OWNER`; và 3 repo guard của phase 05 vẫn đúng.
- [ ] Full CI matrix chạy trên 3 OS, không có job skip im lặng vì guard sai.
- [ ] Mọi failure được phân loại (a)/(b)/(c) trong triage report.
- [ ] Tiêu chí 3-OS defer từ phase 03/05 có verdict thật kèm link CI run, không còn tick dựa trên local-only.
- [ ] Regression chưa sửa được có issue và ghi trong `decisions.md`; không tiêu chí nào tick sai.

## Risk Assessment

Rủi ro chính: **CI xanh giả**. Nếu runner label Blacksmith và token owner không sửa trước, nhiều job skip mà UI vẫn hiện xanh — đây chính là lỗi đã xảy ra một lần trong audit của plan này (grep `self-hosted` không bắt được `blacksmith-*`). Mitigation: bước 1 đứng trước bước 2, và tiêu chí thành công yêu cầu "không job skip im lặng".

Rủi ro thứ hai: **scope mở**. Số regression không biết trước. Mitigation: phase riêng có effort range mở, phân loại bắt buộc, và cho phép defer bằng issue thay vì kéo dài vô hạn.

Rủi ro thứ ba: **regression phát hiện quá muộn** — đây là chi phí đã chấp nhận của quyết định flip-sau-phase-05. Tín hiệu assumption vỡ: nếu nhóm (a) lớn tới mức phải reopen phase 02/03/04, dừng lại và báo user để re-plan thứ tự thay vì fix chồng trong phase này.
