---
phase: 7
title: "Dựng Rust control plane và PTY/SSH candidates có gate"
status: pending
priority: P1
effort: "1-2 tuần"
dependencies: [6]
---

# Phase 07: Dựng Rust control plane và PTY/SSH candidates có gate

## Overview

Xây Rust control plane cho process/app-data/filesystem policy và một PTY candidate fail-closed. Node sidecar vẫn production authority; Rust PTY/SSH không được cắt sang nếu chưa đạt byte/lifecycle/interoperability parity.

## Requirements

- Stage A: Rust control commands, supervisor state, app-data metadata/`rusqlite`, secure-store adapters; không own live PTY.
- Stage B: `portable-pty` candidate sau feature flag, raw bytes, separate reader/writer threads, resize coalescing, bounded queues, process-tree semantics.
- Stage C: `russh` feasibility/interoperability only; production SSH vẫn `ssh2` cho đến full matrix pass.
- Không Axum/REST, không git2, không dual authority, không UTF-8 re-encode PTY bytes.
- Preserve Fable raw path, hidden/reveal, snapshots, alternate screen, OSC, Kitty, paste, resize.

## Architecture và ownership

- Exclusive: Rust control-plane/PTY/SSH candidate modules and Rust-only tests under `src-tauri/src/runtime/**`.
- Read-only: frozen phase-06 contracts; Node sidecar phase-08 files.
- Conflict: candidates emit same protocol but cannot modify schema; phase 09 selects authority per session.

## Related Code Files

- Create: Rust process supervisor, DB worker, capability-safe fs/process primitives, `portable-pty` adapter/tests, optional `russh` probe tests.
- Do not delete: node-pty/ssh2/headless emulator or Electron runtime.
- Add notices/SBOM entries for crates after lockfile verification.

## Tests Before

- Port Electron oracle fixtures to runtime-neutral byte/snapshot harness.
- Define thresholds: zero loss/reorder, bounded RSS, deterministic replay, one exit event, stale-write rejection.
- Define SSH matrix: host key, key/password/agent/keyboard-interactive, PTY, SFTP, forwarding, ProxyJump/proxy, keepalive/rekey, reconnect, WSL.

## Refactor

1. Implement Stage A control plane + `rusqlite` worker; DB only app-data, never workspace/SSH/network FS.
2. Implement PTY candidate with bytes/seq/incarnation/backpressure/resize/lifecycle contracts.
3. Add Windows Job Object/process-tree evaluation, Unix process-group tests and WSL behavior.
4. Run russh probe against OpenSSH matrix; no production enablement from feature-list equivalence.

## Tests After

- 100 MB burst and invalid UTF-8 fixtures preserve byte hashes; no deadlock/drop/reorder.
- Reconnect/replay, exit/EOF/signal/transport errors and descendant cleanup match oracle.
- Rust SSH probe produces explicit compatibility report; failures keep `ssh2` authority.

## Regression Gate

`cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, stress/parity harness on Windows/macOS/Linux/WSL. PTY/SSH candidate flag remains off unless every P1 gate passes.

## Security, risks và rollback

- Risk: ConPTY deadlock/process-tree mismatch, WebKit variance, russh semantic gaps. Mitigation: separate threads, bounded queues, oracle and OpenSSH matrix.
- Security: narrow fs roots/commands; keyring failure explicit; no plaintext fallback or SSH local-secret forwarding.
- Rollback: disable/remove Rust candidate flag; Node sidecar remains sole authority.

## Success Criteria

- [ ] Rust control plane operates without owning production PTY/SSH.
- [ ] PTY candidate meets or clearly fails quantified parity gates; no ambiguous partial cutover.
- [ ] SSH candidate is evidence-only until full interoperability pass.
- [ ] Fable/Claude/Codex raw terminal behavior matches Electron oracle.
