import { describe, expect, it } from 'vitest'
import {
  canCleanupUnregisteredAioAdeWorktreeDirectory,
  isWorktreePathMissing,
  stripAioAdeProvenanceMetaUpdates
} from './worktree-removal-safety'
import type { WorktreeMeta } from '../shared/types'

describe('isWorktreePathMissing', () => {
  it('recognizes missing-path errors from local and remote stat providers', async () => {
    await expect(
      isWorktreePathMissing('/missing', async () => {
        throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      })
    ).resolves.toBe(true)

    await expect(
      isWorktreePathMissing('/missing', () => Promise.reject({ code: 'ENOTDIR' }))
    ).resolves.toBe(true)
  })

  it('does not classify existing paths or unrelated stat failures as missing', async () => {
    await expect(isWorktreePathMissing('/exists', async () => ({}))).resolves.toBe(false)

    await expect(
      isWorktreePathMissing('/unknown', async () => {
        throw new Error('permission denied')
      })
    ).resolves.toBe(false)
  })
})

describe('canCleanupUnregisteredAioAdeWorktreeDirectory', () => {
  it('does not treat aioAdeCreatedAt alone as cleanup authority', () => {
    expect(
      canCleanupUnregisteredAioAdeWorktreeDirectory({
        meta: { aioAdeCreatedAt: Date.now() }
      })
    ).toBe(false)
    expect(
      canCleanupUnregisteredAioAdeWorktreeDirectory({
        meta: {
          aioAdeCreatedAt: Date.now(),
          aioAdeCreationSource: 'runtime'
        }
      })
    ).toBe(true)
  })

  it('accepts legacy AIO-ADE-created metadata before explicit provenance existed', () => {
    expect(
      canCleanupUnregisteredAioAdeWorktreeDirectory({
        meta: { createdAt: Date.now() }
      })
    ).toBe(true)
  })

  it('does not treat creation layout metadata alone as cleanup authority', () => {
    const layoutOnlyMeta: WorktreeMeta = {
      displayName: '',
      comment: '',
      linkedIssue: null,
      linkedPR: null,
      linkedLinearIssue: null,
      linkedGitLabMR: null,
      linkedGitLabIssue: null,
      isArchived: false,
      isUnread: false,
      isPinned: false,
      sortOrder: 0,
      lastActivityAt: 0,
      workspaceStatus: 'todo',
      aioAdeCreationWorkspaceLayout: { path: '/aio-ade/workspaces', nestWorkspaces: true }
    }

    expect(
      canCleanupUnregisteredAioAdeWorktreeDirectory({
        meta: layoutOnlyMeta
      })
    ).toBe(false)
  })

  it('does not trust paths without provenance or legacy metadata', () => {
    expect(
      canCleanupUnregisteredAioAdeWorktreeDirectory({
        meta: undefined
      })
    ).toBe(false)
  })
})

describe('stripAioAdeProvenanceMetaUpdates', () => {
  it('removes AIO-ADE-owned provenance fields from user metadata updates', () => {
    expect(
      stripAioAdeProvenanceMetaUpdates({
        comment: 'keep me',
        aioAdeCreatedAt: 123,
        aioAdeCreationSource: 'desktop',
        aioAdeCreationWorkspaceLayout: { path: '/workspace', nestWorkspaces: false },
        automationProvenance: {
          kind: 'created-by-automation',
          automationId: 'automation-1',
          automationNameSnapshot: 'Nightly review',
          automationRunId: 'run-1',
          automationRunTitleSnapshot: 'Nightly review run',
          createdAt: 123,
          executionTargetType: 'local',
          executionTargetId: 'local',
          projectId: 'repo-1'
        }
      })
    ).toEqual({ comment: 'keep me' })
  })
})
