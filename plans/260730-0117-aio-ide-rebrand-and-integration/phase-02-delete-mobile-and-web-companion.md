---
phase: 2
title: "Xoá mobile và web companion"
status: pending
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

- [ ] `Test-Path mobile` false và không còn package script/workflow build mobile.
- [ ] `pnpm lint` không fail vì path mobile hoặc stale reliability gate.
- [ ] Desktop notification/unread state vẫn hoạt động; không còn mobile bridge trong renderer bundle.
- [ ] Không còn link tải APK/iOS trong README user-facing aio-ade.

## Risk Assessment

Mobile và desktop share account snapshots, unread state, agent catalog và một phần remote transport. Mitigation: đọc reverse imports, giữ `build:web*`, `vite.web.config.ts`, renderer web/SSH runtime khi còn consumer, chạy e2e notification/agent picker trước merge.
