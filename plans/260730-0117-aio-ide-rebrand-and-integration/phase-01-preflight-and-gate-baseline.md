---
phase: 1
title: "Preflight và gate baseline"
status: completed
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
- Non-functional: **CI không khả dụng cho phase 01-05.** Repo còn private và Actions bị billing-block; flip public nằm ở phase 08 (sau phase 05), CI matrix thật chạy ở phase 12. Mọi quality gate của phase 01-05 phải đạt bằng local run (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build:desktop`) và ghi output vào research. Các tiêu chí **bắt buộc nhiều OS** (packaged smoke 3 OS, PATH/uninstall trên Windows shims + macOS/Linux links + WSL + SSH, artifact naming, build metadata) không thể đạt local trên một máy — đánh dấu chúng là **deferred-verification**, lập danh sách theo dõi, và verify thật ở phase 12.
- Functional: chọn + pin secret-scan tool (gitleaks hoặc trufflehog) và chạy **dry-run scan trên toàn bộ history** ngay ở phase này — không cần đổi visibility, và biết sớm liệu history có secret không rotate được sẽ quyết định cả kế hoạch public ở phase 08. Repo hiện không có `.gitleaks.toml`, workflow scan, dependabot hay CodeQL.

## Related Code Files

- Read: `README.md`, `package.json`, `pnpm-workspace.yaml`, `.github/`, `config/reliability-gates.jsonc`, `config/max-lines-baseline.txt`.
- Create: `plans/.../decisions.md`, baseline report trong `research/baseline/`:
  `local-verification-baseline.md`, `inventory.md`, `secret-scan-triage.md`, `proposed.gitleaks.toml`,
  `deferred-verification.md`, `decisions-audit.md`,
  `coupling-mobile.md`, `coupling-cli.md`, `coupling-brand-token.md`, `coupling-accounts.md`.
- Modify later: không sửa source product trong phase này.

## Implementation Steps

1. Xác nhận branch, remote, visibility, Node/pnpm version và trạng thái dirty; giữ nguyên untracked research của người dùng.
2. Chạy inventory read-only: file counts, token counts, `git grep` cho `orca`, `mobile`, `src/cli`, `CLAUDE_CONFIG_DIR`, `CODEX_HOME`.
3. Đọc gate files và map mỗi path sẽ bị xoá tới package scripts, workflow, tests, bundler và packaging.
4. Chốt decision record: CLI A/B, tldraw license A/B, Pages target, profile model.
5. Thêm smoke fixtures cho settings migration và export redaction trước khi thay schema.

## Success Criteria

- [x] Baseline command output lưu trong research, có timestamp và không chứa secret. → `research/baseline/` (inventory, lint, typecheck, test summaries, build). Raw gitleaks report **cố ý** giữ ngoài repo; chỉ commit triage không có secret value.
- [x] Mỗi quyết định P1 có owner, trade-off và rollback. → `research/baseline/decisions-audit.md`: 25/27 row đủ 4 cột; 2 row rollback `N/A` là hợp lệ. Đã sửa **1 contradiction thật** (row Brand tokens nói giữ alias `orca-ide`, trái với row CLI alias legacy) và thêm row `Phase 12 serialization` còn thiếu.
- [x] Có test fixture cho persisted removed-agent ids và legacy Orca auth path. → `src/main/persistence-removed-agent-roster-preflight.test.ts` (6 test), `src/main/legacy-orca-data-path-preflight.test.ts` (9 test), `src/main/observability/export-redaction-preflight.test.ts` (12 test).
- [x] Không phase sau phụ thuộc vào giả định chưa ghi trong `decisions.md`. → traced 01→12 trong `decisions-audit.md`; gap duy nhất (phase 12 là CI gate đầu tiên) đã thành row chính thức.
- [x] Local verification baseline (lint/typecheck/test/build) chạy được và output đã lưu — đây là gate của phase 01-05 thay cho CI. → `research/baseline/local-verification-baseline.md`. lint **exit 0**, typecheck **exit 0**, build:desktop **exit 0**, test **2 failed / 39869 passed**.

### Kết quả quan trọng phát sinh

1. **Node pin sai host:** máy mặc định Node 25.9.0 nhưng `engines` pin **24**. Node 25 expose `localStorage` global một phần nên happy-dom không tự cài → **41 test renderer fail giả**. Chạy trên Node 24.19.0: 47 fail → 6 fail, không sửa source. **Mọi gate local của phase 01-05 phải chạy Node 24.**
2. **3 failure là lỗi test-harness thật, đã sửa** (commit riêng): git 2.34.1 dưới boundary `worktree list -z` (2.36); flake 50% do stat-identity trùng khi rewrite cùng số byte; fixture SSH thiếu `relay-watcher.js` + `node-pty/lib/utils` stub nên probe MISSING rồi chạy npm install thật.
3. **2 failure còn lại là load-only timeout** (pass isolation 19.6s và 10.4s, timeout 30s khi chạy full suite trên 1 máy không shard). CI shard 16 way → **defer sang phase 12**, không tick là xanh, cũng không coi là regression.
4. **Secret scan: 0 secret cần rotate** trên 17.537 commit. Trả lời gate phase 08 là **không cần nhánh contingency** theo evidence hiện tại.

## Risk Assessment

Rủi ro lớn nhất là xoá nhầm coupling ẩn trong reliability gates hoặc packaging. Mitigation: đọc gate files trước, dùng compiler/parity tests, giữ commit preflight riêng.
