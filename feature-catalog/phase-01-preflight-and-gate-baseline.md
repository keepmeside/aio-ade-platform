---
phase: 1
title: "Preflight và gate baseline"
status: partial-inventory-and-baseline-done
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
4. Chốt decision record: CLI A/B, tldraw license A/B, Pages target, profile model.
5. Thêm smoke fixtures cho settings migration và export redaction trước khi thay schema.

## Success Criteria

- [ ] Baseline command output lưu trong research, có timestamp và không chứa secret → [baseline preflight inventory](research/baseline-260803-preflight-inventory.md)
- [ ] Mỗi quyết định P1 có owner, trade-off và rollback → 6/8 gate vẫn `pending` trong `decisions.md`, cần user duyệt
- [ ] Có test fixture cho persisted removed-agent ids và legacy Orca auth path → **chặn bởi phát hiện: repo chưa có settings-migration layer nào**, phải tạo mới chứ không mở rộng
- [ ] Không phase sau phụ thuộc vào giả định chưa ghi trong `decisions.md`

## Kết quả thực thi (2026-08-03)

Đã hoàn thành phần read-only: inventory, coupling map, gate baseline. Xem
[baseline preflight inventory](research/baseline-260803-preflight-inventory.md).

Phát hiện làm đổi giả định của plan:

1. **Agent roster là 37, không phải 35.** Giữ `claude` + `codex` nghĩa là xoá 35 member.
2. **Repo chưa có settings-migration layer.** `git ls-files | grep -iE "settings.*migrat"` rỗng.
   Acceptance criterion "không reset profile cũ khi đọc lần đầu" cần layer mới, đây là scope
   chưa được tính trong effort của Phase 04/05.
3. **`src/main/cli/` khác `src/cli/`.** Xoá `src/cli/` vẫn để lại installer (`cli-installer.ts`,
   `wsl-cli-installer.ts`) trỏ vào binary không tồn tại. Phase 03 phải xử lý cả hai cây.
4. **`mobile/` không tự chứa.** 4 reliability gate, lint path literal, oxlint rule,
   ratchet entry, 5 workflow và setting `showMobileButton` đều phải sửa cùng lúc.
5. **`bin` name `orca` vừa là CLI coupling vừa là rebrand target** → Phase 03 và 05 giao nhau tại `package.json:8`.
6. **`appId` `com.stablyai.orca`** là migration-critical; đổi mà không migrate userData sẽ mất
   toàn bộ persisted state và OAuth account.

Chưa làm (cần user):

- Chốt 6 gate còn `pending` trong `decisions.md`.
- Tạo smoke fixtures cho settings migration + export redaction (bước 5) — phụ thuộc quyết định
  CLI/roster vì shape của persisted state thay đổi theo đó.

## Risk Assessment

Rủi ro lớn nhất là xoá nhầm coupling ẩn trong reliability gates hoặc packaging. Mitigation: đọc gate files trước, dùng compiler/parity tests, giữ commit preflight riêng.
