# Phát hiện: công việc đã tồn tại trên branch khác

- Ghi: 2026-08-04
- Mức độ: **chặn kế hoạch hiện tại**

## Tóm tắt

Phase 02/03/04 **đã được implement** trên branch `codex/aio-ade-implementation`,
checkout tại worktree riêng: `D:/Project/worktrees/.15_Ai0-IDE-codex-aio-ade-implementation`.

Trước khi phát hiện, tôi đã bắt đầu làm lại Phase 03 trên `main` một cách song song.
Đã revert toàn bộ (`git checkout -- .`), `main` sạch.

## Nội dung branch

| Commit | Ngày | Nội dung |
|---|---|---|
| `20b784a` | 2026-07-30 | docs: tauri migration roadmap |
| `a7462db` | 2026-07-30 | chore: establish aio-ade migration baseline |
| `6ba27fa` | 2026-07-30 | refactor: remove mobile companion runtime |
| `a44dfbc` | 2026-07-30 | chore: remove obsolete cli and mobile build gates |
| `150b481` | 2026-08-01 | feat(phase03): remove product cli and orchestration |

Diff so với `main`: **1,161 file, +41,746 / −141,879**. Riêng `src/`: 921 file, −120,583.

Ngoài 5 commit, worktree còn **470 thay đổi chưa commit**: 210 xoá + 260 sửa.
Kiểm tra cho thấy đây là **Phase 04 đang làm** (thu gọn roster): 60 file thuộc
`antigravity`, `devin`, `opencode`, `pi`, `mimo`, `goose`, `kilo`, `crush`, `aider`
trong `src/main/ai-vault/`, `src/main/rate-limits/`, `src/shared/agent-icons/`.
Không phải rác — là công việc thật đang dở.

Có 1 stash (`da62fd6`) 22 file / −5,045 dòng, cũng thuộc roster reduction.

## So sánh với công việc trên `main`

`main` (session này) và branch làm **trùng nhau ở Phase 02/03** nhưng khác cách:

| Hạng mục | `main` (session này) | `codex/aio-ade-implementation` |
|---|---|---|
| Xoá RN `mobile/` | có (`de1e6d8`) | có (`6ba27fa`) |
| Xoá `src/cli/` | không (đã revert) | có (`150b481`) |
| Xoá orchestration khỏi `orca-runtime.ts` | không làm được (33k dòng, 219 ref) | **đã xong**, 0 ref còn lại |
| Phase 04 roster | chưa | đang làm, 210 file đã xoá |
| Baseline inventory + token classification | có | không |
| Typecheck | xanh | xanh (đã verify trong worktree) |

Branch đi xa hơn nhiều về mặt code. `main` chỉ hơn ở tài liệu phân tích
(baseline inventory, token classification) — hai thứ đó **không xung đột** với branch.

## Rủi ro nếu tiếp tục làm trên `main`

Xoá `src/cli/` + orchestration trên `main` sẽ tạo hai lịch sử khác nhau cho cùng một
thay đổi trên 921 file. Merge sau đó gần như chắc chắn conflict diện rộng và không ai
resolve được an toàn. Đây là lý do đã dừng và revert.

## Trạng thái gate của worktree (đã đo 2026-08-04)

Sau khi repair `resources/build/` và chạy lại `pnpm install` (bin links 0 → 222):

| Gate | Kết quả |
|---|---|
| `pnpm typecheck` | **PASS**, 0 error |
| `pnpm lint` | **PASS** (locale parity 11,185 key × 4, coverage 12 allowlisted) |
| `vitest run src/shared/` | **FAIL: 37 test / 16 file** (2,917 pass, 24 skip) |

So với `main` (4 fail do locale/separator), worktree có **37 fail** — tức là
33 fail mới, đến từ Phase 04 dở dang.

Nguyên nhân: roster reduction đã xoá agent implementation nhưng **chưa cập nhật test
vẫn assert các agent đó tồn tại**. Ví dụ:

- `agent-session-resume.test.ts` — "treats devin as a resumable TUI agent"
- `agent-hook-listener.test.ts` — Pi / Kimi / MiMo Code lifecycle events
- `agent-kind.test.ts` — "keeps concrete telemetry kinds in exact sync with shipped TuiAgents"
- `agent-session-option-catalog.test.ts` — Cursor model discovery

Đây là **failure thật, không phải môi trường**. Typecheck xanh nhưng test đỏ vì test
kiểm tra dữ liệu runtime (roster registry) chứ không phải kiểu tĩnh.

Kết luận: Phase 04 **chưa xong**, không nên merge về `main` ở trạng thái này.
Việc còn lại là đồng bộ test với roster mới (giữ `claude` + `codex`), không phải
sửa production code.

## Đã xử lý: Phase 04 hoàn tất trên worktree (2026-08-04)

Sau khi phát hiện trùng việc, đã **không** làm lại trên `main`, mà hoàn thiện Phase 04
ngay trên worktree. Commit `a69dac5` "feat: reduce agent roster to Claude and Codex":
474 file, +1,648 / −54,911.

Cách xử lý 37 test đỏ — **không xoá bừa assertion**:

| Loại | Cách xử lý | Ví dụ |
|---|---|---|
| Test dùng agent đã bỏ làm *fixture*, nhưng invariant vẫn đúng | **Đổi fixture sang claude/codex**, giữ nguyên assertion | transcriptPath + record `origin` qua hydration |
| Test mà agent đã bỏ *chính là* chủ đề | Xoá test | Pi/Kimi/MiMo lifecycle, Cursor model catalog |
| Test khẳng định "unsupported agent bị drop" | **Giữ nguyên** `pi` — nó chính là ví dụ agent lạ | `drops Pi sleeping-agent records...` |
| Test assert danh sách agent hardcode | Đổi sang `toContain` để không vỡ khi roster đổi tiếp | source-control AI supported-agents |
| Test assert hành vi giờ không còn tồn tại | Xoá kèm giải thích | `!spec` branch không còn reachable |

Hai lỗi type do việc này lộ ra, đã sửa:

- `telemetry-events.ts`: `AGENT_KIND_VALUES` từ 36 xuống 3 (`claude-code`, `codex`, `other`)
  để giữ invariant "telemetry kind đồng bộ với TuiAgent" mà `agent-kind.test.ts` bảo vệ.
- `agent-hooks/server.ts`: xoá nhánh `agentKind === 'opencode'` trong dedupe.
  Đã verify `promptInteractionKey` **chỉ** được set cho `opencode`, `mimo-code`,
  `command-code` (`agent-hook-listener.ts:3564,3607`) — tức là với claude/codex nhánh này
  không bao giờ chạy, nên xoá là an toàn chứ không đổi hành vi.

Kết quả gate trên worktree:

| Gate | Trước | Sau |
|---|---|---|
| `pnpm typecheck` | PASS | **PASS** |
| `pnpm lint` | PASS | **PASS** |
| `vitest src/shared/` | 37 fail / 2,917 pass | **4 fail / 2,931 pass** |
| `vitest src/main/agent-hooks/` | 2 fail | **0 fail** (413 pass) |

4 fail còn lại đúng bằng baseline pre-existing của `main` (2 POSIX separator,
2 en-US locale) — xem [baseline preflight inventory](../research/baseline-260803-preflight-inventory.md).

Ngoài ra `feature-interactions.test.ts` timeout 15s khi chạy song song cả `src/shared/`
(pass khi chạy riêng). File không bị sửa; là test quét codebase, chậm do I/O contention
trên ổ D. Không phải regression.

Stash `da62fd6` giờ **đã bị bao trùm hoàn toàn** — mọi file nó xoá đều đã biến mất khỏi
worktree. Giữ lại cho an toàn, chưa drop.

## CẢNH BÁO: scope test thật lớn hơn nhiều so với báo cáo ban đầu (2026-08-04, đo lại)

Báo cáo trước ghi "gate xanh, 4 fail pre-existing". **Con số đó chỉ đúng cho `src/shared/`.**
Sau khi chạy rộng ra, scope thật:

| Suite | Test fail | File fail | Pass |
|---|---:|---:|---:|
| `src/shared/` | 4 | 3 | 2,931 |
| `src/main/` | **152** | **40** | 14,681 |
| `src/renderer/src/lib/` | **119** | **23** | 3,076 |
| `src/renderer/` (toàn bộ) | chưa đo xong | — | — |

Tức là còn **≥271 test fail / ≥63 file** chưa sửa, không phải 4. Đây là fallout của roster
reduction lan sang renderer và main, cùng loại nguyên nhân đã sửa trong `src/shared/`:
test tham chiếu agent đã bỏ (`opencode` show-cursor detection, `agent-picker-search`,
`launch-agent-*`, `agent-paste-draft`, `source-control-agent-action-plan`...).

**Typecheck và lint vẫn xanh** — vì đây là test kiểm tra dữ liệu runtime (roster registry,
detection heuristics), không phải kiểu tĩnh. Đó là lý do typecheck xanh không chứng minh
Phase 04 xong.

Phase 04 vì vậy **chưa hoàn tất**. Việc còn lại là mechanical nhưng khối lượng lớn:
đi qua ~63 file, phân loại từng test theo 5 nhóm đã dùng cho `src/shared/`
(đổi fixture / xoá / giữ làm ví dụ agent lạ / `toContain` / xoá vì hành vi không còn).

### Đã làm thêm trong lần này

- Commit `775cf96`: sửa 2 test migration launch-args (removed-agent key giờ bị **drop**
  chứ không sanitize in-place), và **thêm test còn thiếu** cho acceptance criterion
  "không reset profile cũ": profile có `defaultTuiAgent: 'gemini'` chỉ mất selection đó,
  các setting khác (`terminalScrollbackRows`, `agentDefaultArgs.claude`) sống nguyên.
  `src/main/persistence.test.ts`: 413 pass / 1 fail (fail là ENOSPC, xem dưới).

### Sửa lại nhận định sai ở Phase 01

Phase 01 kết luận "repo chưa có settings-migration layer nào" dựa trên
`git ls-files | grep -iE "settings.*migrat"` — **grep theo tên file là bằng chứng quá yếu**.
Thực tế repo **đã có** pattern migration hoàn chỉnh trong `src/main/persistence.ts`:
`migrateAgentYoloDefaults`, `migrateTerminalScrollbackRows`,
`migrateRuntimePairingDataToCanonicalUserDataPath`, và ~8 one-shot stamp trong
`GlobalSettings` (`agentYoloDefaultsMigrated`, `terminalMacOptionAsAltMigrated`...).

Hệ quả tốt cho Phase 05: rebrand `appId` **không cần dựng layer mới**, chỉ cần thêm một
migration + stamp theo đúng pattern đang có. Ước lượng effort của Phase 04/05 nên giảm ở
phần này (nhưng tăng ở phần test fallout bên trên).

### Blocker mới: ổ C: đầy 100%

`C:` còn **59 MB / 120 GB**. Test ghi vào `tmpdir()` trên C:, nên một test
(`loads legacy pane aliases from very large persisted split layouts`) fail với
`ENOSPC: no space left on device`. Không phải lỗi code — `persistence.ts` không bị sửa.

Đã dọn 943 thư mục `orca-test-*` rò rỉ từ các lần chạy crash (thu hồi ~121 MB) nhưng
không đủ. Chạy `src/renderer/` toàn bộ bị treo không ra output, nghi cùng nguyên nhân.

Cần user quyết dọn gì trên C: — tôi không tự xoá file người dùng ở đó.

## Tiến độ Phase 04 sau khi dọn test (2026-08-04, lượt 2)

Đã mở được blocker disk bằng cách **trỏ temp sang ổ D** (`TMPDIR=/d/tmp-aio`) thay vì xoá
file trên C:. `ENOSPC` biến mất, `persistence.test.ts` từ 413/1-fail lên **414/414 pass**.

Commit thêm: `e60c69d`, `9a2dc53`, `19a7d41`, `4ba06e8`.

| Suite | Trước | Sau | Ghi chú |
|---|---:|---:|---|
| `src/shared/` | 4 | **4** | đúng baseline pre-existing |
| `src/renderer/src/lib/` | 113 | **31** | −82 |
| `src/main/ipc+runtime+ai-vault+agent-hooks` | — | **65** | phần lớn pre-existing, xem dưới |

Cách làm: viết script `prune-retired-agent-tests.cjs` phân loại theo **tiêu đề test** —
nếu tiêu đề nêu agent đã bỏ thì xoá cả block; nếu không thì chỉ xoá **dòng assertion**
nào nêu agent đã bỏ, giữ lại các assertion claude/codex trong cùng test. Nhờ vậy các test
"mixed" như `still accepts legitimate idle/working titles` vẫn giữ được phần `Codex done`.

### Phát hiện quan trọng: roster commit có nhiều substitution sai

`a69dac5` đã đổi **212 chỗ** `agent: '<retired>'` → `agent: 'claude'` trên 205 file test.
Cách đổi mù này tạo ra test **khẳng định điều không thể đúng**, vì agent thay thế có config
khác. Đã tìm và sửa 3 ca:

1. `agent-paste-draft.test.ts` — "keeps the render-quiet wait": gốc dùng `gemini`, đổi sang
   `claude`. Nhưng claude có `draftPromptFlag: '--prefill'` nên
   `agentDeliversDraftViaNativePrefill` return sớm, **không bao giờ tới** đoạn render-quiet.
   Sửa: thêm `forcePaste: true` — đường duy nhất còn tới được path đó.
2. `native-chat-initial-view-mode.test.ts` — "returns undefined for unsupported agents"
   nhưng truyền `claude` (agent **được** support). Sửa: dùng `undefined`.
3. `tab-agent.test.ts` — còn lại body không có assertion sau khi cắt.

Bài học: các test còn lại trong ~63 file nên được kiểm bằng **đọc, không phải grep** —
substitution mù là nguồn lỗi âm thầm, typecheck không bắt được.

### Đã sửa một bug thật do roster để lại

`NATIVE_CHAT_SUPPORTED_AGENTS` vẫn còn `openclaude` sau khi agent bị xoá, kéo theo
`resolveNativeChatTranscriptAgent` giữ nhánh alias chết. Đã xoá cả hai + test tương ứng.

### 65 fail còn lại ở `src/main` phần lớn KHÔNG phải roster

Đã verify bằng cách `git stash` toàn bộ thay đổi của mình rồi chạy lại:

| Nhóm | Số fail | Nguyên nhân | Pre-existing? |
|---|---:|---|---|
| `worktree-base-directory-watcher`, `ephemeral-vm`, `filesystem-watcher-*` | 30 | `spawn /bin/sh ENOENT` — cần POSIX shell, không có trên Windows | **Có** (verify bằng stash) |
| `rate-limits/service` | 8 | assert `allowPtyFallback: true`, nhưng `shouldAllowClaudePtyFallback` return `false` khi `win32` | **Có** (verify bằng stash) |
| còn lại | ~27 | chưa phân loại | chưa rõ |

Tức là cùng một class với 4 fail của `src/shared`: **test giả định môi trường POSIX/en-US**,
chạy trên Windows thì đỏ. Trên CI Linux sẽ xanh.

## Build đã vỡ mà không gate nào bắt được (2026-08-04, lượt 3)

Kiểm tra trạng thái dự án thì phát hiện **`pnpm run build:electron-vite` fail** — chưa ai
biết vì sau roster reduction không ai chạy build.

```
[UNRESOLVED_ENTRY] Cannot resolve entry module
  src/main/ai-vault/session-scanner-opencode-sqlite-worker-entry.ts
```

Roster reduction xoá file worker OpenCode nhưng để lại entry trong `electron.vite.config.ts:205`.

**Vì sao typecheck + lint + 15,000 test đều xanh mà build vỡ:** không gate nào đọc
bundler entry map. `tsc` chỉ theo import graph từ source; vitest không build production.
Entry mồ côi là vùng mù hoàn toàn.

Đã sửa (`41efdbe`) và quét lại toàn bộ: 10/10 entry trong `electron.vite.config.ts` giờ đều tồn tại.

### Config packaging cũng còn rác

`config/electron-builder.config.cjs` còn 7 glob `asarUnpack` trỏ tới thư mục agent đã xoá
(`antigravity`, `copilot`, `cursor`, `droid`, `gemini`, `grok`, `hermes`). Đây là **no-op im lặng**,
không gây lỗi build — nên càng khó phát hiện. Đã xoá (`4f27929`).

### Trạng thái build sau khi sửa

| Bước | Kết quả |
|---|---|
| `build:electron-vite` | **PASS** (main + preload + renderer) |
| `build:relay` | **PASS** (darwin-x64/arm64, win32-x64/arm64, WSL) |
| `build:desktop` | **PASS** end-to-end, web projection 763 file / 39.9 MiB |
| `electron-builder-config.test.mjs` | **PASS** 25/25 |

Khuyến nghị: thêm `pnpm run build:desktop` vào gate trước khi merge. Typecheck xanh
**không** chứng minh build được — đây là bằng chứng cụ thể.

### Sửa lại 2 ước lượng sai trong plan

**Phase 06 "5-6 tuần" quá cao.** Account switcher **đã tồn tại**:
`src/main/codex-accounts/` (17 file) và `src/main/claude-accounts/`, tổng ~68 file liên quan.
Việc còn lại là API profile/vault (chỉ 7 file match), không phải xây từ đầu.

**Phase 02 mobile trong `src/` chỉ còn 32 file**, không phải 162 như báo cáo lượt trước —
branch đã dọn thêm.

### Chưa ai kiểm chứng (rủi ro còn lại lớn nhất)

- **App chưa từng được launch** sau khi cắt CLI + orchestration + 35 agent. Build xanh
  không chứng minh app khởi động được.
- **274 file e2e** chưa chạy lần nào.
- `windows-native-registry` không rebuild được → sẽ chặn launch Electron trên máy này.
- Telemetry/updater (106 file) vẫn trỏ `stablyai/orca`.

## Khuyến nghị đã cập nhật

1. **Không** tiếp tục Phase 03/04/05 trên `main`.
2. Tiếp tục trên worktree `codex/aio-ade-implementation`, nơi Phase 04 đang dở.
3. Commit hoặc dọn 470 thay đổi chưa commit ở đó trước khi thêm việc mới —
   hiện không thể phân biệt đâu là ý định và đâu là dở dang.
4. Port 2 tài liệu từ `main` sang branch (baseline inventory, token classification)
   vì chúng vẫn đúng và branch chưa có.
5. Cập nhật `plan.md` để trỏ tới branch, tránh người/agent sau lại làm lại lần ba.

## Hư hại do disk-full lan sang worktree

Worktree cũng mất `resources/build/` (5 file: icon.icns, icon.ico, icon.png,
entitlements.mac.plist, entitlements.computer-use.mac.plist) — cùng nguyên nhân
disk 99% full. Đã `git checkout -- resources/build/` restore ở **cả hai** nơi.

`node_modules/.bin` của worktree cũng rỗng, `pnpm lint` fail với
`'oxlint' is not recognized`. Đã chạy lại install.

## Câu hỏi chưa giải quyết

- 470 thay đổi chưa commit trong worktree: commit thành Phase 04 hay bỏ?
- Stash `da62fd6` còn cần không, hay đã bị 470 thay đổi kia bao trùm?
- Branch có commit `20b784a` "tauri migration roadmap" — có định đổi Electron sang Tauri không? Plan hiện tại không có phase nào cho việc đó.
- Merge branch về `main` khi nào, hay `main` chỉ giữ docs?
