# Phase 03: product CLI va orchestration removal

- Hoan thanh: 2026-08-01
- Branch: `codex/aio-ade-implementation`
- Trang thai: completed

## Ket qua

- Xoa `src/cli`, Agent Teams, orchestration bridge, headless `serve`, installers va shims; khong them alias CLI moi.
- Giu generic PTY/xterm, headless emulator, local/SSH/WSL providers, remote runtime, file/editor, native Computer Use va native Linear runtime.
- Loai bo skill/CTA va package global cho `computer-use`, `linear-tickets`, `orca-linear`; manifest hien tai chi con `orca-per-workspace-env`.
- Them legacy CLI cleanup theo platform: macOS/Linux symlink/AppImage/bare-dispatcher, macOS privilege fallback, Windows User PATH/WSL cleanup, startup retry marker.
- Cap nhat ghost recovery va localization; giu snapshot history doc duoc va restore `release-mapping.json` byte-for-byte.

## Verification

| Gate | Ket qua |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` + reliability/max-lines/localization gates | pass; 46 reliability gates, 323 grandfathered suppressions, khong them bypass |
| `pnpm build:desktop` | pass; relay, Electron/Vite va projected web client build |
| Focused reviewer suites | 18 files, 195 passed, 5 skipped |
| Cleanup/worktree focused tests | 231 passed |
| `git diff --check` | pass |

## Known limitations

- Baseline khong lien quan: Windows `git init //./nul` fail tai `src/main/skills/skill-git-tree-identity.test.ts:54`.
- Release roundtrip chua verify day du vi tag `v1.4.151-rc.2` khong co local.
- Residual advisory risks: lineage co the stale truoc scan moi; macOS privilege denial co the prompt lai; Windows process PATH co the giu entry cu; Linux bare-dispatcher marker content-based.

## Cac cau hoi chua giai quyet

- Khong co blocker cho Phase 03; cac residual risk tren duoc giu lai theo quyet dinh cleanup/retry/security hien tai va se xem lai neu scope thay doi.
