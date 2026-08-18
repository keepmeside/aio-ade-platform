# Preflight baseline inventory

- Captured: 2026-08-03T17:39:25Z
- Commit: `0304a3650aa8691975c8cb61535aec8a2d4ace02`
- Branch: `main`
- Remote: `https://github.com/keepmeside/aio-ade-platform.git`
- Toolchain: Node `v24.12.0`, pnpm `10.24.0`
- App version: `orca@1.4.162-rc.0`

Không có secret trong output. Untracked research của người dùng giữ nguyên, không stage.

## Inventory (re-measured, khác plan.md)

| Hạng mục | plan.md (2026-07-30) | Đo lại (2026-08-03) | Ghi chú |
|---|---:|---:|---|
| File tracked | 11,056 | 11,084 | +28, do plan artifacts đã commit |
| File chứa `orca` | 3,475 | 3,494 | +19 |
| Lần xuất hiện `orca` | 42,835 | 43,441 | +606 |
| File `mobile/` | 1,048 | 1,048 | không đổi |
| File `src/cli/` | 146 | 146 | không đổi |
| Workflow CI | 23 | 24 | +1 (workflow Pages manual đã push) |
| Agent roster | 35 | 37 | đếm trực tiếp union `TuiAgent` |

Roster thật là **37 member**, không phải 35. Định nghĩa canonical: `src/shared/types.ts:2505`
(`export type TuiAgent`). Phase 04 phải dựa vào con số 37, và giữ `claude` + `codex`
nghĩa là xoá 35 member.

## Coupling map cho các path sẽ xoá

### `mobile/`

| Bề mặt | Vị trí | Ràng buộc |
|---|---|---|
| Reliability gates | `config/reliability-gates.jsonc` | 4 gate id: `mobile-ui.drawer-close-continuity`, `mobile-relay.endpoint-recovery`, `terminal-query.mobile-view-authority`, `terminal-runtime.mobile-stream-budget` (tổng 53 gate) |
| Gate commands | cùng file | gọi `pnpm --dir mobile exec vitest ...`, sẽ fail ngay khi xoá `mobile/` |
| Shared test còn lại | `src/shared/mobile-relay-close-codes.test.ts` | thuộc `src/`, gate `mobile-relay.endpoint-recovery` tham chiếu; không xoá cùng `mobile/` |
| Lint | `package.json` script `audit:code-quality:native` | truyền literal path `mobile` cho oxlint |
| oxlint plugin | `.oxlintrc.json` + `config/oxlint-plugins/mobile-pairing-qrcode-import.mjs` | rule `mobile-pairing/no-eager-qrcode-import` = `error` |
| max-lines ratchet | `config/max-lines-baseline.txt:5` | `inline mobile/src/constants/marine-creatures.ts` |
| Workflows | `mobile.yml`, `mobile-android-release.yml`, `mobile-ios-release.yml`, `release-cut.yml`, `homebrew-bump.yml` | 5 trong 24 workflow |
| e2e | script `test:e2e:floating-mobile-emulator` → `tests/e2e/floating-mobile-emulator-tab.spec.ts` | emulator tab sống trong desktop app, không trong `mobile/` |
| Settings UI | `GlobalSettings.showMobileButton` (`src/main/ipc/settings.ts` APPEARANCE_MENU_KEYS) | persisted setting + menu checkbox |

Kết luận: `mobile/` không tự chứa. Xoá directory mà không sửa 4 gate, lint path,
oxlint rule, ratchet, 5 workflow và `showMobileButton` sẽ làm `pnpm lint` đỏ trước cả typecheck.

### `src/cli/`

| Bề mặt | Vị trí | Ràng buộc |
|---|---|---|
| Bin entry | `package.json:8` | `"orca": "./out/cli/index.js"` — vừa là CLI coupling vừa là rebrand target |
| Build | script `build:cli` | trong `build:desktop` và `build:release`; chạy `verify-cli-bin.mjs` + `install-dev-cli.mjs` |
| Typecheck | `config/tsconfig.cli.json`, `config/tsconfig.tc.cli.json` | script `typecheck` gate trên `tsconfig.tc.cli.json` |
| Scripts | `tc:cli`, `typecheck:cli`, `typecheck:tsc:cli`, `verify:cli-bin`, `build:cli` | 5 script |
| Workflows | `pr.yml`, `computer-e2e.yml` | 2 workflow |
| max-lines ratchet | `config/max-lines-baseline.txt:6-9` | 4 entry `src/cli/` |
| Orchestration | `src/main/runtime/orchestration/cli-command.ts` + `preamble` | inject lệnh CLI vào terminal agent |
| Desktop installer | `src/main/cli/cli-installer.ts`, `wsl-cli-installer.ts` (+ ratchet dòng 36-38) | khác `src/cli/`; cài CLI vào PATH/WSL, không xoá lẫn |
| e2e | `test:e2e:multi-client-navigation` | phụ thuộc CLI transport |

Điểm quan trọng: `src/main/cli/` (installer, 3 file trong ratchet) **không** phải `src/cli/`.
Phase 03 phải phân biệt hai cây này; xoá `src/cli/` vẫn để lại installer trỏ vào binary không tồn tại.

### Rebrand `orca`

| Bề mặt | Giá trị |
|---|---|
| `appId` | `com.stablyai.orca` (`config/electron-builder.config.cjs:21`) |
| `productName` | `Orca` (dòng 66), dùng lại ở `shortcutName` và `uninstallDisplayName` |
| package name | `orca@1.4.162-rc.0` |
| bin name | `orca` |
| Runtime module | `src/main/runtime/orca-runtime.ts` (+ test) |
| Legacy auth/config path | ≥20 file `src/main/**` tham chiếu `'orca'` / `.orca`, tập trung ở `agent-hooks/`, `ai-vault/`, `antigravity/` |

`appId` và userData directory là migration-critical: đổi `appId` mà không migrate sẽ làm app
mất toàn bộ persisted state và OAuth account.

## Agent auth env

- `CLAUDE_CONFIG_DIR`: chỉ xuất hiện trong `config/scripts/` (repro + verify script), không trong `src/`.
- `CODEX_HOME`: `config/scripts/` (7 file), `docs/agent-status-over-wsl.md`, và `mobile/src/session/ai-vault-resume-launch.test.ts`.

Nghĩa là auth env resolution nằm trong script layer chứ không hardcode trong product source —
tốt cho Phase 06, nhưng `mobile/` có 1 test dùng `CODEX_HOME`, cần đọc trước khi xoá để không mất coverage.

## Persisted-state surface cho migration fixtures

- Union: `src/shared/types.ts:2505`
- Default: `src/shared/constants.ts:310` → `defaultTuiAgent: null`
- IPC: `src/main/ipc/settings.ts` (`sanitizeRendererSettingsUpdate`, `SETTINGS_CHANGED_WHITELIST`)
- Runtime: `src/main/runtime/orca-runtime.ts`, `src/main/runtime/rpc/methods/client-ui-schemas.ts`
- Commit-message default: `src/shared/commit-message-agent-spec.ts:677` → `DEFAULT_COMMIT_MESSAGE_AGENT_ID: TuiAgent = 'claude'`

Không tìm thấy file settings-migration nào (`git ls-files | grep -iE "settings.*migrat"` rỗng).
Đây là gap thật: **repo chưa có versioned settings migration layer**. Phase 04/05 cần tạo mới,
không phải mở rộng cái có sẵn. Đó là điều kiện tiên quyết cho acceptance criterion
"không reset profile cũ khi đọc lần đầu".

## Gate baseline (đã xác minh)

| Gate | Kết quả | Ghi chú |
|---|---|---|
| `pnpm typecheck` | PASS | 3 project: node, tc.cli, tc.web |
| `pnpm lint` | PASS | chỉ pass sau khi 4 file scratch untracked ra khỏi repo root |
| `audit:code-quality:native` | PASS | scope `src config tests mobile --deny-warnings` |
| `check:reliability-gates` | PASS | 53 gate |
| `check:max-lines-ratchet` | PASS | 354 grandfathered suppression |
| `verify:bundled-skill-guides` | PASS | |
| `verify:skill-bundle-manifest` | PASS sau regen | staleness là line-ending artifact, xem Blocker 4 |
| `verify:localization-catalog` | PASS | ja/ko/zh parity, 11,548 key mỗi locale |
| `verify:localization-coverage` | PASS | 12 allowlisted candidate |
| `vitest run src/shared/` | 4 fail / 3401 pass / 24 skip | 3 fail là pre-existing Windows-only, xem dưới |

Baseline tracked source **xanh** cho lint + typecheck. Đây là safety net cho các phase xoá/rename tiếp theo.

### Pre-existing test failure: `node-markdown-document-discovery.test.ts` (Windows-only)

2 trong 3 test fail. File **không bị sửa** (`git status` sạch), nên đây là defect có sẵn tại HEAD
trên Windows, không phải regression.

Nguyên nhân: `src/shared/node-markdown-document-discovery.ts:66` dùng
`join(absoluteDirectoryPath, entry.name)`. Trên Windows `join('/repo', 'docs')` trả
`\repo\docs`, không bao giờ khớp fixture key `/repo/docs` trong test. Đã verify trực tiếp:

```
node -e "const{join}=require('node:path');console.log(JSON.stringify(join('/repo','docs')))"
→ "\\repo\\docs"
```

Hệ quả: subdirectory traversal trả rỗng, nên test 1 mất `docs/guide.mdx` và test 3 resolve `[]`
thay vì reject. Trên macOS/Linux `join` giữ `/` nên CI xanh — đó là lý do defect chưa bị bắt.

Vi phạm quy tắc cross-platform trong `AGENTS.md` ("File paths: use `path.join` — never assume
`/` or `\`"): production code dùng `join` đúng, nhưng **test fixture hardcode POSIX separator**.
Fix thuộc test, không thuộc production: fixture nên build key bằng `join` thay vì literal `/repo/docs`.

Chưa sửa trong phase này vì Phase 01 là read-only preflight. Ghi nhận để Phase 02 xử lý,
và để không ai nhầm nó là regression do xoá `mobile/`.

### 2 pre-existing failure còn lại: locale-dependent (không phải code defect)

Cả 2 file cũng `git status` sạch. Nguyên nhân là **system locale của máy này (`Asia/Saigon`, vi-VN)**,
không phải logic sai:

| Test | Expected | Received | Nguyên nhân |
|---|---|---|---|
| `automation-schedules.test.ts` > friendly cron labels | `Sundays at 12:30` | `Chủ Nhậts at 12:30` | weekday name lấy từ `Intl` theo locale hệ thống, rồi nối `s` thành `Chủ Nhậts` |
| `external-automation-jobs-file.test.ts` > excessive job counts | `more than 10,000 jobs` | `more than 10.000 jobs` | number grouping separator vi-VN dùng `.` thay `,` |

Cả hai là test giả định locale `en-US`. Trên CI (locale en) sẽ xanh. Đây là cùng một class lỗi
với `node-markdown-document-discovery`: **test hardcode môi trường**, production code không sai.

Tổng kết 4 failure: 2 do POSIX separator hardcode, 2 do en-US locale hardcode. Không có failure
nào liên quan tới `mobile/`, `src/cli/`, agent roster hay rebrand — nên baseline vẫn dùng được
làm safety net, miễn là so sánh trên **cùng máy, cùng locale** trước và sau mỗi phase.

Khuyến nghị: khi bắt đầu Phase 02, chạy `vitest run src/shared/` và xác nhận vẫn đúng 4 failure
này. Nếu số tăng, đó là regression thật.

### Blocker 1: D: drive hết dung lượng (đã xử lý)

`pnpm typecheck` fail với `'tsc' is not recognized` vì `node_modules` rỗng. Nguyên nhân gốc
không phải install sai mà là **D: còn 1.6 GB / 118 GB (99% full)**. Install ghi dở dang làm
corrupt cả `node_modules/.pnpm` (thiếu `typescript@7.0.2/package.json`) và pnpm store index
(thiếu `@emnapi+core@1.11.2.json`), rồi `node_modules/.bin` biến mất giữa hai lần chạy.

Xử lý: `pnpm store prune` thu hồi **20 GB** (1.6 GB → 22 GB free), sau đó
`pnpm install --frozen-lockfile` chạy sạch, `.bin` có 225 link.

Bài học cho các phase sau: gate đỏ trên máy này phải loại trừ disk trước khi debug source.
Phase 02 xoá `mobile/` (~9.7 MB) không giải quyết được vấn đề disk ở cấp độ này.

### Blocker 2: file scratch untracked làm `pnpm lint` đỏ

`oxlint` chỉ ignore `**/node_modules`, `**/dist`, `**/out` (`.oxlintrc.json:151`), nên nó lint cả
file untracked ở repo root. 4 file gây fail:

- `.mf_schema.ts` (max-lines 1207)
- `.mf_crown_http.ts` (max-lines 769 + 9 `curly`)
- `.mf_heatmap.ts` (max-lines 360 + type-style)
- `.mf_reviewmodel.ts` (indexed-object-style + `curly`)

Không phải lỗi tracked source. Di chuyển sang subdirectory **không** giúp vì oxlint vẫn quét;
chỉ khi 4 file ra khỏi repo thì `pnpm lint` xanh. Các file đã được restore nguyên trạng
(byte-identical) về repo root sau khi đo.

Cần user quyết: thêm 4 file vào `ignorePatterns`, đổi tên ra ngoài repo, hay xoá.
Chưa xoá vì đây là research artifact của user.

### Blocker 3 (không chặn gate): native module

`windows-native-registry` không rebuild được (`Cannot find module './build/Release/native.node'`).
Postinstall cố ý continue. Không ảnh hưởng typecheck/lint/unit test, nhưng sẽ chặn khi
launch Electron hoặc chạy e2e.

### Blocker 4: `verify:skill-bundle-manifest` luôn stale trên Windows (CRLF)

`git config core.autocrlf` = `true`, nhưng `.gitattributes` **không** có rule `eol=lf` cho
`resources/skills/*.json`. Generator ghi LF, git checkout thành CRLF, nên verify luôn báo stale:

```
Generated skill artifacts are stale:
resources\skills\current-manifest.json
resources\skills\snapshot-registry.json
resources\skills\release-mapping.json
```

`git diff --numstat` sau regen trả **rỗng** → zero content diff, chỉ khác line ending.
Pre-existing, không phải regression. Fix đúng: thêm 3 file này vào `.gitattributes` với `text eol=lf`
(giống pattern đã dùng cho `/config/scripts/*.mjs` và `/skill-guides/*.md`). Chưa sửa vì Phase 01 read-only.

### Cảnh báo vận hành: mất file do disk-full

Trong lúc debug, `resources/build/` (5 binary asset: `icon.icns`, `icon.ico`, `icon.png`,
`entitlements.mac.plist`, `entitlements.computer-use.mac.plist`) biến mất khỏi working tree —
tác dụng phụ của disk-full/prune, không do lệnh nào chủ ý xoá. Đã `git checkout --` restore đủ 5 file.

Bài học: sau bất kỳ sự cố disk trên repo này, chạy `git status` và restore tracked file bị mất
**trước** khi kết luận gate hay commit. Nếu không, một `git add -A` sẽ commit luôn việc mất
icon và entitlement, làm packaging macOS fail ở phase sau.

## Câu hỏi chưa giải quyết

- `src/shared/mobile-relay-close-codes.test.ts` và relay transport trong `src/` giữ hay xoá cùng mobile companion? Gate `mobile-relay.endpoint-recovery` phủ cả hai cây.
- 4 mobile gate sẽ retire hay rewrite sang desktop-only scope? Ratchet chỉ được co, nên retire phải sửa cả `reliability-gates.jsonc`.
- `showMobileButton` và floating mobile emulator tab là mobile companion hay desktop feature độc lập?
- `appId` mới là gì, và có migrate userData từ `com.stablyai.orca` không?
- Version `1.4.162-rc.0` reset về `0.1.0` khi rebrand hay tiếp tục từ upstream?
