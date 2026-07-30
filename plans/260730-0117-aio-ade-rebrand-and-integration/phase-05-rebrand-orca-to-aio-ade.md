---
phase: 5
title: "Rebrand Orca thành aio-ade"
status: pending
priority: P1
effort: "3-5d"
dependencies: [4]
---

# Phase 05: Rebrand Orca thành aio-ade

## Overview

Đổi brand, binary, app identifiers, artifact names, docs và author metadata thành aio-ade, Keepmeside, SalyyS1. Giữ legacy read/migrate compatibility đủ lâu để không logout hoặc mất workspace.

## Requirements

- Functional: user-visible product, package, installer, protocol, docs, telemetry labels, website links và release assets dùng aio-ade.
- Functional: migrate `.orca`/Orca auth/workspace/cache paths sang aio-ade an toàn; preserve old paths chỉ làm source đọc một lần hoặc uninstall cleanup.
- Non-functional: no raw secret/log path leakage; copyright/NOTICE phản ánh upstream và authorship thật.
- Compatibility: treat `TERM_PROGRAM=Orca` as an internal terminal protocol token, not user-visible branding. Retain it for one compatibility release unless a capability matrix proves `aio-ade` preserves Claude/Fable and Codex TUI behavior; classify the token separately from the brand scan.

## Related Code Files

- Modify: `package.json`, `README.md`, `LICENSE`/NOTICE, `resources/`, `config/electron-builder.config.cjs`, canonical product-identity chokepoints, app/userData identifiers, localization, `.github/` workflows.
- Do not reintroduce `src/shared/orca-cli-command-name.ts`: Phase 03 deletes the CLI command-name module with the full CLI tree. Any required legacy alias belongs in the migration boundary owned by the product identity module.
- Compatibility: plugin manifest/wire contracts (`orca-plugin.json`, `engines.orca`, `orca-panel-*`, frame prefixes, marketplace/bundled hashes) phải dual-read/accept-both trước khi switch canonical name. Panel bridge constant, main navigation guard, renderer iframe name và shell placeholders phải đổi atomically.
- Separate migration: existing Orca Profiles cloud/storage/UI subsystem và native chat agent profiles không phải `AgentAuthProfile`; migrate identity riêng.
- Rename: files/dirs có `orca` trong tên chỉ khi không phá migration; update imports and generated manifests.
- Add: migration/version marker, legacy path tests, brand scan report.

## Implementation Steps

1. Tạo canonical brand tokens và mapping `orca -> aio-ade`; phân biệt code symbol internal với user-visible copy.
2. Viết compatibility readers/writers cho plugin manifest, panel bridge, account markers, Keychain service và existing profile identities; verify old plugins/accounts/workspaces trước khi đổi app identity.
3. Đổi package name/homepage/author/bin/appId/artifact names/icon metadata. Giữ release workflows inert cho tới khi signing, notarization, updater, telemetry, diagnostics, privacy policy và fork-owned release credentials được duyệt; không chỉ đổi guard từ `stablyai/orca`.
4. Implement one-way data copy/migration for userData, account marker files, settings and dev config; never move arbitrary symlinks; giữ cleanup aliases một release window.
5. Rewrite README/docs/skills and remove Orca marketing links; retain attribution/third-party notices.
6. Run contract-aware scan. Remaining `orca` tokens require classification: migration alias, wire compatibility, upstream copyright, internal module not yet safe to rename, or bug.
7. Verify terminal capability matrix for `TERM_PROGRAM`, OSC 10/11, focus, Kitty keyboard, bracketed paste, mouse, hyperlinks and resize on local, WSL and SSH before changing the internal token.

## Success Criteria

- [ ] New install shows aio-ade and artifacts are `aio-ade-*`.
- [ ] Existing Claude/Codex OAuth accounts and workspaces load without silent logout.
- [ ] User-visible scan has zero legacy Orca token; compatibility aliases are documented and covered by tests.
- [ ] macOS/Windows/Linux build metadata and update channels agree on one product identity.
- [ ] Không production traffic hoặc publish target nào còn trỏ tới `stablyai/orca`, `onorca.dev` hay upstream PostHog; telemetry/diagnostics disabled hoặc dùng endpoint fork-owned đã duyệt.
- [ ] Updater disabled mặc định hoặc trỏ tới fork-owned signed release channel; release workflow không tag/publish/mutate `main` trước approval.
- [ ] Old/new plugin manifest và wire-token compatibility tests, hostile-panel containment e2e, persisted plugin route migration và bundled plugin hash regeneration đều xanh với `pluginSystemEnabled`.

## Risk Assessment

Mass rename can collide with orchestration symbols and legacy paths. Mitigation: roster/CLI first, chokepoint mapping, migration tests, separate commit, no blind global replace.
