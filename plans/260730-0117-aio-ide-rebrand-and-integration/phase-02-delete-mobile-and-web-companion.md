---
phase: 2
title: "Xoá mobile và web companion"
status: completed
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
- Modify: `package.json`, `pnpm-workspace.yaml`, `config/reliability-gates.jsonc` (gồm gate ids `mobile-ui.*`, `mobile-relay.*`), `.oxlintrc.json` root, `config/max-lines-baseline.txt`, mobile IPC/notification bridge.
- Delete cùng mobile tree: `mobile/.oxlintrc.json`.
- Verify: `src/main/ipc/`, `src/main/notifications/`, `tests/e2e/` không còn import mobile-only modules.

## Implementation Steps

1. Tạo manifest file delete và grep reverse imports trước `git rm`.
2. Xoá mobile tree cùng workflows, release tags/docs links, mobile-specific localization keys.
3. Gỡ literal `mobile` khỏi `audit:code-quality:native`, 31 reliability-gate refs, floating-mobile e2e và scripts; giữ `pnpm-workspace.yaml packages: []` nếu chưa chứng minh bỏ an toàn.
4. Kiểm tra desktop notification, tray, SSH và renderer không gọi mobile transport.
5. Chạy typecheck/lint/test hẹp; sửa orphan imports và snapshots.

## Success Criteria

- [x] `Test-Path mobile` false và không còn package script/workflow build mobile. → 0 tracked file dưới `mobile/`, 3 workflow xoá. Tiêu chí gốc viết bằng PowerShell (1 OS); form portable nằm ở `src/shared/mobile-companion-removal-guard.test.ts` (15 test, viết **trước** khi xoá: 7 đỏ → xanh).
- [x] `pnpm lint` không fail vì path mobile hoặc stale reliability gate. → **exit 0**. Đã sửa: literal path `mobile` trong `audit:code-quality:native`; gate `mobile-ui.drawer-close-continuity` xoá (53→52 gate); 8 `testFiles` + 4 command + 6 `assertionRefs` + 3 `evidenceRuns` prune khỏi 3 gate còn sống; ratchet baseline 353→334.
- [x] Desktop notification/unread state vẫn hoạt động; không còn mobile bridge trong renderer bundle. → không có import nào từ `src/**` vào `mobile/**` (đã verify trước khi xoá), `pnpm build:desktop` **exit 0** (768 file / 40.5 MiB web client), suite **39.911 pass**.
- [x] Không còn link tải APK/iOS trong README user-facing aio-ade. → xoá feature cell "Mobile Companion" + section download iOS/Android, sửa alt text hero. Cấu trúc table verify cân (8 `<tr>`, 16 `<td>`).

### Quyết định scope (Option A)

Chỉ xoá **RN tree** + coupling config/CI/docs. **Giữ 162 module desktop-side** tên "mobile" (pairing UI, E2EE v1/v2, QR, notification replay, presence lock, emulator pane) — chúng chạy trong Electron và phục vụ **paired web client**, không phải app điện thoại. `MOBILE_RPC_METHOD_ALLOWLIST` trong `runtime-rpc.ts` vẫn live: nó chặn method ngoài allowlist cho device pair scope `mobile`, mà web client vẫn dùng. Xoá tiếp các surface đó là quyết định scope riêng, có acceptance criteria riêng; trộn vào commit này sẽ làm mất khả năng revert.

Chi tiết đầy đủ (bảng từng file + lý do, danh sách giữ lại có evidence): [`research/baseline/phase-02-delete-manifest.md`](research/baseline/phase-02-delete-manifest.md).

## Risk Assessment

Mobile và desktop share account snapshots, unread state, agent catalog và một phần remote transport. Mitigation: đọc reverse imports, giữ `build:web*`, `vite.web.config.ts`, renderer web/SSH runtime khi còn consumer, chạy e2e notification/agent picker trước merge.
