---
phase: 3
title: "CLI agent bridge hoặc full delete có điều kiện"
status: pending
priority: P1
effort: "1.5-2.5d"
dependencies: [1, 2]
---

# Phase 03: CLI agent bridge hoặc full delete có điều kiện

## Overview

Đây là gate kiến trúc. Mặc định giữ một CLI bridge tối thiểu để external Claude/Codex process gọi orchestration qua process boundary. Chỉ chọn full delete khi user chấp nhận bỏ orchestration, Agent Teams và các e2e liên quan.

## Requirements

- Functional A: giữ `runtime/`, `runtime-client`, orchestration/core handlers/specs, parity guards và bundled guide tối thiểu; xoá browser, computer, emulator, Linear, VM, project/repo/worktree, terminal/file/diagnostic surface không cần.
- Functional A2: quyết định riêng headless `serve`. Nếu giữ, inventory packaging/update/browser dependencies và tăng keep-set; không gọi nó là một phần bridge nhỏ chưa đo.
- Functional B: nếu full delete, xoá `src/cli/`, `src/main/runtime/orchestration/`, CLI IPC/installer/shims và mọi prompt/feature gọi CLI; không để worker chạy lệnh ghost.
- Non-functional: CLI binary name mới là `aio-ide`; Windows/macOS/Linux packaging không còn orphan shim.

## Related Code Files

- Keep in A: `src/cli/runtime/**`, `src/cli/runtime-client.ts`, `src/cli/handlers/{core,orchestration}.ts`, relevant specs, `registry-parity*`, `handler-group-manifest*`, bundled guide generator.
- Delete in A: unused handler/spec/formatter trees and related skills.
- Delete in B: toàn bộ `src/cli/`, CLI installer/IPCs, native launcher, `resources/win32`, build/typecheck CLI scripts.
- Modify both: `package.json`, `config/tsconfig.cli.json`, `.github/workflows/`, reliability/max-lines gates, Electron builder.

## Implementation Steps

1. Chọn Option A hoặc B và ghi vào `decisions.md`; không triển khai hai nhánh cùng lúc.
2. Option A: lập keep-set, xoá feature surface, update specs/index, regenerate bundled guides, chạy 3 parity tests.
3. Option B: xoá orchestration/preamble/Agent Teams cùng CLI, remove renderer "Install CLI", redirects, SSH passthrough và build gates.
4. Định nghĩa command/alias matrix theo platform. Ship `aio-ide` canonical và chỉ giữ alias migration cần thiết ít nhất một update; không cài bare `orca` trên Linux vì xung đột GNOME Orca screen reader. Giữ `orca-ide` ở host cần migration, rồi cleanup theo telemetry/compatibility evidence.
5. Quyết định keep/drop `serve` riêng và update `src/main/ssh/ssh-remote-cli-host-passthrough.ts`, packaging, update supervisor, browser/runtime dependencies tương ứng.
6. Chạy `pnpm tc:cli` hoặc xác nhận script đã bị xoá; sau đó typecheck/test e2e orchestration phù hợp.

## Success Criteria

- [ ] Không có command prompt nào gọi `orca orchestration` sau khi phase hoàn tất.
- [ ] Option A: worker_done/ask/check round-trip và parity tests xanh.
- [ ] Option B: orchestration UI/prompt/Agent Teams bị xoá hoặc disabled rõ ràng, không timeout âm thầm.
- [ ] `pnpm build:desktop` và packaged smoke không tham chiếu binary cũ.
- [ ] Headless `serve` có decision, inventory và tests riêng; không nằm trong keep-set ngầm.
- [ ] PATH/uninstall migration tests cover Windows shims, macOS/Linux links, WSL và SSH host; Linux không shadow GNOME `orca`.

## Risk Assessment

Full delete có blast radius cao hơn carve vì external agent không thể dùng Electron IPC. Nếu chưa có transport thay thế, chọn A. Windows có ba shim độc lập, chỉ packaged smoke mới bắt được lỗi.
