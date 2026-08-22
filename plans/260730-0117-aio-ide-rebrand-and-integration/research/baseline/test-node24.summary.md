```text
# baseline: vitest run (Node 24, engines-pinned)
host: Linux 5.15.0-176-generic x86_64 | node v24.19.0
cmd: node config/scripts/ensure-native-runtime.mjs --runtime=node && node_modules/.bin/vitest run --config config/vitest.config.ts
commit: 0304a3650aa8691975c8cb61535aec8a2d4ace02
started: 2026-08-22T05:40:52Z

### full log kept out of git (test-node24.log, 2.9M); summary below

### failing files
 FAIL  src/main/git/worktree-list-paths.test.ts > git worktree paths > deletes the matching local branch after removing a newline-path worktree
 FAIL  src/main/git/worktree-list-paths.test.ts > git worktree paths > lists worktrees whose paths contain newlines
 FAIL  src/main/runtime/orca-runtime-files.test.ts > RuntimeFileCommands > resolveTerminalPath > rejects stale absolute terminal artifact previews before returning changed content
 FAIL  src/main/ssh/ssh-system-transport.integration.test.ts > system SSH transport integration > deploys and speaks relay RPC over a system ssh process for ProxyUseFdpass targets
 FAIL  src/relay/git-handler.test.ts > GitHandler > listWorktrees > lists worktrees whose paths contain newlines
 FAIL  src/renderer/src/components/github-project/project-view-wrapper-source-context-boundary.test.ts > ProjectViewWrapper GitHub source context boundary > builds project work items with a host-pinned repository identity

### error classes
      1 AssertionError: expected [ …(2) ] to include '/home/stackops/.jcode/scratch/orca-wo…'
      1 AssertionError: expected [ …(2) ] to include '/home/stackops/.jcode/scratch/relay-g…'
      1 AssertionError: expected true to be false // Object.is equality
      1 AssertionError: promise resolved "{ content: 'Y2hhbmdlZCE=', …(3) }" instead of rejecting
      1 Error: Cannot find module 'electron'
      1 Error: Test timed out in 20000ms.
      1 Error: Test timed out in 30000ms.
      2 Error: runtime offline

### totals
 Test Files  5 failed | 3770 passed | 13 skipped (3788)
      Tests  6 failed | 39868 passed | 152 skipped (40026)
   Duration  309.85s (transform 540.36s, setup 0ms, import 2720.64s, tests 886.47s, environment 128.03s)
exit=1 finished=2026-08-22T05:46:04Z
```
