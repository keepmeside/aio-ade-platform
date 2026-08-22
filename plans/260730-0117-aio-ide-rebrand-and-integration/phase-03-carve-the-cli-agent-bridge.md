---
phase: 3
title: "CLI thu gọn thành agent bridge tối thiểu (Option A đã duyệt)"
status: pending
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

- [ ] Không có command prompt nào gọi `orca orchestration` sau khi phase hoàn tất.
- [ ] Worker_done/ask/check round-trip và parity tests xanh (Agent Teams là consumer đã xác nhận).
- [ ] `pnpm build:desktop` và packaged smoke không tham chiếu binary cũ. *(packaged smoke đa OS là deferred-verification — verify thật ở phase 12)*
- [ ] Chỉ có một binary `aio-ade` trong PATH sau install; không có `orca` hay `orca-ide`. Uninstall xoá được shim cũ nếu có.
- [ ] `serve` sau feature flag OFF, có inventory dependency, không có consumer nào trong keep-set gọi tới nó.
- [ ] PATH/uninstall migration tests cover Windows shims, macOS/Linux links, WSL và SSH host. *(deferred-verification: chỉ chạy được đủ trên CI matrix — phase 12)*

## Risk Assessment

Full delete bị loại vì external agent không thể dùng Electron IPC — đó là lý do user chốt Option A, và Agent Teams được giữ nên orchestration có consumer thật. Windows có ba shim độc lập, chỉ packaged smoke mới bắt được lỗi.

**Rủi ro của "không alias":** user cũ chạy `orca` sẽ command-not-found. Đây là quyết định có chủ đích (2026-08-21). Lưu ý phân biệt: bỏ alias chỉ áp cho **binary/PATH** — **one-way data migration của phase 05 vẫn giữ nguyên** (đọc `~/.orca`, Keychain service cũ, plugin manifest token cũ). Nếu bỏ luôn phần đó thì user cũ mất account và workspace, không chỉ mất một lệnh.

Bridge keep-set phải giữ transport process-boundary trung lập runtime (stdio/socket, không Electron API trực tiếp) để spike Tauri v2 ở phase 11 không phải viết lại bridge.
