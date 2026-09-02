---
phase: 5
title: "Rebrand Orca thành aio-ade"
status: completed
priority: P1
effort: "3-5d"
dependencies: [4]
---

# Phase 05: Rebrand Orca thành aio-ade

## Overview

Đổi brand, binary, app identifiers, artifact names, docs và author metadata thành aio-ade, Keepmeside, SalyyS1. Giữ legacy read/migrate compatibility đủ lâu để không logout hoặc mất workspace.

## Requirements

- Functional: user-visible product, package, installer, protocol, CLI bridge, docs, telemetry labels, website links và release assets dùng aio-ade.
- Functional: migrate `.orca`/Orca auth/workspace/cache paths sang aio-ade an toàn; preserve old paths chỉ làm source đọc một lần hoặc uninstall cleanup.
- Non-functional: no raw secret/log path leakage; copyright/NOTICE phản ánh upstream và authorship thật.

## Related Code Files

- Modify: `package.json`, `README.md`, `LICENSE`/NOTICE, `resources/`, `config/electron-builder.config.cjs`, `src/shared/orca-cli-command-name.ts`, app/userData identifiers, localization, `.github/` workflows.
- Compatibility: plugin manifest/wire contracts (`orca-plugin.json`, `engines.orca`, `orca-panel-*`, frame prefixes, marketplace/bundled hashes) phải dual-read/accept-both trước khi switch canonical name. Panel bridge constant, main navigation guard, renderer iframe name và shell placeholders phải đổi atomically.
- Separate migration: existing Orca Profiles cloud/storage/UI subsystem và native chat agent profiles không phải `AgentAuthProfile`; migrate identity riêng.
- Rename: files/dirs có `orca` trong tên chỉ khi không phá migration; update imports and generated manifests.
- Add: migration/version marker, legacy path tests, brand scan report.
- Create: **NOTICE / third-party-notices** — repo hiện chưa có file nào. Phase này là owner tạo nó (nó thuộc attribution của rebrand); phase 07 và 10 append vào cùng path, phase 08 chỉ verify nội dung. Phải giữ dòng copyright upstream (MIT, Copyright (c) 2026 Lovecast Inc.).

## Implementation Steps

1. Tạo canonical brand tokens và mapping. **Hai token, không một:** display/product name là **`AIO-ADE`** (uppercase — productName, window title, About dialog, README, installer title), machine token là **`aio-ade`** (lowercase — binary/CLI, artifact name, appId `com.keepmeside.aio-ade`, package name). Org/author `stablyai` → `keepmeside`. Phân biệt code symbol internal với user-visible copy.
2. Viết compatibility readers/writers cho plugin manifest, panel bridge, account markers, Keychain service và existing profile identities; verify old plugins/accounts/workspaces trước khi đổi app identity.
3. Đổi package name/homepage/author/bin/appId/artifact names/icon metadata; `stablyai` → `keepmeside`, guard `stablyai/orca` → `keepmeside/aio-ade-platform`. **Release workflow: bỏ RC channel, chỉ stable, manual dispatch, không auto-tag** (quyết định 2026-08-21). **Ship unsigned ở bản đầu** (chưa có cert) — chấp nhận SmartScreen/Gatekeeper cảnh báo; **updater phải tắt** vì kênh chưa xác thực. **Telemetry/diagnostics chuyển sang endpoint Keepmeside, bỏ update check** — chỉ bật sau khi có privacy policy, opt-in/opt-out UI và redaction tests.
4. Implement one-way data copy/migration for userData, account marker files, settings and dev config; never move arbitrary symlinks. **Lưu ý quan trọng:** quyết định "không alias" chỉ áp cho **binary/PATH**, KHÔNG áp cho data migration — reader cho `~/.orca`, Keychain service cũ, plugin manifest/panel-bridge token cũ **phải giữ**, nếu không user cũ mất account và workspace.
5. Rewrite README/docs/skills and remove Orca marketing links; retain attribution/third-party notices.
6. Run contract-aware scan. Remaining `orca` tokens require classification: migration alias, wire compatibility, upstream copyright, internal module not yet safe to rename, or bug.

## Success Criteria

- [x] New install shows **AIO-ADE** (display) và artifacts là `aio-ade-*` (machine token) — `package.json` `name: aio-ade` + `productName: AIO-ADE`; `electron-builder` appId `com.keepmeside.aio-ade`, artifact `aio-ade-windows-setup.exe` / `aio-ade-macos-${arch}` / `aio-ade-linux[-arm64]` / `aio-ade_${version}_${arch}.deb`. Pin bằng `src/shared/brand-token-contract.test.ts`. *(deferred-verification: build thật cần CI matrix 3 OS — phase 12)*
- [x] Existing Claude/Codex OAuth accounts and workspaces load without silent logout — `src/main/legacy-user-data-adoption.ts` copy userData cũ (`orca-data.json`, `profiles/`, `claude-accounts`, `codex-accounts`, …) trước read đầu tiên; 9 test trong `legacy-user-data-adoption.test.ts`. **Cố ý KHÔNG copy `*.enc`**: safeStorage key dẫn xuất từ app name nên ciphertext cũ không giải mã được — copy sẽ biến "thiếu credential" thành "lỗi giải mã"
- [x] User-visible scan has zero legacy Orca token — `brand-token-contract.test.ts` bắt mọi occurrence còn lại phải được **classify** (`legacy-data-read` / `wire-compat` / `upstream-owned` / `screen-reader` / `generated`); chỉ ship binary `aio-ade`, không alias; `LEGACY_CLI_COMMAND_NAMES` giữ để reclaim symlink cũ và có inverse-guard chống sweep xoá reader. *(Tick này **sai** khi đặt lần đầu: scan đang đỏ. Verify thật 2026-09-02 — xem mục "Full suite: kết quả thật".)*
- [x] NOTICE/third-party-notices tồn tại và giữ copyright upstream Lovecast Inc. — `NOTICE` ở root, pin bằng `src/shared/attribution-notice.test.ts`
- [x] macOS/Windows/Linux build metadata agree on one product identity; **chỉ có stable channel**, không RC — `Casks/orca@rc.rb` đã xoá, `Casks/aio-ade.rb` mới; `homebrew-bump.yml` từ chối tag không phải `vX.Y.Z`; job `homebrew-bump-published-rc-draft` đã bỏ. *(deferred-verification: build thật ở phase 12)*
- [x] Không production traffic hoặc publish target nào còn trỏ tới `stablyai/orca`, `onorca.dev` hay upstream PostHog — `TELEMETRY_ENABLED = false` (inert có chủ đích, không phải nhờ thiếu CI secret), `TELEMETRY_INGEST_HOST` trỏ `telemetry.aio-ade.keepmeside.dev`; 0 occurrence `i.posthog.com` trong shipped source
- [x] **Updater tắt** — `src/main/updater-distribution-gate.ts`: `UPDATE_CHANNEL_AUTHENTICATED = false` chặn mọi entry point (setup, menu check, nudge, remote-server support). Lý do là **signing state**, không phải preference: kênh update không xác thực được thì tệ hơn không có updater. Có test-only override để 10 updater suite vẫn phủ được machinery phía sau gate
- [x] Artifact unsigned được document rõ trong README kèm hướng dẫn bypass Gatekeeper (`right-click → Open` / `xattr -d com.apple.quarantine`), SmartScreen trên Windows, và `caveats` trong cask; `.github/CONTRIBUTING.md` bỏ hướng dẫn RC channel
- [x] Old/new plugin manifest và wire-token compatibility — identity gate nhận **cả hai họ** publisher/prefix (`stablyai`+`orca-` và `keepmeside`+`aio-ade-`), panel bridge nhận cả hai dialect và **trả lời đúng dialect của request**, `orca-plugin-tree-v1` giữ nguyên (preimage của content hash = tên thư mục install). 58 test file plugin xanh

## Risk Assessment

Mass rename can collide with orchestration symbols and legacy paths. Mitigation: roster/CLI first, chokepoint mapping, migration tests, separate commit, no blind global replace.

## Tiến độ

Thứ tự theo `research/baseline/coupling-brand-token.md`: dual-read reader cho **D**, **E**, **G** trước, khi tên cũ vẫn là tên duy nhất. Sau đó mới rename các class tự-kiểm (A, B, C, H, I, J).

### Class E — Keychain service (xong)

`src/main/claude-accounts/keychain.ts`: canonical write `AIO-ADE Claude Code Managed Credentials`, read fallback + delete cả `Orca Claude Code Managed Credentials`. `Claude Code-credentials` **không đổi** (upstream Claude Code sở hữu, scope bằng `sha256(CLAUDE_CONFIG_DIR)`). Test: `keychain.test.ts` pin 4 tính chất (read canonical, read fallback, write chỉ canonical, delete cả hai).

### Class D — filesystem data path (xong phần user data)

Module mới:

| Module | Vai trò |
|---|---|
| `src/shared/app-home-paths.ts` | `~/.aio-ade` canonical, `~/.orca` legacy; join local + POSIX-remote, trả candidate list |
| `src/shared/app-home-dir-resolution.ts` | Read-side resolve cho process không chạy được migration (relay deploy trên remote, CLI) |
| `src/main/legacy-app-home-adoption.ts` | One-way copy `~/.orca` → `~/.aio-ade`, allowlist entry durable, bỏ qua symlink, marker chạy một lần; gọi ở startup trước mọi lazy read |
| `src/shared/repo-app-paths.ts` | In-repo `.aio-ade/` + `aio-ade.yaml`, legacy `.orca/` + `orca.yaml`; renderer-safe, join bằng `/` |
| `src/main/remote-project-config-read.ts` | Đọc project config qua SSH, canonical trước rồi fallback |
| `src/main/claude-accounts/managed-auth-marker.ts` | Marker chủ quyền managed auth dir, đọc cả hai tên, write canonical, có bản shell test cho remote/WSL |

Đã chuyển sang module chung: keybindings, jira, linear, speech API key, claude-agent-teams shim, agent-hook installer + install lock, relay session snapshot, hook script remote/WSL, in-repo `issue-command`/`templates`/`drops`, gitignore writer (local + remote), CLI `vm` handler.

Adopt (durable, copy sang root mới): `keybindings.json`, `jira-sites.json`, `jira-tokens`, `linear-token.enc`, `linear-viewer.json`, `linear-workspaces.json`, `linear-tokens`, `openai-speech-token.enc`, `sessions`.
Không adopt (app tự tạo lại): `agent-hooks`, `claude-agent-teams-bin`, install lock. Hook config matcher khớp theo `agent-hooks/<file>` nên entry cũ vẫn bị quét sạch dù đổi thư mục cha.

`src/main/legacy-orca-data-path-preflight.test.ts` đã viết lại: thay vì pin literal `.orca`, giờ pin **hợp đồng dual-read** (candidate order, adopt-set vs regenerate-set, mọi store phải đi qua module chung).

4 locale value bị sai do thay đổi này đã sửa ở cả 5 ngôn ngữ (`~/.orca` → `~/.aio-ade`). 22 key hiển thị `orca.yaml` **không sửa**: file đó vẫn được đọc thật nên copy chưa sai — thuộc class A ở bước rename.

#### Class G — plugin manifest và panel-bridge token (xong)

`src/shared/plugins/plugin-brand-tokens.ts` sở hữu mọi tên hướng ra tác giả plugin:

| Token | Canonical | Vẫn đọc được |
|---|---|---|
| Manifest file | `aio-ade-plugin.json` | `orca-plugin.json` |
| Marketplace index | `aio-ade-marketplace.json` | `orca-marketplace.json` |
| `engines` key | `aio-ade` | `orca` |

`engines` được chuẩn hoá bằng một zod `preprocess` nên mọi consumer chỉ thấy một shape; đọc qua `getPluginHostVersionRange()`. Reader nhận cả hai tên: `resolvePluginManifestPath`/`hasPluginManifest`, marketplace fetch, install từ local path, `verify-packaged-plugin-resources.cjs`, và error presentation.

Identity gate (`isOfficialPluginIdentity` / `isReservedPluginIdentity` / `isOfficialOrganizationGitSource`) nhận **cả hai họ token**: `stablyai` + `orca-` và `keepmeside` + `aio-ade-`. Lý do: plugin key là identity **được persist** — nó là tên thư mục install và là thứ `disabledPlugins` lưu. Nếu gate chỉ biết một họ, sau khi đổi publisher token thì một official plugin đang cài sẽ không còn được nhận là official, và lựa chọn disable của user không còn khớp.

Panel bridge:

| Token | Xử lý | Vì sao |
|---|---|---|
| `PANEL_ACTION_REQUEST_TYPE` | nhận cả hai | do code panel của plugin tự gửi |
| `PANEL_ACTION_RESULT_TYPE` | trả lời đúng dialect của request (`resolvePanelActionResultType`), kể cả reply lúc budget refuse | panel filter reply theo `type`; trả sai dialect thì panel cũ không bao giờ nhận được, kể cả thông báo rate-limit |
| ping/pong, frame-name prefix, shell placeholder | đổi thẳng | host tự sinh shell script và tự đọc frame name — hai đầu ship cùng nhau, không có nợ tương thích |

Bundled resource đã rename và `contentHash` regenerate (`ce3a146b` → `6e982430`).

**Không đổi:** domain tag `orca-plugin-tree-v1` trong `plugin-content-hash.ts`. Nó là preimage của content hash, mà hash chính là tên thư mục install và entry trong lockfile — đổi tag làm mọi plugin đang cài mất địa chỉ.

### NOTICE (xong)

`NOTICE` ở repo root: giữ nguyên `MIT License` + `Copyright (c) 2026 Lovecast Inc.`, ghi AIO-ADE với Keepmeside và SalyyS1, bảng 21 runtime component kèm license, nêu rõ component Apache-2.0 (`sherpa-onnx`, `agent-browser`, `serve-sim`) phải giữ NOTICE riêng trong bundle, và ghi MIT không cấp quyền trademark.

`package.json` thêm `license: MIT`, `author: Keepmeside`, `contributors: [Keepmeside, SalyyS1]` — đồng thời đóng luôn gate item của phase 08 về `"license": "MIT"`.

`src/shared/attribution-notice.test.ts` pin dòng copyright upstream ở cả NOTICE và LICENSE cùng các field manifest, để một lần sweep brand sau này không xoá được chúng trong im lặng.

## Hoãn có lý do

Ba dòng dưới đây **đã đóng** trong lượt rename cuối (class A/B/C/H/I/J):

| Việc | Vì sao hoãn | Kết quả |
|---|---|---|
| userData dir, `orca-data.json`, `~/.config/orca` | Thư mục userData chỉ di chuyển khi `package.json` `name` / `app.setName` đổi. Rename file data trước khi thư mục đổi sẽ xếp hai lớp "legacy" lên cùng một file | **Xong.** `src/shared/user-data-dir-names.ts` tách hai nghĩa: `PRE_PROFILE_*` (layout trước profiles) vs `LEGACY_USER_DATA_*` (spelling trước rebrand); `legacy-user-data-adoption.ts` copy một chiều trước read đầu tiên |
| `~/.orca-relay`, `~/.orca-remote`, `.orca-wsl` | Không chứa user data — mọi entry deploy lại theo version | **Xong** cùng bước rename class B |
| `.orca-session-copies`, `.orca-config-settings-baseline.json`, `.orca-hook-trust-provenance.json`, `.orca-resource-copies`, `.orca-backfill-*`, `.orca-apfs-clone-*`, `.orca-wsl-cli.lock`, `.orca.localhost` | Marker/temp/cache nội bộ, tự tạo lại | **Xong** ở class I / H |

## Rename: 7 vị trí token mà rule `\b` không thấy

Ghi lại vì mỗi lỗi đều **im lặng trong diff** — compiler hoặc test bắt, không phải review:

| Vị trí | Ví dụ | Vì sao rule không thấy |
|---|---|---|
| Giữa identifier | `parseOrcaYaml`, `trustedOrcaHooks` | không có word boundary trước `Orca` (254 symbol) |
| Cạnh `_` | `LEGACY_ORCA_PROFILE_NAME`, `orca_telemetry_disabled` | `_` là word char nên `\bORCA\b` không khớp |
| Sau escape sequence | `'\r\x1b[Korca % '`, `'\nORCA-NPTY-PROBE-OK'` | `\n`, `K`, `m` đều là word char |
| Separator bị escape | `stablyai\/orca` (regex), `keepmeside%2Forca` (URL) | owner và repo bị rename độc lập → mất suffix `-platform`, pattern không khớp release URL thật |
| Vị trí identifier của kebab token | `function activate(orca)`, `engines: { orca: … }`, `bin?.orca` | `aio-ade` có hyphen → syntax error hoặc `ReferenceError` |
| Slug tách thành nhiều argument | `githubRepo('id', 'stablyai', 'orca')` | rule literal `stablyai/orca` không thấy hai argument rời |
| Case variant bị freeze | freeze `StablyAI` nhưng rename `stablyai` | phá fixture cố ý ghép hai casing để test grouping case-insensitive |

**Scan phải case-sensitive** (`orca|Orca|ORCA`): `errorCategory`, `onErrorCallback`, `forCache` đều chứa bốn chữ đó — match case-insensitive làm scan đỏ vĩnh viễn vì lý do không rename được.

## Lớp lỗi thứ hai: hằng số **đi kèm** token, không phải token (phát hiện 2026-09-02)

Bảy vị trí trên là chỗ rename **không chạy**. Lớp này ngược lại: rename chạy **đúng**, nhưng một con số gắn với độ dài/vị trí của token cũ thì không đổi theo. `orca` (4 ký tự) → `aio-ade` (7) lệch **+3** mỗi lần xuất hiện, nên mọi offset, độ dài, biên wrap và slug phái sinh đi kèm đều sai lệch trong im lặng.

Đặc điểm: **`lint` và `typecheck` không bắt được lớp này** — code hợp lệ, chỉ có giá trị mong đợi là sai. Chỉ full suite bắt được. Đây chính là lý do 23 test đỏ tồn tại sau khi phase 05 tự đánh dấu 9/9 success criteria.

| Dạng | Ví dụ thật | Sai thành |
|---|---|---|
| Offset highlight trong tên đã đổi | `repoRange` của `keepmeside/aio-ade-platform` | `{9,13}` (từ `stablyai/orca`) thay vì `{11,18}` |
| Độ dài path/URL | `new URL(...).pathname` của fixture chứa slug | `88`→`91`, `811`→`814` |
| Ngân sách byte đúng bằng độ dài chuỗi cũ | `isRuntimeProviderSearchQueryWithinLimit('project = AIO_ADE', 14)` | `14` là độ dài `project = ORCA`; chuỗi mới 17 byte |
| Danh sách index phủ tên | `<MatchedText text="aio-ade" hits={[0,1,2,3]} />` | chỉ tô `aio-` |
| Token bị cắt qua nhiều phần tử array | row buffer 15 ký tự: `'/private/tmp/or'` + `'ca-setup-e2e.hO'` | fixture vẫn dựng lại path `orca` trong khi assertion đã là `aio-ade` |
| Slug phái sinh từ URL | clone `…/aio-ade-platform.git` tạo thư mục `aio-ade-platform` | expectation giữ `aio-ade`, mất `-platform` (5 assertion ở 2 file) |
| Alias trùng sau rename | `detectCmdAliases: ['orca-dev', 'orca-ide']` | `orca-ide` → `aio-ade` trùng `detectCmd`, thành dead data |

**Cách sửa đã dùng:** không hardcode số mới, mà **dẫn xuất từ fixture** (`name.indexOf(query)`, `[...name].map((_, i) => i)`, `line.indexOf(taskId)`, slice row từ chính path). Chỗ nào ý định thật là "đủ dài để wrap" thì đổi sang quan hệ (`toBeGreaterThan(COLS * 5)`) chứ không phải một literal mới sẽ hỏng lần rename sau.

## Việc còn lại của phase 05

- `pnpm lint` (8 gate) và `pnpm typecheck` (3 project): **xanh**.
- `pnpm test` full suite: **đã chạy và đã đóng 2026-09-02.** Xem mục dưới.
- Build desktop thật: defer phase 12 theo `deferred-verification.md`.

## Full suite: kết quả thật (2026-09-02)

**Kết quả cuối: xanh — `3.729 file passed | 12 skipped (3.741)`, `38.953 test passed | 148 skipped (39.101)`, exit 0**, dưới Node 24 (`.nvmrc`). Node 25 (default của máy) tạo ~40 failure localStorage ảo — luôn `nvm use 24` trước khi đo.

Dòng "lần chạy cuối vẫn đang chạy" trước đó **không phải là xanh**. Chạy full suite dưới Node 24 hai lần cho kết quả giống nhau: **23 test đỏ / 16 file** (3.712 file xanh, 38.916 test xanh). Deterministic, không phải flake. Phân loại:

**(a) 3 defect production thật — không phải expectation cũ:**

| Chỗ | Lỗi | Hệ quả |
|---|---|---|
| `src/shared/aio-ade-profiles.ts` | default profile vẫn mint partition `persist:orca-browser-session-…`, trong khi `browser-session-registry.ts:49` validate `persist:aio-ade-browser-session-…` | `isProfileOwnedSessionPartition` là **security control** (`will-attach-webview` dùng nó để renderer bị compromise không tuồn được partition tuỳ ý). Bên tạo và bên gác không khớp → mọi session default profile tạo ra đều bị chính guard của nó từ chối. Đã sửa: cả hai dẫn xuất từ một constant export duy nhất |
| `src/shared/brand-token-contract.test.ts` | scan brand — **guard load-bearing của phase này** — đang **đỏ**: 1 file chưa classify (`mobile-e2ee-v2-fixtures.ts`, comment giải thích golden vector recompute khi đổi protocol label) | Success criterion "zero legacy token" đã tick `[x]` trong lúc test của nó đỏ. Đồng thời allowlist chứa entry sai: nó khai `aio-ade-profiles.ts` "reads the pre-rebrand partition so existing sessions still resolve" — file đó **không đọc**, nó **ghi**, và lời biện hộ sai đó chính là thứ cho bug ở hàng trên đi qua scan. Đã xoá entry, đã classify file kia |
| `src/shared/tui-agent-config.ts` | `detectCmdAliases: ['aio-ade-dev', 'aio-ade']` — `orca-ide` (binary Linux thứ hai để tránh GNOME Orca) rename thành trùng `detectCmd` | Dead data dưới quyết định "không alias"; `getTuiAgentDetectionProbeCommands` dedup nên không đổi hành vi, nhưng bảng expectation có một entry ma. Đã xoá |

**(b) 17 expectation gắn cứng vào độ dài/offset/slug của token** — xem mục "Lớp lỗi thứ hai" ở trên. Sửa bằng cách dẫn xuất từ fixture, không hardcode số mới.

**(c) 1 artifact build stale:** `wsl-hook-relay-live.integration.test.ts` chạy bundle `out/relay/wsl/` build **28-08**, tức trước rebrand, vì `beforeAll` chỉ rebuild khi file **thiếu**, không khi **cũ**. Bundle guest ghi path cũ trong khi assertion host đã đúng — một false failure đọc y như failure thật. Đã sửa: so mtime bundle với `src/relay` + `src/shared`. Lưu ý CI không có `out/` nên luôn build mới; lỗ hổng này **chỉ tồn tại local** — đúng chỗ mà verification của phase 01-05 đang diễn ra.

**(d) 1 timeout do tải, không do rename:** `project-view-wrapper-source-context-boundary.test.ts` import động `ProjectViewWrapper` để lấy `buildProjectWorkItem`; transform cả module graph mất **15,8s trên máy rảnh**, dưới 30s khi chạy riêng nhưng quá 30s khi full suite chiếm hết core. Đã nâng timeout của case đó lên 90s kèm số đo. (Sửa gốc là tách `buildProjectWorkItem` ra module riêng — thuộc phase 09.)
