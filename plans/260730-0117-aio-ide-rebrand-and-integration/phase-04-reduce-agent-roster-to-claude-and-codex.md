---
phase: 4
title: "Chỉ giữ Claude Code và Codex"
status: completed
priority: P1
effort: "2-3d"
dependencies: [2, 3]
---

# Phase 04: Chỉ giữ Claude Code và Codex

## Overview

Narrow `TuiAgent` từ roster 35 thành `claude | codex`, dùng compiler errors làm worklist, rồi xoá implementation/assets/tests/docs của agent không còn hỗ trợ. **`claude-agent-teams` được GIỮ** (quyết định user 2026-08-21) — nó là launch mode của Claude phụ thuộc CLI bridge, không phải binary riêng, và Option A phase 03 đã giữ bridge nên consumer còn sống.

**Quyết định 2026-08-21:** các agent khác không bị bỏ vĩnh viễn — chúng quay lại qua generic ACP slot ở phase 10. Phase này chỉ xoá per-agent native integration. Seam cho phase 10 là **tầng picker/catalog**: `acp` sẽ là agent-kind riêng, KHÔNG phải member mới của `TuiAgent` union (tiêu chí "compile-time chỉ claude|codex" giữ nguyên vĩnh viễn), và ACP config persist trong namespace riêng nằm ngoài mọi sanitizer roster-keyed của phase này — sanitizer coerce `gemini`/`droid`/`cursor` chỉ áp dụng cho TuiAgent fields, không đụng namespace ACP tương lai.

## Requirements

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

- [x] `TuiAgent` compile-time chỉ có `claude`, `claude-agent-teams` và `codex` (Agent Teams được giữ theo quyết định 2026-08-21 #5 — nó là launch mode của Claude, không phải binary riêng). Guard: `src/shared/native-roster-preflight.test.ts`.
- [x] Existing settings không crash/reset khi chứa id removed. Sanitizer `src/shared/tui-agent-settings-normalization.ts` wired ở cả disk load (`src/main/persistence.ts:3191`) và IPC update (`:5350`), cộng model map trong `src/shared/source-control-ai.ts`. Fixture `gemini`/`droid`/`opencode`/`cursor` phủ ở `src/main/persistence.test.ts:5306-5339`.
- [x] Agent picker, quick command, status bar, session scanner và locale đều chỉ hiện agent còn ship. `TUI_AGENT_CONFIG` + `TUI_AGENT_AUTO_PICK_ORDER` đúng 3 entry; `remote-session-scanner-sources.ts` còn claude/codex; StatusBar + `status-bar-provider-visibility` thu về `claude | codex`; 61 orphan locale key đã prune, parity 11.456 key × 5 locale.
- [x] Không xoá `AGENT_KIND_VALUES` historical telemetry nếu nó còn validate queued events. Đã xác minh không có queue trên disk (`research/baseline/phase-04-roster-narrowing-analysis.md`); `'other'` escape hatch giữ nguyên.

## Verification (local, Node 24.19.0 — 2026-08-27)

| Gate | Kết quả |
|---|---|
| `pnpm typecheck` | exit 0 — **chạy sau khi xoá `config/*.tsbuildinfo`**. Lần verify đầu báo xanh sai vì incremental state cũ; 29 lỗi thật nằm trong project `tc.web` |
| `pnpm lint` | exit 0 (9 sub-check, gồm reliability gates, max-lines ratchet, localization catalog + coverage) |
| `pnpm test` | 38.841 pass / 1 fail — `project-view-wrapper-source-context-boundary.test.ts` timeout 30s, đúng baseline phase 03, pass khi chạy riêng |

Quy mô: 485+ file, khoảng +2.700 / −55.700 so với `18fa088c1`. Locale prune tổng cộng 85 key (61 + 24 sau khi xoá UI chết), parity 11.432 key × 5 locale.

**Code review đã tìm 3 bug would-ship, đã sửa + có regression test:**

1. `pnpm typecheck` thực ra fail 29 lỗi / 7 file (status-bar usage module + web preload shim chưa theo narrowing). CI dùng fresh checkout nên sẽ đỏ; `build:release` không chạy typecheck nên còn ship code cũ im lặng.
2. `src/shared/source-control-ai.ts` — normalizer null hoá `agentId` top-level nhưng vẫn seed mỗi action recipe bằng id thô. Profile cũ có `agentId: 'gemini'` → mọi action giữ `gemini` → `resolveSourceControlAiForOperation` hard-fail "does not support" thay vì fallback Claude, và giá trị đó được persist lại. Guard: `source-control-ai-agent-roster.test.ts`.
3. `src/renderer/src/web/web-preload-api.ts` `mergeSettings` thiếu cả 2 sanitizer mới (`defaultTuiAgent`, `agentCmdOverrides`). Desktop đóng, web mở: blob `orca.web.settings.v1` chứa `defaultTuiAgent: 'gemini'` → composer lấy làm default → `TUI_AGENT_CONFIG[agent]` TypeError. Guard: `web-preload-api.test.ts`.

Cũng sửa 2 UI chết mà review chỉ ra: 6 toggle usage trong status-bar context menu (mutate persisted state, render không gì; `opencode-go` + `minimax` không bị CLI-gate nên hiện vĩnh viễn) và 2 section AccountsPane còn thu credential mồ côi (Gemini OAuth toggle, OpenCode Go session cookie — secret được encrypt mà không còn consumer).

**Defer sang phase 09** (dead code sau narrowing, không đổi hành vi): `titleIdentityGroup` không profile nào set nên `hasCompatibleAgentTitleIdentity` + 4 helper trong `orca-runtime.ts` unreachable; `'hermes-query'` trong `AgentPromptInjectionMode` với branch chết ở `tui-agent-startup.ts:63,126`; `AGENT_HOOK_INSTALL_PLUGINS_METHOD` export không caller; `OPENCLAUDE_HOOK_SETTINGS`; branch `providerSessionOnly` trong `agent-hooks/server.ts`; `native-chat` transcript decoder cho Grok; `resources/opencode.webp` (sprite pet, không phải agent integration); `src/main/pty/omp-sqlite-overlay.ts` + `overlay-mirror.ts` chỉ còn test của chính nó import; `preflightTrust?: 'cursor' | 'copilot'` không ai assign nên `markCursorWorkspaceTrusted`/`markCopilotFolderTrusted` unreachable; `GlobalSettings` field mồ côi vẫn thread qua persistence/telemetry/runtime (`opencodeSessionCookie` — còn encrypt, `geminiCliOAuthEnabled`, `minimaxGroupId`, `minimaxUsageModels`); README (root + 7 bản dịch, 48 lần nhắc agent đã bỏ) để phase 05 rewrite cùng brand.

**Nên gộp vào 09:** đưa membership check vào `isTuiAgentEnabled` (`src/shared/tui-agent-selection.ts:50`) để lần đổi roster sau chỉ có 1 gate thay vì 9 — hiện mỗi entry point tự guard bằng `isTuiAgent` riêng.

**Coverage mất thật** (hành vi đi cùng agent bị bỏ, ghi lại để không tưởng là bỏ sót): Pi title normalization; cơ chế delay/queue mobile-snapshot sau foreground probe; `draftPromptEnvVar` env clearing; win32 quoting cho source-control action plan; `needsNoMarkerWrapper` trong `local-pty-provider.test.ts`; reclaim launch identity từ native OpenCode title (#8478). Ngoài ra `isGeminiTerminalTitle('⠋ π - gemini')` giờ trả `true` vì guard Pi đã mất — không reachable từ agent còn ship.

## Risk Assessment

Rủi ro cao nhất là stale roster keys lọt qua persistence hoặc RPC rồi tạo UI/runtime state không hợp lệ. Mitigation: normalize sau `JSON.parse`, sanitize mọi map host-scoped, test backup/restore và giữ telemetry historical values.
