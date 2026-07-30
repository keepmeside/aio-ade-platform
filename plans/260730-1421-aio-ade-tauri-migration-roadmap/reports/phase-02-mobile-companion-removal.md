# Phase 02: xóa Mobile Companion

- Hoàn thành: 2026-07-30
- Branch: `codex/aio-ade-implementation`
- Trạng thái: completed

## Kết quả

- Xóa toàn bộ `mobile/**`, workflow iOS/Android/mobile, companion assets, QR/pairing UI và relay-only runtime.
- Xóa quảng bá/cài đặt Mobile Companion khỏi README chính và 6 README bản dịch.
- Giữ Android/iOS emulator, browser/terminal mobile-driver, web runtime, notifications/unread, SSH và remote runtime.
- Đổi desktop pairing/Markdown/E2EE/socket contracts sang namespace `runtime`.
- Giữ `files.open`/`files.openDiff` bằng bridge generic `ui:open*FromRuntime`.
- Giữ cảnh báo auth failure bằng `runtime:authFailure`, one-shot consume và toast dẫn tới Settings → Servers.

## Verification

| Gate | Kết quả |
| --- | --- |
| Mobile removal/preservation contract | pass, 4/4 |
| Tester preservation suite | pass, 9 files / 221 tests |
| `useIpcEvents` + runtime auth helper | pass, 94/94 |
| Runtime file-open bridge subset | pass, 75/75 + 3/3 focused |
| Typecheck Node/CLI/Web | pass |
| Electron/Vite build smoke | pass; warning dynamic import/CSS có sẵn |
| Web projection build | pass; 763 files |
| Focused Oxlint | pass |
| `git diff --check` | pass |

`runtime-rpc.test.ts` đầy đủ vượt timeout 120 giây mà không phát failure. Một test Windows IPv4-loopback trong `orca-runtime-files.test.ts` fail độc lập ở nhánh `resolveTerminalPath`; code Phase 02 chỉ đổi import tên module trong file này, còn 3 test file-open liên quan đều pass.

## Cleanup chuyển Phase 03

- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.oxlintrc.json`, `config/reliability-gates.jsonc` và max-lines baseline còn tham chiếu mobile/relay theo ownership đã khóa.
- `pnpm check:reliability-gates` hiện báo 15 path test mobile/relay đã xóa; Phase 03 là manifest steward và phải dọn cùng CLI/orchestration.
- `src/cli/**`, headless `serve`, installer/shim và orchestration vẫn còn có chủ đích tới Phase 03.

## Câu hỏi chưa giải quyết

- Không có blocker Phase 02. Windows IPv4-loopback test cần được phân loại riêng nếu còn fail sau manifest cleanup Phase 03.
