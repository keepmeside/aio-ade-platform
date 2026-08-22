# Tauri v2 — Research (2026-08-21)

Scope: đánh giá **Rust + Tauri v2** làm hướng thay Electron cho app này, so sánh với Electrobun và Rust+GPUI. Verified từ crates.io API, GitHub API và docs chính thức `v2.tauri.app` (trang Prerequisites cập nhật 2026-08-20).

## 1. Trạng thái (verified)

| Hạng mục | Giá trị | Nguồn |
|---|---|---|
| Crate | `tauri` **2.11.5**, published **2026-07-01** | crates.io API |
| Số version | **220** | crates.io API |
| Downloads | **26.7M** tổng, 10.1M recent | crates.io API |
| License | **Apache-2.0 OR MIT** (dual → chọn MIT được) | crates.io API |
| MSRV | Rust 1.77.2 | crates.io API |
| Repo | `tauri-apps/tauri`, **110k stars**, Apache-2.0, push 2026-08-21 | GitHub API |
| Open issues | 1.436 | GitHub API |
| Governance | Tauri Foundation / Tauri Contributors, có GOVERNANCE + trademark guidelines | tauri.app |

So sánh độ chín (cùng thời điểm đo):

| | Tauri v2 | Electrobun | gpui |
|---|---:|---:|---:|
| Latest | 2.11.5 (2026-07-01) | 1.18.1 stable / 2.0 beta hàng ngày | 0.2.2 (2025-10-22, **stale 10 tháng**) |
| Downloads | 26.7M | — | 220k |
| Versions | 220 | ~30 | 7 |
| Maintainers | Foundation + community | **1 (no-support policy)** | Zed team (publish là phụ) |
| License | Apache-2.0 OR MIT | MIT | Apache-2.0 |

Tauri v2 chín hơn hai hướng kia **một bậc độ lớn** về mọi chỉ số đo được.

## 2. OS floor — điểm khác biệt lớn nhất so với Electrobun

Từ trang Prerequisites chính thức (cập nhật 2026-08-20):

| OS | Tauri v2 yêu cầu | Electrobun yêu cầu | Floor hiện tại của app |
|---|---|---|---|
| macOS | **Catalina 10.15+** | macOS 14+ | do Electron 43 (chưa declare) |
| Windows | **Windows 7+** (WebView2 có sẵn từ Win10 1803) | Win11+ | do Electron 43 (chưa declare) |
| Linux (Debian/Ubuntu) | `libwebkit2gtk-4.1-dev` | Ubuntu 24.04+ | Ubuntu 20.04 / glibc 2.31 |

**Xung đột duy nhất là Linux:** `webkit2gtk-4.1` không có trên Ubuntu 20.04 (20.04 chỉ có 4.0); 4.1 xuất hiện từ Ubuntu 22.04. Vậy Tauri v2 đẩy floor Linux lên **22.04**, nhẹ hơn nhiều so với 24.04 của Electrobun nhưng vẫn phá floor 20.04 hiện tại. macOS và Windows thì Tauri **rộng hơn cả Electron hiện tại**.

## 3. API parity — plugin chính thức có sẵn

Từ mục Plugins của docs: autostart, CLI, clipboard, deep-linking, dialog, file-system, global-shortcut, HTTP client, localhost, logging, notifications, opener, OS info, persisted-scope, positioner, process, shell, **single-instance**, SQL, **store**, **stronghold**, **updater**, upload, websocket, window-state. Cộng guide riêng cho **System Tray** và **Window Menu**.

Đối chiếu nhu cầu của app:

| Cần | Tauri v2 | Ghi chú |
|---|---|---|
| IPC | `invoke` + events (Rust ↔ frontend) | Có, kèm permission/capability model chặt hơn Electron |
| Multi-window | Có | |
| Tray, menu, dialog | Có (plugin + guide) | Electrobun thiếu menu trên Linux |
| Auto-update | `tauri-plugin-updater` 2.10.1 | Chín; Electrobun có delta tốt hơn nhưng ít chín hơn |
| Notifications | `tauri-plugin-notification` | Electrobun **không có** |
| Single instance | `tauri-plugin-single-instance` | Quan trọng cho app này |
| **Secret storage** | `tauri-plugin-stronghold` 2.3.1 (IOTA Stronghold, encrypted vault) | **Không phải wrapper OS keychain** — khác `safeStorage`. `tauri-plugin-store` **không encrypt**. Cần đánh giá riêng: Stronghold hoặc `keyring` crate |
| Preload/contextIsolation | Không có preload; thay bằng capability/permission + isolation pattern | Model khác, phải thiết kế lại boundary |
| Packaging | DMG, MSI + NSIS, deb, RPM, AppImage, Snapcraft, Flathub, App Store, MS Store | **Tốt hơn Electrobun rõ rệt**; có docs signing riêng cho macOS/Windows/Linux/iOS/Android |

## 4. Seam hybrid quan trọng nhất: Node.js as a sidecar

Docs có guide chính thức **"Node.js as a sidecar"** (`/learn/sidecar-nodejs/`) và **"Embedding External Binaries"** (`/develop/sidecar/`).

Đây chính là cách đọc khả thi nhất của yêu cầu "phần không thể thay được thì giữ": main process TypeScript hiện tại (**2.780 file**, 227 file import `electron`) chạy như **Node sidecar** dưới Tauri, thay vì phải viết lại sang Rust ngay. Renderer (4.940 file, **0 import `electron`** — đã decoupled) load trong webview của Tauri.

Nghĩa là lộ trình có thể chia pha:
1. Tauri shell + Node sidecar giữ nguyên logic main → thay `electron` API surface (227 file) bằng Tauri plugin/IPC equivalents.
2. Dần chuyển từng phần logic từ Node sidecar sang Rust nếu có lợi đo được.

Đây là hướng duy nhất trong ba hướng non-Electron cho phép **migration tăng dần** thay vì big-bang. Cái giá: một process Node bundled (mất một phần lợi thế size), và vẫn phải thay 227 file dùng `electron` API.

## 5. Terminal — feature cốt lõi

- `portable-pty` (wezterm) **0.9.0**, 12.1M downloads — crate PTY chín nhất trong Rust, cross-platform gồm Windows ConPTY.
- Hoặc: giữ `node-pty` trong Node sidecar → **không phải viết lại PTY layer ngay**. `IPtyProvider` (`src/main/providers/types.ts:121`) với 3 implementation local/ssh/daemon sống nguyên trong sidecar.
- Đây là điểm Tauri hơn hẳn Electrobun (không có Windows PTY chính thức) và GPUI (`gpui-terminal` 0.1.0, 2.3k LOC).

## 6. Nhược điểm thật của Tauri v2

1. **Webview fragmentation** — `wry` 0.56.1 dùng WKWebView (macOS) / WebView2 (Windows) / WebKitGTK (Linux). Cùng bài toán với Electrobun: renderer React 19 + Tailwind + Monaco + xterm.js phải chạy đúng trên 3 engine, không còn một Chromium pinned. Đây là rủi ro kỹ thuật số một cho hướng này.
2. **Không có safeStorage tương đương trực tiếp.** Stronghold là encrypted vault riêng (không dùng OS keychain), `store` không encrypt. Phải chọn: Stronghold, `keyring` crate, hoặc giữ secret layer trong Node sidecar dùng chính `safeStorage`… nhưng `safeStorage` là API Electron, không có ngoài Electron → phải viết lại. 10+ consumer `safeStorage` đều bị ảnh hưởng.
3. **Không có preload model.** Capability/permission model của Tauri chặt hơn nhưng khác hẳn; plugin system với iframe-sandboxed panel của app phải thiết kế lại boundary.
4. **Main process phải là Rust** (hoặc Node sidecar như trên). 227 file dùng `electron` API là công việc không thể tránh.
5. **Linux floor lên 22.04** do webkit2gtk-4.1.
6. **Rust learning + build time** cho team.

## 7. Xếp hạng cập nhật (4 hướng non-Electron + status quo)

| Hạng | Hướng | Lý do |
|---:|---|---|
| 1 | **Giữ Electron + Rust sidecar cho compute** | Chi phí 1-3 engineer-months, precedent có trong repo (`native/` 5 sidecar), bảo toàn toàn bộ đầu tư |
| 2 | **Tauri v2 + Node sidecar** | Hướng non-Electron chín nhất và duy nhất cho phép migration tăng dần; floor macOS/Windows còn rộng hơn Electron hiện tại; packaging/signing tốt. Chi phí ~6-12 engineer-months, rủi ro chính là 3-engine renderer |
| 3 | Giữ Electron nguyên trạng | Chi phí 0 |
| 4 | Electrobun | Single maintainer, giữa 2.0 rewrite, thiếu safeStorage/Windows PTY/Windows signing, floor cao nhất |
| 5 | Rust + GPUI | Crate stale 10 tháng, UI rewrite 4.940 file, mất Monaco/xterm.js, code Zed là GPL |

**Nhận định:** nếu mục tiêu là thoát Electron, **Tauri v2 là lựa chọn hợp lý duy nhất trong ba hướng non-Electron** — nó có Node-sidecar escape hatch, packaging thật, plugin đầy đủ, floor rộng, và một foundation đứng sau. Nhưng nó vẫn là 6-12 engineer-months và vẫn có bài toán 3-engine renderer.

## Giới hạn của research này

- Không hands-on: chưa dựng thử Tauri app, chưa load renderer bundle vào wry.
- Ubuntu 20.04 không có webkit2gtk-4.1: suy ra từ yêu cầu `libwebkit2gtk-4.1-dev` của docs + kiến thức phiên bản distro; **chưa verify bằng cách query package index của Ubuntu**.
- Ước lượng engineer-months là phán đoán từ scale codebase, không đo từ dự án tương đương.
- Chưa đánh giá sâu Stronghold vs `keyring` crate cho 10+ consumer secret.
- Chưa kiểm tra app lớn nào cỡ này đã ship trên Tauri v2 (search bị 502 cả session).

## Câu hỏi chưa giải quyết

1. Renderer hiện tại (React 19 + Tailwind + Monaco + xterm.js) chạy được trên WKWebView/WebView2/WebKitGTK ở mức nào? Đây là câu hỏi chung cho cả Tauri và Electrobun và chỉ trả lời được bằng spike.
2. Secret layer: Stronghold, `keyring` crate, hay giữ trong Node sidecar? Ảnh hưởng 10+ consumer.
3. Plugin system iframe-sandboxed panel map sang capability model của Tauri thế nào?
4. Có app nào cỡ ~11k file đã ship trên Tauri v2 chưa? Cần verify.
