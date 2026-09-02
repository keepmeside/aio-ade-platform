// @vitest-environment happy-dom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GitHubProjectRow } from '../../../../shared/github-project-types'

const COMPONENT_ROOT = __dirname

function componentSource(relativePath: string): string {
  return readFileSync(join(COMPONENT_ROOT, relativePath), 'utf8')
}

function sourceBetween(source: string, startPattern: string, endPattern: string): string {
  const start = source.indexOf(startPattern)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endPattern, start + startPattern.length)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('ProjectViewWrapper GitHub source context boundary', () => {
  /* Timeout raised above the 30s suite default because this case really does import the component:
   * `buildProjectWorkItem` lives in `ProjectViewWrapper`, so reaching it TS-transforms that whole
   * module graph — 15.8s on an idle machine, which is under 30s alone but over it once the full
   * suite saturates every core. It timed out on every full-suite run while passing in isolation. */
  it('builds project work items with a host-pinned repository identity', async () => {
    const { buildProjectWorkItem } = await import('./ProjectViewWrapper')
    const row: GitHubProjectRow = {
      id: 'PVTI_1',
      itemType: 'PULL_REQUEST',
      content: {
        number: 42,
        title: 'Enterprise pull request',
        body: null,
        url: 'https://ghe.example.com/acme/aio-ade/pull/42',
        state: 'OPEN',
        stateReason: null,
        isDraft: false,
        repository: 'acme/aio-ade',
        assignees: [],
        labels: [{ name: 'bug', color: 'd73a4a' }],
        parentIssue: null,
        issueType: null
      },
      fieldValuesByFieldId: {},
      updatedAt: '2026-07-16T00:00:00.000Z',
      position: 0
    }

    expect(buildProjectWorkItem(row, 'repo-1', 'ghe.example.com')).toMatchObject({
      repoId: 'repo-1',
      type: 'pr',
      prRepo: { owner: 'acme', repo: 'aio-ade', host: 'ghe.example.com' }
    })
    expect(buildProjectWorkItem(row, 'repo-1')?.prRepo?.host).toBe('github.com')
  }, 90_000)

  it('passes the matched repo source context into the repo-backed GitHub dialog', () => {
    const source = componentSource('ProjectViewWrapper.tsx')
    const contextSection = sourceBetween(
      source,
      'const resolvedDialogRepo = resolvedDialogRepoItem',
      'const resolvedMissingRepoDialogs'
    )
    const dialogSection = sourceBetween(source, '<GitHubItemDialog', 'onUse={(item) => {')

    expect(source).toContain('buildTaskSourceContextFromRepo')
    expect(contextSection).toContain("provider: 'github'")
    expect(contextSection).toContain('repo: resolvedDialogRepo')
    expect(dialogSection).toContain('sourceContext={resolvedDialogSourceContext}')
  })
})
