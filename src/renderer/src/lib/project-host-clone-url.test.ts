import { describe, expect, it } from 'vitest'
import type { Project } from '../../../shared/types'
import { getProjectHostCloneUrl } from './project-host-clone-url'

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    displayName: 'Project',
    badgeColor: '#000',
    sourceRepoIds: ['repo-1'],
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('getProjectHostCloneUrl', () => {
  it('builds a GitHub HTTPS clone URL from provider identity', () => {
    // Owner and repo come from one source on both sides: renaming them independently is how the
    // expectation and the input drifted apart.
    const owner = 'keepmeside'
    const repo = 'aio-ade-platform'

    expect(
      getProjectHostCloneUrl(
        createProject({
          providerIdentity: {
            provider: 'github',
            owner: ` ${owner} `,
            repo: ` ${repo} `
          }
        })
      )
    ).toBe(`https://github.com/${owner}/${repo}.git`)
  })

  it('preserves an authenticated Enterprise host and port', () => {
    expect(
      getProjectHostCloneUrl(
        createProject({
          providerIdentity: {
            provider: 'github',
            owner: 'enterprise owner',
            repo: 'aio-ade repo',
            host: 'github.acme-corp.com:8443'
          }
        })
      )
    ).toBe('https://github.acme-corp.com:8443/enterprise%20owner/aio-ade%20repo.git')
  })

  it('rejects malformed or path-bearing Enterprise hosts', () => {
    for (const host of [
      'https://github.acme-corp.com',
      'github.acme-corp.com/org',
      'user@github.acme-corp.com',
      'github.acme-corp.com?token=secret',
      'github.acme-corp.com:not-a-port'
    ]) {
      expect(
        getProjectHostCloneUrl(
          createProject({
            providerIdentity: { provider: 'github', owner: 'acme', repo: 'aio-ade', host }
          })
        )
      ).toBeNull()
    }
  })

  it('returns null when provider identity is missing or incomplete', () => {
    expect(getProjectHostCloneUrl(createProject())).toBeNull()
    expect(
      getProjectHostCloneUrl(
        createProject({
          providerIdentity: {
            provider: 'github',
            owner: '',
            repo: 'aio-ade'
          }
        })
      )
    ).toBeNull()
  })
})
