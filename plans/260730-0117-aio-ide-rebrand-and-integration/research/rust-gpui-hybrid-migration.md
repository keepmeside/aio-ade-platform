# Rust + GPUI hybrid migration — Research (2026-08-21)

Scope: đánh giá **Rust + GPUI** làm hướng thay runtime cho app Electron này, dạng **hybrid** (một phần sang Rust+GPUI, phần không thay được giữ Electron). So sánh với hướng Electrobun (`electrobun-migration-feasibility.md`).

Phương pháp: dữ liệu lấy trực tiếp từ crates.io API và GitHub API (verified 2026-08-21). Web search bị 502 nên không có blog/announcement; các mục cần nguồn văn bản được đánh dấu UNVERIFIED.

## 1. GPUI — trạng thái crate (verified)

| Hạng mục | Giá trị | Nguồn |
|---|---|---|
| Crate | `gpui`, "Zed's GPU-accelerated UI framework" | crates.io API |
| Latest | **0.2.2**, published **2025-10-22** | crates.io API |
| Kể từ đó | **không có release mới** (~10 tháng tính tới 2026-08) | crates.io API: `updated_at 2025-10-22`, `num_versions: 7` |
| License | **Apache-2.0** | crates.io API + `crates/gpui/LICENSE-APACHE` trong repo Zed |
| Downloads | 220k tổng, 118k recent | crates.io API |
| Docs | `documentation: null` — **không có docs.rs**, chỉ gpui.rs | crates.io API |
| Size | 65.8k LOC (127 file Rust + Metal/HLSL/WGSL shaders) | crates.io linecounts |
| Repo | `zed-industries/zed`, 89k stars, push mới nhất 2026-08-21 | GitHub API |

**Kết luận quan trọng:** Zed cực kỳ active nhưng **crate publish đã cũ 10 tháng**. Người dùng ngoài Zed hoặc pin 0.2.2 hoặc vendor từ git. Vẫn là 0.x, không có cam kết API stability, không docs.rs. Đây là rủi ro khác loại với Electrobun: không phải "single maintainer", mà là "framework được maintain cho use case của chính chủ, publish là phụ".

## 2. License — điểm mấu chốt cho app MIT

- `gpui` = **Apache-2.0** → dùng trong app MIT hợp lệ, nghĩa vụ: giữ LICENSE/NOTICE.
- Repo `zed-industries/zed` = **NOASSERTION** (mixed license): Zed editor là GPL, một số crate Apache/MIT. **Copy code editor của Zed (kể cả terminal implementation) tạo nghĩa vụ copyleft** — không dùng được cho app MIT.
- Suy ra: dùng được `gpui` engine, **không** copy Zed's terminal/editor code. Thay thế non-GPL: `gpui-terminal` (MIT OR Apache-2.0, xem dưới).

## 3. Ecosystem GPUI (verified — 124 reverse dependencies)

| Crate | Version | License | LOC | Ý nghĩa |
|---|---|---|---|---|
| `gpui-component` (Longbridge) | 0.5.1, 2026-02-05 | Apache-2.0 | 47.8k | Component library lớn: form, table, code editor với tree-sitter (27 grammar). **Có feature `webview` backed by `wry`** |
| `gpui-terminal` (zortax) | 0.1.0, 2025-12-24 | MIT OR Apache-2.0 | 2.3k | Terminal emulator component — non-GPL alternative cho Zed terminal. Rất sớm (0.1.0, 2.3k LOC) |
| `gpui-tokio-bridge` | 0.1.0, 2026-01 | Apache-2.0 | 56 | Chạy tokio task trong GPUI context |
| `gpui-symbols` | 0.6.1, 2026-01 | MIT/Apache | 606 | SF Symbols icons |
| `gpui-router` | 0.3.0, 2025-12 | MIT | 517 | Routing |
| `gpui-liveplot` | 0.2.6, 2026-03 | MIT | 5.4k | Plotting |

**`gpui-component` feature `webview` (wry) là seam hybrid quan trọng nhất tìm được:** một app GPUI có thể nhúng webview. Nghĩa là "GPUI shell + webview chạy renderer React hiện tại" là khả thi về mặt kỹ thuật — nhưng khi đó bạn đã quay lại đúng bài toán webview-fragmentation của Tauri/Electrobun (wry = WKWebView/WebView2/WebKitGTK), cộng thêm một ngôn ngữ mới.

## 4. GPUI là gì và chi phí port UI

GPUI là retained-mode GPU UI trong Rust: element tree dựng bằng Rust builder API, styling bằng Tailwind-like helper methods trong Rust (`.flex().gap_2().bg(...)`), shader Metal/HLSL/WGSL cho render. **Không chạy HTML/CSS/JS.**

Chi phí port renderer hiện tại (đo trên repo này):
- `src/renderer/` = **4.940 file** TS/TSX, React 19 + Tailwind + shadcn + Monaco.
- `src/renderer/` có **0 import trực tiếp từ `electron`** — renderer đã decoupled hoàn toàn khỏi Electron API, giao tiếp qua preload/IPC.

Con số thứ hai là tin tốt cho *mọi* hướng migration (renderer không dính Electron API). Con số thứ nhất là chi phí: port 4.940 file React sang GPUI là **viết lại UI từ đầu**, không phải migration. Monaco (editor/diff) và xterm.js đều là web component — không có đường mang sang GPUI, phải thay bằng `gpui-component`'s code editor và `gpui-terminal` (cả hai kém hơn đáng kể so với Monaco/xterm về maturity).

## 5. Bốn hướng hybrid — thật vs ảo

| Hướng | Mô tả | Đánh giá |
|---|---|---|
| **(a) Rust core sidecar, Electron giữ toàn bộ UI** | Logic nặng (git, index, search) sang Rust binary out-of-process; UI không đổi | **Thật, rủi ro thấp nhất.** Repo đã có precedent: `native/` chứa 5 sidecar (Swift, C#, Python, PowerShell) — pattern out-of-process đã tồn tại, chỉ thêm ngôn ngữ. Không có GPUI nào ở đây |
| **(b) GPUI cho một số window + Electron cho window khác, 2 process** | Hai UI toolkit trong một sản phẩm | **Gần như ảo.** Không tìm thấy tiền lệ. Vỡ ở: single-instance/window management (2 app framework tranh nhau), updater (2 runtime cần update atomically), packaging (2 bundle trong 1 installer), tray/menu ownership, và **theming**: STYLEGUIDE.md + `main.css` tokens không tồn tại trong GPUI → hai UI sẽ trông khác nhau. Chi phí duy trì gấp đôi vĩnh viễn |
| **(c) Full GPUI rewrite renderer, giữ backend** | Thay 4.940 file React | **Rewrite, không phải migration.** Mất Monaco, xterm.js, shadcn, Tailwind, react-markdown, toàn bộ test renderer |
| **(d) Giữ Electron, chỉ chuyển phần compute sang Rust** | = (a) nhưng có thể qua N-API thay vì sidecar | **Thật.** Lưu ý repo hiện **không có Rust và không có N-API addon nào**; native code là sidecar binary. Thêm N-API tạo nghĩa vụ prebuild cross-platform mới và ràng buộc glibc floor (2.31) cho artifact Rust |

**Điều user mô tả** ("Rust + GPUI một số chỗ, phần không thay được giữ Electron") map vào (b) nếu "một số chỗ" nghĩa là UI, hoặc (a)/(d) nếu nghĩa là logic. Hai cách hiểu này khác nhau một bậc độ lớn về chi phí và cần user phân định trước khi spike.

## 6. Terminal — feature cốt lõi của app này

- GPUI path: `gpui-terminal` 0.1.0, 2.3k LOC, một maintainer, publish 2025-12. So với xterm.js (đang dùng) là bước lùi lớn về maturity.
- Zed's own terminal: GPL → **không dùng được**.
- PTY trong Rust: `portable-pty` (wezterm) là lựa chọn chín nhất; SSH có `russh`. Nhưng app này đã có `IPtyProvider` với 3 implementation (local/ssh/daemon) đang hoạt động — thay chúng nghĩa là viết lại cả abstraction host (native/WSL/SSH) mà `AGENTS.md` yêu cầu giữ.

## 7. So sánh chi phí (ước lượng, không phải đo)

| Hướng | Engineer-months (thô) | Giữ lại được gì |
|---|---:|---|
| (a)/(d) Rust cho compute, giữ Electron | 1–3 | Gần như toàn bộ: UI, packaging, updater, secrets, terminals |
| Electrobun full | 6–12+ | Renderer bundle (nếu 3 engine chịu được); mất node-pty, safeStorage, electron-builder |
| (b) GPUI + Electron song song | 6–12, rồi chi phí duy trì kép vĩnh viễn | Một nửa UI, nhưng thêm nợ kiến trúc |
| (c) Full GPUI rewrite | 18–36+ | Chỉ business logic ở main/shared; mất toàn bộ renderer |
| Giữ Electron | 0 | Tất cả |

## 8. Verdict

Xếp hạng cho một app MIT với terminal là feature cốt lõi:

1. **Giữ Electron + chuyển compute sang Rust sidecar (a/d)** — hướng duy nhất bảo toàn đầu tư hiện có, có precedent trong repo, rủi ro bounded. Đây là hướng "Rust" thực dụng.
2. **Giữ Electron nguyên trạng** — chi phí 0, đánh đổi footprint.
3. **Electrobun** — rewrite đội lốt migration; chi tiết ở report riêng.
4. **Rust + GPUI (b hoặc c)** — (c) là rewrite 18–36 engineer-months; (b) là rewrite cộng thêm nợ kiến trúc vĩnh viễn. Không hướng nào phù hợp trừ khi mục tiêu thật là "xây lại sản phẩm", không phải "đổi runtime".

GPUI là framework tốt cho app viết mới from scratch bằng Rust (Zed chứng minh điều đó). Nó không phải đường migration cho một Electron app 4.940-file-renderer đang chạy.

## Giới hạn của research này

- Web search 502 suốt session → **không có** statement chính thức từ Zed team về GPUI readiness/1.0, không có blog/changelog, không có danh sách app third-party ngoài crates.io reverse deps.
- Ước lượng engineer-months là phán đoán từ scale codebase, không phải đo từ dự án tương đương.
- Không kiểm tra hands-on: chưa build thử gpui, chưa thử `gpui-component` webview feature.
- napi-rs current state: UNVERIFIED (không search được).

## Câu hỏi chưa giải quyết

1. "Một số chỗ" trong yêu cầu của user là **UI** hay **logic**? Quyết định này thay đổi chi phí một bậc độ lớn.
2. Động cơ thật của việc đổi runtime là gì — bundle size, RAM, startup, hay hiệu năng render? Chưa có số đo baseline nào của app hiện tại để so, nên không thể nói hướng nào giải quyết được vấn đề gì.
3. GPUI có roadmap publish/stabilization không (crate stale 10 tháng)? Cần nguồn văn bản.
