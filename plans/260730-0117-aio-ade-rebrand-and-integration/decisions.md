# Decision log: aio-ade roadmap

## Decision matrix

Các product gate dưới đây được user duyệt ngày 2026-07-30. Pages vẫn là external capability blocker, không phải product-scope gate.

| Gate | State | Lựa chọn/khuyến nghị | approvedBy | approvedAt | Compatibility window | Rollback trigger |
|---|---|---|---|---|---|---|
| Brand | approved | Canonical brand/package/binary là `aio-ade`; authors Keepmeside và SalyyS1 | User | 2026-07-30 | Dual-read legacy Orca data một release | migration làm mất auth/workspace hoặc artifact identity lệch |
| CLI | approved | Xoá toàn bộ CLI, orchestration bridge, Agent Teams, headless `serve`, installer/shims và dependent e2e | User | 2026-07-30 | Chỉ giữ legacy uninstall/data cleanup cần thiết | desktop build hoặc core Claude/Codex session regression |
| Canvas | approved | Excalidraw MIT; không thêm canvas runtime thứ hai. XYFlow deferred sang topology tranche | User | 2026-07-30 | `.excalidraw` file contract versioned | offline, SSH, accessibility hoặc bundle gate fail |
| Secret store | required | Encrypted `safeStorage`; fail closed/explicit-consent encrypted fallback, ACL chỉ harden ciphertext | Maintainer security baseline | 2026-07-30 | Không plaintext migration | secret xuất hiện trong state/log/export hoặc corrupt recovery fail |
| Pages target | blocked-by-capability | Deploy sanitized static artifact từ private source repo bằng manual workflow; không đổi visibility. API trả `404`, credential chỉ có `WRITE`/không có `ADMIN`, dispatch bị chặn trước build bởi billing/payment/spending limit. Cần owner sửa billing + bật Pages hoặc duyệt public plan repo riêng | User request | 2026-07-30 | Chỉ `plan.html`, không private/internal URL | Pages capability fail hoặc artifact lộ repo/private link |
| Account model | required | `accounts` cho OAuth/subscription, `profiles` cho API/base URL; provider-specific runtime resolver | Maintainer architecture baseline | 2026-07-30 | Dual-read legacy account metadata trong migration window | OAuth regression hoặc provider config corruption |
| SSH profile secrets | approved | Không forward local secret ngầm; remote vault/provisioning là tranche riêng | User | 2026-07-30 | Existing OAuth SSH behavior preserved | secret vượt host boundary hoặc remote launch silently breaks |
| CCS importer | approved | Read-only one-way importer; CCS không là runtime dependency | User | 2026-07-30 | Import format pinned/versioned | secret leak hoặc native Codex config bị ghi sai |
| Telemetry/diagnostics | approved | Disabled mặc định cho tới khi có fork-owned endpoints, privacy policy và redaction tests | User | 2026-07-30 | Không gửi upstream | traffic tới upstream hoặc secret/PII leak |
| Release/update channel | approved | Workflows inert; updater disabled cho tới khi signing/notarization và fork-owned channel được duyệt | User | 2026-07-30 | Không auto-update từ upstream | tag/publish/mutate `main` hoặc tải artifact upstream |

## Đã xác minh

- Working copy đã có remote `keepmeside/aio-ade-platform`; không cần clone đè.
- Account subsystem Claude/Codex đã tồn tại lớn, nên switcher là mở rộng seam chứ không xây từ số 0.
- `src/main/runtime/orchestration/preamble.ts` inject lệnh CLI vào terminal agent; xoá CLI mà không xoá orchestration sẽ làm worker timeout.
- `mobile/` có lockfile và roster riêng; `pnpm lint` đang truyền literal path `mobile` và reliability gates có path tới mobile/CLI.
- tldraw SDK hiện hỗ trợ React 18/19 và offline rendering, nhưng production cần trial/commercial/hobby key; hobby giữ watermark. Vì aio-ade muốn bản MIT không key và không watermark, vẫn không chọn tldraw mặc định.
- tldraw commercial/hobby key validate client-side và dùng offline; commercial/hobby không gửi dữ liệu, trial chỉ ping license-key hash theo docs. `offline.tldraw.com` là desktop-app prior art riêng; source license, document contract và agent bridge vẫn cần review trước reuse.
- CCS là MIT, có phân tách account/profile, global env, routing, quota, migration và doctor; không nên bê nguyên plaintext secret store hoặc web server.
- CCS `v8.8.1` tại commit `51e8716` lưu generic API settings plaintext. Codex không nhận generic API profile trực tiếp ngoài CLIProxy bridge, nên aio-ade chỉ lấy schema/policy ideas và phải giữ resolver riêng cho Codex.

## Nguyên tắc rollback

Mỗi phase một commit hoặc một chuỗi commit nhỏ có thể revert. Trước migration rebrand tạo backup marker và migration version. Không xoá legacy auth directories trước khi có test restore. Không public repo chính như một bước triển khai Pages.

## Nguồn pháp lý

- CCS MIT: https://github.com/kaitranntt/ccs
- tldraw license/terms cần review tại: https://github.com/tldraw/tldraw/blob/main/LICENSE
- Excalidraw: https://github.com/excalidraw/excalidraw
- XYFlow: https://github.com/xyflow/xyflow
- Code Review Graph MIT: report nội bộ trong `research/`

## Câu hỏi chưa giải quyết

- Pages: owner sửa billing/bật private Pages hay duyệt public static-only repo?
- `[Pasted text #1 +5 lines]` chưa có nội dung để inventory.
