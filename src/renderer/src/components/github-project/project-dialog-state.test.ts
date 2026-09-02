import { describe, expect, it } from 'vitest'
import {
  resolveMissingRepoProjectDialogState,
  resolveRepoBackedProjectDialogState
} from './project-dialog-state'

describe('resolveRepoBackedProjectDialogState', () => {
  it('keeps a repo-backed dialog when the repo still exists', () => {
    const dialog = { repoId: 'repo-1', label: 'Issue 1' }

    expect(
      resolveRepoBackedProjectDialogState(dialog, new Set(['repo-1']), new Set(['repo-1']))
    ).toBe(dialog)
  })

  it('clears a repo-backed dialog when its repo is removed', () => {
    expect(
      resolveRepoBackedProjectDialogState(
        { repoId: 'repo-1' },
        new Set(['repo-2']),
        new Set(['repo-1'])
      )
    ).toBeNull()
  })

  it('clears a repo-backed dialog when its repo is no longer selected', () => {
    expect(
      resolveRepoBackedProjectDialogState(
        { repoId: 'repo-1' },
        new Set(['repo-1']),
        new Set(['repo-2'])
      )
    ).toBeNull()
  })
})

describe('resolveMissingRepoProjectDialogState', () => {
  it('clears fallback dialogs while the slug index is rebuilding', () => {
    const slugDialog = { origin: { owner: 'keepmeside', repo: 'aio-ade-platform' } }
    const repoNotInAioAde = { owner: 'keepmeside', repo: 'aio-ade-platform', url: null }

    expect(
      resolveMissingRepoProjectDialogState({
        slugIndexReady: false,
        slugDialog,
        repoNotInAioAde,
        lookupSlug: () => [{ id: 'repo-1' }],
        selectedRepoIds: new Set(['repo-1'])
      })
    ).toEqual({ slugDialog: null, repoNotInAioAde: null })
  })

  it('clears slug fallback dialogs once the repo slug resolves', () => {
    const slugDialog = { origin: { owner: 'keepmeside', repo: 'aio-ade-platform' } }
    const repoNotInAioAde = { owner: 'other', repo: 'tool', url: null }
    const result = resolveMissingRepoProjectDialogState({
      slugIndexReady: true,
      slugDialog,
      repoNotInAioAde,
      lookupSlug: (slug) => (slug === 'keepmeside/aio-ade-platform' ? [{ id: 'repo-1' }] : []),
      selectedRepoIds: new Set(['repo-1'])
    })

    expect(result.slugDialog).toBeNull()
    expect(result.repoNotInAioAde).toBe(repoNotInAioAde)
  })

  it('clears repo-not-in-aio-ade dialogs once the repo slug resolves', () => {
    const slugDialog = { origin: { owner: 'other', repo: 'tool' } }
    const repoNotInAioAde = { owner: 'keepmeside', repo: 'aio-ade-platform', url: null }
    const result = resolveMissingRepoProjectDialogState({
      slugIndexReady: true,
      slugDialog,
      repoNotInAioAde,
      lookupSlug: (slug) => (slug === 'keepmeside/aio-ade-platform' ? [{ id: 'repo-1' }] : []),
      selectedRepoIds: new Set(['repo-1'])
    })

    expect(result.slugDialog).toBe(slugDialog)
    expect(result.repoNotInAioAde).toBeNull()
  })

  it('clears fallback dialogs when the repo is globally known but not selected', () => {
    const slugDialog = { origin: { owner: 'keepmeside', repo: 'aio-ade-platform' } }
    const repoNotInAioAde = { owner: 'keepmeside', repo: 'aio-ade-platform', url: null }
    const result = resolveMissingRepoProjectDialogState({
      slugIndexReady: true,
      slugDialog,
      repoNotInAioAde,
      lookupSlug: () => [{ id: 'repo-2' }],
      selectedRepoIds: new Set(['repo-1'])
    })

    expect(result).toEqual({ slugDialog: null, repoNotInAioAde: null })
  })

  it('keeps missing-repo fallback dialogs when there are no global matches', () => {
    const slugDialog = { origin: { owner: 'keepmeside', repo: 'aio-ade-platform' } }
    const repoNotInAioAde = { owner: 'keepmeside', repo: 'aio-ade-platform', url: null }
    const result = resolveMissingRepoProjectDialogState({
      slugIndexReady: true,
      slugDialog,
      repoNotInAioAde,
      lookupSlug: () => [],
      selectedRepoIds: new Set(['repo-1'])
    })

    expect(result).toEqual({ slugDialog, repoNotInAioAde })
  })
})
