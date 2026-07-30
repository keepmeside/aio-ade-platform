---
phase: 12
title: "Cắt sang Tauri, loại Electron nếu mọi gate đạt"
status: pending
priority: P1
effort: "1-2 tuần"
dependencies: [10, 11]
---

# Phase 12: Cắt sang Tauri, loại Electron nếu mọi gate đạt

## Overview

Chỉ promote Tauri khi parity, security, packaging, migration và rollback gates đều xanh. Nếu bất kỳ P1 gate fail, Electron tiếp tục baseline và phase 12 không xóa runtime Electron.

## Requirements

- Final decision report chọn `cutover` hoặc `hold`; không partial delete.
- Build/sign/package Tauri + Node sidecar cho Windows x64/ARM64, macOS x64/ARM64, Linux glibc 2.31; verify upgrades/rollback.
- Remove Electron dependencies/entry/preload/builder only after signed packaged parity and data migration tests.
- Updater, telemetry, diagnostics và release workflow vẫn inert nếu fork-owned endpoints/signing/feed/credentials chưa sẵn sàng.
- Docs/README/install paths chỉ claim hành vi thực sự verified; no mobile/CLI/Agent Teams/tldraw/XYFlow promises. Any retained `TERM_PROGRAM=Orca` compatibility token is documented as a migration exception, not a public brand surface.

## Architecture và ownership

- Exclusive: release/update/telemetry guards, packaging/signing configs, Electron cutover deletion, final docs/migration notices.
- Prior phase source is read-only; fixes go back to owner phase before rejoin.
- Conflict: cutover commit separated from docs/release activation; Electron removal is last reversible commit.

## Related Code Files

- Modify: release/build installers, app metadata, CI matrices, docs/README/notices, telemetry/updater guards.
- Delete conditionally: Electron entry/preload/builder/dependency/test paths after gates.
- Preserve: last signed Electron artifact, legacy data readers, sidecar and React/xterm runtime.

## Tests Before

- Re-run complete Electron and Tauri oracle matrices from fresh/legacy/corrupt profiles.
- Run upgrade/downgrade, interrupted update, sidecar locked-file, signer/notarization and glibc checks.
- Verify release workflows remain inert without credentials and cannot target upstream.

## Refactor

1. Generate final parity/security/license/SBOM/capability report.
2. If all P1 pass, switch default package/launcher to Tauri and keep rollback channel.
3. Remove Electron runtime/dependencies in isolated commit; keep data compatibility readers.
4. Update docs/install/troubleshooting and migration copy.
5. Enable updater/telemetry/release only in a separate future approval when external capability exists.

## Tests After

- Fresh install, upgrade from Electron, rollback and data preservation pass across platform matrix.
- Local git/folder/WSL/SSH, Claude/Codex/Fable, profiles and Excalidraw pass packaged Tauri smoke.
- Binary/network/artifact scans show no Electron/upstream/mobile/CLI/tldraw residue beyond documented notices/migrations.

## Regression Gate

Full pnpm/cargo/Playwright/package/signing/notarization/glibc/SSH/WSL suite. Release promotion requires human review of parity report; missing signing/feed/Pages capability leaves release inert, not bypassed.

## Security, risks và rollback

- Risk: cutover hides platform-only regression or strands legacy data. Mitigation: signed canary, migration backup, staged channel and last Electron artifact.
- Security: verify capability ACL, sidecar signatures, SBOM/notices, no upstream endpoints, no plaintext secrets.
- Rollback: revert launcher/package commit and distribute last signed Electron baseline; never destructive-downgrade data.

## Success Criteria

- [ ] Tauri becomes default only with all P1 parity/security/release gates green.
- [ ] Electron removed only after successful cross-platform upgrade/rollback evidence.
- [ ] Telemetry/updater/release stay inert without fork-owned infrastructure.
- [ ] Final docs match lowercase `aio-ade`, Keepmeside/SalyyS1 and actual supported scope.
