```text
# baseline: full vitest after phase-01 test-harness fixes
host: Linux 5.15.0-176-generic x86_64 | node v24.19.0 | git git version 2.34.1
commit: 0304a3650aa8691975c8cb61535aec8a2d4ace02 + uncommitted test fixes
started: 2026-08-22T07:03:14Z
---

### full log kept out of git (test-node24-after-fixes.log, 2.9M); summary below

### failing files
 FAIL  src/renderer/src/components/github-project/project-view-wrapper-source-context-boundary.test.ts > ProjectViewWrapper GitHub source context boundary > builds project work items with a host-pinned repository identity
 FAIL  src/renderer/src/components/sidebar/WorktreeCard.pr-display.test.tsx > WorktreeCard linked PR display > keeps linked GH PR status out of the left status slot by default

### error classes
      1 Error: Cannot find module 'electron'
      1 Error: Test timed out in 20000ms.
      1 Error: Test timed out in 30000ms.
      2 Error: runtime offline

### totals
 Test Files  2 failed | 3773 passed | 13 skipped (3788)
      Tests  2 failed | 39869 passed | 155 skipped (40026)
   Duration  389.30s (transform 785.93s, setup 0ms, import 3670.61s, tests 973.48s, environment 144.53s)
exit=1 finished=2026-08-22T07:09:46Z
```
