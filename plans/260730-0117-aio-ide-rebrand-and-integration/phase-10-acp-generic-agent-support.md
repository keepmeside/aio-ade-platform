---
phase: 10
title: "ACP generic agent support"
status: pending
priority: P1
effort: "3-5 engineer-weeks (calendar phụ thuộc staffing)"
dependencies: [4, 6]
---

<!-- dependency 6 = milestone 06A (vault + manual switching) là đủ; không cần 06B routing/auto-recovery. Lý do: ACP env secrets cần vault (xem Requirements). -->

# Phase 10: ACP generic agent support

## Overview

Sau khi phase 04 thu roster native về `claude | codex`, phase này thêm một **generic ACP agent slot**: mọi agent khác (Gemini CLI, opencode, Copilot CLI, Cursor CLI, ~39 agent trong ACP registry) chạy qua Agent Client Protocol thay vì per-agent native integration. Adopt **ACP v1** qua `@agentclientprotocol/sdk` (Apache-2.0, Zed + JetBrains đồng maintain); v2 còn draft nên bọc protocol types sau một internal adapter layer. Chi tiết evidence: `research/acp-generic-agent-support.md`.

## Requirements

- Functional: user thêm được ACP agent bằng command/args/env/cwd (form thủ công) và optionally từ ACP registry picker (`registry.json`). **Env values mang credential (API key, token) phải route qua vault phase 06 dưới dạng `secretRef`** — không lưu plaintext trong settings JSON; config export/diagnostics có redaction test. Đây là lý do thực của dependency lên 06A (vault + manual switching), không phải toàn bộ phase 06. Lưu ý: `src/main/ai-vault/` KHÔNG phải secret vault (nó là session-transcript scanning) — precedent đúng để model theo là `src/main/plugins/plugin-secrets-store.ts`, `src/main/integration-credential-file.ts`, `src/main/speech/openai-api-key-store.ts`.
- Functional: registry picker treat `registry.json` là untrusted input — HTTPS bắt buộc, hiển thị full resolved command + pinned version và yêu cầu user confirm trước lần spawn đầu tiên; không auto-execute command từ CDN metadata.
- Functional: một ACP session đầy đủ vòng đời — initialize (protocolVersion 1 + capabilities), auth (authMethods, gồm terminal-auth relaunch vào PTY tab), `session/new` với `cwd` là workspace/worktree hiện tại, `session/prompt` streaming, `session/cancel`, `session/load` khi agent có capability.
- Functional: client-side handlers — `session/request_permission` (UI allow-once/always/reject), `fs/read_text_file` + `fs/write_text_file`, `terminal/*` bridge sang PTY layer hiện có, elicitation.
- Functional: chat-style pane cho ACP session — markdown message stream, tool-call cards, diff viewer (`oldText`/`newText`), plan display, permission dialog, input box. KHÔNG render ACP output qua PTY grid.
- Functional: MCP passthrough — forward MCP server configs của host vào `session/new`.
- Non-functional (đã chốt 2026-08-21): **ACP chỉ chạy trên local native host.** ACP agent spawn bằng absolute binary path trên Windows/macOS/Linux host native; **không** route qua WSL, và **không** hỗ trợ workspace non-local. **User xác nhận giới hạn này chấp nhận được lâu dài** — không mở tranche stdio-over-`wsl.exe`/SSH sau, trừ khi user đổi ý. Lý do: JetBrains precedent (ACP không support dưới WSL), PATH inheritance của GUI-launched app, npx `.cmd` shim quirks, và `fs/*` + `terminal/*` của ACP mặc định là local disk/local PTY — trên workspace remote chúng sẽ đọc/ghi sai máy.
- Non-functional: **predicate disable phải cụ thể và có test.** Disable ACP picker (kèm lý do hiển thị, không im lặng fail, không spawn rồi timeout) khi bất kỳ điều kiện sau đúng, dùng API đã có trong repo:
  - `ProjectExecutionRuntimeResolution.runtime.kind === 'wsl'` (`src/shared/project-execution-runtime.ts:53`);
  - resolution ở trạng thái repair-required (`ProjectExecutionRuntimeRepair`, cùng file) — `resolveLocalWindowsTerminalRuntimeOptions` throw ở trạng thái này;
  - `isWslUncPath(worktreePath)` (`src/shared/wsl-paths.ts:19`);
  - workspace backed by SSH/daemon/relay provider (cho tới khi SSH stdio spike ở step 8 PASS).
- Non-functional: **terminal bridge phải pin native host.** `IPtyProvider` hiện suy ra WSL từ shell name hoặc cwd (`src/main/ipc/pty.ts` quanh dòng 760 và 826), nên một project `windows-host` có default shell là WSL vẫn sẽ cho ACP tool-call một WSL shell — agent emit `C:\repo\file` mà terminal không thấy, và terminal-auth ghi credential vào WSL home trong khi agent host-side vẫn unauthenticated. Yêu cầu: ACP session force non-WSL shell override và `terminalWindowsWslDistro: null`, có test assert **không có `wsl.exe` spawn** từ ACP session.
- Non-functional: `fs/read_text_file`/`fs/write_text_file` route qua filesystem provider của workspace (repo đã có `ssh-filesystem-provider.ts`), không raw disk IO — để nếu sau này mở SSH thì không phải sửa lại contract.
- Non-functional: ACP types cô lập sau internal adapter layer (chuẩn bị v2 diff-format churn); Apache-2.0 NOTICE append vào third-party-notices do phase 05 tạo; ACP slot lỗi không ảnh hưởng native Claude/Codex.

## Architecture

```text
renderer chat pane (markdown + tool cards + diff + permission UI)
        | IPC
main: AcpSessionManager (state machine per instance)
        |
  AcpAgentProcess (spawn/supervise, ClientSideConnection từ @agentclientprotocol/sdk)
        |                        \
  agent subprocess (stdio)        client handlers: permission / fs / terminal(*bridge PTY) / elicitation
```

Native Claude/Codex giữ nguyên PTY path. ACP slot là surface song song, không thay thế. Terminal capability và terminal-auth tái dùng PTY/xterm infra — điểm mạnh sẵn có của app.

## Related Code Files

- Add: `src/main/acp/` (acp-agent-process.ts, acp-session-manager.ts, acp-client-handlers.ts, acp-registry-catalog.ts) — khớp convention module-per-agent sẵn có trong `src/main/` (`claude/`, `codex/`, `gemini/`, …); `src/shared/acp-agent-config.ts`; IPC channel mới.
- **Renderer — quyết định reuse-vs-fork bắt buộc trước khi code:** `src/renderer/src/components/native-chat/` đã có 158 file phủ gần hết surface cần: `NativeChatApprovalCard.tsx` (permission dialog), `NativeChatToolRun.tsx` (tool-call card), `NativeChatMessageList.tsx`, `NativeChatComposer*.tsx`, `NativeChatQuestionCard.tsx`/`NativeChatInteractiveCard.tsx` (elicitation analogue), `NativeChatDiffView.tsx` + `native-chat-diff.ts` (diff trong chat pane), `native-chat-incremental-assembler.ts`. Tạo `acp-session/` mới chỉ khi chứng minh được không generalize được native-chat; nếu reuse thì effort đổi đáng kể theo cả hai hướng.
- Markdown: đã có `react-markdown@^10` + remark/rehype plugins và `editor/MarkdownPreview.tsx` — không cần dependency mới.
- Modify: agent picker/catalog — **`acp` là agent-kind riêng ở tầng picker/catalog, KHÔNG phải member của `TuiAgent` union** (giữ nguyên tiêu chí phase 04 "compile-time chỉ claude|codex"); ACP config persist trong namespace riêng (`acpAgents`) nằm ngoài `isTuiAgent` (`src/shared/tui-agent-config.ts:310`) và zod guard `src/shared/workspace-session-schema.ts:87`. Các guard này **drop/undefine** id lạ (không rename), nên nếu ACP config lọt vào TuiAgent field thì agent user đặt tên `gemini` sẽ bị âm thầm biến mất hoặc làm parse fail — đó là lý do cần namespace tách. Settings UI, `package.json` (`@agentclientprotocol/sdk`), third-party notices.
- Reuse: **`IPtyProvider` tại `src/main/providers/types.ts:121`** (spawn/attach/write/resize/pause/resume) cho `terminal/*` và terminal-auth — implementations `local-pty-provider.ts`, `ssh-pty-provider.ts`, `daemon/daemon-pty-provider.ts`. Lưu ý `src/main/pty/` KHÔNG phải layer đó (chỉ env-shaping helpers). SSH đã có PTY provider + `ssh-filesystem-provider.ts` nên SSH spike không phải greenfield. shadcn primitives theo STYLEGUIDE.

## Implementation Steps

1. Đọc `research/acp-generic-agent-support.md`; pin `@agentclientprotocol/sdk` version; định nghĩa internal adapter types (không leak SDK types ra ngoài `src/main/acp/`).
2. AcpAgentProcess: spawn/supervise subprocess, stderr → logs, restart/exit handling. Precedent stdio JSON-RPC gần nhất là `src/main/codex/codex-app-server-client.ts` (+ `codex-app-server-session.ts`) — nhưng nó **short-lived per session**, còn ACP cần long-running supervision/restart, nên phần supervision là code mới, không copy pattern.
3. Client handlers: permission, fs read/write (disk IO), terminal bridge qua `IPtyProvider`, elicitation; capability flags khai đúng những gì implement.
4. Session manager + IPC: initialize/auth/new/load/prompt/cancel state machine; cancellation phải resolve pending permission requests là cancelled.
5. Renderer: **trước khi viết component, chốt reuse-vs-fork với `native-chat/`** (xem Related Code Files) và ghi quyết định + lý do. Sau đó: message stream, tool-call cards (gồm embedded terminal theo `terminalId`), diff blocks, plan, permission dialog, input; keyboard-accessible, reduced-motion theo STYLEGUIDE.
6. Config UI: add-ACP-agent form + registry picker (fetch `registry.json` khi online, cache; không bắt buộc network).
7. Auth flows: authMethods UI; terminal-auth relaunch vào PTY tab, reconnect sau exit 0.
8. SSH: **không trong scope** (quyết định 2026-08-21 — ACP local-native-only là lâu dài). Workspace SSH/daemon-backed nằm trong disable-predicate vĩnh viễn; **không để picker enabled rồi spawn local với `cwd` remote**, vì `fs/*` sẽ đọc/ghi sai máy. Ghi giới hạn vào user-facing docs.
9. Test: Gemini CLI `--acp`, `opencode acp`, một adapter chính thức; Windows path quirks (npx `.cmd` shim, absolute paths); disable-predicate cho cả 4 điều kiện; assert không `wsl.exe` spawn; focused tests cho state machine, permission flow, cancellation, sanitize khi agent crash mid-turn.

## Success Criteria

- [ ] Thêm Gemini CLI và opencode qua ACP slot, chạy full prompt round-trip với tool calls, diff render và permission prompt hoạt động.
- [ ] Cancellation giữa chừng không treo session và không để pending permission dialog mồ côi.
- [ ] Native Claude/Codex không thay đổi hành vi; app khởi động bình thường khi không có ACP agent nào cấu hình.
- [ ] ACP types chỉ xuất hiện trong `src/main/acp/`; phần còn lại dùng internal adapter types.
- [ ] Quyết định reuse-vs-fork với `native-chat/` được ghi rõ kèm lý do; không tồn tại hai implementation song song của cùng một card/dialog.
- [ ] Apache-2.0 LICENSE/NOTICE có trong third-party notices surface (surface này phải được tạo — repo hiện chưa có NOTICE artifact nào); `pnpm lint/typecheck/test` xanh.
- [ ] Windows: ACP agent spawn được bằng absolute path trên host native.
- [ ] Disable-predicate có test cho cả 4 điều kiện (WSL runtime kind, repair-required, WSL UNC path, SSH/daemon-backed workspace); mỗi trạng thái disabled hiển thị lý do, không im lặng fail.
- [ ] Có test assert **không có `wsl.exe` spawn** từ ACP session, kể cả khi project default shell là WSL.
- [ ] `fs/*` đi qua filesystem provider của workspace, không raw disk IO; có test cho trường hợp workspace non-local bị chặn đúng chỗ.
- [ ] Giới hạn "ACP local-native-only" được document trong user-facing docs.

## Risk Assessment

Rủi ro chính: v1→v2 churn (diff format, update semantics đổi) — mitigation: adapter layer, không leak SDK types; theo dõi v2 stabilization. Rủi ro hai: per-agent ACP quality không đồng đều (docs claim ≠ thực tế) — mitigation: test matrix 3 agent thật, treat registry metadata là hint không phải guarantee. Rủi ro ba: SSH story — stdio-over-SSH chưa được verify; tín hiệu vỡ: spike fail → ship local-only, không delay cả phase. Rủi ro bốn: **estimate risk lớn nhất là renderer scope** — reuse-vs-fork với `native-chat/` (158 file) có thể đẩy 3-5 engineer-weeks lệch cả hai chiều; quyết định này phải chốt trước khi commit lịch. Rủi ro năm: scope creep UI (chat pane phình thành editor) — giữ đúng surface trong Requirements, follow-along `locations` skip ở bản đầu.
