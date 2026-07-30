---
phase: 11
title: "Tích hợp Excalidraw offline và context handoff"
status: pending
priority: P2
effort: "1-2 tuần"
dependencies: [9]
---

# Phase 11: Tích hợp Excalidraw offline và context handoff

## Overview

Thêm Excalidraw MIT làm canvas duy nhất, lazy trong editor-tab path. Board lưu trên workspace host, chạy zero-network, export ảnh + structured context cho Claude/Codex. tldraw excluded; XYFlow deferred.

## Requirements

- `.excalidraw` open/save/autosave qua host-aware fs API với `connectionId`; hỗ trợ local git, folder workspace, WSL và SSH.
- Vendor/self-host fonts/assets; disable/guard remote embeds/bookmarks; packaged network-off smoke có zero request.
- Export PNG/SVG và compact nodes/edges/text outline; screenshot annotation và plan-linked board là approved first slice.
- Lazy chunk, startup/bundle budget; missing canvas dependency không block core startup.
- Keyboard-only, focus, screen-reader labels/announcements, reduced motion, light/dark và platform shortcuts theo STYLEGUIDE.
- Không thêm tldraw SDK, XYFlow, second canvas runtime hoặc arbitrary agent scene writes.

## Architecture và ownership

- Exclusive: `src/renderer/src/components/excalidraw-board/**`, board file schema/serializer/export/context modules and tests.
- Consume phase-09 host fs/runtime API read-only; không chỉnh profile/bridge/runtime files.
- Conflict: shared editor dispatch change phải ở một small adapter file owned phase 11; không mở rộng monolithic EditorContent.

## Related Code Files

- Create: lazy board surface, file codec/versioning, conflict-safe autosave, export/outline/context actions, accessibility tests.
- Modify: file-language/preview dispatch and tab create/open entry at narrow seams.
- Add: Excalidraw dependency/assets/notices through a versioned dependency request owned/applied by the Phase 03 root-manifest steward; release activation remains phase 12.

## Tests Before

- Characterize editor tab file open/save, remote fs with `connectionId`, external-change conflict and agent image attachment flow.
- Add offline request interception and bundle/startup baseline.
- Accessibility spike verifies Excalidraw actual keyboard/AT behavior before acceptance.

## Refactor

1. Add versioned board file codec and host-aware read/write with mtime/conflict guard.
2. Lazy-load Excalidraw; map theme/tokens without hardcoded colors or custom shadow tiers.
3. Vendor assets/fonts; disable network-dependent features by default.
4. Add PNG/SVG + structural outline export and explicit send-to-agent action.
5. Add screenshot annotation, errors/retry/empty states and external edit recovery.

## Tests After

- Save/reload/export/attach works on local/folder/WSL/SSH and survives restart.
- Packaged offline mode issues zero network requests and renders fonts/icons correctly.
- Keyboard/screen-reader/reduced-motion/focus tests pass; board file conflicts never overwrite silently.

## Regression Gate

Focused renderer/fs/export/a11y tests, Playwright packaged offline smoke, `pnpm typecheck && pnpm test && pnpm lint && pnpm build:desktop`, Tauri startup/chunk budget check.

## Security, risks và rollback

- Risk: remote overwrite, embedded malicious data, pointer-only UX, bundle regression.
- Mitigation: schema/size validation, sanitized assets, conflict guard, a11y gate, lazy loading.
- Rollback: feature flag/file viewer disable; `.excalidraw` files remain portable and untouched.

## Success Criteria

- [ ] Excalidraw is the only canvas dependency; tldraw absent, XYFlow deferred.
- [ ] Board is zero-network, host-aware, conflict-safe and portable.
- [ ] PNG/SVG/structured context reaches both Claude and Codex.
- [ ] Accessibility and startup/bundle gates pass on all desktop platforms.
