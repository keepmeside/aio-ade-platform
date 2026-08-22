---
phase: 3
title: "CLI thu gọn thành agent bridge tối thiểu (Option A đã duyệt)"
status: in-progress (browser carve xong; Linear/emulator/computer chờ user quyết)
priority: P1
effort: "1.5-2.5d"
dependencies: [1, 2]
---

# Phase 03: CLI thu gọn thành agent bridge tối thiểu

## Overview

**Gate đã đóng 2026-08-21: user duyệt Option A — giữ CLI bridge tối thiểu.** External Claude/Codex process gọi orchestration qua process boundary; Option B (full delete) bị loại. Các bước Option B bên dưới giữ lại chỉ làm tài liệu trade-off, không triển khai.

## Requirements

- Functional: giữ `runtime/`, `runtime-client`, orchestration/core handlers/specs, parity guards và bundled guide tối thiểu; xoá browser, computer, emulator, Linear, VM, project/repo/worktree, terminal/file/diagnostic surface không cần. **Agent Teams được giữ** (quyết định 2026-08-21) nên orchestration là bắt buộc trong keep-set.
- Functional: headless `serve` **feature-flagged OFF** (quyết định 2026-08-21) — không nằm trong keep-set, không xoá code ngay. Quyết định xoá thật ở phase 09. Không kéo packaging/updater/browser dependency của `serve` vào bridge.
- Non-functional: CLI binary name mới là `aio-ade`. **Không alias legacy** (quyết định 2026-08-21): không ship `orca`, không ship `orca-ide`. Windows/macOS/Linux packaging không còn orphan shim.
- Non-functional: bridge transport không phụ thuộc Electron API trực tiếp để tương thích go/no-go Tauri v2 (phase 11).

## Related Code Files

- Keep: `src/cli/runtime/**`, `src/cli/runtime-client.ts`, `src/cli/handlers/{core,orchestration}.ts`, relevant specs, `registry-parity*`, `handler-group-manifest*`, bundled guide generator.
- Delete: unused handler/spec/formatter trees and related skills.
- Modify: `package.json`, `config/tsconfig.cli.json`, `.github/workflows/`, reliability/max-lines gates, Electron builder.

## Implementation Steps

1. Option A đã ghi vào `decisions.md` (2026-08-21); chỉ triển khai nhánh A.
2. Lập keep-set, xoá feature surface, update specs/index, regenerate bundled guides, chạy 3 parity tests.
3. Định nghĩa command matrix theo platform: **chỉ ship `aio-ade`**, không alias. Không cài bare `orca` (xung đột GNOME Orca screen reader trên Linux) và cũng không cài `orca-ide`. Uninstall/PATH cleanup phải xoá shim cũ của `orca` nếu tồn tại từ bản trước — đây là phần duy nhất còn chạm tên cũ.
4. Set `serve` sau feature flag OFF; **không** kéo `src/main/ssh/ssh-remote-cli-host-passthrough.ts`, packaging, update supervisor, browser/runtime dependency của nó vào keep-set. Ghi inventory những gì `serve` cần để phase 09 có dữ liệu quyết định xoá.
5. Chạy `pnpm tc:cli`; sau đó typecheck/test e2e orchestration phù hợp.

## Success Criteria

- [x] **Carve tranche 1 (browser) xong.** 216 → **139 command** (-77). Browser đi trước và đi một mình vì là nhóm lớn duy nhất **không có consumer nào**, verify 6 cách: 0 importer ngoài `src/cli`, 0 reference `orca browser` trong repo, **0 shipped skill-guide ref**, 0 e2e spec, 0 reliability gate, 0 formatter re-export. `generate-bundled-skill-guides.mjs --check` báo **unchanged** sau khi xoá — đó là bằng chứng không guide nào phụ thuộc.
- [ ] Carve tranche 2: **chờ user quyết**, nhưng audit 2026-08-22 đã **đảo khuyến nghị**. Chạy đúng 6 bước kiểm như browser thì cả `emulator` và `computer` đều **fail**:
  - **`computer` có consumer runtime**: `computer-use-error-recovery.ts` trả hướng dẫn agent "Run `orca computer list-apps --json`", dùng bởi `runtime/rpc/errors.ts:109` và `dispatcher.ts:281`. Xoá CLI = app phát hướng dẫn cho command không còn ship. Thêm native sidecar `native/computer-use-macos/` và 1 e2e spec.
  - **`emulator` được UI desktop quảng cáo**: `MobileEmulatorAgentSetupGuideSteps.tsx:150` ("Teaches agents the orca emulator commands"), locale 5 thứ tiếng, pane desktop giữ lại từ phase 02.
  - Chỉ **Linear** là candidate có blocker thuần docs (115 guide ref, regenerate được).

  Khuyến nghị mới: **giữ cả 3 ở phase này.** Minimal bridge dừng ở **139 command**, không phải ~82 như hình dung ban đầu — trừ khi user chấp nhận sửa luôn computer-use error surface và UI copy của emulator, đó là scope change riêng (hoặc để phase 09 sau khi ACP phase 10 chốt agent reach gì).
- [x] Worker_done/ask/check round-trip và parity tests xanh (Agent Teams là consumer đã xác nhận). → 84 test xanh across `orchestration*.test.ts`, `preamble.test.ts`, `cli-command.test.ts`; 4 registry suite (`registry-parity`, `handler-group-manifest`, `vocabulary-policy`, `core`) 24 test xanh.
- [ ] `pnpm build:desktop` và packaged smoke không tham chiếu binary cũ. *(deferred-verification → phase 12)* → **hoãn sang phase 05**: rename binary không thuộc phase này.
- [ ] Chỉ có một binary `aio-ade` trong PATH sau install. → **hoãn sang phase 05** (D2/D3 trong `deferred-verification.md`): `bin`, `verify-cli-bin.mjs`, `install-dev-cli.mjs`, union `OrchestrationCliCommand`, Agent Teams shim và artifact name phải đổi **cùng lúc**, không tách được.
- [x] `serve` sau feature flag OFF, có inventory dependency, không có consumer nào trong keep-set gọi tới nó. → `src/cli/serve-feature-flag.ts` (fail-closed, chỉ `1`/`true`), 12 test viết trước implementation; inventory ở [`research/baseline/serve-dependency-inventory.md`](research/baseline/serve-dependency-inventory.md).
- [ ] PATH/uninstall migration tests cover Windows shims, macOS/Linux links, WSL và SSH host. *(deferred-verification → phase 12)*
- [x] **(bổ sung)** Bridge transport không phụ thuộc Electron API trực tiếp. → `src/cli/bridge-runtime-neutrality.test.ts`: 0 file trong `src/cli` import `electron`; transport là `node:net` + WebSocket. Mutation-check: thêm `import { app } from 'electron'` làm suite đỏ và in ra file vi phạm.

## Trạng thái: BLOCKED — cần user chọn scope carve

Surface thật: **216 command / 20 spec group** (số liệu ở [`research/baseline/coupling-cli.md`](research/baseline/coupling-cli.md)).

Keep-set đã xác minh bằng evidence, không phải suy đoán:
- `orchestration send/check/ask/reply` — preamble nói thẳng với agent "You talk to the coordinator only through the CLI commands below" (`src/main/runtime/orchestration/preamble.ts:64`).
- `orchestration run-*/task-*/dispatch*/worker-*/coordinator-*/gate-*/reset` — lifecycle desktop điều khiển.
- `core`: `open`, `status`, `claude-teams` (Agent Teams được giữ), `terminal *` (26 ref trong guide).
- `agent-context`, `agent hooks status/off/on`.

Candidate-drop và **rủi ro guide** (đây là phần chặn):

| Group | Commands | Ref trong shipped skill guides | Ghi chú |
|---|---:|---:|---|
| browser-basic + browser-advanced | 77 | **0** | an toàn nhất để xoá |
| linear + linear-mcp | 27 | **115** | `skills/orca-linear`, `skills/linear-tickets`, `skill-guides/orca-linear.md`, `skill-guides/linear-tickets.md` |
| emulator | 16 | 2 | |
| computer | 14 | 6 | |
| vm | 1 | 9 | `serve --recipe-json` là result channel của VM recipe — xem inventory |

`verify:bundled-skill-guides` + `verify:skill-bundle-manifest` **nằm trong `pnpm lint`**, nên xoá command mà guide còn dạy sẽ fail lint, và tệ hơn: agent workflow đang dùng sẽ chết im lặng.

Ba lựa chọn đã trình user: (A) xoá cả 4 nhóm ~134 command; (B) xoá browser+emulator+computer ~107, **giữ Linear**; (C) chưa carve, để phase 09. Khuyến nghị **B**.

**Đã thực thi phần không cần quyết định:** browser (77 command) — nhóm duy nhất có 0 consumer và 0 guide ref, nên nằm trong giao của cả A và B. Ba nhóm còn lại vẫn chờ.

### Fallout mà compiler KHÔNG bắt được (bài học cho tranche 2)

Xoá 13 file browser không làm `tsc` đỏ, nhưng để lại 4 loại surface treo — 2 trong số đó **lừa agent**:

1. **`--page` bị advertise trên 10 command không liên quan.** `supportsBrowserPageFlag` cấp flag theo kiểu *loại trừ* ("mọi thứ trừ các nhóm này"), nên xoá browser làm flag lan sang `serve`, `claude-teams`, `environment *`, `agent hooks *`, `vm recipe doctor`. Đã retire hẳn function + call site ở `help.ts`/`args.ts` + test đã thành vô nghĩa.
2. **9 group header chết** trong `isCommandGroup`: `tab`, `cookie`, `intercept`, `capture`, `mouse`, `set`, `clipboard`, `dialog`, `storage` → `orca tab` vẫn được coi là group hợp lệ với 0 thành viên.
3. **Root help vẫn quảng cáo 77 command đã xoá** (3 section + 10 example). Help là cách agent biết mình được gọi gì, nên đây là leftover nguy hiểm nhất: agent đọc help rồi tốn lượt vào command trả về "Unknown command".
4. 1 assertion e2e-style trong `index.test.ts`.

**Guard mới:** `src/cli/help-command-coverage.test.ts` — mọi `$ orca …` example và mọi dòng command trong help section phải resolve về spec/alias/group header thật. Không có gì typecheck help text nên class drift này trước đây vô hình. Mutation-check: thêm dòng `ghost command` làm suite đỏ và in ra tên.

**Tranche 2 phải lặp lại đúng 4 bước kiểm này**, không chỉ xoá file.

## Risk Assessment

Full delete bị loại vì external agent không thể dùng Electron IPC — đó là lý do user chốt Option A, và Agent Teams được giữ nên orchestration có consumer thật. Windows có ba shim độc lập, chỉ packaged smoke mới bắt được lỗi.

**Rủi ro của "không alias":** user cũ chạy `orca` sẽ command-not-found. Đây là quyết định có chủ đích (2026-08-21). Lưu ý phân biệt: bỏ alias chỉ áp cho **binary/PATH** — **one-way data migration của phase 05 vẫn giữ nguyên** (đọc `~/.orca`, Keychain service cũ, plugin manifest token cũ). Nếu bỏ luôn phần đó thì user cũ mất account và workspace, không chỉ mất một lệnh.

Bridge keep-set phải giữ transport process-boundary trung lập runtime (stdio/socket, không Electron API trực tiếp) để spike Tauri v2 ở phase 11 không phải viết lại bridge.
