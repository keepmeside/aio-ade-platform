---
title: "Aio-IDE rebrand, strip and integration roadmap"
status: blocked
created: 2026-07-30
updated: 2026-08-18
authors: [Keepmeside, SalyyS1]
repository: keepmeside/aio-ade-platform
blockedBy: []
blocks: []
---

# Aio-IDE: roadmap rebrand, strip and integration

> **QUAN TRỌNG — đọc trước khi implement:** Phase 02/03/04 **đã được implement** trên branch
> `codex/aio-ade-implementation` (worktree `D:/Project/worktrees/.15_Ai0-IDE-codex-aio-ade-implementation`),
> không phải trên `main`. `main` chỉ chứa tài liệu phân tích và việc xoá RN mobile tree.
> Đọc [báo cáo trùng việc](reports/from-implementer-to-planner-duplicate-work-on-codex-branch.md)
> trước khi làm bất cứ phase nào, để không implement lần thứ ba.

> **Artifact chính:** [plan.html](plan.html). File này là mục lục để review và handoff, còn phase files giữ chi tiết thực thi.

## Mục tiêu

Chuyển fork Orca thành **Aio-IDE**, tác giả hiển thị là **Keepmeside** và **SalyyS1**. Sản phẩm cuối là desktop orchestrator chỉ hỗ trợ **Claude Code** và **Codex**, bỏ mobile companion, thu gọn hoặc xoá CLI theo quyết định được duyệt, thêm chuyển đổi account và API profile, rồi tuyển chọn các ý tưởng có giá trị từ CCS, tldraw và 7 nguồn đã nghiên cứu.

## Repo baseline đã xác minh

Số liệu đo lại 2026-08-03, chi tiết trong [baseline preflight inventory](research/baseline-260803-preflight-inventory.md).

| Hạng mục | Giá trị |
|---|---:|
| Remote | `https://github.com/keepmeside/aio-ade-platform.git` |
| Tổng file tracked | 11,084 |
| Token `orca` | 3,494 file, 43,441 lần xuất hiện |
| `mobile/` | 1,048 file |
| `src/cli/` | 146 file |
| Agent roster | **37** xuống 2 (`claude`, `codex`) — đếm trực tiếp union `TuiAgent` tại `src/shared/types.ts:2505` |
| Workflow CI | 24 |
| Reliability gates | 53 (4 gate thuộc mobile) |
| Gate baseline | `lint` + `typecheck` + `build:desktop` xanh (build từng vỡ do entry mồ côi, đã sửa); `vitest src/shared/` có 4 pre-existing failure do test hardcode locale/separator |
| Trạng thái Pages | Workflow manual đã push; Pages API `404`, token chỉ có `WRITE` không có `ADMIN`, Actions bị chặn bởi billing/payment/spending limit |

## Phase roadmap

| Phase | Trạng thái | Effort | Phụ thuộc |
|---|---|---:|---|
| [01 Preflight và gate baseline](phase-01-preflight-and-gate-baseline.md) | inventory+baseline done, decisions pending | 0.5 ngày | - |
| [02 Xoá mobile và web companion](phase-02-delete-mobile-and-web-companion.md) | RN tree đã xoá; 162 file mobile trong `src/` chờ quyết định | 1 đến 1.5 ngày | 01 |
| [03 Thu gọn CLI thành agent bridge hoặc xoá có điều kiện](phase-03-carve-the-cli-agent-bridge.md) | **DONE trên branch** (`150b481`) — xoá toàn bộ src/cli + orchestration | 1.5 đến 2.5 ngày | 01, 02 |
| [04 Chỉ giữ Claude và Codex](phase-04-reduce-agent-roster-to-claude-and-codex.md) | **PARTIAL trên branch** (tới `4ba06e8`) — shared xong (4 fail pre-existing), renderer/lib 113→31, main còn ~65 phần lớn pre-existing | 2 đến 3 ngày | 02, 03 |
| [05 Rebrand Orca thành Aio-IDE](phase-05-rebrand-orca-to-aio-ide.md) | token classification xong; chờ `appId` mới + migration layer | 3 đến 5 ngày | 04 |
| [06 Account và API profile switcher](phase-06-account-and-api-profile-switcher.md) | pending — **account switcher đã có sẵn** (codex-accounts + claude-accounts); chỉ còn API profile/vault | ước lượng 5-6 tuần cần xem lại | 04, 05 |
| [07 Tích hợp tính năng chọn lọc từ upstream](phase-07-upstream-feature-integrations.md) | staged | theo tranche | 05, 06 |
| [08 HTML review và GitHub Pages](phase-08-docs-html-plan-and-github-pages.md) | awaiting-user-choice | 0.5 đến 1 ngày | 01; GitHub billing/Pages capability |

## Gate cần người dùng duyệt

1. **CLI:** khuyến nghị giữ agent bridge tối thiểu để không làm hỏng orchestration qua process boundary. Nếu bắt buộc xoá toàn bộ `src/cli/`, phải xoá cả orchestration, Claude Agent Teams và các e2e phụ thuộc nó.
2. **tldraw:** không đưa SDK tldraw vào bản phân phối nếu chưa có production/downstream license phù hợp. Mặc định dùng Excalidraw MIT; `@xyflow/react` chỉ thêm ở tranche topology sau usage validation.
3. **Pages:** repo hiện private. Workflow manual đã được push, nhưng GitHub chặn run trước build vì billing/payment/spending limit; Pages API trả `404` và credential hiện tại chỉ có `WRITE`, không có `ADMIN`. Owner phải sửa billing + bật Pages, hoặc duyệt repo public riêng chỉ chứa static plan; không tự ý public repo chính.
4. **Scope integrations:** phase 07 chia must-have, next, later, skip để tránh biến plan thành danh sách copy vô hạn.
5. **Pasted text #1:** nội dung không có trong transcript, nên chưa thể trích tính năng từ phần đó.
6. **Release/telemetry:** giữ release workflow, updater, telemetry và diagnostics inert/disabled cho tới khi có fork-owned endpoints, signing, privacy policy và approval rõ ràng.

## Acceptance criteria cấp chương trình

- `pnpm lint`, `pnpm typecheck`, `pnpm test` xanh sau mỗi tranche; build desktop xanh trước release.
- Agent picker và persisted settings chỉ còn Claude/Codex, không reset profile cũ khi đọc lần đầu.
- Không còn `orca` trong user-visible strings, binary name, artifact name; alias legacy chỉ tồn tại trong migration/uninstall compatibility.
- Account OAuth hiện tại sống sót; API profile có secret isolation, redaction và binding theo workspace/session.
- Không copy code từ nguồn BUSL/GPL/không có LICENSE; mọi phần MIT được ghi NOTICE/attribution.
- HTML plan tự chứa, tiếng Việt, responsive, keyboard-accessible, không cần network assets.

## Tài liệu liên quan

- [Decision log](decisions.md)
- [Research digest](digest-audits.md)
- [Parallel validation synthesis](reports/parallel-validation-synthesis.md)
- [Full feature catalog: 176 rows](feature-catalog.md)
- [Research reports](research/)
- [Baseline preflight inventory](research/baseline-260803-preflight-inventory.md)
- [Phân loại token orca cho rebrand](research/rebrand-260803-orca-token-classification.md)
- [Aio-IDE HTML plan](plan.html)

## Handoff

Plan này chỉ tạo roadmap và artifact review. Sau khi duyệt gate, chạy `/ak:cook D:\Project\.15_Ai0-IDE\plans\260730-0117-aio-ide-rebrand-and-integration\plan.md` để bắt đầu implementation theo phase.

## Câu hỏi chưa giải quyết

- Chọn CLI bridge tối thiểu hay xoá toàn bộ CLI?
- Pages dùng repo public riêng hay private Pages theo gói GitHub hiện có?
- Có giấy phép thương mại tldraw hay dùng mặc định Excalidraw + XYFlow?
- Nội dung `[Pasted text #1 +5 lines]` là gì?
- SSH remote có được nhận secret từ vault local, hay remote profile phải có vault riêng?
- Cần importer một chiều từ CCS hay không cần interoperability?

## Validation Log

### Verification Results (2026-08-18, đo trên Linux clone `/home/stackops/devops-learning/aio-ade-platform`)

- Claims checked: 8
- Verified: 4 | Failed: 3 | Unverified: 1
- Tier: Full (8 phases)

| Claim trong plan | Kết quả đo | Bằng chứng |
|---|---|---|
| Phase 04 "PARTIAL trên branch (tới `4ba06e8`)" | **FAILED** — các commit `a69dac5`, `775cf96`, `e60c69d`, `9a2dc53`, `19a7d41`, `4ba06e8`, `41efdbe`, `4f27929` không tồn tại trong bất kỳ ref local/remote nào, không có trong clone nào khác trên host này | `git cat-file -t <sha>` → MISSING cho cả 8; `git log --all --grep="reduce agent roster"` → 0 hit |
| Remote `codex/aio-ade-implementation` chứa Phase 02/03/04 | **FAILED** — tip remote là `150b48126` = chỉ Phase 03. Phase 04 (roster reduction, ~500 file, −54,911 dòng) chưa bao giờ được push | `git rev-parse origin/codex/aio-ade-implementation` → `150b48126` |
| Worktree `D:/Project/worktrees/.15_Ai0-IDE-codex-aio-ade-implementation` | **FAILED** trên host này — path Windows; host Linux chỉ có 1 worktree. Toàn bộ Phase 04 đang kẹt trên máy Windows không truy cập được | `git worktree list` → chỉ `/home/stackops/devops-learning/aio-ade-platform` |
| `main` còn `src/cli/` 146 file | VERIFIED | `git ls-files src/cli/ \| wc -l` → 146 |
| `main` còn `mobile/` 1,048 file | VERIFIED | `git ls-files mobile/ \| wc -l` → 1,048 |
| Agent roster 37 tại `src/shared/types.ts:2505` | VERIFIED (35 member đếm được; union bắt đầu đúng dòng 2505; số 37 trong baseline có thể gồm alias) | `awk '/^export type TuiAgent =/,/^$/' src/shared/types.ts \| grep -c "\| '"` → 35 |
| Baseline 3,494 file / 43,441 token `orca` | VERIFIED (đo lại 3,475 / 42,838 — lệch ~0.5%, plan hơi cũ) | `git grep -l -i orca \| wc -l` → 3,475 |
| `de1e6d8` xoá RN trên `main` | **FAILED** — commit không tồn tại trên `main`; việc xoá RN chỉ có trên codex branch (`6ba27faf8`) | `git cat-file -t de1e6d8` → not a valid object |

Unverified: trạng thái 470 thay đổi chưa commit + stash `da62fd6` trong worktree Windows (không truy cập được từ host này).

### Kết luận validate

**Không đủ điều kiện implement.** Tiền đề trung tâm của plan — "Phase 02/03/04 đã implement trên branch, đừng làm lại" — chỉ đúng một nửa: Phase 02/03 có trên remote (`6ba27faf8`, `a44dfbcd1`, `150b48126`), nhưng **toàn bộ Phase 04 và các bản sửa build (`41efdbe`, `4f27929`) không tồn tại ở bất kỳ đâu mà pipeline này với tới được**. Implement từ plan này trên host hiện tại sẽ là implement lần ba cho Phase 04, đúng kịch bản báo cáo trùng việc cảnh báo, trừ khi có quyết định rõ ràng:

1. **Khôi phục:** push branch từ máy Windows (commits tới `4ba06e8` + build fixes) lên remote, rồi rebase pipeline lên đó. *(Khuyến nghị)*
2. **Làm lại từ `150b481`:** branch từ tip codex remote, redo Phase 04 theo chiến lược test 5 nhóm đã ghi trong báo cáo.
3. **Docs-only:** chỉ commit relocation + trạng thái đã hiệu chỉnh, hoãn implementation.

## Red Team Review

Ngày 2026-08-18. Một lượt review đối kháng duy nhất (không spawn subagent) áp 4 lens — Security Adversary, Assumption Destroyer, Failure Mode Analyst, Scope & Complexity Critic — vì các bằng chứng trùng nhau; mọi finding đều có bằng chứng repo kiểm chứng được.

| # | Severity | Finding | Evidence | Disposition |
|---|---|---|---|---|
| 1 | **Critical** | Work đã mất: Phase 04 (~500 file, −54,911 dòng) + 2 bản sửa build chỉ tồn tại trên disk Windows không truy cập được; không có trong ref local/remote nào | `git cat-file -t` MISSING × 8 SHA; `origin/codex/aio-ade-implementation` = `150b48126` | Accept — ghi blocker, chờ quyết định khôi phục |
| 2 | **Critical** | Trạng thái phase trong plan sai sự thật trên mọi ref pipeline với tới: "DONE/PARTIAL trên branch" không đúng cho Phase 04; nấu từ plan này sẽ xoá lại 120k+ dòng đã xoá một lần và tạo lịch sử merge không resolve được | `git log --oneline origin/codex/aio-ade-implementation` dừng ở Phase 03 | Accept — cập nhật trạng thái Phase 04 thành `lost-unpushed` khi có quyết định |
| 3 | High | Plan relocation chưa commit: 27 file bị xoá khỏi `plans/260730-...` (tracked deletion) + 31 file untracked trong `feature-catalog/`, 4 file đã sửa. Link nội bộ (`reports/...`, `research/...`) chỉ resolve ở bản untracked | `git status -s` tại `main` trước khi tạo branch | Accept — commit relocation trên branch `docs/aio-ide-plan-relocation` |
| 4 | High | Không có baseline build trên host này: `node_modules` rỗng, 53 reliability gate chưa từng chạy trên Linux host; mọi con số gate trong plan đo trên Windows | `ls node_modules/.bin \| wc -l` → 0 | Accept — chạy `pnpm install` + gate trước tranche code đầu tiên |

### Whole-Plan Consistency Sweep

Đã đọc lại `plan.md` + 8 `phase-*.md` sau khi append 2 log trên. Mâu thuẫn còn lại (chưa sửa vì cần quyết định user, không tự ý chữa):

- Bảng phase roadmap vẫn ghi Phase 03 "DONE trên branch", Phase 04 "PARTIAL trên branch (tới `4ba06e8`)" — chỉ đúng cho Phase 02/03; Validation Log ở trên là nguồn sự thật cho tới khi cập nhật.
- Blockquote đầu file trỏ worktree Windows `D:/Project/...` — không tồn tại trên host này.
- `phase-04-*.md` và báo cáo trùng việc mô tả commit/state không còn truy cập được.

**Sweep result: 3 mâu thuẫn chưa giải quyết → KHÔNG khuyến nghị `/ak:cook` cho tới khi user chọn hướng khôi phục/làm lại.**
