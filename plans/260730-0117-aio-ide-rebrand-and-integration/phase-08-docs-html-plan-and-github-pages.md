---
phase: 8
title: "HTML review và GitHub Pages"
status: awaiting-user-choice
priority: P1
effort: "0.5-1d"
dependencies: [1]
---

# Phase 08: HTML review và GitHub Pages

## Overview

Đóng gói plan review ngay sau preflight thành HTML tiếng Việt tự chứa và triển khai Pages không làm lộ source private ngoài ý muốn. Docs sản phẩm được sync lại trong từng phase implementation, không chờ phase 06/07 mới publish roadmap.

## Requirements

- Functional: `plan.html` hiển thị overview, stats, dependency diagram, phase cards, detail modal, decisions, feature matrix, risks, open questions và source URLs.
- Functional: responsive 375px đến desktop, keyboard-accessible modal/filter, reduced-motion, không cần network assets.
- Non-functional: workflow Pages build từ file authoritative, không copy tay nội dung, không dùng docs path bị gitignore nếu chưa allowlist.

## Related Code Files

- Create: `plans/.../plan.html`, `.github/workflows/aio-ide-plan-pages.yml`.
- Modify: `docs/` only for approved user-visible architecture/rebrand decisions; `README.md` link plan after approval.
- Do not create: secrets, tokens, public copies of private source.

## Implementation Steps

1. Chạy red-team + whole-plan consistency sweep; chốt open questions rõ ràng.
2. Generate inline HTML/CSS/JS theo editorial plan contract; embed phase content hoặc data inline, SVG diagram CSS-only.
3. Lint/smoke HTML: parse, check links, verify no external assets, mobile viewport and reduced-motion CSS.
4. Add Pages Actions workflow manual-dispatch only, runs configure-pages, copies only safe self-contained HTML to `_site/index.html` và rejects private/internal GitHub URLs trước upload.
5. Check repository visibility/Pages capability. Nếu private repo không hỗ trợ, stop before publicizing and request choice of separate public repo or local-only.
6. Commit focused docs/workflow changes, push branch/main only after user-approved scope, then confirm Pages URL with `gh api` and HTTP check.

## Deployment Attempt

- 2026-07-30: plan/workflow pushed to `main` at commit `7eff045`.
- Pages create API returned `404` for the private repository.
- Manual workflow dispatch was blocked before any step ran because GitHub reported failed account payments or an insufficient spending limit.
- Next action requires user choice: repair billing/private Pages capability, or approve a separate public repo containing only the sanitized static artifact.

## Success Criteria

- [ ] Mở `plan.html` local không network vẫn đủ nội dung và tương tác.
- [ ] GitHub Pages URL trả HTTP 200 và artifact khớp commit đã push.
- [ ] Không tự ý public `keepmeside/aio-ade-platform`; nếu cần repo public riêng, có approval trước.
- [ ] Published HTML không link tới private/internal files không được copy vào artifact; source citations dùng public URL hoặc inline safe summary.

## Risk Assessment

Pages trên private repo phụ thuộc gói GitHub. Mitigation: deploy static plan only, prefer separate public site repo, never change visibility implicitly. Workflow dùng pinned major actions và không build app.
