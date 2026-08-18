---
phase: 2
title: "Xoá mobile và web companion"
status: rn-tree-removed-src-surface-pending
priority: P1
effort: "1-1.5d"
dependencies: [1]
---

# Phase 02: Xoá mobile và web companion

## Overview

Loại React Native mobile tree và mọi release/CI/docs coupling, nhưng giữ desktop runtime contracts không phụ thuộc mobile. Làm trước roster để tránh sửa các file sẽ xoá.

## Requirements

- Functional: xoá `mobile/`, mobile lockfile/assets/tests/workflows; xoá bridge IPC/preload nếu chỉ phục vụ mobile companion.
- Functional: giữ generic web build, renderer web client, runtime RPC và SSH/remote transport nếu còn desktop hoặc remote-client consumer; không đồng nhất "mobile" với toàn bộ web runtime.
- Non-functional: `pnpm lint` không truyền path không tồn tại; reliability gates, max-lines ratchet, workspace config vẫn hợp lệ.

## Related Code Files

- Delete: `mobile/`, `.github/workflows/mobile*.yml`, mobile-only scripts/assets/docs sau khi cross-reference.
- Modify: `package.json`, `pnpm-workspace.yaml`, `config/reliability-gates.jsonc`, `config/oxlint*`, `config/max-lines-baseline.txt`, mobile IPC/notification bridge.
- Verify: `src/main/ipc/`, `src/main/notifications/`, `tests/e2e/` không còn import mobile-only modules.

## Implementation Steps

1. Tạo manifest file delete và grep reverse imports trước `git rm`.
2. Xoá mobile tree cùng workflows, release tags/docs links, mobile-specific localization keys.
3. Gỡ literal `mobile` khỏi `audit:code-quality:native`, 31 reliability-gate refs, floating-mobile e2e và scripts; giữ `pnpm-workspace.yaml packages: []` nếu chưa chứng minh bỏ an toàn.
4. Kiểm tra desktop notification, tray, SSH và renderer không gọi mobile transport.
5. Chạy typecheck/lint/test hẹp; sửa orphan imports và snapshots.

## Success Criteria

- [ ] `Test-Path mobile` false và không còn package script/workflow build mobile → xoá 1,048 file + 3 workflow, commit `de1e6d8`
- [ ] `pnpm lint` không fail vì path mobile hoặc stale reliability gate → lint + typecheck xanh, 51 gate pass
- [ ] Desktop notification/unread state vẫn hoạt động; không còn mobile bridge trong renderer bundle → **chưa làm**, xem "Scope còn lại"
- [ ] Không còn link tải APK/iOS trong README user-facing Aio-IDE → chưa audit docs

## Kết quả thực thi (2026-08-03)

### Đã xong: xoá RN tree

Reverse-import audit trước khi xoá cho kết quả quan trọng: **`src/` không import gì từ root
`mobile/`**. Các đường dẫn `../mobile/` trong `src/renderer/` trỏ tới
`src/renderer/src/components/mobile/` — thư mục pairing UI phía desktop, hoàn toàn khác cây React Native.
Nên xoá RN tree là thao tác cô lập, không cần sửa import nào trong `src/`.

Đã xoá và verify:

- `mobile/` (1,048 file) + `mobile.yml`, `mobile-android-release.yml`, `mobile-ios-release.yml`
- Literal path `mobile` khỏi `audit:code-quality:native`
- 2 gate mobile-only (`mobile-ui.drawer-close-continuity`, `mobile-relay.endpoint-recovery`) → 53 còn 51
- Thu hẹp 2 gate terminal (`terminal-query.mobile-view-authority`, `terminal-runtime.mobile-stream-budget`)
  về tests desktop; phải xoá kèm `assertionRefs` và `evidenceRuns` mobile vì validator bắt buộc
  `assertionRefs.file` ∈ `testFiles` và `evidenceRuns.command` ∈ gate commands
- 20 entry stale khỏi `max-lines-baseline.txt` (1 mobile + 19 `mobile-config`), 354 → 334

Gate sau khi xoá: `pnpm lint` xanh, `pnpm typecheck` xanh, 51 gate pass,
`vitest src/shared/` giữ **đúng 4 failure pre-existing** với 3,401 pass — không regression.
Tracked file 11,084 → 10,034.

### Scope còn lại: 162 file mobile trong `src/`

Plan giả định Phase 02 chỉ là xoá `mobile/`. Thực tế còn **162 file có `mobile` trong tên nằm trong
`src/`** (61 là test), chưa đụng tới:

| Khu vực | Số file | Ghi chú |
|---|---:|---|
| `src/renderer/src/components/mobile/` | 30 | pairing UI, brand icons, network picker |
| `src/main/**` mobile modules | 40 | gồm `src/main/ipc/mobile.ts` |
| `src/shared/**` mobile modules | 23 | gồm 8 file `mobile-relay-*` |
| Consumer trong `src/renderer` | ~99 tham chiếu | `MobilePane`, sidebar onboarding badge, settings |

Đây là **desktop-side mobile companion** (pairing, relay E2EE, phone protocol). Xoá nó là quyết định
sản phẩm riêng, không phải hệ quả tự động của việc bỏ RN app: user vẫn có thể muốn giữ pairing
để dùng với client khác, hoặc bỏ hẳn. Chưa xoá vì cần user chốt.

Lưu ý coupling: `showMobileButton` nằm trong `GlobalSettings` và `APPEARANCE_MENU_KEYS`
(`src/main/ipc/settings.ts`), nên bỏ surface này chạm vào persisted settings — phải đi cùng
settings-migration layer mà Phase 01 phát hiện là **chưa tồn tại**.

### Audit 2026-08-03: xoá `src/` mobile surface KHÔNG phải thao tác xoá đơn thuần

User đã duyệt "xoá hết" 162 file. Nhưng audit dependency trước khi xoá cho thấy scope thực tế
lớn hơn nhiều so với 162 file, nên **chưa thực thi** và cần đổi cách tiếp cận.

Số liệu đo được:

| Chỉ số | Giá trị |
|---|---:|
| File có `mobile` trong tên, trong `src/` | 162 |
| File **không** mang tên mobile nhưng tham chiếu `mobile` | 315 |
| Trong đó import thật từ module mobile | **55** |
| File trong `src/main/runtime/rpc/` tham chiếu mobile | 61 |
| File dính logic `mobile-fit` / fit-override | 33 |

Coupling nằm ở **hạ tầng desktop dùng chung**, không phải nhánh lá:

1. **`src/preload/index.ts`** import 3 type mobile và expose IPC channel
   `ui:mobileMarkdownRequest` / `ui:mobileMarkdownResponse`. Preload là public API surface
   giữa main và renderer — sửa nó ảnh hưởng mọi renderer consumer.
2. **`src/main/index.ts`** có 6 chỗ dùng `mobilePairing`, và cờ CLI `--serve-mobile-pairing`
   quyết định `scope: 'mobile' | 'runtime'` của headless serve. Nghĩa là mobile pairing
   **gắn với gate "Headless `serve`"** đang còn `pending` trong `decisions.md`.
3. **`mobile-fit` / fit-override** đã thành hành vi terminal desktop: xuất hiện ở
   `src/main/ipc/pty.ts`, `src/main/ipc/runtime.ts`, `orca-runtime.ts`,
   `rpc/methods/terminal.ts`. Comment trong preload nói rõ resize baseline được giữ
   "while a mobile-fit override blocks pty:resize" — xoá mù sẽ đổi hành vi resize PTY của desktop.
4. **Relay E2EE v2** (7 file `mobile-e2ee-*` + `src/main/runtime/relay/`) là transport layer;
   `src/shared/network/` cũng import. Cần xác định remote/SSH client có dùng chung hay không
   trước khi bỏ — plan đã cảnh báo "không đồng nhất mobile với toàn bộ web runtime".

Kết luận: đây là **refactor nhiều ngày có rủi ro đổi hành vi desktop**, không phải `git rm`.
Effort "1-1.5d" của phase này chỉ đúng cho phần RN tree (đã xong). Phần `src/` cần tách thành
phase riêng, và phải chốt gate "Headless `serve`" trước vì `--serve-mobile-pairing` nối hai thứ.

Đề xuất thứ tự an toàn: làm Phase 05 rebrand trước (user đã chọn), rồi quay lại xoá `src/` mobile
như một phase độc lập có audit riêng cho preload contract, fit-override và relay transport.

## Risk Assessment

Mobile và desktop share account snapshots, unread state, agent catalog và một phần remote transport. Mitigation: đọc reverse imports, giữ `build:web*`, `vite.web.config.ts`, renderer web/SSH runtime khi còn consumer, chạy e2e notification/agent picker trước merge.
