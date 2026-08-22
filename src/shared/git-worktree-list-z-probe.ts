import { execFileSync } from 'node:child_process'

/**
 * Runtime probe for `git worktree list --porcelain -z` (Git 2.36+).
 *
 * Why a probe and not a `git --version` parse: vendor builds backport flags, so the
 * repo's compatibility contract (docs/reference/git-compatibility.md) treats behavior
 * as the only authority. Tests that assert *preferred* behavior — newline-safe worktree
 * paths, which the documented line-parser fallback cannot represent — must skip on hosts
 * below the boundary instead of failing. The 3-version CI matrix
 * (`src/shared/git-binary-compatibility.test.ts`) still pins the boundary itself.
 */
let cached: boolean | null = null

export function localGitSupportsWorktreeListZ(): boolean {
  if (cached !== null) {
    return cached
  }
  try {
    execFileSync('git', ['worktree', 'list', '--porcelain', '-z'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    })
    cached = true
  } catch {
    // Exit 129 (usage) means the flag was rejected; any other failure also means we
    // cannot prove support, and skipping is the safe answer for a capability probe.
    cached = false
  }
  return cached
}
