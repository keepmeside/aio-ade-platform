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
  4. Workflow audit — **đã verify 2026-08-21, và re-verify 2026-09-02 sau khi phase 05 chạy** (bản audit đầu dùng `grep self-hosted` nên bỏ sót runner pool third-party). Trạng thái hiện tại, đo bằng `grep` thường trên toàn bộ `.github/workflows/` (không phải `git grep` — xem ghi chú dưới):
     - **Đã đóng:** cả 3 repo guard `if: github.repository == 'stablyai/orca'` giờ là `'keepmeside/aio-ade-platform'` (`release-cut.yml:68`, `release-mac-build.yml:26`, `readme-downloads-badge.yml:23`). Phase 05 đã sửa; **không còn là việc của phase 12.**
     - **Còn lại (2 chỗ, thuộc phase 12):** `release-mac-build.yml:30` dùng `runs-on: blacksmith-6vcpu-macos-15` — runner pool **third-party (Blacksmith)**, fork owner không administer nên job sẽ không schedule; và `track-community-prs.yaml` còn **hai** reference `stablyai` (`:27` `owner:` của app-token mint, `:32` `PROJECT_OWNER`) — bản plan trước chỉ ghi một.
     - `pull_request_target` chỉ 1 chỗ (`track-community-prs.yaml`), không checkout PR head nên không exec untrusted code.
     - Gate item ở đây yêu cầu: đã enumerate đầy đủ `runs-on` labels + repo guards, xác nhận không runner nào nhận fork PR với quyền ngoài kiểm soát, và set Actions permissions cho external contributor trước flip.

     **Ghi chú phương pháp (quan trọng cho mọi item của gate này):** `git grep` chỉ đọc file **đã tracked**. Phase 05 tạo 29 file mới chưa `git add`, nên mọi verification bằng `git grep` trên working tree chưa commit sẽ **under-report** trong im lặng. Lần re-verify đầu tiên bằng `git grep` cho kết quả "0 occurrence" cho `stablyai/orca`; `grep -r` cho 4 file. Dùng `grep -r` cho tới khi phase 05 được commit.
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

- Đã tồn tại (verify, không create lại): `plans/.../plan.html` (30 KB — **nhưng KHÔNG còn tracked**: quyết định `plans/ visibility` áp dụng 2026-09-02 gỡ `plans/` khỏi repo (`.gitignore:132`), `git ls-files plans/` trả 0 file. Và **stale**: generate 2026-07-30, chưa có phase 09/10/11/12 và các quyết định 2026-08-21, phải regenerate), `.github/workflows/aio-ide-plan-pages.yml` (tracked, `workflow_dispatch`-only, permissions `contents: read`/`pages: write`/`id-token: write`, `configure-pages@v5`/`upload-pages-artifact@v3`/`deploy-pages@v4`).
- **Đã đóng 2026-09-02: artifact tới được CI.** Vì `plans/` untracked, `actions/checkout` không có gì để publish. User chọn nhánh thứ ba (xem row `Cách plan.html tới được Pages` trong `decisions.md`): allowlist `plan.md` + `phase-*.md` trong `.gitignore` rồi **generate `plan.html` trong CI**. Hệ quả: `plan.html` không còn là file phải bảo trì tay — nó là output, và trang publish không thể lệch khỏi plan. 46 file `plans/` đã rời index thật (trước đó chỉ staged), 13 file markdown giữ lại.
- Create (đã xong): `config/scripts/plan-html-data.mjs` (đọc frontmatter/section/criteria/dependency thành model) + `config/scripts/render-plan-html.mjs` (render self-contained HTML) + `render-plan-html.test.mjs` (16 test). Tách data khỏi render để assert được phase list, cạnh phụ thuộc và status count mà không phải parse HTML.
- **Đã sửa 2026-09-02: private-URL guard.** Guard cũ (`aio-ide-plan-pages.yml:36`, inline `grep -Eqi`) fail build nếu `plan.html` chứa `github.com/keepmeside/aio-ade-platform` — đúng khi repo private, **sai sau flip** vì URL đó thành public và là citation hợp lệ; `plan.md` chứa nó trong bảng baseline nên regenerate sẽ trip guard. Thay bằng `config/scripts/plan-html-publish-guard.mjs` (+ 14 test trong `plan-html-publish-guard.test.mjs`), threat model sau flip gồm 4 rule: `external-asset` (artifact phải inline mọi asset), `non-public-host` (loopback/private IP/`.local`/`.internal`/`.corp`…), `third-party-private-path` (path repo có từ `private`/`internal`, **trừ** repo đang publish — đọc từ `GITHUB_REPOSITORY`), `unpublished-local-link` (chỉ `index.html` được publish nên mọi relative/`file:` href là link chết). Bug parser bắt được trong lúc viết test: `url()` lồng trong data-URI SVG (`filter='url(%23n)'`) làm regex cũ báo `%23n` là external asset — value trong quote giờ đọc tới quote đóng, không tới `)` đầu tiên. Workflow pin Node bằng `actions/setup-node@v6` + `node-version-file: package.json`.
- Create: secret-scan setup — repo chưa có `.gitleaks.toml`, workflow gitleaks/trufflehog, `dependabot.yml`, hay CodeQL. Tool selection + dry-run đã thuộc phase 01; ở đây chỉ chạy full scan.
- Verify (không create): NOTICE / third-party-notices — **phase 05 là owner tạo file này** (nó đã có `LICENSE`/NOTICE trong Related Code Files và cần cho attribution rebrand); phase 07 và 10 append vào cùng một path. Gate item 1 ở đây chỉ verify nội dung đúng.
- Modify: `package.json` — thêm `"license": "MIT"` (hiện KHÔNG có field `license`); `docs/` only for approved user-visible decisions (lưu ý `docs/**` bị gitignore với allowlist tại `.gitignore:84-95`, doc mới cần thêm entry); `README.md` link plan sau approval.
- Không thuộc phase này: sửa 2 chỗ workflow còn chặn fork (Blacksmith runner label + `track-community-prs.yaml` `owner:`/`PROJECT_OWNER`) — thuộc phase 12. Ba repo guard đã đóng ở phase 05.
- Do not create: secrets, tokens.

## Implementation Steps

1. **(xong)** Chạy red-team + whole-plan consistency sweep; chốt open questions rõ ràng. Kết quả: xoá 2 bản ghi bị thay thế trong `decisions.md` (một-token brand, "Keepmeside sở hữu credentials"), sửa claim "plan.html tracked", và sửa số workflow còn chặn fork từ 4 xuống 2 ở cả phase 08 và 12.
2. **(xong)** Thay "regenerate plan.html" bằng **generator**: `render-plan-html.mjs` đọc `plan.md` + `phase-*.md` và sinh HTML tự chứa (inline CSS/JS, SVG dependency diagram tính từ frontmatter, phase card + dialog, filter). Chạy trong CI mỗi lần dispatch nên artifact không stale được.
3. **(xong)** Smoke: guard chạy xanh trên output; 16 test pin phase list, cạnh phụ thuộc, criteria state, a11y (dialog aria, chip `aria-pressed`, `role="status"`, SVG `title`/`desc`), `prefers-reduced-motion`, breakpoint 375px, và tính xác định của output.
4. **(xong)** Sửa private-URL guard sang threat model sau flip (không block URL của chính repo này) và verify workflow: manual-dispatch only, configure-pages, chỉ copy self-contained HTML sang `_site/index.html`. Guard chạy xanh trên output mới — và **bắt thật**: bản đầu của trang có link tương đối tới `decisions.md` + 2 file `research/` (dead link cho reader), nên renderer giờ đổi mọi ref nội bộ thành text có tooltip thay vì link.
5. **(xong)** `"license": "MIT"` đã có từ phase 05; NOTICE verify xong; secret-scan tool đã pin ở phase 01 giờ install thật ở root (`.gitleaks.toml`) và chạy trên toàn history.
6. **(xong)** Gate 5 items đã chạy — xem bảng kết quả. Không có secret nào phải rotate.
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

## Kết quả pre-publication gate (chạy 2026-09-02)

| Item | Verdict | Bằng chứng |
|---|---|---|
| 1. License / NOTICE | **PASS** | `package.json`: `license: MIT`, `author: Keepmeside`, `contributors: [Keepmeside, SalyyS1]`. Dòng copyright `Lovecast Inc.` còn nguyên ở **cả** `LICENSE` và `NOTICE`; 7 test trong `attribution-notice.test.ts` pin nó |
| 2. History secret scan | **PASS** | gitleaks 8.30.1, config đã install ở root (`.gitleaks.toml`), `--log-opts=--all`: **16.371 commit / 304 MB, 0 finding**, exit 0. Finding duy nhất lúc đầu là chính `secret-scan-triage.md` — tài liệu liệt kê các finding nên bản thân nó chứa chuỗi hình-dạng-secret; match là dòng mô tả `deviceToken` tổng hợp trong `pairing.test.ts`. Verdict ghi vào config, không phải làm scan im lặng đi |
| 3. PII / issues / PR | **PASS sau khi sửa** | Issues + PR: 1 + 1, sạch (chỉ có chữ "secret"/"token" trong văn xuôi). **Đã sửa 3 việc:** (a) trailer commit của app ghi `help@stably.ai` — địa chỉ support của upstream — vào git history của user; giờ là `noreply@keepmeside.dev` ở cả shared constant và 2 fallback shell/PowerShell; (b) 4 doc dẫn đường dẫn tuyệt đối trong home của một contributor (`/Users/jinwoohong/…`) — 2 doc trỏ vào file của repo này nên đổi thành đường dẫn tương đối (11/12 link resolve; link thứ 12 trỏ file đã bị xoá upstream nên gỡ link, giữ tên); 2 doc trỏ repo private khác nên dùng prefix `codex:`/`codexbar:` kèm ghi chú; (c) username thật trong fixture test và trong một error message được document |
| 4. Workflow / runner audit | **PASS (đã enumerate)** | 8 label `runs-on` phân biệt; 3 repo guard đã là `keepmeside/aio-ade-platform`; **còn 2 chỗ thuộc phase 12** (Blacksmith runner label, `track-community-prs.yaml` `owner:` + `PROJECT_OWNER`); 1 `pull_request_target` duy nhất không checkout PR head. **Chưa làm được:** set Actions permissions cho external contributor — là setting của owner |
| 5. Upstream endpoints inert | **PASS** | `TELEMETRY_ENABLED = false`, `TELEMETRY_INGEST_HOST = telemetry.aio-ade.keepmeside.dev`, `UPDATE_CHANNEL_AUTHENTICATED = false`. 0 occurrence `i.posthog.com` và `onorca.dev` trong source. `stablyai/orca` còn lại: attribution MIT bắt buộc trong `README.md:241` + văn xuôi plan. `stablyai/orca-*` trong `resources/plugins/launch/` là repo upstream của 3 plugin bundled — persisted identity, **không được rename** |

**Đã đóng 2026-09-02 — link issue bị rewrite sai nghĩa.** Rebrand rewrite `stablyai/orca` → `keepmeside/aio-ade-platform` **bên trong URL issue/PR**, tạo 178 link phân biệt / 333 occurrence trỏ vào một tracker chỉ có 2 issue. Đúng cú pháp, sai nghĩa. Bằng chứng: `git show 631b3b0e7:<file>` cho thấy mỗi file citation có **đúng cùng số** occurrence `stablyai/orca/issues/N` trước rebrand — rewrite 1:1.

Phân loại theo *vai trò của URL*, không theo pattern:

| Nhóm | Số | Xử lý |
|---|---:|---|
| Citation issue/PR thật của upstream (11 file: `reliability-gates.jsonc` 131, doc `2026-07-21-windows-daemon…` 53, 9 file còn lại 11) | 195 occurrence | **Trỏ lại `stablyai/orca`** — issue chỉ tồn tại ở tracker upstream |
| Fixture test (29 file) | phần còn lại | **Giữ tên mới.** Owner/repo là dữ liệu tổng hợp; tên của chính mình mới đúng |
| Sample URL trong UI (`link-routing-preference-dialog.tsx`, `pull/1234`) | 1 | **Giữ tên mới** — đây là ví dụ hiển thị cho user, phải trông giống repo mình |

Guard đi kèm: scan brand giờ **tự nhận** citation upstream theo *hình dạng* (`github.com/stablyai/orca/(issues|pull)/N`) thay vì allowlist 11 path. Khác biệt quan trọng: allowlist theo path sẽ tắt scan cho cả file, còn cách này chỉ trừ đúng URL — file chứa citation vẫn bị quét cho mọi occurrence khác. Có test riêng chứng minh điều đó (`subtracts only the citation, so a real miss beside one still fails`).

## Packaging leak tìm được khi verify artifact (2026-09-03)

Mở `app.asar` của bản Linux packaged (`electron-builder --linux --dir`) để verify identity thì thấy nó chứa **`plans/` — 64 file, 1,1 MB**, gồm `decisions.md`, `secret-scan-triage.md`, coupling map. Tức là nội dung đã cố ý gỡ khỏi repo để không public **vẫn nằm trong mọi bản cài của user**. Cùng lọt: `tools/` (e2e harness, benchmark), `.claude/`, `.gitleaks.toml`, `.oxlintrc.json`, `pnpm-workspace.yaml`, `vite.web.config.ts`, `aio-ade.yaml` của checkout.

Nguyên nhân là lớp lỗi repo này đã gặp ở 1.4.160-rc.3 (`examples/hostile-panel` ship vào asar): `files` trong `electron-builder.config.cjs` là danh sách **toàn negation**, nên thư mục nào không có `!` là **ship**. Im lặng nghĩa là "đóng gói".

Trên máy dev, asar còn phình từ 113 MB lên **1,58 GB** vì nuốt luôn `.code-review-graph/graph.db` (2,0 GB) và `.codegraph/` (742 MB) — hai cái này gitignored nên **CI release không bị**, nhưng `plans/`/`tools/`/config thì tracked và **đã ship thật** trong mọi bản CI trước đây.

Đã sửa (TDD: test đỏ trước, drive `FileMatcher` thật của app-builder-lib chứ không pin chuỗi pattern): 7 negation mới trong `files`, và test đối chứng rằng `out/`, `package.json`, `LICENSE`, `NOTICE` vẫn ship. Sau sửa, top-level của asar chỉ còn `LICENSE NOTICE out package.json resources`; artifact Linux có executable `aio-ade`, không có `orca*`, `productName: AIO-ADE`, `license: MIT`.

**Gate item 3 (PII) được mở rộng bởi phát hiện này:** quét PII trong docs/plans/issues là chưa đủ — phải quét **cả bundle đã đóng gói**, vì `files` all-negation biến mọi thứ tracked thành user-visible. Đã quét: 0 legacy token trong `out/`, không còn `plans/`.

## Success Criteria

- [x] Mở `plan.html` local không network vẫn đủ nội dung và tương tác; nội dung khớp `plan.md` + phase files hiện tại (gồm 09/10/11/12) — **khớp theo cấu tạo**, vì nó được sinh từ chính hai nguồn đó. 184 KB, 0 external asset, đọc được không JS (`.phase-detail[hidden]` được noscript stylesheet mở lại). **Tương tác được verify bằng cách chạy thật, không phải bằng assert markup:** `render-plan-html-interaction.test.mjs` load trang vào happy-dom, execute script inline của chính nó, rồi bấm card (dialog mở đúng phase body), đóng dialog (node được trả về `#phase-details` và hidden lại), gõ filter (thu hẹp đúng, và **tìm cả trong body phase** không chỉ label card), bật/tắt chip status. 6 test.
- [x] Private-URL guard đã sửa cho threat model sau flip và chạy xanh trên `plan.html` mới (không false-positive vì URL repo trong bảng baseline) — `plan-html-publish-guard.mjs`, 4 rule, 14 test.
- [x] Pre-publication gate pass cả 5 items — xem bảng "Kết quả pre-publication gate". Nhánh contingency **không cần dùng**: scan 16.371 commit trả 0 finding, nên không có secret nào của fork hay của upstream phải rotate. Còn 1 item của owner (Actions permissions cho external contributor) và 1 phát hiện chờ quyết định (178 link issue bị rewrite).
- [ ] Owner là người flip visibility; có xác nhận `gh repo view --json visibility` = PUBLIC sau flip.
- [ ] GitHub Pages URL trả HTTP 200 và artifact khớp commit đã push.
- [x] Published HTML không link tới nội dung không có trong artifact; source citations dùng public URL hoặc inline safe summary — guard rule `unpublished-local-link` bắt mọi href không phải `https://` public / `#fragment` / `mailto:`, và renderer đổi ref tới tài liệu nội bộ thành text có tooltip. Chỉ còn 1 external link: URL repo trong bảng baseline.

## Risk Assessment

Flip public là bất khả nghịch thực tế: sau khi có external clone, quay lại private không thu hồi được nội dung. Mitigation: gate secret/PII/license scan chạy trước, flip là hành động owner, fallback local-only nếu gate fail. Tín hiệu assumption vỡ: gitleaks tìm thấy secret trong history → rotate là bắt buộc; nếu không rotate được thì không flip. Fork PR có thể chạy Actions với quyền không mong muốn — audit đã xác nhận không có self-hosted runner và `pull_request_target` duy nhất không checkout PR head, việc còn lại là sửa app-token owner và set Actions permissions.

**Trade-off của flip-sau-phase-05 (user đã chọn), định giá lại chính xác:** đổi CI sớm lấy việc tip/clone/README hiển thị aio-ade thay vì Orca khi public. **Lưu ý phạm vi thật:** history 17.537 commit vẫn chứa toàn bộ branding và endpoint upstream sau flip — deferral làm sạch tip, không làm sạch history. Nếu trademark exposure trong history là động cơ thật thì phải quyết history rewrite hoặc squashed mirror riêng.

Chi phí đã chấp nhận: phase 01-05 verify local-only, không có CI matrix 3 OS trước rebrand. Mitigation: các tiêu chí 3-OS của phase 03/05 được đánh dấu deferred-verification và verify thật ở **phase 12**, không tick dựa trên một OS. Phase 06, 09, 11 đều blockedBy phase 12 để regression không lọt vào một phase security-sensitive hoặc một phase xoá code.
