---
phase: 4
title: "Chỉ giữ Claude Code và Codex"
status: pending
priority: P1
effort: "2-3d"
dependencies: [2, 3]
---

# Phase 04: Chỉ giữ Claude Code và Codex

## Overview

Narrow `TuiAgent` từ roster 35 thành `claude | codex`, dùng compiler errors làm worklist, rồi xoá implementation/assets/tests/docs của agent không còn hỗ trợ. `claude-agent-teams` là launch mode cũ phụ thuộc CLI, không phải binary Claude Code.

## Requirements

- Preserve Claude model catalog entry `fable`, launch mapping `model: 'fable'` -> `--model fable`, unknown model pass-through and session-option persistence while narrowing only the agent roster to Claude/Codex.
- Keep PTY/xterm byte transport provider/model-blind; do not add a Fable-specific ANSI filter or renderer adapter. Fable usage-panel parsing remains a separate hidden `/usage` path.

- Functional: agent picker/config/status/session scanner/permissions/skills chỉ enumerate Claude và Codex.
- Functional: persisted roster-keyed fields được sanitize đầy đủ. `disabledTuiAgents`/default args/env đã có normalize một phần; cần bổ sung `defaultTuiAgent`, `agentCmdOverrides`, selected/discovered model maps, host-scoped maps và stale RPC payloads.
- Non-functional: telemetry historical enum không bị narrow làm mất queued events; locale parity và resource imports không stale.

## Related Code Files

- Modify: `src/shared/types.ts`, `tui-agent-config.ts`, agent-kind/selection/display/launch/permission tables, `src/main/persistence.ts`, `src/main/runtime/orca-runtime.ts`, renderer agent catalog/status, locales.
- Delete: per-agent `src/main/{antigravity,command-code,hermes,opencode,pi}/`, removed scanner/hooks/icons/tests/docs.
- Tests: high-density `pty-connection`, `agent-hooks/server`, runtime, IPC/pty, persistence, locale parity.

## Implementation Steps

1. Narrow union trước, chạy typecheck để compiler liệt kê stale Record entries.
2. Trim shared tables và delete exclusive modules; giữ fallback `unknown -> other/null` cho stale IPC/settings.
3. Thêm normalize/coercion ngay sau `JSON.parse` và tại IPC update boundaries; fixture chứa `gemini`, `droid`, `cursor` phải ra Claude/Codex hợp lệ mà không làm mất field không liên quan.
4. Xoá main/renderer/assets/i18n/test entries, cập nhật orchestration skill coverage.
5. Chạy focused tests rồi `pnpm typecheck`, `pnpm test`, `pnpm lint`; launch app xác nhận picker đúng 2 item.

## Success Criteria

- [ ] `TuiAgent` compile-time chỉ có `claude` và `codex`.
- [ ] Existing settings không crash/reset khi chứa id removed.
- [ ] Agent picker, quick command, status bar, session scanner và locale đều chỉ hiện 2 agent.
- [ ] Không xoá `AGENT_KIND_VALUES` historical telemetry nếu nó còn validate queued events.

## Risk Assessment

Rủi ro cao nhất là stale roster keys lọt qua persistence hoặc RPC rồi tạo UI/runtime state không hợp lệ. Mitigation: normalize sau `JSON.parse`, sanitize mọi map host-scoped, test backup/restore và giữ telemetry historical values.
