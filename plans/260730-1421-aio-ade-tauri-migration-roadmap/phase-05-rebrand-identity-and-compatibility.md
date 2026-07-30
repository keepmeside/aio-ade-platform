---
phase: 5
title: "Rebrand canonical aio-ade và giữ compatibility boundary"
status: pending
priority: P1
effort: "4-6 ngày"
dependencies: [4]
---

# Phase 05: Rebrand canonical aio-ade và giữ compatibility boundary

## Overview

Đổi display/package/binary/artifact thành lowercase `aio-ade`, authors Keepmeside và SalyyS1. Đọc legacy Orca identities trong migration boundary để không logout, mất workspace/plugin hoặc phá terminal protocol.

## Requirements

- User-visible copy, app/package/binary/artifact/protocol docs dùng `aio-ade`.
- Dual-read legacy userData, auth markers, Keychain service, plugin manifests/wire tokens/routes một compatibility window; canonical write chỉ sau backup marker/version.
- Preserve `TERM_PROGRAM=Orca` and other terminal wire tokens for the compatibility window; change only after a capability matrix and dual-read fixtures prove Claude/Codex/Fable terminal behavior unchanged.
- `TERM_PROGRAM=Orca` được phân loại là terminal compatibility token; chỉ đổi nếu matrix Claude/Fable/Codex chứng minh parity.
- Telemetry/updater/release remain inert; không đổi guard thành fork-active khi chưa có endpoint/signing/feed.

## Architecture và ownership

- Exclusive: product identity module, legacy readers/migrations, app icons/metadata, plugin manifest/wire compatibility, user-facing brand docs/locales.
- Package display name, binary identifiers and root metadata đi qua manifest request tới Phase 03 steward; phase 05 không sửa trực tiếp `package.json` hoặc lockfile.
- Không sửa agent roster, runtime bridge, profiles/canvas hoặc release activation.
- Conflict: no blind global replace; mỗi remaining `orca` token phải được classify.

## Related Code Files

- Modify: product identity chokepoints, Electron builder metadata, README/LICENSE/NOTICE, resources/locales, plugin contracts.
- Add: migration version/backup marker, legacy path/service readers, brand scan script/tests.
- Preserve: upstream copyright, Claude-owned service/file names, internal terminal tokens chưa qua parity.

## Tests Before

- Fixtures cho old userData/auth/Keychain markers, persisted workspace/routes, plugin manifests and panel wire messages.
- Baseline artifact/binary/protocol scan; terminal capability tests cho `TERM_PROGRAM`, OSC, focus, Kitty, paste, mouse, resize.

## Refactor

1. Centralize canonical/legacy identity mapping.
2. Implement backup + dual-read/adopt + canonical-write migrations; reject symlink/path escape.
3. Rebrand package/app/artifacts/resources/docs/locales; keep third-party notices.
4. Migrate plugin manifest/panel frame/wire names atomically with accept-both tests.
5. Delete upstream telemetry/site/update URLs or keep subsystem inert.

## Tests After

- Existing users load accounts/workspaces/plugins without silent logout/reset.
- New installs/artifacts show only `aio-ade`; remaining `orca` tokens are classified allowlist.
- Local/folder/WSL/SSH terminal behavior unchanged, including Fable.

## Regression Gate

Migration/plugin/terminal tests, `pnpm typecheck && pnpm test && pnpm lint && pnpm build:desktop`, packaged artifact scan on Windows/macOS/Linux.

## Security, risks và rollback

- Risk: mass rename silently loses Keychain/auth/plugin identity. Mitigation: dual-read before switch, backup marker, one-release cleanup window.
- Security: do not move arbitrary symlinks; migration roots canonicalized; no secrets in logs/backups.
- Rollback: old readers remain; Electron artifact can revert while preserving canonical data backup.

## Success Criteria

- [ ] Canonical display/package/binary/artifact là lowercase `aio-ade`; authors đúng.
- [ ] Legacy auth/workspace/plugin data loads và migrates idempotently.
- [ ] No upstream telemetry/feed/site traffic.
- [ ] Terminal compatibility token chỉ đổi khi parity matrix pass.
