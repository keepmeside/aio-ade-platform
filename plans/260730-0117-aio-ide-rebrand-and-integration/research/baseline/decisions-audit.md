# decisions.md completeness and consistency audit (phase 01)

Generated 2026-08-22. Phase 01 success criteria being checked:

- "Mỗi quyết định P1 có owner, trade-off và rollback."
- "Không phase sau phụ thuộc vào giả định chưa ghi trong `decisions.md`."

Method: parsed the gate table programmatically for missing cells, then cross-read `plan.md` and
`phase-01`..`phase-12` for assumptions and for statements that contradict the 2026-08-21 decisions.

## Verdict

The decision log is **substantially complete**: 25 of 27 gate rows carry `approvedBy`, `approvedAt`,
a compatibility window and a rollback trigger. Two rows have a legitimately empty rollback. The real
problem is not the log — it is **three contradictions where phase files and the log disagree**, one of
which would produce wrong behavior if implemented as written.

## Gap table

| Gate | State | Missing | Assessment |
|---|---|---|---|
| CCS interoperability | approved | rollback trigger (`N/A`) | **Acceptable.** The decision is "ideas only, no importer" — there is no artifact to roll back. |
| Pasted text #1 | resolved | rollback trigger (`N/A`) | **Acceptable.** Removed from scope; nothing to revert. |

No row is missing `approvedBy` or `approvedAt`. No P1 gate is unowned.

## Contradiction table

| # | Location | Says | Contradicts | Severity |
|---|---|---|---|---|
| C1 | `decisions.md:14` (Brand tokens row, "Compatibility window" cell) | "Alias legacy `orca-ide` giữ 1 release window" | `decisions.md:18` (CLI alias legacy row): "**Không alias.** Chỉ ship `aio-ade`; không ship `orca`, không ship `orca-ide`." Both rows are dated 2026-08-21 and both approved | **High.** Two approved rows in the same table give opposite instructions about shipping `orca-ide`. Phase 03 and 05 both implement from this table. Fix: rewrite the Brand-tokens compatibility cell to reference the no-alias row and keep only the genuine constraint (do not install bare `orca` on Linux). |
| C2 | `plan.md:57` and the filename `phase-05-rebrand-orca-to-aio-ide.md`; also the plan directory `260730-0117-aio-ide-rebrand-and-integration` | `aio-ide` | Approved machine token is **`aio-ade`** | **Low, cosmetic but confusing.** The link text already says "aio-ade"; only the filename and directory retain `aio-ide`. Recommend leaving the paths alone (renaming breaks every cross-reference and the Pages workflow) and adding one explicit note that `aio-ide` in paths is historical. |
| C3 | `.github/workflows/aio-ide-plan-pages.yml` references throughout phase 08/09 | workflow filename contains `aio-ide` | same as C2 | **None.** This is a real existing filename; phase 09 explicitly protects it from cleanup. No action. |

## Assumption coverage per phase

Each phase's load-bearing assumptions traced to a recorded decision:

| Phase | Depends on | Recorded? |
|---|---|---|
| 01 | CI unavailable for 01-05; local-only gates; deferred 3-OS criteria | Yes — Repo visibility row records the accepted cost explicitly |
| 02 | mobile deletion does not imply deleting generic web/SSH runtime | Yes — "Đã xác minh" section |
| 03 | Option A minimal bridge; no legacy alias; `serve` flagged off | Yes — three separate rows |
| 04 | roster → claude+codex; Agent Teams kept; ACP returns other agents at phase 10 | Yes — Agent roster + Claude Agent Teams + ACP host boundary rows |
| 05 | two brand tokens; data migration readers survive; unsigned; no auto-update; telemetry endpoint moves | Yes — Brand tokens, CLI alias, Signing, Release channel, Telemetry rows |
| 06 | shared schema + per-provider resolver; SSH secret both options, default not-forward; 06A/06B split | Yes — Account model + SSH secret provisioning rows |
| 07 | Excalidraw only; tldraw excluded; XYFlow deferred | Yes — Canvas row |
| 08 | public flip after phase 05; owner flips, not agent; pre-publication gate | Yes — Repo visibility + Pages target rows |
| 09 | `serve` delete decision lands here; do not delete pending-phase seams | Yes — Headless `serve` + Cleanup phase rows |
| 10 | ACP local-native-host only, accepted long-term | Yes — ACP host boundary row |
| 11 | Tauri v2 direction C; B2 fallback; NO-GO valid; metric tension acknowledged | Yes — Runtime migration + OS floor + Runtime motive rows |
| 12 | first CI venue; phases 06/09/11 blocked on it | Recorded in `plan.md` serialization note; **not** a row in `decisions.md` |

**One genuine gap:** the phase-12-as-first-CI-gate serialization is stated in `plan.md`
("Điểm serialize") and in phase 08's risk section, but has no row in the decision table even though
phases 06, 09 and 11 are blocked by it. Recommend adding a row so the dependency is owned.

## Recommended edits (not applied — phase 01 is read-only on plan content beyond status sync)

1. **C1, do this before phase 03 starts.** Rewrite the Brand-tokens compatibility-window cell to drop
   "Alias legacy `orca-ide` giữ 1 release window" and point at the CLI-alias row.
2. Add a `Phase 12 serialization` row: owner User, 2026-08-21, rollback trigger = "regression found on
   CI matrix that phase 01-05 local verification missed".
3. Add one line near the top of `plan.md` noting that `aio-ide` in file and directory paths is
   historical and the approved token is `aio-ade`, so no future reader treats it as a second brand.

## Newly created phase-01 evidence that decisions.md should reference

- `research/baseline/local-verification-baseline.md` — the local gate that replaces CI, incl. the
  Node 24 pin requirement.
- `research/baseline/secret-scan-triage.md` — answers the phase 08 rotation question **no**, which
  means the contingency branch in the Repo-visibility rollback trigger is currently not needed.
- `research/baseline/deferred-verification.md` — the tracking list the phase-01 requirement asks for.
- `research/baseline/coupling-{mobile,cli,brand-token,accounts}.md` — the inventories.
