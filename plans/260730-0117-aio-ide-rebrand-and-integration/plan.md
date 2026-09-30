---
title: "AIO-ADE rebrand, strip and integration roadmap"
status: approved-gates-updated
created: 2026-07-30
updated: 2026-09-13
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
| Agent roster | 35 xuống 3 native (`claude`, `claude-agent-teams`, `codex`) + generic ACP slot (phase 10) |
| Workflow CI | 23 |
| Upstream LICENSE | MIT, Copyright (c) 2026 Lovecast Inc. (fork redistribution hợp lệ khi giữ notice) |
| Trạng thái Pages | Repo còn private tại thời điểm viết; Actions/Pages bị chặn bởi billing + thiếu ADMIN. Quyết định: flip public sau pre-publication gate (phase 08) |

## Phase roadmap

| Phase | Trạng thái | Effort | Phụ thuộc |
|---|---|---:|---|
| [01 Preflight và gate baseline](phase-01-preflight-and-gate-baseline.md) | **completed** 2026-08-22 | 0.5 ngày | - |
| [02 Xoá mobile và web companion](phase-02-delete-mobile-and-web-companion.md) | **completed** 2026-08-22 (Option A: chỉ RN tree) | 1 đến 1.5 ngày | 01 |
| [03 Thu gọn CLI thành agent bridge tối thiểu](phase-03-carve-the-cli-agent-bridge.md) | **completed** 2026-08-22 — `serve` flag OFF, neutrality guard, browser carve (216→**139 command**); emulator/computer giữ, Linear defer phase 09 | 1.5 đến 2.5 ngày | 01, 02 |
| [04 Chỉ giữ Claude và Codex native](phase-04-reduce-agent-roster-to-claude-and-codex.md) | **completed** 2026-08-27 — roster `claude \| claude-agent-teams \| codex`; usage/accounts của agent đã bỏ xoá luôn (kéo theo rate-limit provider thu về claude/codex); passive title detection giữ, sweep ở 09 | 2 đến 3 ngày | 02, 03 |
| [05 Rebrand Orca thành aio-ade](phase-05-rebrand-orca-to-aio-ide.md) | **completed** 2026-09-02 — full suite xanh thật: 3.729 file / 38.953 test, 0 đỏ (Node 24). Lần đo đầu có **23 đỏ / 16 file**: 3 defect production (partition browser-session lệch với security guard, scan brand đang đỏ, alias trùng), 17 expectation gắn cứng vào độ dài/offset token, 1 bundle build stale, 1 timeout do tải | 3 đến 5 ngày | 04 |
| [06 Account và API profile switcher](phase-06-account-and-api-profile-switcher.md) | pending | 5 đến 6 tuần, chia 06A/06B | 04, 05, **12** |
| [07 Tích hợp tính năng chọn lọc từ upstream (canvas: Excalidraw)](phase-07-upstream-feature-integrations.md) | staged | theo tranche | 05, 06 |
| [08 HTML review, repo public sau rebrand và Pages](phase-08-docs-html-plan-and-github-pages.md) | **blocked-on-owner** 2026-09-02 — 4/6 tiêu chí xong: `plan.html` giờ **generate trong CI** từ `plan.md` + phase files (không còn file viết tay stale), publication guard 4 rule + 14 test, pre-publication gate **pass cả 5 item** (gitleaks 16.371 commit → 0 finding). Còn lại **chỉ hành động của owner**: flip visibility, bật Pages, dispatch | 2 đến 4 ngày | 05; pre-publication gate |
| [12 Post-flip CI matrix và regression triage](phase-12-post-flip-ci-matrix-and-regression-triage.md) | pending — **chạy ngay sau 08** | 2 đến 5 ngày (mở theo số regression) | 08 |
| [09 Codebase cleanup sau rebrand](phase-09-codebase-cleanup-sau-rebrand.md) | **in-progress** 2026-09-13 — nhóm 1 đóng + commit `2c2771ed8`; nhóm 3 (phần local) đóng + commit `e9f437138`; **nhóm 5 (`serve`): user chốt xoá thật, commit `054e3c3a9`** (84 file −6.761/+343), offscreen-backend sweep đang hoàn tất. Đã chạy local mọi gate từng defer: **full suite 3.734 file / 38.994 test exit 0**, **`build:desktop` exit 0**, **packaged smoke Linux pass** (0 token `orca` trong asar sạch). Còn: nhóm 2 + nhóm 4 (deps, 8 glob `asarUnpack` chết, clean-step cho `out/`) chờ 12 | 2 đến 3 ngày | 05, 12 |
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
- [Phase 09 cleanup manifest](reports/cleanup-manifest.md) — quyết định inventory tool (option b: compiler + reverse-grep), evidence từng nhóm xoá, và **danh sách giữ lại** (passive title detection, historical `AgentType` enum, reserved seam của 08/10/11)
- [Full feature catalog: 176 rows](feature-catalog.md)
- [Research reports](research/) — gồm `electrobun-migration-feasibility.md`, `rust-gpui-hybrid-migration.md`, `tauri-v2-migration-feasibility.md`, `acp-generic-agent-support.md`
- [aio-ade HTML plan](plan.html)

## Trạng thái thực thi 2026-09-13

Phase 05 đóng thật (full suite xanh: 3.729 file / 38.953 test, `lint` 8 gate xanh sau khi tách `remote-pairing.ts`, `typecheck` 3 project xanh). Phase 08 xong phần agent làm được; **gate CI và mọi phase phụ thuộc nó chờ owner flip visibility**, vì:

- Phase 12 (gate CI đầu tiên) `blockedBy` 08 — cần Actions chạy được, tức cần repo public hoặc sửa billing.
- Phase 06, 09, 11 đều `blockedBy` 12.
- Phase 07 `blockedBy` 06; phase 10 `blockedBy` 06A.

Ba việc owner phải làm, theo thứ tự: (1) flip `keepmeside/aio-ade-platform` sang public, (2) bật Pages với source **GitHub Actions**, (3) set Actions permissions cho external contributor. Sau đó dispatch `aio-ide-plan-pages.yml` và bắt đầu phase 12.

**Việc chạy trước gate (2026-09-03):** phase 09 **nhóm 1** đã làm — nó là fallout phase 04 chủ động defer sang 09 ("passive title detection giữ, sweep ở 09") và verify được hoàn toàn local, không cần CI. Nội dung: gỡ các đường **launch** và **title ownership** thành unreachable sau khi roster thu về `claude | claude-agent-teams | codex` — xoá `hermes-startup-query.ts`, thu `AgentPromptInjectionMode` 6→2 mode, gỡ `SyntheticAgentTitleProfile.titleIdentityGroup`, gỡ `OPENCLAUDE_HOOK_SETTINGS` (dead từ trước), collapse `agent-title-owner.ts` 190→35 LoC, gỡ 4 runtime member delay-mobile-snapshot. Lớp **passive detection** giữ nguyên có chủ ý. Full suite **3.734 file / 38.994 test, 0 đỏ**; lint 8 gate + typecheck 3 project xanh. Review độc lập tự chứng minh lại reachability và không tìm defect chặn; 3 finding (2 câu justification sai trong comment, `??` vs `||` ở `agentType` rỗng, 2 input thiếu trong test) đã sửa trước khi đóng. Nhóm 2-5 của phase 09 (assets/locale, workflows/scripts, deps/config gates, quyết định `serve`) **vẫn chờ 12** vì cần packaged smoke trên CI matrix — **trừ hai item đã xác minh là không cần CI**: một script verify hook có zero caller, và tiêu chí "gate ref tới path không tồn tại" thì `pnpm lint` đã prove (51 gate pass, và gate id `mobile-ui.*` mà requirements nêu thực ra không tồn tại). Evidence: [cleanup manifest](reports/cleanup-manifest.md).

**Nhóm 1 đã commit `2c2771ed8` (2026-09-13)** — trước đó code xanh nhưng còn nằm ở working tree. Verify lại trước khi commit: typecheck 3 project, lint 8 gate, full suite **3.734 file / 38.994 test, 0 đỏ** (327s, Node 24).

**Nhóm 3 — phần verify local được: đóng 2026-09-13.** Ba việc, không việc nào cần packaged smoke:

1. Xoá `config/scripts/verify-agent-hook-stdin-lifecycle.mjs` (396 LoC). Zero caller xác minh lại bằng `grep -r` toàn repo. Chạy thử nó để chứng minh **broken chứ không chỉ mồ côi**: `ENOENT … antigravity-hook.sh` ở entry đầu của `MANAGED_SCRIPTS` (`readGeneratedScripts` gọi `statSync` trần); 8/12 entry không còn generator sau khi roster thu lại.
2. Sửa **12 comment rot / 7 file** mô tả cross-agent title re-ownership như hành vi còn sống (cùng lớp defect mà review nhóm 1 đã bắt được 2 câu trong `agent-title-owner.ts`). Sau sửa: 0 hit cho `Pi-compatible`/`OMP emits`/`identity group`/`nested pi` trên `src`. Passive-detection map `Pi`/`OMP` **giữ nguyên** — thuộc lớp detect agent ngoài roster.
3. **Quyết định GIỮ owner-threading** (candidate nhóm 1 đề xuất xoá). Đây đúng là reserved seam mà requirement phase 09 bảo vệ, và xoá nó phải bỏ param `owner` khỏi signature 3 normalizer — tức chính là inline mà nhóm 1 đã quyết không làm với 35 call site. Chi phí giữ là property read thuần.

**Tiêu chí "không còn workflow/script/gate ref tới path không tồn tại" đã đóng và verify được static, không cần CI:** 51 reliability gate pass path validation qua `pnpm lint`; 26 path script trong `.github/workflows/`, 57 trong `package.json`, 3 composite `uses: ./…` — tất cả tồn tại; 0 stale `max-lines` baseline entry (script **return 1** nếu có, và lint exit 0). Premise gate id `mobile-*` hoá ra **sai**: `mobile-ui.*` không tồn tại, `mobile-relay.endpoint-recovery` không orphan. Tiêu chí `max-lines` chỉ-shrink cũng đóng: chưa từng chạy `--init`, và không có gì để `--prune`.

Verify nhóm 3: blast radius 7 file test **642 pass**, typecheck + lint xanh. Mọi thay đổi `src/` là **comment-only** (chứng minh bằng `git diff` lọc bỏ dòng comment → rỗng) nên không chạy lại full suite.

**Hai gate từng ghi "chờ phase 12" hoá ra verify được local, và đã chạy (2026-09-13):**

- **`pnpm build:desktop` → exit 0**, đủ 5 stage, không `UNRESOLVED_ENTRY`. Không defer vì repo đã có bug đúng lớp này: một bundler entry trỏ tới worker bị xoá làm build fail mà typecheck/lint/test không cái nào bắt được, và commit sửa nó ghi rằng defer sang matrix *"produced no coverage at all"*. Nhóm 1 xoá module nên nằm trong lớp rủi ro đó.
- **Full suite chạy lại → xanh, exit 0** (3.734 file / 38.994 test). Lần chạy trước trên **cùng cây code** đỏ đúng 1 test ở `attach-main-window-services.test.ts`, chạy riêng thì pass 27/27 trong 8,4s → **flake do tải, không phải regression**. Nguyên nhân: `vi.waitFor` timeout mặc định **1s**, không ăn theo `testTimeout: 30_000`, và **204 file test** dùng nó. Đã ghi thành rủi ro thứ tư của phase 12 kèm mitigation triage — runner CI thường 2-4 core, tải xấu hơn máy dev 16 core đã sinh flake.

**Packaged smoke: đã pass trên Linux (2026-09-13).** Chạy đúng procedure của job CI
(`pr.yml` "Package unpacked app" + "Smoke packaged CLI", job chạy `ubuntu-latest` nên
đây là tái hiện trung thực): `build:desktop` → `build:native` →
`ensure:electron-runtime` → `electron-builder --dir` (`dist/linux-unpacked` 526 MB,
`app.asar` 118,9 MB) → `smoke-packaged-cli.mjs`: `resources/bin/aio-ade --help` chạy
thành công **ngoài repo**, exit 0. Brand-scan lại theo step 6: `brand-token-contract`
6/6 pass, **0 token `orca`** trong `app.asar` build sạch, top-level đúng
`LICENSE NOTICE out package.json resources`. Matrix 3 OS vẫn thuộc phase 12.

**Phát hiện mới, để phase 12 (2 item):**

1. `asarUnpack` trong `config/electron-builder.config.cjs` còn **8 glob chết** (`out/main/<agent>/**` với `out/main/` thật chỉ có `agent-hooks`, `chunks`, `codex`). 7 glob mồ côi do `631b3b0e7` xoá `src/main/<dir>`; 1 (`claude`) khác nguyên nhân — source còn nhưng bị bundle vào `index.js`. Tác hại thấp (glob không match thì không unpack gì, build vẫn exit 0). Chưa sửa vì thuộc nhóm 4 và vì `win32-utils.js` trong cùng danh sách là entry platform-conditional trông y hệt glob chết — prune đúng cần `out/` thật trên cả 3 OS.
2. **`out/` không bao giờ được clean** → module đã xoá khỏi `src/` vẫn bị đóng vào `app.asar` của build local. Đo được **17 entry stale**: 2 binary shim `out/bin/orca{,-dev}` (từ 2026-09-01, trước rebrand), 6 module `orca-*`, 3 `hermes-*` (gồm đúng module nhóm 1 vừa xoá), 3 `pi-*`, 3 khác. Nguyên nhân: không script build nào clean `out/`, `tsc` không xoá output mồ côi, `files` all-negation nên *silence means ship*. **Phạm vi CHỈ build local** — `out/`/`dist/` gitignored, runner ephemeral, `e2e.yml` dùng `upload/download-artifact` trong cùng run chứ không phải `actions/cache`, `release-cut.yml` chỉ cache thư mục download của electron-builder. **Chứng minh:** `rm -rf out dist` + build lại → 0 stale, 0 `orca`, 0 orphan. Kết luận pre-publication của phase 08 **vẫn đứng**, nhưng claim "0 legacy token trong `out/`" phải hiểu là về **build sạch**. Chưa sửa: là thay đổi build pipeline, không phải dọn dead code, và 3 hướng sửa đều có trade-off.

**Còn lại của phase 09:** nhóm 2 (assets/locale) và nhóm 4 (deps purge + 8 glob `asarUnpack` + quyết định clean-step cho `out/`) — chờ phase 12. Nhóm 5 (`serve`) đã chốt **xoá thật** theo user (commit `054e3c3a9`); sweep `OffscreenBrowserBackend` + verify cuối đang hoàn tất trước khi đóng tiêu chí.

## Handoff

Plan này chỉ tạo roadmap và artifact review. Sau khi duyệt gate, chạy `/ak:cook plans/260730-0117-aio-ide-rebrand-and-integration/plan.md` để bắt đầu implementation theo phase.

## Câu hỏi cần user quyết định

**Scope carve CLI đã chốt (2026-08-22).** Xem row `CLI carve scope` trong [decisions.md](decisions.md).

- **browser (77 command) đã xoá** — 0 consumer, 0 guide ref. CLI: 216 → **139 command**.
- **emulator + computer: audit đã đảo khuyến nghị, nên GIỮ.** `computer` có consumer runtime thật (RPC error path phát hướng dẫn `aio-ade computer …` cho agent — trước rebrand là `orca computer …`); `emulator` được UI desktop quảng cáo + locale 5 thứ tiếng.
- **Linear (27 command): defer sang phase 09.** Blocker thuần docs (115 guide ref) nhưng giá trị xoá thấp, và phase 10 (ACP) có thể đổi việc agent reach gì. Minimal bridge chốt ở **139 command**.

Các gate khác đã đóng — xem [decisions.md](decisions.md). Các quyết định phát sinh trong lúc thực thi:

- ~~**Phase 01:** kết quả history secret scan.~~ **Đã đóng 2026-09-02:** gitleaks trên mọi ref (16.371 commit, 304 MB) trả **0 finding**. Không có secret của fork hay của upstream phải rotate, nên **không dùng nhánh contingency nào**. Config đã install ở root (`.gitleaks.toml`), mỗi allowlist entry có verdict viết ra.
- **Phase 09:** xoá thật `serve` hay giữ.
- **Phase 11:** verdict Tauri GO/NO-GO. Nếu bundle size xấu >10% (khả năng cao vì Node sidecar) → cần quyết định user riêng.
- **Sau khi mua cert:** bật signing + notarization, rồi mới bật auto-update.
- Ai sở hữu release channel, signing và notarization credentials? (Vẫn mở. Lưu ý: bản ghi cũ "Keepmeside sở hữu credentials" **đã bị thay thế** — row `Signing/notarization` trong `decisions.md` nói chưa có cert, ship unsigned. Câu hỏi còn lại là ai giữ credentials **sau khi mua**.)
