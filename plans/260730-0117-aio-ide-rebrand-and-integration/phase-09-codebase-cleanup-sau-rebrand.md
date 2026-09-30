---
phase: 9
title: "Codebase cleanup sau rebrand"
status: in-progress
priority: P2
effort: "2-3d"
dependencies: [5, 12]
---

# Phase 09: Codebase cleanup sau rebrand

## Overview

Sau các phase xoá lớn (02 mobile, 03 CLI carve, 04 roster) và rebrand (05), codebase còn lại dead code, stale gates, orphan assets/docs/workflows và baseline files phồng. Phase này quét và dọn có bằng chứng: chỉ xoá thứ chứng minh được là không còn consumer, không "dọn" thứ đang giữ compatibility window của phase 05.

**Quyết định thuộc phase này:** xoá thật headless `serve` hay giữ. Phase 03 đã đặt nó sau feature flag OFF và để lại inventory dependency; ở đây quyết dựa trên việc remote development có là tính năng muốn bán hay không. Nếu xoá: gỡ luôn `src/main/ssh/ssh-remote-cli-host-passthrough.ts` và các packaging/updater/browser dependency chỉ phục vụ `serve`.

## Requirements

- Functional: xoá dead code (module không còn importer), orphan tests/fixtures/snapshots, unused assets/icons/locales keys, stale workflows và scripts trỏ tới path đã xoá.
- Functional: thu gọn config gates về hiện trạng — `config/reliability-gates.jsonc` (check-only script, sửa tay có review), `config/max-lines-baseline.txt` (chỉ `--prune`, không `--init`), `.oxlintrc.json` root không còn ref path chết; dependencies không dùng bị gỡ khỏi `package.json`.
- Functional: KHÔNG xoá: (a) migration alias, wire-compatibility tokens, legacy-path readers còn trong compatibility window của phase 05; (b) telemetry historical enums còn validate queued events (phase 04); (c) **seam và artifact dành sẵn cho phase chưa chạy** — picker/catalog seam cho ACP (phase 10), extension points của phase 06, feature flags phase 07, **`.github/workflows/aio-ide-plan-pages.yml`** (workflow_dispatch-only, zero caller → trông y hệt orphan nhưng thuộc phase 08), và **exclusion cho `tools/` trong `config/electron-builder.config.cjs`** (phase 11 thêm; gỡ nó sẽ đưa spike code vào `app.asar`). Các item này có zero consumer cho tới khi phase tương ứng chạy nên knip/reverse-import sẽ flag chúng là dead; evidence "giữ" của chúng là reference tới phase đang pending, ghi rõ trong cleanup manifest.
- Non-functional: mỗi nhóm xoá là commit riêng revert được; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build:desktop` xanh sau mỗi commit nhóm.

## Architecture

Cleanup theo pipeline evidence-first: inventory (knip/depcheck/ts-prune hoặc compiler+grep reverse-import) → phân loại (dead / compat-window / unknown) → xoá theo nhóm → verify. Nhóm "unknown" không xoá, ghi vào report với lý do.

## Related Code Files

- Scan toàn bộ: `src/`, `config/`, `.github/workflows/`, `resources/`, `docs/`, `tests/`.
- Modify: `package.json` (deps/scripts), `config/reliability-gates.jsonc` (hand-maintained: `config/scripts/check-reliability-gates.mjs` không có write path; ~~gate ids `mobile-ui.*`, `mobile-relay.*` bị phase 02 orphan~~ — **đính chính: không id nào orphan**, xem step 5), `config/max-lines-baseline.txt` (qua `node config/scripts/check-max-lines-ratchet.mjs --prune`), `.oxlintrc.json` (root — không phải `config/oxlint*`, đó là plugin configs), locale files tại `src/renderer/src/i18n/locales/`.
- Delete: dead modules/tests/assets/workflows theo manifest sinh ra trong phase.
- Create: `plans/260730-0117-aio-ide-rebrand-and-integration/reports/cleanup-manifest.md` (danh sách xoá + evidence + nhóm giữ lại). **Đã tạo 2026-09-03** với nhóm 1.

## Implementation Steps

1. **Chọn và pin inventory tool trước** — repo hiện KHÔNG có knip/ts-prune/depcheck/madge (đã xác minh: không trong deps, không trong 105 scripts). Hai lựa chọn: (a) thêm một devDep pinned ở root (knip cho unused files/exports/deps là đủ cho cả 4 nhóm), hoặc (b) không thêm tool, dùng compiler + reverse-grep thủ công và bỏ tiêu chí "theo depcheck". Ghi lựa chọn vào cleanup manifest.
2. Chạy inventory: unused exports/files/deps, grep reverse-import cho mọi candidate, đối chiếu dynamic import/require và asset refs trong `config/electron-builder.config.cjs`.
3. Phân loại candidate thành: dead (xoá), compat-window (giữ, ghi chú expiry), reserved-seam (giữ, ghi phase pending sở hữu nó), unknown (giữ, ghi lý do). Danh sách compat-window lấy từ phase 04/05 success criteria. Lưu ý contention: nếu phase 06/07/10 đang chạy song song, không purge `package.json` deps trong cùng window — dọn deps sau khi các phase đó merge.
4. Xoá theo nhóm, mỗi nhóm một commit: (a) dead modules+tests, (b) assets/icons + locale keys (dùng script sẵn có: `sync:localization-catalog`, `audit:localization`, `verify:localization-coverage`, allowlist `config/localization-coverage-allowlist.json` — không prune key thủ công), (c) workflows/scripts, (d) deps/config gates.
5. Config gates: `node config/scripts/check-max-lines-ratchet.mjs --prune` (shrink-only; KHÔNG `--init`, nó reset ratchet và hấp thụ suppression mới). `config/reliability-gates.jsonc` sửa tay có review vì `check-reliability-gates.mjs` là check-only — ~~gỡ các gate id đã orphan (`mobile-ui.*`, `mobile-relay.*`)~~ **đính chính 2026-09-13: premise sai, không có việc phải làm.** Không gate id `mobile-ui.*` nào tồn tại; `mobile-relay.endpoint-recovery` không orphan (coverageNotes đã reconcile cho phase 02, test file nó trỏ tới tồn tại và pass). Chi tiết trong [cleanup manifest](reports/cleanup-manifest.md). `--prune` cũng không có gì để làm: 0 stale entry.
6. Full verify: lint, typecheck, test, build:desktop, packaged smoke; chạy brand-scan lại để xác nhận không lộ token `orca` user-visible mới.
7. Viết cleanup manifest report.

## Success Criteria

- [x] Inventory tool đã chọn + pin (hoặc quyết định không dùng tool được ghi rõ) trước bất kỳ lần xoá nào. **Chọn option (b)**: không thêm devDep, dùng `tsc --noEmit` (3 project) + `grep -r` reverse-import. Lý do ghi trong [cleanup manifest](reports/cleanup-manifest.md).
- [ ] Inventory evidence + reverse-import evidence tồn tại cho mọi file bị xoá. *(3 file đã xoá — 2 ở nhóm 1, 1 ở nhóm 3 — cả 3 đều có evidence trong [cleanup manifest](reports/cleanup-manifest.md). Nhóm 2/4/5 chưa xoá gì.)*
- [x] Không còn workflow/script/gate ref tới path không tồn tại (gồm gate ids `mobile-*` orphan). **Verify 2026-09-13, static, không cần CI:** `pnpm lint` → `Reliability gate manifest check passed for 51 gate(s)` (script validate path từng gate); 26 path script mà `.github/workflows/` ref qua `node|bash|sh|python3|npx` → tồn tại hết; 57 path trong `package.json` scripts → tồn tại hết; 3 composite action `uses: ./…` → tồn tại hết; 0 shell-source ref; 0 ref tới file đã xoá ngoài `plans/`. **Premise về gate `mobile-*` sai** (xem đính chính trong manifest): không gate id `mobile-ui.*` nào tồn tại, và `mobile-relay.endpoint-recovery` không orphan. Orphan thật duy nhất tìm được (`verify-agent-hook-stdin-lifecycle.mjs`) đã xoá ở nhóm 3.
- [ ] `package.json` không còn dependency unused theo tool đã chọn (nếu chọn không dùng tool, tiêu chí này thay bằng: mọi dep còn lại có ít nhất một import/script reference chứng minh được). *(Chờ phase 12 + sau khi 06/07/10 merge, theo contention note ở step 3.)*
- [x] `max-lines` baseline chỉ shrink (`--prune`), không reset. **Verify 2026-09-13:** chưa từng chạy `--init`. `check-max-lines-ratchet.mjs` **return 1 khi có stale entry**, và `pnpm lint` exit 0 với `max-lines ratchet OK — 327 grandfathered suppression(s), no new bypasses` → **0 entry stale**, tức các file đã xoá không để lại entry mồ côi. Không có gì để `--prune`.
- [x] Compat-window và reserved-seam items của phase 04/05/06/07/10 còn nguyên và test của chúng xanh. **Verify nhóm 1:** passive title detection (`HERMES_AGENT_NAME_RE`, `terminal-title-*`, `agent-title-*`), historical `AgentType` enum, `openclaude` native-chat layer, `aio-ide-plan-pages.yml`, exclusion `tools/` — tất cả còn nguyên; full suite 3.734 file xanh. **Verify nhóm 3 (2026-09-13):** passive-detection map `Pi: 'pi'` / `OMP: 'omp'` còn nguyên sau khi sửa comment; owner-threading seam (35 call site / 8 file) **giữ nguyên có quyết định**, không xoá; 642 test blast radius xanh. Re-verify lại sau mỗi nhóm sau.
- [x] Quyết định `serve`: **xoá** — user chọn xoá thật, không giữ flag. Đã xoá command + spec + handler + launcher + supervisor + handoff + argv branch + readiness pair + activation gate + virtual-display + headless PTY registration + headless automation dispatcher + pairing repro harness + headless Linux guide + gate `runtime.headless-desktop-promotion-continuity` + mọi test/doc/config của nó + **offscreen browser backend** (`browser-backend.ts` interface, `setBrowserGuestStateChangedListener`/`registerOffscreenGuest` seam, `owner` field) + serve-start dispatcher installer + `aio-ade serve` nhánh trong `per-workspace-env` skill guide (giờ SSH-only). Dependency riêng (`serve-update-supervisor`, `serve-update-handoff`, `serve-signal-exit-diagnostic`, `OffscreenBrowserBackend`, `headless-dispatch`/`headless-workspace-create`, pairing-repro script + docker harness, `preferPinnedWsPort`, `AIO_ADE_APPIMAGE_NO_SANDBOX`, `registerHeadlessPtyRuntime`, `UpdateInstallMode` union, `HOST_INTERACTIVE_COMMANDS['serve']`) đi cùng. **Giữ compat-window:** `RemoteServerUpdateInstallMode` headless tokens (wire — peer cũ report), `BROWSER_HEADLESS_RUNTIME_CAPABILITY` + `HEADLESS_RUNTIME_WINDOW_ID` + `browserPageId` (peer cũ publish), `buildBareAioAdeCliScript` (managed-terminal shim còn dùng), `'serve'` trong `APPIMAGE_CLI_COMMAND_NAMES` (routing allowlist). Evidence + lý do: [cleanup manifest](reports/cleanup-manifest.md).
- [x] Toàn bộ pipeline verify xanh; packaged smoke pass trên ít nhất một OS desktop. **Đóng 2026-09-13 trên Linux**, chạy đúng procedure của job CI (`pr.yml` "Package unpacked app" + "Smoke packaged CLI" — job đó chạy `ubuntu-latest` nên đây là tái hiện trung thực, không phải thay thế): `build:desktop` exit 0 (5 stage) → `build:native` → `ensure:electron-runtime` → `electron-builder --dir` (`dist/linux-unpacked` 526 MB, `app.asar` 118,9 MB) → `smoke-packaged-cli.mjs --app-dir=dist/linux-unpacked`: `resources/bin/aio-ade --help` **chạy thành công ngoài repo**, exit 0; `verify-packaged-plugin-resources` OK (1 plugin). Brand-scan lại theo step 6: `brand-token-contract.test.ts` 6/6 pass và **0 token `orca`** trong danh sách file của `app.asar` build sạch. Matrix 3 OS vẫn thuộc phase 12.

## Tiến độ

**Nhóm 1 — roster-narrowing fallout: đóng 2026-09-03.** Gỡ đường launch và title
ownership thành unreachable sau khi roster thu về `claude | claude-agent-teams |
codex`: xoá `hermes-startup-query.ts` (+windows test), thu `AgentPromptInjectionMode`
6→2 mode, gỡ `SyntheticAgentTitleProfile.titleIdentityGroup`, gỡ
`OPENCLAUDE_HOOK_SETTINGS` (dead từ trước), collapse `agent-title-owner.ts` 190→35
LoC về identity function, gỡ 4 runtime member delay-mobile-snapshot. Làm theo TDD:
characterisation test viết trước, xanh trên code cũ, giữ xanh sau khi gỡ.
Evidence + nhóm giữ lại: [cleanup manifest](reports/cleanup-manifest.md).

Review độc lập đã chạy và tự chứng minh lại reachability (0 assignment
`titleIdentityGroup`, `TUI_AGENT_CONFIG` 3 entry chỉ name 2 mode còn lại) → không
defect chặn. Sửa theo review, trước khi commit: 2 câu justification **sai** trong
comment `agent-title-owner.ts` (khai caller so sánh bằng reference để skip
re-render — 4 call site đều phá reference ngay), `?? undefined` → `|| undefined`
cho tương đương thật với guard cũ ở `agentType: ''`, và test bổ sung 2 input mà
cũ/mới lệch nhau.

Nhóm 2-5 (assets/locale, workflows/scripts, deps/config gates, quyết định `serve`)
chưa chạy — nên chờ phase 12 vì cần packaged smoke trên CI matrix. **Ngoại lệ đã
xác minh:** `config/scripts/verify-agent-hook-stdin-lifecycle.mjs` (nhóm 3) có
**zero caller** nên packaged smoke không exercise được nó, và gate id orphan
`mobile-*` trong `config/reliability-gates.jsonc` (nhóm 4) chạy qua script
check-only trong `pnpm lint`. Cả hai verify được local; xem candidate list trong
cleanup manifest.

**Nhóm 5 — quyết định `serve`: đóng 2026-09-30.** User chọn
**xoá thật**; commit `054e3c3a9` (84 file, −6.761/+343) mang phần lớn việc xoá
theo inventory: CLI spec/handler/flag/launcher/supervisor/handoff, main
`--serve*` argv + readiness/activation/virtual-display, updater install-mode
threading, headless PTY registration, headless automation dispatcher + module,
pairing-repro script + docker harness + guide, gate
`runtime.headless-desktop-promotion-continuity`, locale `pairingCommand`, ~20
comment rot. Commit `1411eb69e` + slice cuối sweep `OffscreenBrowserBackend`
(module + `BrowserBackend` interface + setter/field + dead branches) và
`installLinuxBareAioAdeDispatcher` (serve-start writer; `buildBareAioAdeCliScript`
giữ vì managed-terminal shim còn dùng); `per-workspace-env` skill guide viết
lại SSH-only. Giữ compat-window: remote-server-update headless tokens,
`browser.headless.v1` token + `HEADLESS_RUNTIME_WINDOW_ID` + `browserPageId`
(wire — remote peers cũ publish), `'serve'` trong AppImage allowlist,
`serve-sim-*` emulator. **Verify cuối 2026-09-30:** typecheck 3 project + lint
8 gate xanh; focused suite 6 file / 1000 pass; **full suite 3.732 file /
39.035 test exit 0**; **`build:desktop` exit 0** (5 stage); **packaged smoke
Linux pass** (`aio-ade --help` chạy ngoài repo, glibc floor + daemon-entry +
plugin-resource verifiers OK, 0 `orca` trong `app.asar`). Evidence:
[cleanup manifest](reports/cleanup-manifest.md).

**Nhóm 3 — phần verify được local: đóng 2026-09-13.** Ba việc, đều không cần
packaged smoke:

1. **Xoá `config/scripts/verify-agent-hook-stdin-lifecycle.mjs` (396 LoC).** Zero
   caller đã xác minh lại bằng `grep -r` toàn repo (chỉ plan doc nhắc tên nó):
   không script `package.json`, không workflow, không gate id, không entry
   max-lines baseline, không gì glob `config/scripts/`. Chạy thử nó để chứng minh
   nó *broken* chứ không chỉ mồ côi: throw `ENOENT … antigravity-hook.sh` ở entry
   đầu của `MANAGED_SCRIPTS` vì `readGeneratedScripts` gọi `statSync` trần; 8/12
   entry không còn generator sau khi roster thu lại. Không phải reserved seam —
   không phase pending nào nhận nó.
2. **Sửa 12 comment rot / 7 file** mô tả cross-agent title re-ownership như hành
   vi còn sống (`use-tab-agent.ts`, `terminal-title-evidence.ts`,
   `worktree-title-derived-agent-rows.ts`, `web-session-tabs-sync.ts`,
   `pane-agent-owner.ts`, `pty-connection.ts`, `aio-ade-runtime.ts`). Sau sửa,
   grep các pattern `Pi-compatible`/`OMP emits`/`identity group`/`nested pi` trên
   `src` (trừ test) trả 0 hit. Passive-detection map `Pi: 'pi'`, `OMP: 'omp'` giữ
   nguyên — nó thuộc lớp detect agent ngoài roster, không phải cơ chế đã gỡ.
3. **Quyết định GIỮ owner-threading** thay vì xoá như candidate list gợi ý. Đây
   đúng là seam mà mục "KHÔNG xoá" của phase này bảo vệ (ACP/phase 10), và nhóm 1
   đã quyết không inline 35 call site. Xoá threading thì phải bỏ param `owner`
   khỏi signature của 3 normalizer — tức chính là inline. Chi phí giữ chỉ là
   property read thuần. Lý do đầy đủ trong cleanup manifest.

Verify: blast radius 7 file test / **642 pass**, typecheck 3 project xanh, lint 8
gate xanh. Mọi thay đổi `src/` là comment-only (chứng minh bằng `git diff` lọc bỏ
dòng comment → rỗng), thay đổi hành vi duy nhất là xoá script không ai gọi và
không chạy được.

**Sau đó đã chạy lại thật hai gate mà nhóm 1/3 ghi "chờ phase 12", vì cả hai verify
được local:**

- **`pnpm build:desktop` → exit 0**, đủ 5 stage (typecheck; relay; cli với
  `verify-cli-bin` xanh; electron-vite 1.886 + 17 + 9.149 module, không
  `UNRESOLVED_ENTRY`; web projection 765 file). Lý do không defer: repo đã có bug
  đúng lớp này — một bundler entry trỏ tới worker bị xoá làm build fail mà
  typecheck/lint/test **không cái nào bắt được**, và commit sửa nó ghi rằng defer
  sang matrix "produced no coverage at all". Nhóm 1 xoá module nên nằm trong lớp rủi
  ro đó. Đã kiểm thêm: không build config nào reference `hermes-startup-query`.
- **Full suite chạy lại → xanh hoàn toàn, exit 0** (3.734 file / 38.994 test). Lần
  chạy trước đó trên cùng cây code đỏ đúng **1 test** ở
  `src/main/window/attach-main-window-services.test.ts`; chạy riêng pass 27/27 trong
  8,4s. **Kết luận: flake do tải, không phải regression** — `vi.waitFor` có timeout
  mặc định **1s**, không ăn theo `testTimeout: 30_000`, và **204 file test** dùng nó.
  Đã ghi thành rủi ro thứ tư của phase 12 kèm mitigation triage, vì runner CI thường
  2-4 core (tải xấu hơn máy dev 16 core đã sinh flake).

**Phát hiện mới, chưa sửa (2):**

1. `asarUnpack` trong `config/electron-builder.config.cjs` còn **8 glob chết** trỏ
   tới `out/main/<agent>/**` không tồn tại — 7 do `631b3b0e7` xoá `src/main/<dir>`
   (antigravity, copilot, cursor, droid, gemini, grok, hermes), 1 (`claude`) khác
   nguyên nhân: source còn nhưng bị bundle vào `index.js`. Tác hại thấp (glob không
   match thì không unpack gì, build vẫn exit 0) nhưng là config chết. **Để phase 12**
   vì thuộc nhóm 4 và vì `win32-utils.js` trong cùng danh sách là entry
   platform-conditional trông y hệt glob chết — prune đúng cần đối chiếu `out/` thật
   trên cả 3 OS.
2. **`out/` không bao giờ được clean**, nên module đã xoá khỏi `src/` vẫn nằm lại
   trong `out/` và **vẫn bị đóng vào `app.asar`** của build local. Đo được **17 entry
   stale** trước khi clean: 2 binary shim `out/bin/orca{,-dev}` (từ 2026-09-01, trước
   rebrand), 6 module `orca-*`, 3 `hermes-*` (gồm đúng module nhóm 1 vừa xoá), 3
   `pi-*`, 3 module khác. Nguyên nhân: không script build nào clean `out/`, `tsc`
   không xoá output mồ côi, và `files` là all-negation nên *silence means ship*.
   **Phạm vi: CHỈ build local** — `out/`/`dist/` gitignored, runner ephemeral,
   `e2e.yml` dùng `upload/download-artifact` trong cùng run (không phải
   `actions/cache`), `release-cut.yml` chỉ cache thư mục download của electron-builder.
   **Chứng minh:** `rm -rf out dist` + build lại → 0 entry stale, 0 token `orca`,
   0 orphan trong `out/shared`. Kết luận pre-publication của phase 08 **vẫn đứng**
   (artifact release build trên runner sạch), nhưng claim "0 legacy token trong
   `out/`" phải hiểu là **về build sạch**, không phải về mọi `out/` tích luỹ. Chưa
   sửa: thuộc nhóm 4, là thay đổi build pipeline chứ không phải dọn dead code, và ba
   hướng sửa (clean step / script `clean` riêng / guard phát hiện orphan) đều có
   trade-off cần quyết định. Chi tiết + bảng so sánh dirty-vs-clean trong
   [cleanup manifest](reports/cleanup-manifest.md).




## Risk Assessment

Rủi ro chính: xoá nhầm consumer động (dynamic import, asset ref trong builder config, workflow gọi script theo string). Mitigation: reverse-grep cả string literal, packaged smoke, commit nhóm nhỏ revert được. Tín hiệu assumption vỡ: build/test fail sau một nhóm xoá → revert nhóm đó, chuyển item sang "unknown" thay vì sửa chồng. Rủi ro thứ hai: dọn nhầm compatibility alias của phase 05 làm user cũ logout — danh sách compat-window là input bắt buộc trước khi xoá.
