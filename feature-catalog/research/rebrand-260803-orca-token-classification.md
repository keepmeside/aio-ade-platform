# Phân loại token `orca` cho rebrand

- Đo: 2026-08-03, commit `74d07a2` (sau khi xoá RN mobile tree)
- Tổng: **43,441 lần xuất hiện / 3,494 file** (đo trước khi xoá mobile; sẽ giảm sau)
- Mục đích: thực hiện step 1 và 6 của Phase 05 — tách "đổi được" khỏi "đổi là hỏng"

## Phân bố theo khu vực

| Khu vực | Số file chứa `orca` |
|---|---:|
| `src/` | 2,719 |
| `tests/` | 238 |
| `config/` | 172 |
| `docs/` | 55 |
| `tools/` | 46 |
| `plans/` | 21 |
| `.github/` | 21 |
| `resources/` | 19 |
| `native/` | 12 |
| `skill-*` | 24 |

File có `orca` trong **tên**: 180.

## 5 nhóm phân loại

### Nhóm A — Wire/manifest contract: KHÔNG rename, phải dual-read

Đổi canonical name trước khi có reader chấp nhận cả hai sẽ làm hỏng plugin đã cài
và session đang chạy.

| Token | File tham chiếu | Rủi ro nếu đổi mù |
|---|---:|---|
| `orca-plugin.json` | 21 | Mọi plugin bên thứ ba ngừng load |
| `orca://` | 31 | Deep link và protocol handler chết |
| `orca-panel-*` | 4 | Panel bridge giữa main/renderer/iframe đứt |
| `engines.orca` | 2 | Version gate của plugin manifest sai |

Thứ tự bắt buộc: viết reader accept-both → release → mới đổi writer sang canonical mới.
`examples/plugins/hello-orca/orca-plugin.json` và `hostile-panel/orca-plugin.json` là fixture
cho containment e2e, phải đổi đồng bộ với reader.

### Nhóm B — App identity: đổi được nhưng BẮT BUỘC kèm migration

| Hạng mục | Giá trị hiện tại | Ghi chú |
|---|---|---|
| `appId` | `com.stablyai.orca` (118 tham chiếu trong `src/`) | Quyết định đường dẫn userData. Đổi mà không copy dữ liệu = mất toàn bộ settings + OAuth |
| `productName` | `Orca` | `shortcutName`, `uninstallDisplayName` dùng lại |
| package name | `orca@1.4.162-rc.0` | |
| `bin` | `orca` → `./out/cli/index.js` | **Giao với Phase 03**; user đã chốt xoá CLI nên entry này sẽ biến mất, đổi tên là thừa |

Phase 01 đã xác định: **repo chưa có settings-migration layer nào**. Nhóm B không thể làm
trước khi layer đó tồn tại.

### Nhóm C — CLI command name: đã có chokepoint sẵn

`src/shared/orca-cli-command-name.ts` tập trung toàn bộ tên lệnh theo platform:

```
linux → 'orca-ide'   win32 → 'orca.cmd'   còn lại → 'orca'
```

Đây là điểm đổi tốt nhất trong repo: một file, ba giá trị. Nhưng vì user đã chốt **xoá toàn bộ
`src/cli/`** (Phase 03), module này nhiều khả năng bị xoá luôn thay vì rebrand. Không đổi bây giờ
để tránh làm việc hai lần — plan.md đã ghi `package.json:8` là điểm giao Phase 03/05.

### Nhóm D — User-visible copy: đổi được, phải giữ key parity

| Locale | Số lần `orca` |
|---|---:|
| `en.json` | 620 |
| `es.json` | 624 |
| `ja.json` | 616 |
| `ko.json` | 615 |
| `zh.json` | 625 |

Gate `verify:localization-catalog` bắt 5 locale cùng **11,548 key**. Sửa lệch một locale là đỏ CI.
Đây là nhóm an toàn nhất về mặt runtime (chỉ là chuỗi hiển thị) nhưng lớn nhất về khối lượng,
và phải sửa cả 5 file trong cùng một commit.

Cảnh báo: `resources/plugins/launch/stablyai.orca-portuguese/` là **plugin id**, thuộc nhóm A
chứ không phải D, dù nằm trong đường dẫn `locales/`.

### Nhóm E — Upstream copyright và code symbol nội bộ

- `native/computer-use-macos/Sources/OrcaComputerUseMacOS*` — Swift module name, đổi kéo theo
  build target và không phải user-visible.
- `Casks/orca.rb`, `Casks/orca@rc.rb` — Homebrew cask, gắn với release channel đang inert.
- `src/main/runtime/orca-runtime.ts` — symbol nội bộ, đổi được nhưng không cấp bách.
- Copyright/attribution upstream: **giữ nguyên**, theo acceptance criterion về NOTICE.

## Thứ tự đề xuất

1. Nhóm A trước: viết reader dual-read + test, chưa đổi writer.
2. Settings-migration layer (điều kiện tiên quyết của nhóm B).
3. Nhóm B: đổi `appId`/`productName` kèm one-way copy userData.
4. Nhóm D: 5 locale trong một commit.
5. Nhóm C và E: dọn sau khi Phase 03 quyết xong số phận `src/cli/`.

Không chạy global replace `orca` → `aio-ide` ở bất kỳ bước nào; Phase 05 Risk Assessment
đã cấm rõ ràng và nhóm A/E sẽ vỡ ngay.

## Câu hỏi chưa giải quyết

- `appId` mới là gì? (`com.keepmeside.aio-ide`?) Cần chốt trước khi viết migration.
- Có giữ compatibility cho plugin dùng `orca-plugin.json` vĩnh viễn hay chỉ một release window?
- Version `1.4.162-rc.0` tiếp tục hay reset?
- Swift module `OrcaComputerUseMacOS` có đổi không, hay giữ vì không user-visible?
