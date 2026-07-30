---
phase: 3
title: "Xóa product CLI, Agent Teams và orchestration bridge"
status: pending
priority: P1
effort: "3-5 ngày"
dependencies: [2]
---

# Phase 03: Xóa product CLI, Agent Teams và orchestration bridge

## Overview

Xóa toàn bộ `src/cli/`, main CLI installer/service, Agent Teams, orchestration preamble/worker, headless `serve`, shims và dependent tests. Giữ generic PTY/xterm/headless emulator/SSH/file editing/remote runtime.

## Requirements

- Không còn command `orca/aio-ade orchestration`, `serve`, CLI install/uninstall UI hoặc PATH mutation mới.
- Giữ `src/main/ipc/pty.ts`, daemon PTY, `@xterm/headless`, snapshot/serialize, local/SSH providers, remote file operations.
- Relocate generic contracts khỏi CLI tree trước khi delete; external agents không được thay bằng Electron IPC giả định.
- Phase này trở thành root-manifest steward: cleanup mobile/CLI ở phase 03, sau đó tiếp nhận versioned dependency/script change requests từ phase 05, 08, 11 và 12 để tránh sửa cùng `package.json`/lockfile ở nhiều phase.

## Architecture và ownership

- Exclusive: `src/cli/**`, `src/main/cli/**`, `src/main/runtime/orchestration/**`, Agent Teams modules, CLI shims/installers, `package.json`, root lockfile/workspace, CLI tsconfig/build/reliability workflows.
- Preserve/read-only: agent roster files (phase 04), identity files (phase 05), PTY/SSH implementation.
- Conflict: any generic helper được move vào named desktop/runtime module trước delete; owner path sau move thuộc phase 03 và frozen cho later phases. Later phases gửi manifest patch/request, không tự sửa root manifests.

## Related Code Files

- Delete: CLI trees, native launchers, `resources/win32/bin/orca*`, Agent Teams UI/state, CLI e2e/docs/scripts.
- Modify: package scripts/builds, Electron builder, `.gitattributes`, reliability/max-lines/localization gates.
- Relocate: runtime clients/test fixtures còn dùng app-level parity, không giữ product CLI surface.

## Tests Before

- Write tests chứng minh orchestration prompts/Agent Teams/headless serve bị removed as a unit, không để ghost command.
- Protect generic PTY hidden/reveal, alternate screen, OSC, Kitty, paste, resize, WSL/SSH and file editing.
- Package-level test cho Windows shims, macOS/Linux symlinks và pre-single-instance redirect.

## Refactor

1. Move generic runtime contracts/tests ra khỏi CLI namespaces.
2. Xóa orchestration feature/preamble trước CLI binary; xóa Agent Teams roster entry/modes.
3. Xóa CLI source/service/installer/shims/headless serve và package/build hooks.
4. Cleanup mobile+CLI references trong root manifests, CI, reliability gates và lockfile.
5. Giữ legacy uninstall cleanup một release window nhưng không cài alias mới; không shadow GNOME `orca`.

## Tests After

- Scans không còn executable/product CLI command, worker prompt hoặc installer path.
- Generic PTY/SSH tests import từ retained runtime, không từ `src/cli`.
- Packaged Electron launch không redirect/exit do orphan shim.

## Regression Gate

Focused CLI-deletion/PTY/SSH tests, rồi `pnpm typecheck && pnpm test && pnpm lint && pnpm build:desktop`; packaged Windows smoke bắt buộc, macOS/Linux CI smoke khi runner có sẵn.

## Security, risks và rollback

- Risk: orphan PATH entry hoặc silent orchestration timeout. Mitigation: uninstall cleanup + prompt scan + packaged smoke.
- Security: remove exposed local server/CLI control surface; retain only authenticated/bounded internal runtime channels.
- Rollback: revert whole phase; không khôi phục một phần CLI mà thiếu orchestration/installer parity.

## Success Criteria

- [ ] `src/cli`, Agent Teams, orchestration bridge, headless serve và installers/shims không còn.
- [ ] Generic PTY/headless emulator/SSH/file/remote runtime xanh.
- [ ] Root build/lint/reliability gates không tham chiếu mobile/CLI đã xóa.
- [ ] Không ghost command, orphan artifact hoặc Linux name collision.
