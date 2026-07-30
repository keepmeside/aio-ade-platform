---
phase: 2
title: "Xóa mobile companion, giữ generic web/remote runtime"
status: pending
priority: P1
effort: "1-2 ngày"
dependencies: [1]
---

# Phase 02: Xóa mobile companion, giữ generic web/remote runtime

## Overview

Xóa React Native/mobile companion và mọi asset/workflow/test chỉ phục vụ mobile. Không xóa renderer web client, remote runtime, notification/unread contracts hoặc SSH transport còn dùng cho desktop.

## Requirements

- Xóa `mobile/`, mobile lockfile, APK/iOS assets, mobile release workflows, pairing/onboarding UI chỉ dành mobile.
- Giữ `build:web*`, browser/web renderer, remote RPC, generic notification state, file/SSH runtime khi còn consumer.
- Không chỉnh agent roster hoặc brand trong phase này.

## Architecture và ownership

- Exclusive: `mobile/**`, mobile-only workflows/assets/docs/tests và imports chỉ trỏ mobile.
- `package.json`, root lockfile, lint/reliability manifests do phase 03 sở hữu; phase 02 chỉ xuất manifest yêu cầu cleanup.
- Conflict: không sửa shared root manifests; phase 03 consume deletion manifest và đóng global gate.

## Related Code Files

- Delete: `mobile/**`, `.github/workflows/*mobile*`, mobile-only resources/docs/e2e.
- Modify: desktop files chỉ khi reverse import chứng minh import mobile-only trực tiếp.
- Preserve: `src/renderer/src/web/**`, `vite.web.config.ts`, `src/main/ssh/**`, generic runtime RPC.

## Tests Before

- Test desktop notification/unread, remote workspace, browser/web client và account snapshot contracts dùng chung.
- Capture mobile reverse-import list và package/gate references cho phase 03.

## Refactor

1. Xóa mobile tree theo delete manifest, không glob qua generic `web`/`remote` names.
2. Xóa mobile-only IPC/listeners/UI/routes/localization/resources.
3. Giữ shared types nếu desktop/SSH consumer tồn tại; rename cụ thể thay vì `mobile` helper chung chung.

## Tests After

- `Test-Path mobile` false; no APK/iOS/mobile workflow/reference.
- Focused desktop notification, web client, SSH/remote, account snapshot tests vẫn xanh.
- Scan imports/resources không còn orphan module.

## Regression Gate

`pnpm typecheck:node`, `pnpm typecheck:web` và focused Vitest/Playwright. Full `pnpm lint`/root manifest gate được phase 03 đóng ngay sau khi owner shared manifests cập nhật.

## Security, risks và rollback

- Risk: xóa shared transport vì tên chứa mobile. Mitigation: reverse imports và keep-set explicit.
- Security: xóa pairing tokens/deep links/mobile endpoints; verify desktop không còn listen service thừa.
- Rollback: revert delete commit độc lập; không migrate user data ở phase này.

## Success Criteria

- [ ] Mobile source/release/docs/assets biến mất hoàn toàn.
- [ ] Desktop web/remote/SSH và unread state không regression.
- [ ] Shared-manifest cleanup request đầy đủ cho phase 03.
- [ ] Không thêm placeholder/mobile shim mới.
