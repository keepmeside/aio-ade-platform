---
phase: 6
title: "Account và API profile switcher"
status: in-progress
priority: P1
effort: "5-6w"
dependencies: [4, 5, 12]
---

# Phase 06: Account và API profile switcher

## Overview

Mở rộng subsystem Claude/Codex hiện có thành hai khái niệm rõ ràng: **Account** cho subscription/OAuth isolated runtime và **API Profile** cho api key, base URL, model, headers, proxy. Chia 06A cho manual secure switching và 06B cho routing/auto-recovery.

**Milestone 06A (dependency target cho phase 10):** exit criteria = secret vault hoạt động (steps 1-3) + profile CRUD/manual switching + resolver precedence (steps 4-6). Phase 10 chỉ chờ 06A, không chờ 06B. Lấy schema/migration/doctor ideas từ CCS nhưng dùng secret handling an toàn hơn.

## Requirements

- Functional: Claude dùng managed `CLAUDE_CONFIG_DIR`; Codex dùng managed `CODEX_HOME`; per-session env snapshot xác định profile đã launch.
- Functional: **SSH secret provisioning là user setting per-host với hai option** (forward từ vault local, hoặc remote vault riêng) — xem step 7. Đây là scope thêm so với bản plan trước ("không forward"), nên effort của 06A tăng nhẹ.
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

1. Read and lock existing service seams before coding; document env injection vs file mutation contract. **Done 2026-10-01:** seam map 9 dimension trong `research/phase-06-service-seams.md` (internal, gitignored) + raw JSON; 3 mâu thuẫn (vault placement, locking scope, decrypt-failure policy) có proposed resolution chờ user veto.
2. Define versioned schema: `accounts` and `profiles` separate, target compatibility, base URL normalization, model/header allowlist và provider-specific materialization contract. **Đã chốt 2026-08-21: một schema `AgentAuthProfile` chung cho Claude và Codex** (cùng shape: id, provider, api key ref, base URL, model, headers, proxy); phần khác nhau nằm hoàn toàn ở runtime resolver per-provider, không fork schema theo provider. **Done 2026-10-01:** `src/shared/agent-auth-profile-types.ts` — strict secret-free schema (chỉ `vault:v1` refs, không có inline value field), `apiKeyKind` phân biệt `ANTHROPIC_API_KEY` vs `ANTHROPIC_AUTH_TOKEN`, base URL normalization (http/https, không userinfo/query, strip trailing slash), header allowlist, per-profile secret-ref self-containment; 26 test xanh, oxlint + `typecheck:node` sạch.
3. Implement secret vault using Electron `safeStorage` **sau một storage-backend interface hẹp** (encrypt/decrypt/availability) để verdict GO của phase 11 chỉ phải thay backend (keychain FFI) chứ không viết lại vault; define fail-closed hoặc explicit-consent encrypted fallback khi OS storage unavailable. ACL/0600 chỉ harden file ciphertext, không phải permission cho plaintext. Store only opaque `secretRef` trong general state, reject symlinks, enforce app-owned roots.
4. Resolve precedence `session > worktree > workspace/folder workspace > provider default > legacy account`; strip inherited conflicting auth env. Persist provenance only, never secret-bearing snapshot.
5. Extend Claude env patch và Codex runtime-owned TOML/provider sections idempotently; preserve comments, unknown tables, trust và CRLF.
6. Add dedicated IPC and UI with existing shadcn primitives/STYLEGUIDE; profile edit/delete phải block hoặc defer khi còn live PTY tham chiếu qua `live-pty-gate`. Test health, focus, loading, error and offline states.
7. Define host boundaries: WSL propagation explicit. **SSH secret provisioning: implement CẢ HAI cách làm option trong settings** (quyết định 2026-08-21) — (1) forward secret từ vault local qua SSH channel vào env của agent trên remote, (2) remote vault riêng cấu hình từng host. Mặc định là (2) hoặc "chưa cấu hình", **không bao giờ mặc định (1)**. Option (1) phải có cảnh báo rõ trong UI trước khi bật: secret vào env của process trên máy remote nên hiện trong `/proc/*/environ`, có thể vào log, và admin máy remote đọc được — không phù hợp máy dùng chung. Per-host setting, không phải global.
8. 06B mới thêm quota routing/affinity/auto-recovery; no mid-request rotation, no CLIProxyAPI in core release.
9. Migrate legacy accounts/settings; test profile deletion/live-session references, concurrent writes, corrupt ciphertext, backup/restore, crash recovery, downgrade behavior, WSL propagation, diagnostics/export redaction và doctor redaction.

## Success Criteria

- [ ] Claude/Codex launch with selected account or API profile without mutating the user's global live auth files.
- [ ] API key never appears in rendered UI after save, logs, telemetry, crash reports or exported data.
- [ ] Existing OAuth account tests remain green; profile binding survives restart and worktree clone.
- [ ] Quota exhaustion can surface and optionally rotate according to explicit user policy, with a visible audit trail.
- [ ] Resolution precedence, WSL distro isolation, Codex TOML preservation có focused tests.
- [ ] **SSH secret provisioning có cả hai option, per-host, mặc định KHÔNG phải forward.** Option forward có cảnh báo UI trước khi bật; có test cho cả hai đường và cho việc đổi option không làm mất profile binding.
- [ ] Không edit/delete profile đang được live PTY dùng; restart/defer flow hiển thị rõ và provenance của session cũ không đổi.

## Risk Assessment

This is security-sensitive and cross-platform. Never copy CCS plaintext secret storage, default management secrets hoặc generic Codex profile plumbing. Do not promise transparent resume if the CLI cannot resume safely; surface a restart boundary instead.
