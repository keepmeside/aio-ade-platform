# Dọn ổ C: — nhật ký thao tác

- Ngày: 2026-08-04
- Lý do: `C:` đầy 100% (còn 12 MB), chặn `vitest` (`ENOSPC`) và làm treo các suite lớn
- Kết quả: **12 MB → 16 GB trống** (87% used)

## Nguyên tắc đã áp dụng

Chỉ xoá thứ **tái tạo được**. Không đụng: tài liệu, credential, lịch sử hội thoại,
profile trình duyệt, ứng dụng đã cài, dữ liệu game.

## Đã xoá

| Mục | Dung lượng | Vì sao an toàn |
|---|---:|---|
| `C:\Windows\Temp\*` | ~1.7 GB | Temp hệ thống, OS tự tạo lại |
| `%LOCALAPPDATA%\Temp\*` | ~0.6 GB | Temp user; gồm 943 thư mục `orca-test-*` rò rỉ từ các lần vitest crash |
| `~\.gradle\caches` + `daemon` | ~3.4 GB | Gradle tải lại khi build |
| `~\.agentkit\backups\*` | ~3.8 GB | 9 backup từ 12–25/07, đã cũ |
| `~\.cache\*` | ~1.0 GB | Cache chung |
| `~\.codex\logs_2.sqlite` | ~3.4 GB | **DB log**, không phải session. Đã verify không có process codex đang chạy trước khi xoá |
| `~\.codex\.tmp`, `~\.codex\backups` | ~0.2 GB | Temp + backup |
| `WinGet\Packages\*` | ~0.9 GB | Installer đã dùng xong |
| Discord `Cache` + `Code Cache` | ~0.4 GB | Cache app |
| `ms-playwright\*` | ~0.7 GB | Browser binary, `npx playwright install` tải lại |
| `SoftwareDistribution\Download\*` | ~1.9 GB | Windows Update đã cài xong |
| Recycle Bin | — | |
| DISM `/StartComponentCleanup /ResetBase` | ~0 | WinSxS đã gọn sẵn |

## Cố ý KHÔNG xoá

| Mục | Dung lượng | Lý do |
|---|---:|---|
| `~\.claude\projects` | 2.9 GB | **Lịch sử hội thoại Claude** của 8+ project |
| `~\.codex\sessions` | 2.1 GB | Lịch sử session Codex |
| `zen\Profiles` | 2.3 GB | Bookmark, login, profile trình duyệt. Chỉ có `shader-cache` là cache (0 GB) |
| `ModrinthApp` | 3.3 GB | Dữ liệu game/mod |
| `Zoom`, `.Chu9Client`, `Overwolf` | ~3.8 GB | Ứng dụng đã cài |
| `Downloads` | 5.2 GB | File người dùng tải về — không tự ý xoá |
| `.vscode`, `.local`, `.agents`, `.m2` | ~5.1 GB | Extension + toolchain đang dùng |
| `ProgramData\Microsoft` | 5.3 GB | Gồm Defender definitions |

## Xác minh sau khi dọn

- `persistence.test.ts`: **414/414 pass** với temp mặc định trên C: (trước đó fail `ENOSPC`)
- `src/renderer/src/lib/`: chạy bình thường, không còn treo
- Workaround `TMPDIR=/d/tmp-aio` **không còn cần thiết**

## Lưu ý còn lại

`Downloads` 5.2 GB là mục lớn nhất có thể thu hồi thêm, nhưng là file của người dùng —
cần bạn tự xem và quyết định.

Nếu C: đầy lại, thủ phạm hay gặp nhất là `~\.codex\logs_2.sqlite` (tăng nhanh) và thư mục
`orca-test-*` rò rỉ trong `%LOCALAPPDATA%\Temp` mỗi khi vitest bị kill giữa chừng.
