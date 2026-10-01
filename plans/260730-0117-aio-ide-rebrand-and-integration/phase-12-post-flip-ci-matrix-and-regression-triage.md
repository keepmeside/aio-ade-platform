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
- Modify (carry-over từ phase 09, đã có evidence sẵn): `config/electron-builder.config.cjs` — prune **8 glob chết** trong `asarUnpack` (`out/main/{antigravity,claude,copilot,cursor,droid,gemini,grok,hermes}/**`; `out/main/` thật chỉ có `agent-hooks`, `chunks`, `codex`). Lý do phải làm ở phase này chứ không phải phase 09: `win32-utils.js` trong cùng danh sách là entry platform-conditional **trông y hệt glob chết** khi check trên Linux, nên prune đúng cần đối chiếu `out/` thật trên cả 3 OS của matrix. 7 glob roster-fallout xoá an toàn trên mọi platform (source đã bị `631b3b0e7` xoá); `claude` cần quyết định riêng vì source vẫn còn, nó chết do bundler gộp vào `index.js`. Bảng đầy đủ trong [cleanup manifest](reports/cleanup-manifest.md).
- Modify (carry-over từ phase 09, đã có evidence sẵn): build pipeline — **`out/` không bao giờ được clean**, nên trên checkout sống lâu module đã xoá vẫn bị đóng vào `app.asar` local (đo được 17 entry stale, gồm binary shim `out/bin/orca{,-dev}` và 6 module `orca-*` thời trước rebrand). CI **không** bị (runner ephemeral, `out/` gitignored, `e2e.yml` dùng artifact trong cùng run chứ không phải `actions/cache`), nên đây là việc hygiene local chứ không phải blocker release. Ba hướng sửa cần quyết định: clean step trong `build:desktop` (đúng nhất, nhưng mọi build dev thành full recompile), script `clean` riêng (không tự bảo vệ), hoặc guard phát hiện orphan theo pattern repo đã dùng cho bundler entry (không làm chậm build, nhưng phải allowlist output không có source 1-1 như `out/main/index.js` và `out/main/chunks/**`). Bảng dirty-vs-clean trong [cleanup manifest](reports/cleanup-manifest.md).
- Create: `plans/260730-0117-aio-ide-rebrand-and-integration/reports/post-flip-ci-triage.md` (bảng failure → phân loại → owner → trạng thái).

## Implementation Steps

1. ~~Sửa runner label + token owner (2 workflow, 3 chỗ) trước khi chạy matrix~~ **ĐÃ LÀM 2026-09-30 (trước flip, là prep local-verifiable):** `release-mac-build.yml` `blacksmith-6vcpu-macos-15` → `macos-15` (cùng image GitHub-hosted mà `release-cut.yml:824/899` + `computer-e2e.yml:145` đã dùng; comment SignPath lỗi thời sửa luôn vì `decisions.md` đã loại SignPath). `track-community-prs.yaml` `owner:` + `PROJECT_OWNER` → `keepmeside`. Repo guard 3 chỗ re-verify bằng `grep -r`: vẫn `keepmeside/aio-ade-platform`, không revert. **Lưu ý:** workflow `track-community-prs` còn cần infra của owner để thực sự chạy — bufo-bot app `2590194` + secret `BUFO_BOT_PRIVATE_KEY` + team `stably-eng` + project `13` đều là của org upstream; owner phải provision lại dưới `keepmeside` hoặc job sẽ fail (không skip im lặng). Đã fix reference; infra provisioning là của owner. Matrix run thật vẫn chờ flip.
2. Chạy full CI matrix trên `main` sau flip. Ghi lại mọi failure.
3. Triage theo 3 nhóm (a)/(b)/(c). Nhóm (c) đối chiếu upstream history để xác nhận không phải do fork.
4. Fix nhóm (b) trong phase này. Fix nhóm (a) theo commit gắn với phase gốc.
5. Verify các tiêu chí 3-OS bị defer từ phase 03/05; tick lại checkbox ở phase gốc kèm link CI run.
6. Viết triage report. Nhóm (a) chưa sửa được → issue + ghi `decisions.md`.

## Success Criteria

- [x] Mọi chỗ còn chặn fork đã sửa hoặc disable có chủ đích, ghi rõ lựa chọn: Blacksmith runner label → `macos-15`, `track-community-prs.yaml` `owner:` + `PROJECT_OWNER` → `keepmeside`; 3 repo guard của phase 05 re-verify bằng `grep -r` vẫn đúng. *(Sửa 2026-09-30 trước flip. `track-community-prs` cần owner provision bufo-bot app + secret + team + project dưới `keepmeside` mới chạy được — reference đúng, infra là của owner.)*
- [~] Full CI matrix chạy trên 3 OS, không có job skip im lặng vì guard sai. **2026-09-30:** E2E `refs/heads/main` push-run xanh (build + ssh-docker + 10 shard, Ubuntu); `golden-e2e-experiment` (ubuntu+macos-15) xanh; `windows-terminal-restart-e2e` xanh; `skill-update-roundtrip` xanh cả 3 OS sau fix; `computer-e2e` **windows leg đỏ** (runtime_unavailable — xem issue #3), mac+linux xanh. Không job nào skip vì guard sai. **Còn:** `pr.yml` (unit-test shard matrix) chỉ trigger `pull_request` — cần PR hoặc trigger khác để chạy trên code này.
- [x] Mọi failure được phân loại (a)/(b)/(c) trong triage report — **bảng triage trong `decisions.md`**: skill-update-roundtrip (b) → fixed `5acf4a0a5`; computer-e2e windows (a)/(b) → issue #3; E2E `36777643063` + Terminal Perf `36734180482` → (c) flake/stale run (log hết hạn, cùng branch run sau xanh).
- [ ] Tiêu chí 3-OS defer từ phase 03/05 có verdict thật kèm link CI run, không còn tick dựa trên local-only. *(Ubuntu packaged smoke + e2e đã có link CI; macOS/Windows 3-OS deferred criteria chờ các workflow còn lại hoàn tất + pr.yml unit matrix.)*
- [x] Regression chưa sửa được có issue và ghi trong `decisions.md`; không tiêu chí nào tick sai — **issue #3** mở cho computer-e2e Windows.

## Risk Assessment

Rủi ro chính: **CI xanh giả**. Nếu runner label Blacksmith và token owner không sửa trước, nhiều job skip mà UI vẫn hiện xanh — đây chính là lỗi đã xảy ra một lần trong audit của plan này (grep `self-hosted` không bắt được `blacksmith-*`). Mitigation: bước 1 đứng trước bước 2, và tiêu chí thành công yêu cầu "không job skip im lặng".

Rủi ro thứ hai: **scope mở**. Số regression không biết trước. Mitigation: phase riêng có effort range mở, phân loại bắt buộc, và cho phép defer bằng issue thay vì kéo dài vô hạn.

Rủi ro thứ ba: **regression phát hiện quá muộn** — đây là chi phí đã chấp nhận của quyết định flip-sau-phase-05. Tín hiệu assumption vỡ: nếu nhóm (a) lớn tới mức phải reopen phase 02/03/04, dừng lại và báo user để re-plan thứ tự thay vì fix chồng trong phase này.

Rủi ro thứ tư: **test flake do tải, bị triage nhầm thành regression.** Đã quan sát thật
2026-09-13 trên máy dev 16 core: cùng một cây code, chạy full suite hai lần — lần 1
đỏ đúng 1 test ở `src/main/window/attach-main-window-services.test.ts`, lần 2 xanh
hoàn toàn (3.734 file / 38.994 test, 0 đỏ, exit 0). File đó chạy riêng thì pass 27/27
trong 8,4s. Nguyên nhân: hai test dùng `vi.waitFor`, **timeout mặc định của nó là 1s
và không ăn theo `testTimeout: 30_000`** trong `config/vitest.config.ts`. Repo đã gặp
đúng lớp lỗi này trước đó (commit sửa WorktreeCard timeout "trên full run trong khi
pass lúc chạy riêng").

Vì sao phase này phải quan tâm: **204 file test** dùng `vi.waitFor`. Runner CI thường
2-4 core, tức điều kiện tải xấu hơn máy dev đã sinh flake, và nhiều job matrix chạy
song song. Một flake loại này sẽ xuất hiện dưới dạng "regression chưa rõ nguyên nhân"
và tốn slot triage.

Mitigation đề xuất: khi triage, **luôn chạy lại job đỏ trước khi phân loại (a)/(b)/(c)**
— flake tải tự hết khi chạy lại. Nếu một file đỏ lặp lại nhiều lần trên cùng runner
nhưng xanh khi chạy riêng, xếp nó thành nhóm riêng (flake hạ tầng) thay vì regression
sản phẩm, và sửa bằng cách truyền timeout tường minh cho `vi.waitFor` hoặc pre-resolve
mock — không phải bằng cách tăng `testTimeout` (không có tác dụng với `waitFor`).
