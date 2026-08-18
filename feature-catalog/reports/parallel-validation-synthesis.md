# Parallel validation synthesis

## Summary

Ba audit read-only kiểm tra repo hiện tại, CCS `v8.8.1` và tldraw SDK/offline. Hướng plan đúng, nhưng cần compatibility-first rebrand, split CLI bridge/headless serve, split profile 06A/06B và publish HTML sớm.

## Verified findings

### Repo hiện tại

- `TuiAgent` thực tế có 35 member; mục tiêu 35 xuống 2 trong plan đúng.
- Persistence đọc `JSON.parse`; `disabledTuiAgents` và launch args/env đã normalize một phần. Gap thật nằm ở default agent, command overrides, selected/discovered model maps, host-scoped maps, saved sessions và RPC inputs.
- `mobile/` khác generic web/SSH runtime. Không xoá `build:web*`, renderer web hoặc remote RPC chỉ vì xoá mobile companion.
- CLI orchestration bridge là load-bearing; headless `serve` là decision riêng.
- Plugin manifests/wire messages và existing Orca Profiles là compatibility contracts cần dual-read trước rebrand.

### CCS

- Source: `kaitranntt/ccs` tag/main `v8.8.1`, commit `51e8716630cdcb5774d7ff243bf2303ed7f1e2fd`, MIT.
- Insight dùng được: account/API-profile split, versioned tolerant metadata, compatibility checks, doctor, quota vocabulary, Windows junction/copy fallback.
- Không copy: plaintext `*.settings.json`, CLI argv secrets, dashboard, Docker, CLIProxy broker, single global default.
- Generic API profile không phải native Codex custom-provider implementation. Aio-IDE phải materialize Codex `CODEX_HOME`/`config.toml` bằng service riêng.
- Phase 06 cần 06A manual secure switching và 06B routing/auto-recovery; tổng effort thực tế khoảng 5 đến 6 tuần.

### tldraw và canvas

- tldraw SDK `5.2.5` peer-compatible React 18/19; production cần trial/commercial/hobby key. Hobby non-commercial và giữ watermark.
- Key validate client-side và dùng offline. Commercial/hobby không gửi dữ liệu; trial chỉ ping license-key hash theo docs.
- Default MIT distribution vẫn no-go nếu không có negotiated downstream/redistribution terms.
- Khuyến nghị Excalidraw `0.18.0` trước; XYFlow `12.11.2` deferred cho live topology. Không ship hai canvas runtimes trong MVP.
- Canvas file IO phải dùng host-aware API với `connectionId`, hỗ trợ local worktree, folder workspace và SSH; không gọi local Electron fs trực tiếp.

## Plan changes applied

- Phase 02 giữ generic web/SSH runtime khi còn consumer.
- Phase 03 thêm headless `serve` decision và dual legacy/new command aliases.
- Phase 04 sửa persistence assumptions và mở rộng roster-key sanitization.
- Phase 05 thêm plugin/profile/data compatibility trước switch app identity.
- Phase 06 split 06A/06B, dedicated IPC/vault, provider-specific Claude/Codex resolver, SSH secret boundary.
- Phase 07 Excalidraw-first, XYFlow deferred, tldraw production-key gate, accessibility/offline/SSH acceptance criteria.
- Phase 08 publish roadmap ngay sau preflight, main-only workflow, self-contained artifact không link private files.

## Recommendations

1. Approve CLI bridge, Agent Teams và headless serve như ba quyết định độc lập.
2. Ship account/profile MVP local + WSL trước; giữ SSH API secret unsupported cho tới khi có remote vault/provisioning contract.
3. Dùng CCS importer read-only chỉ nếu user thật sự cần migrate; không biến CCS thành runtime dependency.
4. Public plan bằng private Pages nếu GitHub plan cho phép. Nếu không, xin approval trước khi tạo repo public riêng.
5. Không bắt đầu implementation phase 01 đến 07 trước khi decision log được duyệt.

## Sources

- https://github.com/kaitranntt/ccs/tree/v8.8.1
- https://tldraw.dev/community/license
- https://tldraw.dev/pricing
- https://github.com/excalidraw/excalidraw
- https://github.com/xyflow/xyflow

## Unresolved questions

- SSH secret provisioning trong MVP hay deferred?
- Có cần read-only CCS importer?
- Headless `serve` còn là product requirement?
- Legacy command/plugin/path compatibility giữ bao nhiêu release?
