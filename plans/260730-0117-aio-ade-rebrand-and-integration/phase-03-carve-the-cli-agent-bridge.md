---
phase: 3
title: "Xoá CLI và orchestration phụ thuộc"
status: pending
priority: P1
effort: "2-4d"
dependencies: [1, 2]
---

# Phase 03: Xoá CLI và orchestration phụ thuộc

## Overview

User đã duyệt full delete. Xoá CLI cùng mọi feature phụ thuộc trực tiếp để không để ghost command, timeout worker hoặc packaged shim mồ côi.

## Requirements

- Functional: xoá `src/cli/`, `src/main/runtime/orchestration/`, Agent Teams, headless `serve`, CLI IPC/installer/shims và mọi prompt/feature gọi CLI.
- Functional: giữ desktop Claude/Codex PTY sessions, SSH terminals, file editing và generic remote transport không phụ thuộc CLI orchestration.
- Non-functional: Windows/macOS/Linux packaging không còn orphan shim, PATH entry hoặc ghost command.

## Related Code Files

- Delete: toàn bộ `src/cli/`, `src/main/runtime/orchestration/`, Agent Teams UI/state, CLI installer/IPCs, native launcher, CLI-specific `resources/win32`, build/typecheck scripts và dependent tests/docs.
- Modify: `package.json`, `config/tsconfig.cli.json`, `.github/workflows/`, reliability/max-lines gates, Electron builder, SSH passthrough và prompt generators.
- Relocate before deletion: retained generic runtime contracts currently consumed by `tests/e2e/local-worktree-visibility-runtime-active.spec.ts` and `tests/e2e/terminal-tab-close-restart-persistence.spec.ts`; update `config/reliability-gates.jsonc` to point at the retained desktop/daemon runtime rather than `src/cli/`.
- Explicitly retain: `src/main/ipc/pty.ts`, `src/main/daemon/pty-subprocess.ts`, `src/main/daemon/headless-emulator.ts`, `@xterm/headless`, terminal snapshot/serialize, renderer `pty-transport*`, SSH PTY providers, ConPTY/query authority, and hidden/reveal recovery. “Headless serve” means the product server/CLI entrypoint, not the internal terminal emulator.

## Implementation Steps

1. Inventory reverse imports và commands từ CLI/orchestration/Agent Teams/headless `serve`; phân loại generic desktop/SSH consumers cần giữ.
2. Di chuyển các contract/runtime helper dùng bởi generic PTY/SSH tests ra module desktop/daemon-owned, rồi đổi reliability-gate references; chạy focused tests trước khi xoá nguồn CLI.
3. Xoá orchestration preamble và UI launch paths trước, rồi xoá CLI tree, installer, shims, redirects và packaging entries.
4. Xoá scripts/config/tests/docs/gates chỉ phục vụ CLI; cập nhật prompt text để không gọi command đã mất. Remove only CLI/Agent Teams shims from `pty.ts` and `tui-agent-config.ts`; preserve `src/main/codex-cli/command.ts`, Claude/Codex launch shell, auth env, startup-query authority and generic shell-ready paths.
5. Giữ legacy uninstall/data cleanup theo platform nhưng không cài binary alias mới; đặc biệt không shadow GNOME `orca` trên Linux.
6. Chạy typecheck, focused PTY/SSH tests, desktop build và packaged smoke; scan binary/artifact cho CLI references.

## Success Criteria

- [ ] Không có command prompt nào gọi `orca orchestration` sau khi phase hoàn tất.
- [ ] Orchestration UI/prompt/Agent Teams/headless `serve` bị xoá, không timeout âm thầm.
- [ ] `pnpm build:desktop` và packaged smoke không tham chiếu binary cũ.
- [ ] Không còn CLI build/typecheck/reliability gate hoặc installer/shim path.
- [ ] Generic PTY/SSH runtime tests vẫn chạy từ module retained, không import ngược `src/cli/`.
- [ ] Internal hidden/reveal and alternate-screen recovery still pass; no deletion is allowed solely because a file/module contains “headless”.
- [ ] xterm write/resize/replay/reattach, OSC 10/11, focus, Kitty keyboard, bracketed paste and ConPTY query tests remain green for Claude/Codex.
- [ ] PATH/uninstall migration tests cover Windows shims, macOS/Linux links, WSL và SSH host; Linux không shadow GNOME `orca`.

## Risk Assessment

Full delete bỏ orchestration automation và Agent Teams theo quyết định user. Rủi ro chính là xoá nhầm generic SSH/PTY runtime; reverse-import inventory và packaged smoke là gate bắt buộc.
