---
phase: 11
title: "Runtime migration: Tauri v2 feasibility spike + go/no-go"
status: pending
priority: P2
effort: "spike 2-3w; migration chỉ sau GO"
dependencies: [5, 12]
---

<!-- dep 5 (rebrand) + 12 (post-flip CI matrix): spike cần CI 3 OS cho baseline và signing. Chạy ngay sau 12 để verdict runtime có trước khi phase 06 build vault quá sâu trên safeStorage. -->

# Phase 11: Runtime migration — Tauri v2 feasibility spike và go/no-go

## Overview

**User đã chọn hướng C: Rust + Tauri v2 + Node sidecar (2026-08-21).** Hướng A (Electrobun) và B1 (GPUI cho UI) bị loại khỏi scope. Phase này không còn là comparative spike mà là **feasibility spike một hướng có go/no-go**, cộng một fallback đã document.

Vì sao Tauri v2 được chọn (theo `research/tauri-v2-migration-feasibility.md`): `tauri` 2.11.5 (2026-07-01), 220 version, **26.7M downloads**, Apache-2.0 **OR MIT** (chọn MIT), Tauri Foundation đứng sau, repo 110k star push hằng ngày. Floor **macOS 10.15+ / Windows 7+** — rộng hơn cả Electron hiện tại; chỉ Linux lên **22.04** vì cần `webkit2gtk-4.1`. Plugin chính thức đầy đủ (updater, store, stronghold, shell, single-instance, notification, dialog, fs, sql, tray, menu) và packaging/signing hơn Electrobun rõ rệt. Quan trọng nhất: **guide chính thức "Node.js as a sidecar"** cho phép giữ main process TypeScript hiện tại và migration tăng dần thay vì big-bang.

Vì sao hai hướng kia bị loại: Electrobun là single maintainer với no-support policy, giữa 2.0 rewrite, thiếu safeStorage/Windows PTY/Windows signing, floor cao nhất. GPUI cho UI không có tiền lệ ship 2 UI toolkit trong 1 app, mất Monaco + xterm.js, crate stale 10 tháng, code editor/terminal của Zed là GPL.

**Fallback nếu Tauri NO-GO:** B2 — Rust sidecar cho compute-heavy workload, giữ nguyên Electron. 1-3 engineer-months, có precedent trong `native/` (5 sidecar Swift/C#/Python/PowerShell). Nếu B2 cũng không đáng làm: giữ Electron nguyên trạng.

## Gate 0 — đã chốt, còn một câu

Các câu gate 0 trước đây đã có câu trả lời:

| Câu | Trạng thái |
|---|---|
| Hướng nào | **C (Tauri v2 + Node sidecar)** — chốt 2026-08-21 |
| OS floor | **Chấp nhận Linux 22.04 / webkit2gtk-4.1.** macOS/Windows không thu hẹp (Tauri rộng hơn Electron hiện tại). Máy dev đã là Ubuntu 22.04.5, glibc 2.35, `libwebkit2gtk-4.1-dev` 2.50.4 đã cài → build được ngay; chưa có `cargo`, cần `rustup` |
| Metric động cơ | **Tất cả** (bundle, RAM, startup, render) — xem cảnh báo xung đột ở C6 |
| Signing ownership | **Chưa có cert** — ship unsigned, ký sau khi mua. C3 vì thế kiểm "đường signing document + tái lập được", không kiểm "đã ký" |
| **Còn lại** | Không còn câu nào chặn gate 0 |

Bối cảnh đo được, cần biết trước khi spike: renderer **4.940 file** React 19/Tailwind/shadcn/Monaco/xterm.js với **0 import `electron`** trực tiếp (đã decoupled — thuận lợi); main process **2.780 file**, trong đó **227 file dùng `electron` API** (đây là khối công việc không thể tránh).

## Requirements

- Functional: đo baseline hiện tại (bundle size, cold/warm startup, RSS idle và với 4 terminal, thời gian render một danh sách lớn) trên cả 3 OS, lưu thành số có thể so sánh. **User yêu cầu cải thiện tất cả bốn metric** nên baseline phải đủ cả bốn.
- Functional: dựng Tauri shell load renderer bundle hiện tại trong `wry`, chạy main process TypeScript hiện tại như **Node sidecar** theo guide chính thức; đo breakage renderer trên 3 engine; đánh giá secret layer (Stronghold vs `keyring` crate vs giữ trong sidecar); đếm và phân loại chính xác 227 file dùng `electron` API.
- Functional (fallback, chỉ chạy nếu Tauri NO-GO): một Rust sidecar thay một workload cụ thể (đề xuất: repo-wide search hoặc git status trên repo lớn), đo speedup so với baseline, theo pattern out-of-process đã có trong `native/`.
- Non-functional: spike nằm ở `tools/tauri-spike/` (và `tools/rust-sidecar-spike/` nếu chạy fallback); không đổi runtime chính thức; Electron là runtime release trong toàn bộ phase.
- Non-functional: `config/electron-builder.config.cjs` dùng `files:` **exclusion-only** và hiện KHÔNG exclude `tools/` — phải thêm exclusion cho spike dir, nếu không spike code bị pack vào `app.asar`.
- Non-functional: mọi verdict PASS/FAIL có evidence tái lập được, kèm version pin (`tauri` 2.11.x) và ngày đánh giá.

## Tiêu chí go/no-go

Tiêu chí chung:

| # | Tiêu chí | PASS khi |
|---|---|---|
| C1 | Terminal | Interactive shell + xterm.js hoạt động trên cả 3 OS, gồm SSH remote case. Đường dễ nhất: giữ `node-pty` + `IPtyProvider` trong Node sidecar. Terminal là feature cốt lõi, không có ngoại lệ |
| C2 | Secret storage | Write/read/delete an toàn trên cả 3 OS, fail-closed khi unavailable. Phải phủ **toàn bộ 10+ consumer `safeStorage` hiện tại** (`persistence.ts`, `index.ts`, `integration-credential-file.ts`, `plugins/plugin-secrets-store.ts`, `orca-profiles/profile-cloud-session-store.ts`, `jira/client.ts`, `linear/client.ts`, `speech/openai-api-key-store.ts`, `minimax/minimax-cookie-store.ts`, `startup/dev-instance-identity.ts`). `safeStorage` là API riêng của Electron nên **phải thay** — ba lựa chọn cần đánh giá: `tauri-plugin-stronghold` (vault riêng, không dùng OS keychain), `keyring` crate (dùng OS keychain, gần `safeStorage` nhất), hoặc giữ layer trong Node sidecar với một backend mới |
| C3 | Packaging + signing | Build được artifact hợp lệ trên cả 3 OS với đúng format (DMG, MSI/NSIS, deb/RPM/AppImage). **Signing: chưa có cert (quyết định 2026-08-21 — ship unsigned tới khi Keepmeside mua cert)**, nên C3 kiểm: (a) artifact build được và chạy được sau khi bypass Gatekeeper/SmartScreen, (b) **đường signing của Tauri được document đầy đủ và tái lập được** cho lúc có cert (docs Tauri có trang signing riêng cho macOS/Windows/Linux). Không dùng "đã ký thành công" làm điều kiện PASS vì điều đó hiện không khả thi |
| C4 | OS floor | Không thu hẹp floor đã chốt: Linux 22.04/webkit2gtk-4.1, macOS 10.15+, Windows 7+ |
| C5 | License | Tauri là Apache-2.0 **OR MIT** → chọn MIT, ghi NOTICE. Không nghĩa vụ copyleft |
| C6 | Cải thiện đo được | PASS khi **≥30%** cải thiện trên ít nhất một trong bốn metric, và không tệ hơn **>10%** ở các metric còn lại. **Cảnh báo đã ghi vào `decisions.md`:** Node sidecar bundled gần như chắc chắn làm bundle size **xấu hơn**, và 2 process có thể làm startup xấu hơn. Nếu bundle size xấu >10% thì cần quyết định user riêng, không auto-NO-GO — nhưng nếu **không metric nào** đạt ≥30% thì NO-GO |

Tiêu chí riêng Tauri v2:

| # | Tiêu chí | PASS khi |
|---|---|---|
| T1 | Renderer 3-engine | Renderer hiện tại (React 19 + Tailwind + shadcn + Monaco + xterm.js, 4.940 file) chạy trong WKWebView + WebView2 + WebKitGTK với breakage đếm được và fix được. **Đây là rủi ro số một** — không còn Chromium pinned |
| T2 | Node sidecar | Main process TypeScript chạy được như sidecar theo guide chính thức, giữ `node-pty` và `IPtyProvider` (local/ssh/daemon) hoạt động; IPC renderer ↔ sidecar ↔ Tauri core có đường đi rõ ràng và đo được latency |
| T3 | Electron API surface | Đếm và phân loại chính xác **227 file** dùng `electron` API: bao nhiêu có plugin Tauri tương đương (dialog, fs, shell, tray, menu, updater, notification, single-instance, global-shortcut, clipboard), bao nhiêu phải viết mới, bao nhiêu không có đường thay. Con số này là ước lượng chi phí thật |
| T4 | Plugin/panel security model | Plugin system iframe-sandboxed panel map được sang capability/permission model của Tauri mà không nới lỏng containment (hostile-panel test phải xanh) |

**Quy tắc quyết định:** FAIL bất kỳ C1-C6 hoặc T1-T4 → Tauri NO-GO. Khi đó fallback theo thứ tự: (1) Rust sidecar giữ Electron nếu có workload đáng tối ưu, (2) giữ Electron nguyên trạng. Ghi verdict + lý do vào `decisions.md`, hẹn đánh giá lại sau 2 quý.

## Architecture

Một spike tree, không import production code (trừ renderer bundle đã build):

```text
tools/tauri-spike/          -> Tauri shell + renderer bundle trong wry + Node sidecar + secret/signing probes
tools/rust-sidecar-spike/   -> chỉ dựng nếu Tauri NO-GO: sidecar workload benchmark
reports/                    -> baseline numbers + verdict matrix
```

Bridge CLI từ phase 03 đã giữ transport trung lập runtime, và vault phase 06 nằm sau storage-backend interface hẹp — nên một GO không buộc viết lại hai phần đó, chỉ thay backend.

Ghi chú kiến trúc cho fallback sidecar: repo đã có precedent out-of-process trong `native/` (5 sidecar: Swift, C#, Python, PowerShell) nhưng **không có Rust và không có N-API addon nào**. Sidecar binary là đường ít ma sát nhất; N-API thêm nghĩa vụ prebuild cross-platform mới.

## Related Code Files

- Create: `tools/tauri-spike/`, (fallback) `tools/rust-sidecar-spike/`, `plans/260730-0117-aio-ide-rebrand-and-integration/reports/runtime-spike-baseline.md`, `.../reports/runtime-spike-verdict.md`.
- Modify: `decisions.md` (verdict + evidence), `config/electron-builder.config.cjs` (exclusion cho spike dirs).
- Đọc để đo baseline: `config/electron-builder.config.cjs`, `docs/reference/linux-glibc-compatibility.md`, `src/main/providers/types.ts` (`IPtyProvider`), danh sách consumer `safeStorage`.
- Không modify: production `src/`, packaging targets, CI release.

## Implementation Steps

1. **Gate 0 đã đóng hết** (hướng C, floor 22.04, tất cả metric, signing deferred). Việc cần làm: cài `rustup` trên máy dev (chưa có `cargo`).
2. **Baseline:** đo bundle size, cold/warm startup, RSS idle và với 4 terminal, render một danh sách lớn — trên 3 OS qua CI matrix của phase 12. Lưu vào `reports/runtime-spike-baseline.md`. Đây là mẫu số của C6 và user yêu cầu cả bốn metric.
3. **T1 trước tiên (rủi ro số một):** pin `tauri` 2.11.x, dựng Tauri shell, load renderer bundle vào `wry` trên cả 3 OS, đếm và phân loại breakage. Nếu T1 FAIL nặng thì dừng — không tốn công T2-T4.
4. **T2 Node sidecar:** chạy main process TypeScript hiện tại như sidecar theo guide chính thức; giữ `node-pty` + `IPtyProvider`; đo latency IPC renderer ↔ sidecar ↔ Tauri core.
5. **T3 inventory:** phân loại 227 file dùng `electron` API thành có-plugin-tương-đương / phải-viết-mới / không-có-đường-thay. Đây là con số chi phí thật.
6. **C2 secret layer:** so sánh ba lựa chọn (Stronghold / `keyring` crate / giữ trong sidecar) trên cả 10+ consumer, không chỉ một probe.
7. **T4 + C3:** plugin/panel capability model với hostile-panel test; build artifact 3 OS đúng format và document đường signing của Tauri cho lúc có cert (chưa ký thật vì chưa có cert).
8. **License:** chọn MIT cho Tauri, ghi NOTICE.
9. **Verdict matrix:** mỗi tiêu chí một dòng PASS/FAIL kèm evidence và version pin. Trình user.
10. **Sau verdict:** GO → scaffold migration plan riêng (plan mới, nhiều tháng, không nhồi vào phase này). NO-GO → chạy fallback sidecar spike nếu có workload đáng tối ưu, hoặc ghi `decisions.md` giữ Electron và hẹn đánh giá lại sau 2 quý.

## Success Criteria

- [ ] Gate 0 đã đóng (ghi trong `decisions.md`); `rustup` đã cài trên máy dev.
- [ ] Baseline numbers tồn tại cho **cả bốn metric** trên 3 OS (qua CI phase 12) và được dùng làm mẫu số của C6.
- [ ] C1-C6 và T1-T4 đều có verdict PASS/FAIL với evidence tái lập được, kèm version pin `tauri` 2.11.x và ngày đánh giá.
- [ ] T3 có **con số thật**: 227 file dùng `electron` API được phân loại thành ba nhóm.
- [ ] C2 đánh giá đủ ba lựa chọn secret layer trên toàn bộ 10+ consumer, không chỉ một probe.
- [ ] NOTICE có Tauri (MIT) đầy đủ.
- [ ] Electron runtime, packaging và release không bị ảnh hưởng trong suốt phase.
- [ ] Spike code không lọt vào release artifact — verify bằng inspect `app.asar` sau `build:unpack`, không dựa vào giả định exclusion.
- [ ] `decisions.md` cập nhật verdict có approvedBy user; nếu GO, migration plan mới được scaffold riêng.

## Risk Assessment

Rủi ro lớn nhất là **chi phí chìm**: spike biến thành migration ngầm. Mitigation: timebox 3 tuần, spike tree tách biệt trong `tools/`, quyết định thuộc user, và thứ tự bước cố tình đặt tiêu chí dễ FAIL nhất (T1) lên trước mọi thứ khác.

Rủi ro thứ hai: **spike chứng minh sai thứ**. User yêu cầu cải thiện cả bốn metric, nhưng Tauri + Node sidecar gần như chắc chắn **không** cải thiện bundle size và có thể không cải thiện startup. Nếu không đo baseline trước thì cả GO lẫn NO-GO đều là cảm tính — vì thế bước 2 đứng trước mọi bước dựng app, và cảnh báo xung đột này đã ghi vào `decisions.md` để verdict không gây bất ngờ.

Rủi ro thứ ba: **kết quả hết hạn**. Tauri release ~2 tuần một bản minor. Mitigation: ghi version pin + ngày trong report; verdict quá 2 quý coi như hết hiệu lực.

Tín hiệu assumption vỡ và phản ứng đã định trước:
- **T1 FAIL nặng** (renderer không chạy nổi trên WebKitGTK hoặc WebView2) → dừng spike ngay, NO-GO, chuyển sang fallback sidecar. Không cố "fix dần" 4.940 file renderer trong một spike.
- **T3 cho ra con số lớn hơn dự kiến nhiều** (ví dụ >150 file không có plugin tương đương) → báo lại ước lượng mới trước khi tiếp tục, không tự nuốt chi phí.
- **C2 không có lựa chọn nào đạt được contract của `safeStorage`** (fail-closed, atomic, per-OS keychain) → NO-GO, vì đây là security-sensitive và phase 06 đã đặt baseline cao hơn.
- Tauri ra breaking change giữa spike → pin lại version đã đo, ghi vào report, không đuổi theo.

Rủi ro thứ tư: **keychain scope** — `safeStorage` có 10+ consumer và là API riêng của Electron, nên hướng này **buộc** phải thay layer đó. Một probe PASS không đại diện; C2 yêu cầu phủ hết danh sách.
