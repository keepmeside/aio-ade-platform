import { describe, expect, it } from 'vitest'
import type { ExecutionHostId } from '../../../shared/execution-host'
import type { Project, ProjectHostSetup, Repo } from '../../../shared/types'
import {
  resolveWorkspaceCreationRepoId,
  resolveWorkspaceCreationTarget
} from './project-host-workspace-target'

function makeRepo(id: string, overrides: Partial<Repo> = {}): Repo {
  return {
    id,
    path: `/repos/${id}`,
    displayName: id,
    badgeColor: '#000000',
    addedAt: 1,
    ...overrides
  }
}

function makeProject(
  id: string,
  sourceRepoIds: string[],
  overrides: Partial<Project> = {}
): Project {
  return {
    id,
    displayName: id,
    badgeColor: '#000000',
    sourceRepoIds,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

function makeSetup(
  id: string,
  projectId: string,
  hostId: ExecutionHostId,
  repoId: string,
  overrides: Partial<ProjectHostSetup> = {}
): ProjectHostSetup {
  return {
    id,
    projectId,
    hostId,
    repoId,
    path: `/repos/${repoId}`,
    displayName: repoId,
    setupState: 'ready',
    setupMethod: 'legacy-repo',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('project-host workspace target resolution', () => {
  it('falls back to a local setup for a local-only repo', () => {
    const repo = makeRepo('aio-ade')

    const resolution = resolveWorkspaceCreationTarget({ eligibleRepos: [repo] })

    expect(resolution).toMatchObject({
      status: 'ready',
      target: {
        projectId: 'repo:aio-ade',
        hostId: 'local',
        projectHostSetupId: 'aio-ade',
        repoId: 'aio-ade'
      }
    })
  })

  it('chooses the focused host setup when one project exists on multiple hosts', () => {
    const repos = [
      makeRepo('aio-ade-local'),
      makeRepo('aio-ade-ssh', { connectionId: 'openclaw-2' })
    ]
    const projects = [
      makeProject('github:keepmeside/aio-ade-platform', ['aio-ade-local', 'aio-ade-ssh'])
    ]
    const projectHostSetups = [
      makeSetup('aio-ade-local', 'github:keepmeside/aio-ade-platform', 'local', 'aio-ade-local'),
      makeSetup(
        'aio-ade-ssh',
        'github:keepmeside/aio-ade-platform',
        'ssh:openclaw-2',
        'aio-ade-ssh'
      )
    ]

    expect(
      resolveWorkspaceCreationRepoId({
        eligibleRepos: repos,
        projects,
        projectHostSetups,
        projectId: 'github:keepmeside/aio-ade-platform',
        focusedHostScope: 'ssh:openclaw-2'
      })
    ).toBe('aio-ade-ssh')
  })

  it('resolves an explicit project and host to the matching setup', () => {
    const repos = [
      makeRepo('aio-ade-local'),
      makeRepo('aio-ade-runtime', { executionHostId: 'runtime:gpu-1' })
    ]
    const projects = [
      makeProject('github:keepmeside/aio-ade-platform', ['aio-ade-local', 'aio-ade-runtime'])
    ]
    const projectHostSetups = [
      makeSetup('aio-ade-local', 'github:keepmeside/aio-ade-platform', 'local', 'aio-ade-local'),
      makeSetup(
        'aio-ade-runtime',
        'github:keepmeside/aio-ade-platform',
        'runtime:gpu-1',
        'aio-ade-runtime'
      )
    ]

    const resolution = resolveWorkspaceCreationTarget({
      eligibleRepos: repos,
      projects,
      projectHostSetups,
      projectId: 'github:keepmeside/aio-ade-platform',
      hostId: 'runtime:gpu-1'
    })

    expect(resolution).toMatchObject({
      status: 'ready',
      target: {
        projectId: 'github:keepmeside/aio-ade-platform',
        hostId: 'runtime:gpu-1',
        projectHostSetupId: 'aio-ade-runtime',
        repoId: 'aio-ade-runtime'
      }
    })
  })

  it('canonicalizes a stale same-host setup id to the setup the picker shows', () => {
    // Why: the run-target picker renders one row per host. A draft persisted before that collapse
    // can still name a duplicate local setup; creation must land in the displayed path, not a
    // transient worktree path the user never sees.
    const repos = [makeRepo('aio-ade-main'), makeRepo('aio-ade-worktree')]
    const projects = [
      makeProject('github:keepmeside/aio-ade-platform', ['aio-ade-main', 'aio-ade-worktree'])
    ]
    const projectHostSetups = [
      makeSetup('aio-ade-main', 'github:keepmeside/aio-ade-platform', 'local', 'aio-ade-main'),
      makeSetup(
        'aio-ade-worktree',
        'github:keepmeside/aio-ade-platform',
        'local',
        'aio-ade-worktree'
      )
    ]

    const resolution = resolveWorkspaceCreationTarget({
      eligibleRepos: repos,
      projects,
      projectHostSetups,
      projectHostSetupId: 'aio-ade-worktree'
    })

    expect(resolution).toMatchObject({
      status: 'ready',
      target: { projectHostSetupId: 'aio-ade-main', repoId: 'aio-ade-main', hostId: 'local' }
    })
  })

  it('keeps an explicit setup id that is the only one on its host', () => {
    const repos = [makeRepo('aio-ade-local'), makeRepo('aio-ade-ssh', { connectionId: 'builder' })]
    const projects = [
      makeProject('github:keepmeside/aio-ade-platform', ['aio-ade-local', 'aio-ade-ssh'])
    ]
    const projectHostSetups = [
      makeSetup('aio-ade-local', 'github:keepmeside/aio-ade-platform', 'local', 'aio-ade-local'),
      makeSetup('aio-ade-ssh', 'github:keepmeside/aio-ade-platform', 'ssh:builder', 'aio-ade-ssh')
    ]

    expect(
      resolveWorkspaceCreationTarget({
        eligibleRepos: repos,
        projects,
        projectHostSetups,
        projectHostSetupId: 'aio-ade-ssh'
      })
    ).toMatchObject({
      status: 'ready',
      target: { projectHostSetupId: 'aio-ade-ssh', repoId: 'aio-ade-ssh', hostId: 'ssh:builder' }
    })
  })

  it('does not merge same-name repos without shared project identity', () => {
    const repos = [
      makeRepo('personal-aio-ade', { displayName: 'aio-ade' }),
      makeRepo('work-aio-ade', { displayName: 'aio-ade', connectionId: 'work-linux' })
    ]

    expect(
      resolveWorkspaceCreationRepoId({
        eligibleRepos: repos,
        projectId: 'repo:personal-aio-ade',
        focusedHostScope: 'ssh:work-linux'
      })
    ).toBe('personal-aio-ade')
  })

  it('reports unavailable when the project is not set up on the selected host', () => {
    const repo = makeRepo('aio-ade')
    const projects = [makeProject('github:keepmeside/aio-ade-platform', ['aio-ade'])]
    const projectHostSetups = [
      makeSetup('aio-ade', 'github:keepmeside/aio-ade-platform', 'local', 'aio-ade')
    ]

    expect(
      resolveWorkspaceCreationTarget({
        eligibleRepos: [repo],
        projects,
        projectHostSetups,
        projectId: 'github:keepmeside/aio-ade-platform',
        hostId: 'ssh:openclaw-2'
      })
    ).toEqual({
      status: 'unavailable',
      reason: 'project-not-set-up-on-host'
    })
  })

  it('reports setup-not-ready when the selected host has pending setup metadata', () => {
    const repo = makeRepo('aio-ade')
    const projects = [makeProject('github:keepmeside/aio-ade-platform', ['aio-ade'])]
    const projectHostSetups = [
      makeSetup('aio-ade', 'github:keepmeside/aio-ade-platform', 'local', 'aio-ade'),
      makeSetup('gpu-pending', 'github:keepmeside/aio-ade-platform', 'runtime:gpu', '', {
        path: '',
        setupState: 'setting-up',
        setupMethod: 'provisioned'
      })
    ]

    expect(
      resolveWorkspaceCreationTarget({
        eligibleRepos: [repo],
        projects,
        projectHostSetups,
        projectId: 'github:keepmeside/aio-ade-platform',
        hostId: 'runtime:gpu'
      })
    ).toEqual({
      status: 'unavailable',
      reason: 'setup-not-ready'
    })
  })

  it('reports unavailable when an explicit setup is not ready', () => {
    const repo = makeRepo('aio-ade')
    const projects = [makeProject('github:keepmeside/aio-ade-platform', ['aio-ade'])]
    const projectHostSetups = [
      makeSetup('aio-ade', 'github:keepmeside/aio-ade-platform', 'local', 'aio-ade', {
        setupState: 'setting-up'
      })
    ]

    expect(
      resolveWorkspaceCreationTarget({
        eligibleRepos: [repo],
        projects,
        projectHostSetups,
        projectHostSetupId: 'aio-ade'
      })
    ).toEqual({
      status: 'unavailable',
      reason: 'setup-not-ready'
    })
  })

  // Regression: selecting a project in the new-workspace dropdown must not be
  // pinned to the host of the currently-active workspace. Each project below is
  // set up on exactly one (different) host; picking the other project while the
  // current host is given only as a preference must resolve to that project's
  // own host instead of returning '' (the silent no-op the dropdown showed).
  describe('cross-host project selection', () => {
    const repos = [makeRepo('local-repo'), makeRepo('remote-repo', { connectionId: 'remote-1' })]
    const projects = [
      makeProject('repo:local-repo', ['local-repo']),
      makeProject('repo:remote-repo', ['remote-repo'])
    ]
    const projectHostSetups = [
      makeSetup('local-repo', 'repo:local-repo', 'local', 'local-repo'),
      makeSetup('remote-repo', 'repo:remote-repo', 'ssh:remote-1', 'remote-repo')
    ]

    it('resolves a remote-only project while the current host is local', () => {
      expect(
        resolveWorkspaceCreationRepoId({
          eligibleRepos: repos,
          projects,
          projectHostSetups,
          projectId: 'repo:remote-repo',
          focusedHostScope: 'local'
        })
      ).toBe('remote-repo')
    })

    it('resolves a local-only project while the current host is remote', () => {
      expect(
        resolveWorkspaceCreationRepoId({
          eligibleRepos: repos,
          projects,
          projectHostSetups,
          projectId: 'repo:local-repo',
          focusedHostScope: 'ssh:remote-1'
        })
      ).toBe('local-repo')
    })

    it('still prefers the current host when the project is set up on it', () => {
      const multiHostProjects = [makeProject('repo:multi', ['multi-local', 'multi-remote'])]
      const multiHostSetups = [
        makeSetup('multi-local', 'repo:multi', 'local', 'multi-local'),
        makeSetup('multi-remote', 'repo:multi', 'ssh:remote-1', 'multi-remote')
      ]

      expect(
        resolveWorkspaceCreationRepoId({
          eligibleRepos: [
            makeRepo('multi-local'),
            makeRepo('multi-remote', { connectionId: 'remote-1' })
          ],
          projects: multiHostProjects,
          projectHostSetups: multiHostSetups,
          projectId: 'repo:multi',
          focusedHostScope: 'local'
        })
      ).toBe('multi-local')
    })

    it('still reports unavailable for an explicit project+host with no ready setup', () => {
      // The strict projectId+hostId path (used by the explicit "Run on" host
      // picker) keeps its hard match — only the project-dropdown call site
      // changed to pass the host as a preference.
      expect(
        resolveWorkspaceCreationTarget({
          eligibleRepos: repos,
          projects,
          projectHostSetups,
          projectId: 'repo:remote-repo',
          hostId: 'local'
        })
      ).toEqual({
        status: 'unavailable',
        reason: 'project-not-set-up-on-host'
      })
    })
  })
})
