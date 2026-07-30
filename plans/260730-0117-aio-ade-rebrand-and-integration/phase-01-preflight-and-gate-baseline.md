---
phase: 1
title: "Preflight và gate baseline"
status: pending
priority: P1
effort: "0.5d"
dependencies: []
---

# Phase 01: Preflight và gate baseline

## Overview

Chốt các quyết định có thể làm đổi kiến trúc, ghi baseline kiểm chứng và dựng safety net trước khi xoá hoặc rename. Không sửa product behavior ngoài migration scaffolding.

## Requirements

- Functional: xác định keep-set cho CLI, agent và Pages; lập inventory mọi coupling của `mobile/`, `src/cli/`, `orca`, account paths.
- Non-functional: snapshot baseline, backup/restore path, không commit secret hoặc local credential.

## Related Code Files

- Read: `README.md`, `package.json`, `pnpm-workspace.yaml`, `.github/`, `config/reliability-gates.jsonc`, `config/max-lines-baseline.txt`.
- Create: `plans/.../decisions.md`, baseline report trong `research/` nếu số liệu đổi.
- Modify later: không sửa source product trong phase này.

## Implementation Steps

1. Xác nhận branch, remote, visibility, Node/pnpm version và trạng thái dirty; giữ nguyên untracked research của người dùng.
2. Chạy inventory read-only: file counts, token counts, `git grep` cho `orca`, `mobile`, `src/cli`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`.
3. Đọc gate files và map mỗi path sẽ bị xoá tới package scripts, workflow, tests, bundler và packaging.
4. Chốt decision record: full CLI delete, Excalidraw canvas, Pages capability, profile model, telemetry/release gates.
5. Thêm smoke fixtures cho settings migration và export redaction trước khi thay schema.

## Success Criteria

- [ ] Baseline command output lưu trong research, có timestamp và không chứa secret.
- [ ] Mỗi quyết định P1 có owner, trade-off và rollback.
- [ ] Có test fixture cho persisted removed-agent ids và legacy Orca auth path.
- [ ] Không phase sau phụ thuộc vào giả định chưa ghi trong `decisions.md`.

## Risk Assessment

Rủi ro lớn nhất là xoá nhầm coupling ẩn trong reliability gates hoặc packaging. Mitigation: đọc gate files trước, dùng compiler/parity tests, giữ commit preflight riêng.
