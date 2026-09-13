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
- Modify: `package.json` (deps/scripts), `config/reliability-gates.jsonc` (hand-maintained: `config/scripts/check-reliability-gates.mjs` không có write path; gate ids `mobile-ui.*`, `mobile-relay.*` bị phase 02 orphan), `config/max-lines-baseline.txt` (qua `node config/scripts/check-max-lines-ratchet.mjs --prune`), `.oxlintrc.json` (root — không phải `config/oxlint*`, đó là plugin configs), locale files tại `src/renderer/src/i18n/locales/`.
- Delete: dead modules/tests/assets/workflows theo manifest sinh ra trong phase.
- Create: `plans/260730-0117-aio-ide-rebrand-and-integration/reports/cleanup-manifest.md` (danh sách xoá + evidence + nhóm giữ lại). **Đã tạo 2026-09-03** với nhóm 1.

## Implementation Steps

1. **Chọn và pin inventory tool trước** — repo hiện KHÔNG có knip/ts-prune/depcheck/madge (đã xác minh: không trong deps, không trong 105 scripts). Hai lựa chọn: (a) thêm một devDep pinned ở root (knip cho unused files/exports/deps là đủ cho cả 4 nhóm), hoặc (b) không thêm tool, dùng compiler + reverse-grep thủ công và bỏ tiêu chí "theo depcheck". Ghi lựa chọn vào cleanup manifest.
2. Chạy inventory: unused exports/files/deps, grep reverse-import cho mọi candidate, đối chiếu dynamic import/require và asset refs trong `config/electron-builder.config.cjs`.
3. Phân loại candidate thành: dead (xoá), compat-window (giữ, ghi chú expiry), reserved-seam (giữ, ghi phase pending sở hữu nó), unknown (giữ, ghi lý do). Danh sách compat-window lấy từ phase 04/05 success criteria. Lưu ý contention: nếu phase 06/07/10 đang chạy song song, không purge `package.json` deps trong cùng window — dọn deps sau khi các phase đó merge.
4. Xoá theo nhóm, mỗi nhóm một commit: (a) dead modules+tests, (b) assets/icons + locale keys (dùng script sẵn có: `sync:localization-catalog`, `audit:localization`, `verify:localization-coverage`, allowlist `config/localization-coverage-allowlist.json` — không prune key thủ công), (c) workflows/scripts, (d) deps/config gates.
5. Config gates: `node config/scripts/check-max-lines-ratchet.mjs --prune` (shrink-only; KHÔNG `--init`, nó reset ratchet và hấp thụ suppression mới). `config/reliability-gates.jsonc` sửa tay có review vì `check-reliability-gates.mjs` là check-only — gỡ các gate id đã orphan (`mobile-ui.*`, `mobile-relay.*`).
6. Full verify: lint, typecheck, test, build:desktop, packaged smoke; chạy brand-scan lại để xác nhận không lộ token `orca` user-visible mới.
7. Viết cleanup manifest report.

## Success Criteria

- [x] Inventory tool đã chọn + pin (hoặc quyết định không dùng tool được ghi rõ) trước bất kỳ lần xoá nào. **Chọn option (b)**: không thêm devDep, dùng `tsc --noEmit` (3 project) + `grep -r` reverse-import. Lý do ghi trong [cleanup manifest](reports/cleanup-manifest.md).
- [ ] Inventory evidence + reverse-import evidence tồn tại cho mọi file bị xoá. *(Nhóm 1 xong — 2 file xoá đều có evidence. Nhóm 2-5 chưa xoá gì.)*
- [ ] Không còn workflow/script/gate ref tới path không tồn tại (gồm gate ids `mobile-*` orphan).
- [ ] `package.json` không còn dependency unused theo tool đã chọn (nếu chọn không dùng tool, tiêu chí này thay bằng: mọi dep còn lại có ít nhất một import/script reference chứng minh được).
- [ ] `max-lines` baseline chỉ shrink (`--prune`), không reset.
- [x] Compat-window và reserved-seam items của phase 04/05/06/07/10 còn nguyên và test của chúng xanh. **Verify nhóm 1:** passive title detection (`HERMES_AGENT_NAME_RE`, `terminal-title-*`, `agent-title-*`), historical `AgentType` enum, `openclaude` native-chat layer, `aio-ide-plan-pages.yml`, exclusion `tools/` — tất cả còn nguyên; full suite 3.734 file xanh. Re-verify lại sau mỗi nhóm sau.- [ ] Quyết định `serve`: xoá hoặc giữ, có lý do ghi trong cleanup manifest. Nếu xoá thì dependency riêng của nó cũng đi cùng.
- [ ] Toàn bộ pipeline verify xanh; packaged smoke pass trên ít nhất một OS desktop. *(Nhóm 1: lint 8 gate + typecheck 3 project + full test xanh. `build:desktop` và packaged smoke chưa chạy — chờ phase 12 CI matrix.)*

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


## Risk Assessment

Rủi ro chính: xoá nhầm consumer động (dynamic import, asset ref trong builder config, workflow gọi script theo string). Mitigation: reverse-grep cả string literal, packaged smoke, commit nhóm nhỏ revert được. Tín hiệu assumption vỡ: build/test fail sau một nhóm xoá → revert nhóm đó, chuyển item sang "unknown" thay vì sửa chồng. Rủi ro thứ hai: dọn nhầm compatibility alias của phase 05 làm user cũ logout — danh sách compat-window là input bắt buộc trước khi xoá.
