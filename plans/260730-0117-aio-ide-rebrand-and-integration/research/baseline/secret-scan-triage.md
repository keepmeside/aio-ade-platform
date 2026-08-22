# Secret-scan triage: full history, all refs

Generated 2026-08-22. Phase 01 step "chọn + pin secret-scan tool và chạy dry-run scan trên toàn bộ history".

## Tool pinned

| Item | Value |
|---|---|
| Tool | `gitleaks` |
| Version | `8.30.1` (latest release at scan time) |
| Artifact | `gitleaks_8.30.1_linux_x64.tar.gz` |
| SHA256 | `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb` (matched upstream `gitleaks_8.30.1_checksums.txt`) |
| Install path | `~/.local/bin/gitleaks` (not vendored into the repo) |
| Command | `gitleaks git . --log-opts="--all" --report-format json --redact=0 --exit-code 0` |

`trufflehog` was not chosen: gitleaks ships a `.gitleaks.toml` allowlist model that maps directly onto the
per-path fixture exemptions this repo needs, and its `--log-opts` passthrough scans every ref in one process.

## Scan scope

| Item | Value |
|---|---|
| Commits reachable from `HEAD` | 7,536 |
| Commits across all refs (`--all`) | 17,537 |
| Refs present locally | 4,401 |
| Findings | 75 |
| Raw report location | outside the repo (`$JCODE_SCRATCH_DIR/gitleaks-scan/history-all-refs.json`) — never committed |

The raw report is deliberately kept out of the working tree: it contains unredacted match text.
This file records rule + path + line + commit only.

## Verdict by class

| Class | Findings | Distinct files |
|---|---:|---:|
| `vendor-patch-noise` — base64/minified blobs inside pnpm patch files | 38 | 4 |
| `test-fixture` — deliberate fakes in tests/fixtures | 36 | 12 |
| `false-positive` — public non-secret identifier | 1 | 1 |
| `REAL-SECRET-NEEDS-ROTATION` | **0** | 0 |

### Gate answer for phase 08

**No.** History contains no fork-owned secret requiring rotation before the public flip.
Every finding is a vendor patch blob, a deliberate test fixture, or a public identifier.
The phase 08 pre-publication gate therefore does not need the rotation contingency branch on
current evidence; it still needs a re-run at flip time because new commits land between now and then.

## Per-finding verdicts

### vendor-patch-noise (38)

pnpm patch files against `@xterm/*` beta builds. Findings are high-entropy substrings of minified
vendor bundles, not credentials. Two of the four files no longer exist at tip (older beta pins).

| File | Findings | Present at tip |
|---|---:|---|
| `config/patches/@xterm__xterm@6.1.0-beta.287.patch` | 22 | yes |
| `config/patches/@xterm__addon-webgl@0.20.0-beta.286.patch` | 12 | yes |
| `config/patches/@xterm__addon-webgl@0.20.0-beta.219.patch` | 2 | no (history only) |
| `config/patches/@xterm__addon-webgl@0.20.0-beta.215.patch` | 2 | no (history only) |

### test-fixture (36)

| File | Findings | Rule(s) | Why it is a fixture |
|---|---:|---|---|
| `src/shared/mobile-e2ee-v2-fixtures.ts:44-45` | 6 | generic-api-key | Named `*Fixtures`; hard-coded hex session keys for the E2EE v2 vector tests |
| `src/main/claude-usage/store.test.ts:206,256,372` | 5 | generic-api-key | Matches are model ids (`row.key === 'claude-opus-4-7-20260416'`), not keys |
| `src/shared/mobile-e2ee-legacy-fixtures.ts` | 3 | generic-api-key | Legacy E2EE test vectors |
| `src/shared/pairing.test.ts:8` | 3 | generic-api-key | `deviceToken: 'abcdef1234567890...'` — visibly synthetic repeating pattern |
| `tests/e2e/plugin-marketplace-content.spec.ts:251,268,276` | 3 | generic-api-key | Matches `pluginKey: 'stablyai.orca-e2e-skills'` — a plugin id |
| `src/main/observability/redactor.test.ts:24,26` | 2 | jwt, private-key | The redactor's own negative-control inputs; truncated PEM body |
| `src/renderer/.../rich-markdown-link-shortcut.test.ts:11` | 2 | generic-api-key | `TEST_KEY = '0123456789abcdef0123456789abcdef'` |
| `src/renderer/.../rich-markdown-html-superscript-link.test.ts` | 2 | generic-api-key | Same `TEST_KEY` constant |
| `tests/e2e/terminal-long-table-fixtures.ts:231` | 2 | generic-api-key | Synthetic wide-table row content used to force horizontal scroll |
| `tests/e2e/terminal-long-table-scroll-restore.spec.ts` | 2 | generic-api-key | Consumes the same fixture row |
| `src/main/runtime/orchestration/orchestration-legacy-storage-db.test.ts:595,625` | 2 | generic-api-key | Matches `operationKey: 'reply_invocation_1'`; file deleted at tip |
| `src/main/bitbucket/client.test.ts:11` | 1 | bitbucket-client-id | Match is an import list, not an id |
| `src/main/runtime/rpc/methods/computer.test.ts:234` | 1 | generic-api-key | Match is `key: 'CmdOrCtrl+Shift'` — a keybinding |
| `src/renderer/.../repro-8075-superscript-footnote.test.ts` | 1 | generic-api-key | Repro fixture; file deleted at tip |
| `tests/e2e/helpers/local-https-test-certificate.ts:3` | 1 | private-key | Test-only self-signed TLS keypair for the local HTTPS e2e server |

Note on the two `private-key` hits: `local-https-test-certificate.ts` holds a complete throwaway
keypair generated for e2e HTTPS. It is not a production key and needs no rotation, but it is the one
finding class worth re-checking if that helper is ever repurposed.

### false-positive (1)

| File | Rule | Verdict |
|---|---|---|
| `src/main/claude-accounts/oauth-refresh.ts:10` | generic-api-key | `OAUTH_CLIENT_ID = '9d1c250a-…'` is the **public** Claude Code OAuth client id, documented in the surrounding comment as verified against the installed `claude` binary. Public OAuth client ids are not secrets. |

## Allowlist validation

`proposed.gitleaks.toml` was run against the same full-history scope and drives findings to **0**:

```
gitleaks git . --log-opts="--all" -c proposed.gitleaks.toml --exit-code 0   # leaks found: 0
```

Two iterations were needed. The first pass left 3 residuals, both structural false positives that the
initial regexes missed: `pluginKey === '…'` (comparison form, not the `pluginKey: '…'` property form)
and `bitbucket-client-id` firing on an import list. Both now have narrow entries — the Bitbucket one is
scoped with `targetRules` so the rule stays live everywhere else.

A zero-finding baseline is the point: at the phase 08 gate any non-zero result is a new secret, not noise.

## Follow-ups

1. Land the proposed `.gitleaks.toml` (see `proposed.gitleaks.toml` beside this file) at the repo root
   as part of phase 08's scan setup, not phase 01 — phase 01 only pins the tool and establishes the baseline.
2. Re-run this exact command at the phase 08 gate; treat any finding outside the allowlist as blocking.
3. When `mobile/` is deleted in phase 02, the `src/shared/mobile-e2ee-*-fixtures.ts` allowlist entries
   must be re-checked: if the desktop pairing/E2EE code is kept (it is desktop-side, not the RN app),
   the fixtures stay and so do their allowlist entries.
