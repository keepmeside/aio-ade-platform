---
phase: 7
title: "Tích hợp tính năng chọn lọc từ upstream"
status: staged
priority: P2
effort: "staged"
dependencies: [5, 6]
---

# Phase 07: Tích hợp tính năng chọn lọc từ upstream

## Overview

Không transplant nguyên repo. Mỗi đề xuất phải có license, integration seam, owner, test và rollback. Chia thành tranches để Aio-IDE không biến thành một monolith sao chép nhiều sản phẩm.

## Tranche đề xuất

| Tranche | Tính năng | Nguồn ý tưởng | Cách đưa vào Aio-IDE | Ưu tiên |
|---|---|---|---|---|
| A | Claude hook event bus, permission approval, needs-you state | Maverick, nodeterm | Reimplement Node/Electron loopback hook server, typed event schema, pending approval UI; benchmark với OSC hiện tại | Must |
| A | Unread notification centre, pane ring, dock/tray status | cmux, termdeck/localterm | Reuse existing OSC parser, add global unread queue, jump-to-oldest, overlay icon, per-worktree metadata | Must |
| Dependency | Account/profile substrate | CCS | Không implement lại ở phase 07. Consume Phase 06A/06B health, provenance và quota events cho notification/canvas. | Planned |
| A | Review prompt presets, hunk-aware diff context, safe prepare-commit hook | opencommit | Port pure prompt/cleanup ideas; sandbox commitlint config; fail-safe commented output | Should |
| A | Code review context graph over MCP | code-review-graph | Optional subprocess MCP via uv/uvx; start with prompt presets, later SQLite/TypeScript diff panel; MIT NOTICE | Should |
| B1 | Offline spatial board, context handoff, plan-to-markdown export | tldraw, nodeterm | Excalidraw first, lazy `.excalidraw` editor/viewer in existing editor-tab path, workspace-host file persistence, PNG/SVG + structured outline export | Should |
| B2 | Live worktree/agent topology | tldraw, nodeterm | Defer `@xyflow/react` until usage proves topology needs; keep it a separate lazy tranche, not two canvas runtimes in MVP | Later |
| B | Port detection, session status glyphs, terminal grid presets | termdeck/localterm, cmux | Implement in existing terminal/worktree model; no web server copy | Nice |
| B | Rewind/checkpoints, automated checks/triage, cross-worktree semantic blast radius | Maverick, nodeterm, code-review-graph | Design after hook/status substrate; use Git restore + transcript fork only with explicit confirmation | Later |
| C | Managed web search fallback for Codex | CCS | Optional MCP/tool provisioning behind feature flag, DuckDuckGo default and key providers opt-in | Later |
| Skip | tldraw SDK without an approved production key/license | tldraw | SDK offline được, nhưng production cần trial/commercial/hobby key; hobby có watermark. Giữ research only cho bản MIT mặc định. | Skip |
| Skip | nodeterm BUSL code, cmux GPL code, maverick no LICENSE, nodeterm BUSL runtime | legal review | Behavioral inspiration only; không source-derived implementation trừ khi counsel duyệt independent clean-room process | Skip |
| Skip | CCS web dashboard, CLIProxyAPI, Docker, browser/image provisioning | CCS | Desktop app already owns UI and Claude/Codex OAuth; avoid daemon/secret expansion | Skip |

## Architecture

```text
Claude/Codex hooks + OSC
          |
          v
  typed event normalizer ----> unread/needs-you store ----> pane, tray, canvas
          |
          +----> permission approval reply channel
          +----> session snapshot + quota/health

worktree graph <----> Excalidraw/XYFlow board <----> context handoff prompt
          |
          +----> optional code-review-graph MCP context
```

## Implementation Steps

1. Create a feature matrix with license classification, provenance record và evidence links before each tranche. Restricted-source implementers chỉ dùng public docs/observable behavior, hoặc một independent isolated team nếu counsel duyệt.
2. Ship Tranche A status/notifications/profile doctor first; measure false positives and latency against OSC.
3. Add commit/review presets with bounded prompt bytes and no untrusted in-process config execution.
4. Add Excalidraw behind lazy feature flag via existing editor-tab path; persist through host-aware fs APIs with `connectionId` for local, folder workspace and SSH, use debounced conflict-safe writes, package network-off smoke, and export structured context plus PNG/SVG image.
5. Add keyboard-only flow, visible focus, screen-reader announcements, reduced-motion and external-file-conflict handling to the canvas spike.
6. Add optional XYFlow topology only after B1 usage validation; no two canvas runtimes in first slice.
7. Add optional MCP/semantic graph only when uv/SQLite availability is detected and graceful degradation is tested.
8. Re-evaluate later ideas after usage evidence; never bundle tldraw in default MIT builds. Revisit only with negotiated downstream terms, key provisioning, notices, privacy docs and counsel review; trial keys are prohibited for release builds.

## Success Criteria

- [ ] Each shipped feature has source attribution, license decision, tests and rollback flag.
- [ ] Agent event status is more informative than raw terminal scraping without regressing OSC fallback.
- [ ] Canvas can save/load offline, export PNG/SVG plus structured nodes, and send context to either Claude or Codex.
- [ ] Canvas works on local git worktree, local folder workspace and SSH host with zero runtime network requests; bundle/startup budget is measured.
- [ ] Keyboard-only, screen-reader labels/announcements, visible focus, reduced motion and external-file conflict recovery are tested.
- [ ] Optional dependencies missing does not block core Aio-IDE startup.
- [ ] Source-license/provenance review là blocking gate; restricted source không đi vào implementation path nếu chưa có counsel-approved isolation.

## Risk Assessment

License/key distribution, Excalidraw accessibility/offline-font setup and scope creep are the primary risks. Keep code provenance records, use MIT sources with NOTICE, implement restricted-source behavior independently, and gate canvas/hook changes behind measured feature flags.
