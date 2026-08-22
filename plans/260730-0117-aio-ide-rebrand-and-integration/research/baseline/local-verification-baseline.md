# Local verification baseline (phase 01)

Generated 2026-08-22 at commit `0304a365` plus the phase-01 test-harness fixes in this commit.

This is the gate that replaces CI for phases 01-05 (repo private, Actions billing-blocked).

## Host

| Item | Value |
|---|---|
| OS | Ubuntu 22.04.5 LTS, kernel 5.15.0-176, x86_64 |
| CPU / RAM | Intel Xeon Gold 6258R, 31.4 GiB |
| Node | **24.19.0** via nvm (see "Node pin" below) |
| pnpm | 10.24.0 |
| git | 2.34.1 (see "Git floor" below) |
| gitleaks | 8.30.1 at `~/.local/bin` |

## Results

| Gate | Command | Result | Log |
|---|---|---|---|
| Lint | `pnpm lint` | **exit 0** | `lint.md` |
| Typecheck | `pnpm typecheck` (node + cli + web) | **exit 0** | `typecheck.md` |
| Tests | full vitest suite | **2 failed / 39869 passed / 155 skipped**, exit 1 | `test-node24-after-fixes.summary.md` |
| Secret scan | `gitleaks git . --log-opts=--all` | 75 findings, 0 needing rotation; 0 residual under the proposed allowlist | `secret-scan-triage.md` |
| Build desktop | `pnpm build:desktop` | **exit 0** (typecheck + relay + cli + electron-vite + web client, 768 files / 40.5 MiB) | `build-desktop.summary.md` |

## Node pin: the box was on the wrong major

`package.json` pins `engines.node: "24"`. The box defaulted to Node 25.9.0, and the first full run
reported **47 failures**. 41 of those were a single Node-25 behavior change: Node 25 exposes a
partial `localStorage` global, so `happy-dom` no longer installs its own, and any test calling
`window.localStorage.removeItem/clear/getItem` throws `is not a function`.

Installing Node 24.19.0 and re-running dropped the count from 47 to 6 with no source changes.

**Consequence for the plan:** every phase 01-05 local gate must run on Node 24. Verifying on the
host default silently invents dozens of failures that do not exist on the pinned runtime. Logs
`test.summary.md` (Node 25, 47 failures) and `test-node24.summary.md` (Node 24, 6 failures) are both kept as the
evidence for this.

## The 6 Node-24 failures, root-caused

| # | Test | Root cause | Action taken |
|---|---|---|---|
| 1-2 | `src/main/git/worktree-list-paths.test.ts` — newline-path worktrees | Host git is **2.34.1**; newline-safe paths require `git worktree list --porcelain -z`, added in **2.36**. The documented fallback (line parser) *cannot* represent a newline path, so these tests assert preferred-path behavior that this host cannot provide. Verified directly: `git worktree list --porcelain -z` exits 129 `unknown switch 'z'` | Added `src/shared/git-worktree-list-z-probe.ts` and gated both tests on the capability, matching `docs/reference/git-compatibility.md` ("do not branch only on a parsed `git --version`" — it is a behavior probe). The boundary itself stays pinned by the 3-version CI matrix in `src/shared/git-binary-compatibility.test.ts` |
| 3 | same file — branch deletion after newline-worktree removal | same | same |
| 4 | `src/main/runtime/orca-runtime-files.test.ts` — stale absolute artifact preview | **50% flaky, not environmental.** The grant's freshness key is `dev:ino:nlink:size:mtimeMs`. The test replaced `'fake-png'` (8 bytes) with `'changed!'` (also 8 bytes); the delete+rewrite reuses the freed inode, so only `mtimeMs` differed — and both writes can land inside one filesystem mtime tick. Reproduced with a standalone stat probe: 6/6 iterations produced an identical identity string | Stamped a distinct mtime with `utimes` after the rewrite. 5/5 repeat runs green (was 2/4) |
| 5 | `src/main/ssh/ssh-system-transport.integration.test.ts` — ProxyUseFdpass relay RPC | **Fixture drift, 3/3 reproducible.** `probeRelayInstalledCommand` gained a `relay-watcher.js` requirement in `e3c47eff1` (2026-07-12) but the fixture was never updated, so the probe returned MISSING and deploy fell through to a **real `npm install`**, which times out at 20s. A second layer: the native-deps probe calls `node-pty/lib/utils.loadNativeModule`, which a bare `index.js` stub cannot satisfy | Added `relay-watcher.js` and a `node-pty/lib/utils.js` stub to the fixture. 4/4 repeat runs green |
| 6 | `src/renderer/.../project-view-wrapper-source-context-boundary.test.ts` | Load-only timeout — see below | none |

## Remaining 2 failures: machine capacity, not defects

| Test | Isolated duration | Full-suite result |
|---|---:|---|
| `project-view-wrapper-source-context-boundary.test.ts` | 19.6 s | times out at 30 s |
| `WorktreeCard.pr-display.test.tsx` | 10.4 s | times out at 30 s |

Both pass in isolation on the pinned Node. They are heavy renderer tests running under a suite that
imports for 3,670 s of cumulative CPU across workers on a shared VM. CI shards this suite 16 ways
(`.github/workflows/pr.yml`), so per-worker contention there is far lower.

**Deferred to phase 12.** Treating these as product regressions on a single unsharded box would be
wrong; treating them as green without evidence would also be wrong. The phase 12 CI matrix is the
authority. If they fail there too, they become real work.

The two `runtime offline` and one `Cannot find module 'electron'` lines in the log are **expected
fixture output** from `daemon-init.test.ts` asserting captured stderr, not failures.

## Git floor note for the program

The repo targets Git 2.25 as the core-workflow baseline. This host at 2.34.1 sits below the `-z`
boundary at 2.36, which makes it a *useful* verification host: it exercises the compatibility
fallback path that a modern-Git developer machine never hits. Worth keeping in mind for phases that
touch Git commands — a green run here is evidence about the fallback, not about the preferred path.

## Reproduce

```bash
export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"   # engines pin
pnpm lint
pnpm typecheck
node_modules/.bin/vitest run --config config/vitest.config.ts
gitleaks git . --log-opts="--all" -c <allowlist> --exit-code 0
```
