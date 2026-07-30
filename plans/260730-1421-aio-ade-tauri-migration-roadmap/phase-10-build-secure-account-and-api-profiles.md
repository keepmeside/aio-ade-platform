---
phase: 10
title: "Xây Account và API Profile an toàn"
status: pending
priority: P1
effort: "2-3 tuần"
dependencies: [9]
---

# Phase 10: Xây Account và API Profile an toàn

## Overview

Tách Account OAuth/subscription và API Profile key/base URL/model, dùng main-owned resolver + encrypted vault. CCS chỉ là importer read-only; local secret không bao giờ forward ngầm sang SSH.

## Requirements

- `accounts`: isolated Claude/Codex OAuth state. `profiles`: provider-specific API settings và opaque `secretRef`.
- Resolution precedence: session > worktree > workspace/folder workspace > provider default > legacy account.
- Claude materialize managed `CLAUDE_CONFIG_DIR`; Codex managed `CODEX_HOME`/`config.toml` preserving comments/unknown sections/CRLF.
- safeStorage/OS keyring; encrypted fallback chỉ explicit consent, ACL/0600 harden ciphertext; no plaintext fallback.
- Vault adapter cannot claim parity until the Phase 06 safeStorage/keyring report proves identity, availability, reset and recovery behavior on each target OS.
- CCS importer read-only, one-way, version-pinned, dry-run, idempotent, canonical-path/symlink safe và redacted.
- SSH remote profile unsupported nếu chưa có remote vault/provisioning; fail visibly, no local secret crossing host boundary.

## Architecture và ownership

- Exclusive: account/profile schemas, migrations, vault, launch resolver, CCS importer, profile IPC/UI/tests.
- Không sửa Tauri bridge/runtime/canvas files; consume phase-09 typed command seam.
- Conflict: phase 11 không chỉnh settings/profile components; shared UI primitive remains read-only.

## Related Code Files

- Extend: Claude/Codex account services, launch resolver, live-PTY gate, usage/quota health.
- Create: versioned profile schema, secret vault adapters, CCS importer, settings/status switcher and focused tests.
- Distinguish: existing product/native-chat profile concepts; không reuse tên mơ hồ.

## Tests Before

- Protect existing OAuth account login/refresh/switch and live PTY bindings.
- Fixtures cho corrupt ciphertext, unavailable keyring, WSL env, Codex TOML, stale profile refs, concurrent writes.
- Security tests prove no secret in logs/state/events/diagnostics/export.

## Refactor

1. Define schemas/migrations/compatibility and opaque launch-spec contract.
2. Implement vault + atomic locked writes + corruption/recovery policy.
3. Implement provider-specific resolver/materialization and visible restart/defer boundary for live PTY, including Fable.
4. Add CRUD/health/binding UI with STYLEGUIDE/shadcn and cross-platform shortcut labels.
5. Add CCS dry-run/import/conflict flow; never execute CCS or write its files.
6. Keep quota routing/auto-recovery manual/visible; no mid-request rotation.

## Tests After

- Claude/Codex launch selected Account/Profile locally and WSL without mutating global auth files.
- SSH profile without remote vault fails visibly and sends no secret.
- Import repeat is idempotent; out-of-root/symlink/corrupt inputs rejected without partial write.

## Regression Gate

Focused auth/profile/vault/import/PTY tests, then full Node/Rust/Tauri type/test/lint/build gates and local/folder/WSL/SSH security matrix.

## Security, risks và rollback

- Risk: secret leak, live-session mutation, Codex config corruption, silent secure-store downgrade.
- Mitigation: opaque refs, redaction at source, live-PTY gate, atomic provider-specific materialization, fail closed.
- Rollback: retain legacy account readers and vault version; disable profile UI/feature flag without deleting encrypted data.

## Success Criteria

- [ ] Account/Profile contracts rõ, provider-specific và migration-safe.
- [ ] No secret appears in renderer state/log/telemetry/report; SSH no-forward enforced.
- [ ] CCS import read-only/dry-run/idempotent/redacted.
- [ ] Claude/Codex/Fable session provenance immutable after launch.
