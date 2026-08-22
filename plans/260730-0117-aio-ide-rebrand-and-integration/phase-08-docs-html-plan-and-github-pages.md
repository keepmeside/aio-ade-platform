---
phase: 8
title: "HTML review, repo public sau rebrand và GitHub Pages"
status: pending
priority: P1
effort: "2-4d (không gồm regression triage — xem phase 12)"
dependencies: [5]
---

<!-- dep đổi từ 1 sang 5 (quyết định user 2026-08-21): flip public SAU rebrand để không public branding/endpoint Orca. Hệ quả: Actions/Pages vẫn bị billing-block trong phase 01-05, verification của các phase đó là local-only. -->

# Phase 08: HTML review, repo public sau rebrand và GitHub Pages

## Overview

Đóng gói plan review thành HTML tiếng Việt tự chứa và triển khai Pages. **User đã chốt 2026-08-21: đổi `keepmeside/aio-ade-platform` sang public, và flip SAU khi phase 05 (rebrand) hoàn tất** — thay thế cả hướng "private Pages" lẫn "public plan repo riêng". Dời flip sang sau phase 05 loại bỏ exposure branding/endpoint Orca vì rebrand đã xong trước khi public. Flip visibility là bất khả nghịch thực tế (external clone/cache), nên phase này có gate pre-publication bắt buộc.

**Hệ quả của việc dời flip:** GitHub Actions vẫn bị chặn bởi billing trong suốt phase 01-05, nên tiêu chí "CI xanh" của các phase đó phải đạt bằng **local verification** (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build:desktop` trên máy dev), không phải bằng CI run. Phase 01 preflight phải ghi rõ điều này để không ai chờ CI không bao giờ chạy.

## Requirements

- Functional: `plan.html` hiển thị overview, stats, dependency diagram, phase cards, detail modal, decisions, feature matrix, risks, open questions và source URLs.
- Functional: responsive 375px đến desktop, keyboard-accessible modal/filter, reduced-motion, không cần network assets.
- Non-functional: workflow Pages build từ file authoritative, không copy tay nội dung, không dùng docs path bị gitignore nếu chưa allowlist.
- Functional (pre-publication gate, chạy TRƯỚC khi flip public — mọi item là pass/fail, không phải "review"):
  1. **Upstream license (đã xác minh 2026-08-21):** `LICENSE` tại repo root là **MIT, Copyright (c) 2026 Lovecast Inc.** → public redistribution của fork đã modify **được phép**, điều kiện là giữ nguyên copyright notice + license text. Gate item còn lại: NOTICE/attribution phản ánh đúng upstream copyright (không xoá dòng Lovecast Inc.) và third-party notices đầy đủ. Lưu ý MIT không cấp quyền trademark: tên "Orca" đi public trước phase 05 là exposure riêng (xem item 5).
  2. Secret scan toàn bộ git history mọi ref — **17.537 commit, 4.401 ref** (đo 2026-08-21), phần lớn thừa hưởng từ upstream. Tool selection + dry-run scan đã làm ở phase 01 (không cần đổi visibility); ở đây chạy scan đầy đủ và xử lý kết quả. Tìm thấy secret **của fork này** → rotation bắt buộc. Tìm thấy secret **của upstream (stablyai/Lovecast) mà owner này không thể rotate** → xem nhánh contingency ở dưới; không mặc định block vĩnh viễn. Rewrite history chỉ là hygiene tuỳ chọn (GitHub cache SHA/PR refs/forks vẫn giữ commit cũ tới khi Support gc).
  3. Quét PII/credential trong docs/plans/research/issue templates VÀ nội dung issues/PR comments hiện có (đi public cùng repo).
  4. Workflow audit — **đã verify 2026-08-21 và có phát hiện phải xử lý** (bản audit trước dùng `grep self-hosted` nên bỏ sót): `release-mac-build.yml:30` dùng `runs-on: blacksmith-6vcpu-macos-15` — runner pool **third-party (Blacksmith)**, không phải GitHub-hosted, fork owner không administer. Ba workflow có `if: github.repository == 'stablyai/orca'` (`release-cut.yml:68`, `release-mac-build.yml:26`, `readme-downloads-badge.yml:23`) không bao giờ chạy dưới `keepmeside`. `pull_request_target` chỉ 1 chỗ (`track-community-prs.yaml`), không checkout PR head nên không exec untrusted code, nhưng mint app token `owner: stablyai`. **Sửa cả bốn thuộc phase 12**; gate item ở đây yêu cầu: đã enumerate đầy đủ `runs-on` labels + repo guards, xác nhận không runner nào nhận fork PR với quyền ngoài kiểm soát, và set Actions permissions cho external contributor trước flip.
  5. **Upstream endpoint check tại thời điểm flip:** telemetry (PostHog upstream), updater feed (`stablyai/orca`), diagnostics phải inert/disabled. Vì flip nằm sau phase 05, các tiêu chí rebrand của phase 05 là **tiền đề đã đạt** — gate item này chỉ re-verify. Lưu ý phạm vi thật: rebrand làm sạch **tip**, không làm sạch history; sau flip toàn bộ 17.537 commit thừa hưởng (mọi string `orca`, guard `stablyai/orca`, endpoint upstream) vẫn public. Nếu trademark exposure trong history là vấn đề, phải quyết history rewrite hoặc squashed mirror **có chủ đích**, không coi là hygiene tuỳ chọn.

### Contingency: secret upstream không rotate được

Nếu scan tìm thấy secret thuộc upstream (`stablyai`/Lovecast) mà owner này không có quyền rotate, quy tắc "rotate hoặc không flip" sẽ block flip vĩnh viễn và kéo theo CI không bao giờ hoạt động. Ba nhánh thoát, user chọn một:

| Nhánh | Nội dung | Chi phí |
|---|---|---|
| Báo upstream + chờ rotate | Liên hệ maintainer upstream, họ rotate, rồi flip | Phụ thuộc bên thứ ba, thời gian không kiểm soát |
| Squashed public mirror | Repo public mới chỉ chứa snapshot hiện tại (không history), repo gốc giữ private | Mất history public, phải maintain hai remote; CI chạy trên mirror |
| Sửa billing thay vì flip | Giữ private, owner sửa payment/spending limit để Actions chạy | Tốn tiền, nhưng giữ nguyên history và một remote |
- Functional: flip visibility là hành động của owner sau khi gate pass — agent không tự đổi visibility. Sau flip: dispatch Pages workflow, verify URL.
- Non-functional: lợi ích "gỡ blocker Actions billing" KHÔNG miễn trừ bất kỳ gate item nào; không shortcut gate để unblock CI của phase khác.

## Related Code Files

- Đã tồn tại (verify, không create lại): `plans/.../plan.html` (30 KB, tracked — **nhưng stale**: generate 2026-07-30, chưa có phase 09/10/11/12 và các quyết định 2026-08-21, phải regenerate), `.github/workflows/aio-ide-plan-pages.yml` (tracked, `workflow_dispatch`-only, permissions `contents: read`/`pages: write`/`id-token: write`, `configure-pages@v5`/`upload-pages-artifact@v3`/`deploy-pages@v4`).
- **Modify bắt buộc: private-URL guard trong `aio-ide-plan-pages.yml:25`.** Guard hiện fail build nếu `plan.html` chứa `github.com/keepmeside/aio-ade-platform` — đúng khi repo private, **sai sau flip** vì URL đó thành public và là citation hợp lệ. Đồng thời `plan.md` có chứa `https://github.com/keepmeside/aio-ade-platform.git` trong bảng baseline, nên regenerate `plan.html` với nội dung plan sẽ **trip guard và fail deploy**. Sửa guard sang threat model sau flip: block URL private/internal của **third party** và path chưa publish, không block chính repo này.
- Create: secret-scan setup — repo chưa có `.gitleaks.toml`, workflow gitleaks/trufflehog, `dependabot.yml`, hay CodeQL. Tool selection + dry-run đã thuộc phase 01; ở đây chỉ chạy full scan.
- Verify (không create): NOTICE / third-party-notices — **phase 05 là owner tạo file này** (nó đã có `LICENSE`/NOTICE trong Related Code Files và cần cho attribution rebrand); phase 07 và 10 append vào cùng một path. Gate item 1 ở đây chỉ verify nội dung đúng.
- Modify: `package.json` — thêm `"license": "MIT"` (hiện KHÔNG có field `license`); `docs/` only for approved user-visible decisions (lưu ý `docs/**` bị gitignore với allowlist tại `.gitignore:84-95`, doc mới cần thêm entry); `README.md` link plan sau approval.
- Không thuộc phase này: sửa 4 workflow chặn fork (3 repo guard + Blacksmith runner + app-token owner) — thuộc phase 12.
- Do not create: secrets, tokens.

## Implementation Steps

1. Chạy red-team + whole-plan consistency sweep; chốt open questions rõ ràng.
2. **Regenerate `plan.html`** từ nội dung hiện tại (file cũ 2026-07-30 đã stale: thiếu phase 09/10/11/12 và các quyết định 2026-08-21): inline HTML/CSS/JS theo editorial plan contract, embed phase content hoặc data inline, SVG diagram CSS-only.
3. Lint/smoke HTML: parse, check links, verify no external assets, mobile viewport and reduced-motion CSS.
4. **Sửa private-URL guard** ở `aio-ide-plan-pages.yml:25` sang threat model sau flip (không block URL của chính repo này), rồi verify workflow: manual-dispatch only, configure-pages, chỉ copy self-contained HTML sang `_site/index.html`. Chạy guard trên `plan.html` mới để chứng minh nó không false-positive.
5. Chuẩn bị artifact còn thiếu: thêm `"license": "MIT"` vào `package.json`, verify NOTICE do phase 05 tạo, chạy secret-scan tool đã pin ở phase 01.
6. Chạy pre-publication gate (5 items ở Requirements). Secret của fork → rotate bắt buộc. Secret upstream không rotate được → chọn một nhánh contingency, không tự quyết.
7. Sau khi gate pass, owner tự flip visibility sang public (agent không làm bước này). Xác nhận qua `gh repo view --json visibility`.
8. Owner/admin bật Pages (source: GitHub Actions). Dispatch `aio-ide-plan-pages.yml`, theo dõi deploy.
9. Commit focused docs/workflow changes, push theo scope đã duyệt, confirm Pages URL với `gh api` và HTTP check.
10. Handoff sang phase 12 (post-flip CI matrix) — regression triage KHÔNG thuộc phase này.

## Deployment Attempt

- 2026-07-30: plan/workflow pushed to `main` at commit `7eff045`.
- Pages create API returned `404` for the private repository.
- Authenticated user has repository `WRITE` but not `ADMIN`, so this session cannot enable Pages in repository settings.
- Manual workflow dispatch was blocked before any step ran because GitHub reported failed account payments or an insufficient spending limit.
- Next action requires user choice: repair billing/private Pages capability, or approve a separate public repo containing only the sanitized static artifact.

## Resolution 2026-08-21

User chọn hướng **repo public** (hàng 2 của matrix cũ nhưng áp dụng cho chính repo chính, không phải repo static riêng). Ghi chú: quyết định này cũng gỡ blocker Actions billing cho CI của các phase khác. Matrix cũ giữ lại làm lịch sử:

| Hướng cũ | Trạng thái |
|---|---|
| Private-repo Pages | Bỏ — bị chặn bởi billing + thiếu ADMIN |
| Public static-only repo | Bỏ — thay bằng public hoá repo chính |
| Local review only | Fallback nếu gate pre-publication fail |

## Success Criteria

- [ ] Mở `plan.html` local không network vẫn đủ nội dung và tương tác; nội dung khớp `plan.md` + phase files hiện tại (gồm 09/10/11/12).
- [ ] Private-URL guard đã sửa cho threat model sau flip và chạy xanh trên `plan.html` mới (không false-positive vì URL repo trong bảng baseline).
- [ ] Pre-publication gate pass cả 5 items: license/NOTICE (`package.json` có `"license": "MIT"`, NOTICE giữ copyright Lovecast Inc.), history secret scan (17.5k commit) sạch hoặc đã rotate hoặc đã chọn nhánh contingency, PII + issues/PR content review, workflow/runner audit enumerate đầy đủ, upstream telemetry/updater inert.
- [ ] Owner là người flip visibility; có xác nhận `gh repo view --json visibility` = PUBLIC sau flip.
- [ ] GitHub Pages URL trả HTTP 200 và artifact khớp commit đã push.
- [ ] Published HTML không link tới nội dung không có trong artifact; source citations dùng public URL hoặc inline safe summary.

## Risk Assessment

Flip public là bất khả nghịch thực tế: sau khi có external clone, quay lại private không thu hồi được nội dung. Mitigation: gate secret/PII/license scan chạy trước, flip là hành động owner, fallback local-only nếu gate fail. Tín hiệu assumption vỡ: gitleaks tìm thấy secret trong history → rotate là bắt buộc; nếu không rotate được thì không flip. Fork PR có thể chạy Actions với quyền không mong muốn — audit đã xác nhận không có self-hosted runner và `pull_request_target` duy nhất không checkout PR head, việc còn lại là sửa app-token owner và set Actions permissions.

**Trade-off của flip-sau-phase-05 (user đã chọn), định giá lại chính xác:** đổi CI sớm lấy việc tip/clone/README hiển thị aio-ade thay vì Orca khi public. **Lưu ý phạm vi thật:** history 17.537 commit vẫn chứa toàn bộ branding và endpoint upstream sau flip — deferral làm sạch tip, không làm sạch history. Nếu trademark exposure trong history là động cơ thật thì phải quyết history rewrite hoặc squashed mirror riêng.

Chi phí đã chấp nhận: phase 01-05 verify local-only, không có CI matrix 3 OS trước rebrand. Mitigation: các tiêu chí 3-OS của phase 03/05 được đánh dấu deferred-verification và verify thật ở **phase 12**, không tick dựa trên một OS. Phase 06, 09, 11 đều blockedBy phase 12 để regression không lọt vào một phase security-sensitive hoặc một phase xoá code.
