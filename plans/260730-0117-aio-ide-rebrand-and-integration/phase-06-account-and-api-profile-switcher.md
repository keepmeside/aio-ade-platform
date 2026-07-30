---
phase: 6
title: "Account và API profile switcher"
status: pending
priority: P1
effort: "5-6w"
dependencies: [4, 5]
---

# Phase 06: Account và API profile switcher

## Overview

Mở rộng subsystem Claude/Codex hiện có thành hai khái niệm rõ ràng: **Account** cho subscription/OAuth isolated runtime và **API Profile** cho api key, base URL, model, headers, proxy. Chia 06A cho manual secure switching và 06B cho routing/auto-recovery. Lấy schema/migration/doctor ideas từ CCS nhưng dùng secret handling an toàn hơn.

## Requirements

- Functional: Claude dùng managed `CLAUDE_CONFIG_DIR`; Codex dùng managed `CODEX_HOME`; per-session env snapshot xác định profile đã launch.
- Functional 06A: create/edit/duplicate/test/delete profile, bind provider default/workspace/folder workspace/worktree/session, quick switch, health test và immutable provenance không chứa secret.
- Functional 06B: routing pool, session affinity, quota cooldown, visible pending recovery và optional auto-rotation tại safe restart/resume boundary.
- Functional: API key/custom base URL cho Claude/Codex qua resolver riêng từng target. Claude dùng auth/base URL env hợp lệ; Codex materialize managed `CODEX_HOME`/`config.toml`/provider settings, không ép generic CCS settings vào Codex.
- Non-functional: secrets không nằm trong general settings JSON, logs, telemetry, breadcrumbs, diagnostics hoặc exported plan; ưu tiên encrypted `safeStorage`. Nếu secure OS storage unavailable thì fail closed hoặc yêu cầu explicit warning/consent cho encrypted fallback; không silently lưu plaintext chỉ dựa vào ACL/0600. Mọi write phải atomic và locked.

## Related Code Files

- Extend: `src/main/claude-accounts/`, `src/main/codex-accounts/`, `src/main/ipc/pty.ts`, `src/shared/agent-session-option-catalog-claude-codex.ts`, usage/rate-limit services.
- Add: `src/shared/agent-auth-profile-types.ts`, schema/migrations, dedicated main-owned IPC, secret vault dùng patterns từ `plugin-secrets-store.ts`/`secure-file.ts`, profile resolver, workspace binding state, redaction helpers, focused tests.
- Distinguish: existing `src/main/orca-profiles/`, `src/renderer/src/components/orca-profiles/`, `src/shared/orca-profiles.ts` and native chat agent profiles are different product concepts; migrate/rebrand them separately, không tái dùng tên `Profile` mơ hồ.
- UI: settings profile CRUD, status-bar switcher, test-connection flow, per-session provenance and recovery state.

## Implementation Steps

1. Read and lock existing service seams before coding; document env injection vs file mutation contract.
2. Define versioned schema: `accounts` and `profiles` separate, target compatibility, base URL normalization, model/header allowlist và provider-specific materialization contract.
3. Implement secret vault using Electron `safeStorage`; define fail-closed hoặc explicit-consent encrypted fallback khi OS storage unavailable. ACL/0600 chỉ harden file ciphertext, không phải permission cho plaintext. Store only opaque `secretRef` trong general state, reject symlinks, enforce app-owned roots.
4. Resolve precedence `session > worktree > workspace/folder workspace > provider default > legacy account`; strip inherited conflicting auth env. Persist provenance only, never secret-bearing snapshot.
5. Extend Claude env patch và Codex runtime-owned TOML/provider sections idempotently; preserve comments, unknown tables, trust và CRLF.
6. Add dedicated IPC and UI with existing shadcn primitives/STYLEGUIDE; profile edit/delete phải block hoặc defer khi còn live PTY tham chiếu qua `live-pty-gate`. Test health, focus, loading, error and offline states.
7. Define host boundaries: WSL propagation explicit; không forward local secret vào SSH. Remote profile unsupported cho tới khi có remote vault hoặc explicit provisioning decision.
8. 06B mới thêm quota routing/affinity/auto-recovery; no mid-request rotation, no CLIProxyAPI in core release.
9. Migrate legacy accounts/settings; test profile deletion/live-session references, concurrent writes, corrupt ciphertext, backup/restore, crash recovery, downgrade behavior, WSL propagation, diagnostics/export redaction và doctor redaction.

## Success Criteria

- [ ] Claude/Codex launch with selected account or API profile without mutating the user's global live auth files.
- [ ] API key never appears in rendered UI after save, logs, telemetry, crash reports or exported data.
- [ ] Existing OAuth account tests remain green; profile binding survives restart and worktree clone.
- [ ] Quota exhaustion can surface and optionally rotate according to explicit user policy, with a visible audit trail.
- [ ] Resolution precedence, WSL distro isolation, SSH no-secret-forward và Codex TOML preservation có focused tests.
- [ ] Không edit/delete profile đang được live PTY dùng; restart/defer flow hiển thị rõ và provenance của session cũ không đổi.

## Risk Assessment

This is security-sensitive and cross-platform. Never copy CCS plaintext secret storage, default management secrets hoặc generic Codex profile plumbing. Do not promise transparent resume if the CLI cannot resume safely; surface a restart boundary instead.
