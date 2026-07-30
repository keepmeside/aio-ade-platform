---
phase: 4
title: "Chỉ giữ Claude Code và Codex; giữ Fable model-blind"
status: pending
priority: P1
effort: "3-4 ngày"
dependencies: [3]
---

# Phase 04: Chỉ giữ Claude Code và Codex; giữ Fable model-blind

## Overview

Thu `TuiAgent`/catalog/runtime mapping xuống `claude | codex`, xóa provider modules/assets/docs còn lại và migrate stale settings. Fable vẫn là Claude model `--model fable`, dùng cùng raw PTY/xterm path.

## Requirements

- Picker, quick launch, hooks, sessions, status, permissions và profiles chỉ enumerate Claude/Codex.
- Preserve Fable model catalog, unknown-model pass-through, session options và usage parsing riêng; không thêm Fable ANSI/filter/renderer adapter.
- Migrate `defaultTuiAgent`, disabled/args/env overrides, selected/discovered models, host-scoped maps, saved sessions/RPC payloads.
- Giữ historical telemetry enum để đọc queued events; UI/runtime union mới vẫn strict.

## Architecture và ownership

- Exclusive: shared agent union/config/catalog, provider-specific removed modules, agent assets/styles/locales/tests.
- Không sửa brand/plugin migration (phase 05), PTY implementation (06-09) hoặc account/profile storage (10).
- Conflict: compiler errors là worklist; no global rename trong agent phase.

## Related Code Files

- Modify: `src/shared/types.ts`, `src/shared/tui-agent-config.ts`, agent kind/session option catalogs, persistence normalization, renderer agent catalog.
- Delete: removed provider main/renderer modules, hooks/scanners/icons/tests/docs.
- Preserve: Claude/Codex launchers, `src/main/codex-cli/command.ts`, PTY transport, Fable model mapping.

## Tests Before

- Add stale-settings fixtures containing removed ids across every roster-keyed map.
- Protect `model: fable -> --model fable`, raw byte fixture, alternate screen, OSC, Kitty, paste, resize, hidden/reveal and snapshots.
- Protect historical telemetry parse and unknown agent fallback.

## Refactor

1. Narrow union first; use type errors to enumerate stale records.
2. Add coercing migration immediately after parse/IPC boundary; preserve unrelated fields.
3. Remove provider tables/modules/assets/locales and update focused tests.
4. Keep model/provider-neutral PTY transport and session provenance.

## Tests After

- Only Claude/Codex visible and launchable on local/folder/WSL/SSH.
- Removed ids normalize without boot crash or full settings reset.
- Fable byte/snapshot behavior matches Electron oracle exactly.

## Regression Gate

Focused persistence/agent/PTY/Fable tests, then `pnpm typecheck && pnpm test && pnpm lint && pnpm build:desktop` plus provider scans and platform launch smoke.

## Security, risks và rollback

- Risk: stale roster keys corrupt/reset settings; telemetry narrowing drops historical events. Mitigation: tolerant migration + wide historical schema.
- Security: delete unused provider auth/env hooks and assets; redact migration diagnostics.
- Rollback: restore roster commit and migration version; never downgrade persisted data without backup reader.

## Success Criteria

- [ ] Compile-time roster chỉ Claude/Codex; no removed provider resource/import.
- [ ] Fable remains same model-blind raw PTY/xterm path with full parity.
- [ ] Stale settings/RPC/session data normalize deterministically.
- [ ] Local git, folder workspace, WSL, SSH launches and Git 2.25-related flows remain intact.
