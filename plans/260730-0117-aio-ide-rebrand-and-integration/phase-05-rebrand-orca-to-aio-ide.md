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

- Functional: user-visible product, package, installer, protocol, CLI bridge, docs, telemetry labels, website links và release assets dùng aio-ade.
- Functional: migrate `.orca`/Orca auth/workspace/cache paths sang aio-ade an toàn; preserve old paths chỉ làm source đọc một lần hoặc uninstall cleanup.
- Non-functional: no raw secret/log path leakage; copyright/NOTICE phản ánh upstream và authorship thật.

## Related Code Files

- Modify: `package.json`, `README.md`, `LICENSE`/NOTICE, `resources/`, `config/electron-builder.config.cjs`, `src/shared/orca-cli-command-name.ts`, app/userData identifiers, localization, `.github/` workflows.
- Compatibility: plugin manifest/wire contracts (`orca-plugin.json`, `engines.orca`, `orca-panel-*`, frame prefixes, marketplace/bundled hashes) phải dual-read/accept-both trước khi switch canonical name. Panel bridge constant, main navigation guard, renderer iframe name và shell placeholders phải đổi atomically.
- Separate migration: existing Orca Profiles cloud/storage/UI subsystem và native chat agent profiles không phải `AgentAuthProfile`; migrate identity riêng.
- Rename: files/dirs có `orca` trong tên chỉ khi không phá migration; update imports and generated manifests.
- Add: migration/version marker, legacy path tests, brand scan report.
- Create: **NOTICE / third-party-notices** — repo hiện chưa có file nào. Phase này là owner tạo nó (nó thuộc attribution của rebrand); phase 07 và 10 append vào cùng path, phase 08 chỉ verify nội dung. Phải giữ dòng copyright upstream (MIT, Copyright (c) 2026 Lovecast Inc.).

## Implementation Steps

1. Tạo canonical brand tokens và mapping. **Hai token, không một:** display/product name là **`AIO-ADE`** (uppercase — productName, window title, About dialog, README, installer title), machine token là **`aio-ade`** (lowercase — binary/CLI, artifact name, appId `com.keepmeside.aio-ade`, package name). Org/author `stablyai` → `keepmeside`. Phân biệt code symbol internal với user-visible copy.
2. Viết compatibility readers/writers cho plugin manifest, panel bridge, account markers, Keychain service và existing profile identities; verify old plugins/accounts/workspaces trước khi đổi app identity.
3. Đổi package name/homepage/author/bin/appId/artifact names/icon metadata; `stablyai` → `keepmeside`, guard `stablyai/orca` → `keepmeside/aio-ade-platform`. **Release workflow: bỏ RC channel, chỉ stable, manual dispatch, không auto-tag** (quyết định 2026-08-21). **Ship unsigned ở bản đầu** (chưa có cert) — chấp nhận SmartScreen/Gatekeeper cảnh báo; **updater phải tắt** vì kênh chưa xác thực. **Telemetry/diagnostics chuyển sang endpoint Keepmeside, bỏ update check** — chỉ bật sau khi có privacy policy, opt-in/opt-out UI và redaction tests.
4. Implement one-way data copy/migration for userData, account marker files, settings and dev config; never move arbitrary symlinks. **Lưu ý quan trọng:** quyết định "không alias" chỉ áp cho **binary/PATH**, KHÔNG áp cho data migration — reader cho `~/.orca`, Keychain service cũ, plugin manifest/panel-bridge token cũ **phải giữ**, nếu không user cũ mất account và workspace.
5. Rewrite README/docs/skills and remove Orca marketing links; retain attribution/third-party notices.
6. Run contract-aware scan. Remaining `orca` tokens require classification: migration alias, wire compatibility, upstream copyright, internal module not yet safe to rename, or bug.

## Success Criteria

- [ ] New install shows **AIO-ADE** (display) và artifacts là `aio-ade-*` (machine token). *(deferred-verification: cần CI matrix 3 OS — verify thật ở phase 12)*
- [ ] Existing Claude/Codex OAuth accounts and workspaces load without silent logout.
- [ ] User-visible scan has zero legacy Orca token. Chỉ ship binary `aio-ade`, **không alias** `orca`/`orca-ide`; data-migration readers vẫn còn và có test.
- [ ] NOTICE/third-party-notices tồn tại và giữ copyright upstream Lovecast Inc.
- [ ] macOS/Windows/Linux build metadata agree on one product identity; **chỉ có stable channel**, không RC. *(deferred-verification: verify ở phase 12)*
- [ ] Không production traffic hoặc publish target nào còn trỏ tới `stablyai/orca`, `onorca.dev` hay upstream PostHog. Telemetry/diagnostics trỏ endpoint Keepmeside nhưng **inert cho tới khi có privacy policy + opt-in UI + redaction tests**; update check bị bỏ hoàn toàn.
- [ ] **Updater tắt** (chưa có cert nên chưa ký được); release workflow manual-dispatch, không tag/publish/mutate `main` tự động.
- [ ] Artifact unsigned được document rõ trong README/release notes kèm hướng dẫn bypass Gatekeeper trên macOS (`right-click → Open` hoặc `xattr -d com.apple.quarantine`).
- [ ] Old/new plugin manifest và wire-token compatibility tests, hostile-panel containment e2e, persisted plugin route migration và bundled plugin hash regeneration đều xanh với `pluginSystemEnabled`.

## Risk Assessment

Mass rename can collide with orchestration symbols and legacy paths. Mitigation: roster/CLI first, chokepoint mapping, migration tests, separate commit, no blind global replace.
