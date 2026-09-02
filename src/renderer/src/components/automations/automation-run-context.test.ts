import { describe, expect, it } from 'vitest'
import type { ProjectHostSetup, Repo } from '../../../../shared/types'
import { buildAutomationRunContextForRepo } from './automation-run-context'

function repo(id: string, path = `/repos/${id}`): Repo {
  return {
    id,
    path,
    displayName: id,
    badgeColor: '#000000',
    addedAt: 1
  }
}

function setup(overrides: Partial<ProjectHostSetup> = {}): ProjectHostSetup {
  return {
    id: 'setup-builder',
    projectId: 'github:keepmeside/aio-ade-platform',
    hostId: 'ssh:builder',
    repoId: 'repo-builder',
    path: '/remote/aio-ade',
    displayName: 'aio-ade',
    setupState: 'ready',
    setupMethod: 'cloned',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('buildAutomationRunContextForRepo', () => {
  it('persists logical project and host setup identity for the selected run repo', () => {
    expect(
      buildAutomationRunContextForRepo({
        repoId: 'repo-builder',
        repos: [repo('repo-local', '/local/aio-ade'), repo('repo-builder', '/remote/aio-ade')],
        projectHostSetups: [
          setup({
            id: 'setup-local',
            hostId: 'local',
            repoId: 'repo-local',
            path: '/local/aio-ade'
          }),
          setup()
        ]
      })
    ).toEqual({
      kind: 'workspace-run',
      projectId: 'github:keepmeside/aio-ade-platform',
      hostId: 'ssh:builder',
      projectHostSetupId: 'setup-builder',
      repoId: 'repo-builder',
      path: '/remote/aio-ade'
    })
  })

  it('does not build a run context for missing or not-ready setups', () => {
    expect(
      buildAutomationRunContextForRepo({
        repoId: 'repo-builder',
        repos: [repo('repo-builder')],
        projectHostSetups: [setup({ setupState: 'setting-up' })]
      })
    ).toBeNull()

    expect(
      buildAutomationRunContextForRepo({
        repoId: 'repo-builder',
        repos: [],
        projectHostSetups: [setup()]
      })
    ).toBeNull()
  })
})
