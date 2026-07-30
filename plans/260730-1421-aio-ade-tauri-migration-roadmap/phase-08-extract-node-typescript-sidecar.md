---
phase: 8
title: "Extract Node TypeScript sidecar giữ nguyên PTY/SSH behavior"
status: pending
priority: P1
effort: "1-2 tuần"
dependencies: [6]
---

# Phase 08: Extract Node TypeScript sidecar giữ nguyên PTY/SSH behavior

## Overview

Tách daemon PTY/headless xterm/SSH/SFTP/remote runtime hiện có thành Node TypeScript sidecar production, giao tiếp stdio framed JSON-RPC. Không đổi behavior, không dùng Bun/ScriptC/SEA làm production path đầu.

## Requirements

- Sidecar owns node-pty, `@xterm/headless`, ssh2, reconnect/history/orphan/process lifecycle, WSL và remote file runtime.
- Protocol version/incarnation/seq/bounds theo frozen phase-06 contract; bytes không JSON-string encode.
- Supervisor detect crash/start/stop/restart; graceful shutdown không kill nhầm session/process tree.
- Bundle target-specific Node runtime/native modules, licenses/SBOM, signable artifacts; Linux glibc 2.31 floor.
- ScriptC/Bun deferred; Node SEA chỉ nghiên cứu sau native-addon spike.

## Architecture và ownership

- Exclusive: `src/sidecar/**`, sidecar launcher/build/package scripts, protocol implementation and sidecar tests.
- Root dependency/script/lockfile changes đi qua versioned manifest request tới Phase 03 steward; sidecar source and tests remain exclusively under phase 08.
- Frozen schema thuộc phase 06; Rust candidate thuộc phase 07; Tauri supervisor adapter thuộc phase 09.
- Conflict: if contract gap found, request phase-06 version bump before parallel branches merge.

## Related Code Files

- Move/extract: daemon PTY, headless emulator, SSH/SFTP/agent/forwarding/reconnect/history authority.
- Create: framed stdio transport, launcher, target packaging/signing manifest, sidecar health diagnostics.
- Preserve: Electron adapter temporarily calls same sidecar contract for oracle comparison.

## Tests Before

- Characterization tests around existing in-process/daemon interfaces and all PTY/SSH fixtures.
- Protocol fuzz tests: malformed length, oversize payload, invalid version, stale incarnation, partial frame, crash mid-frame.
- Native packaging baseline for node-pty/ssh2 on Windows/macOS/Linux/WSL.

## Refactor

1. Extract services behind injected transport without changing logic.
2. Implement stdio frame reader/writer with backpressure and bounded memory.
3. Add supervisor handshake, health, graceful drain, crash recovery and replay cursor.
4. Build target Node/native bundles; verify target-triple naming, signing hooks and notices.
5. Route Electron oracle through sidecar behind feature flag before Tauri integration.

## Tests After

- Sidecar and legacy path produce identical byte/snapshot/lifecycle/SSH outputs.
- Crash/restart/reconnect does not duplicate exit events or lose authoritative history.
- Packaged sidecar runs from paths with spaces and no global Node installation.

## Regression Gate

Focused sidecar/protocol/PTY/SSH tests, `pnpm typecheck && pnpm test && pnpm lint && pnpm build:desktop`; packaged smoke on Win/macOS/Linux, glibc verifier for Linux.

## Security, risks và rollback

- Risk: native addon/signing/path discovery and stdio deadlock. Mitigation: target builds, bounded queues, hidden launcher, crash tests.
- Security: validate frame sizes/kinds, no shell interpolation, strip/redact secrets from diagnostics, least-privilege child env.
- Rollback: feature flag routes Electron back to current daemon until phase 09; no Rust dependency.

## Success Criteria

- [ ] Node sidecar is production-ready and behavior-identical to Electron oracle.
- [ ] PTY/SSH/session authority is singular and restart-safe.
- [ ] Native modules package/sign on target matrix with license notices.
- [ ] No Bun, ScriptC, REST server or global Node prerequisite.
