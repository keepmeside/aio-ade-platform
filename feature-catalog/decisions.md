# Decision log: Aio-IDE roadmap

## Decision matrix

`pending` chỉ là recommendation, không phải approval. Phases 01-07 không được cook cho tới khi các gate liên quan có `approvedBy` và `approvedAt`.

| Gate | State | Lựa chọn/khuyến nghị | approvedBy | approvedAt | Compatibility window | Rollback trigger |
|---|---|---|---|---|---|---|
| CLI agent bridge | **approved: xoá toàn bộ** | Xoá hết `src/cli/`. Người dùng chọn ngược khuyến nghị, nên Phase 03 phải xoá kèm orchestration CLI surface, Claude Agent Teams và e2e phụ thuộc, đồng thời xử lý `src/main/cli/` installer để không trỏ vào binary không tồn tại | User | 2026-08-03 | Không giữ legacy command | orchestration worker timeout hoặc packaged smoke fail sau khi xoá |
| Claude Agent Teams | **approved: xoá theo CLI** | Hệ quả trực tiếp của quyết định xoá CLI: Agent Teams đi qua CLI bridge nên phải xoá cùng | User (implied by CLI gate) | 2026-08-03 | N/A | phát hiện consumer còn sống sau khi xoá |
| Headless `serve` | pending | Quyết định độc lập; defer nếu không có product use case | — | — | N/A | kéo lại browser/updater surface không cần thiết |
| Canvas | pending | Excalidraw trước; XYFlow deferred; tldraw chỉ với negotiated downstream license | — | — | tldraw không có trong default build | license, offline, accessibility hoặc bundle gate fail |
| Secret store | required | Encrypted `safeStorage`; fail closed/explicit-consent encrypted fallback, ACL chỉ harden ciphertext | Maintainer security baseline | 2026-07-30 | Không plaintext migration | secret xuất hiện trong state/log/export hoặc corrupt recovery fail |
| Pages target | blocked-by-capability | Deploy sanitized static artifact từ private source repo bằng manual workflow; không đổi visibility. API trả `404`, credential chỉ có `WRITE`/không có `ADMIN`, dispatch bị chặn trước build bởi billing/payment/spending limit. Cần owner sửa billing + bật Pages hoặc duyệt public plan repo riêng | User request | 2026-07-30 | Chỉ `plan.html`, không private/internal URL | Pages capability fail hoặc artifact lộ repo/private link |
| Account model | required | `accounts` cho OAuth/subscription, `profiles` cho API/base URL; provider-specific runtime resolver | Maintainer architecture baseline | 2026-07-30 | Dual-read legacy account metadata trong migration window | OAuth regression hoặc provider config corruption |
| Telemetry/diagnostics | pending | Disabled mặc định cho tới khi có fork-owned endpoints, privacy policy và redaction tests | — | — | Không gửi upstream | traffic tới upstream hoặc secret/PII leak |
| Release/update channel | pending | Workflows inert; updater disabled cho tới khi signing/notarization và fork-owned channel được duyệt | — | — | Không auto-update từ upstream | tag/publish/mutate `main` hoặc tải artifact upstream |

## Quyết định vận hành (2026-08-03)

| Vấn đề | Quyết định | approvedBy | Ghi chú |
|---|---|---|---|
| 4 file scratch `.mf_*.ts` làm `pnpm lint` đỏ | Thêm `.mf_*.ts` vào `ignorePatterns` trong `.oxlintrc.json` | User, 2026-08-03 | Đã thực hiện và verify `oxlint` exit 0. Giữ nguyên file research của user |
| D: còn 22 GB sau prune | Đủ để tiếp tục, không dọn thêm | User, 2026-08-03 | Theo dõi lại trước `build:desktop` hoặc e2e; disk-full từng làm corrupt `node_modules` và mất `resources/build/` |

## Đã xác minh

- Working copy đã có remote `keepmeside/aio-ade-platform`; không cần clone đè.
- Account subsystem Claude/Codex đã tồn tại lớn, nên switcher là mở rộng seam chứ không xây từ số 0.
- `src/main/runtime/orchestration/preamble.ts` inject lệnh CLI vào terminal agent; xoá CLI mà không xoá orchestration sẽ làm worker timeout.
- `mobile/` có lockfile và roster riêng; `pnpm lint` đang truyền literal path `mobile` và reliability gates có path tới mobile/CLI.
- tldraw SDK hiện hỗ trợ React 18/19 và offline rendering, nhưng production cần trial/commercial/hobby key; hobby giữ watermark. Vì Aio-IDE muốn bản MIT không key và không watermark, vẫn không chọn tldraw mặc định.
- tldraw commercial/hobby key validate client-side và dùng offline; commercial/hobby không gửi dữ liệu, trial chỉ ping license-key hash theo docs. `offline.tldraw.com` là desktop-app prior art riêng; source license, document contract và agent bridge vẫn cần review trước reuse.
- CCS là MIT, có phân tách account/profile, global env, routing, quota, migration và doctor; không nên bê nguyên plaintext secret store hoặc web server.
- CCS `v8.8.1` tại commit `51e8716` lưu generic API settings plaintext. Codex không nhận generic API profile trực tiếp ngoài CLIProxy bridge, nên Aio-IDE chỉ lấy schema/policy ideas và phải giữ resolver riêng cho Codex.

## Nguyên tắc rollback

Mỗi phase một commit hoặc một chuỗi commit nhỏ có thể revert. Trước migration rebrand tạo backup marker và migration version. Không xoá legacy auth directories trước khi có test restore. Không public repo chính như một bước triển khai Pages.

## Nguồn pháp lý

- CCS MIT: https://github.com/kaitranntt/ccs
- tldraw license/terms cần review tại: https://github.com/tldraw/tldraw/blob/main/LICENSE
- Excalidraw: https://github.com/excalidraw/excalidraw
- XYFlow: https://github.com/xyflow/xyflow
- Code Review Graph MIT: report nội bộ trong `research/`

## Câu hỏi chưa giải quyết

- Tài khoản GitHub hiện tại có thể bật Pages cho private repo không? Nếu không, cần user chọn public plan repo riêng hoặc local-only.
- Có muốn giữ Agent Teams dưới dạng launch mode của Claude trong bản đầu không?
- Có giữ headless `serve` như product requirement độc lập không?
- Tên binary cuối cùng là `aio-ide` hay có alias `aio-ide-dev` cho developer?
- Có cần đồng bộ API profile với CLI bên ngoài hay chỉ dùng trong Aio-IDE?
- SSH secret provisioning thuộc 06A hay remote profile chưa hỗ trợ cho tới khi có remote vault?
- Có cần importer read-only từ CCS, hay chỉ dùng CCS làm nguồn ý tưởng?
- Telemetry/diagnostics sẽ disabled hoàn toàn hay chuyển sang endpoint fork-owned?
- Ai sở hữu release channel, signing và notarization credentials?
