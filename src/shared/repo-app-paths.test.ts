import { describe, expect, it } from 'vitest'
import {
  getRepoAppDirCandidates,
  getRepoAppPath,
  getRepoAppPathCandidates,
  getRepoProjectConfigCandidates,
  LEGACY_PROJECT_CONFIG_FILE_NAME,
  LEGACY_REPO_APP_DIR_NAME,
  PROJECT_CONFIG_FILE_NAME,
  REPO_APP_DIR_NAME
} from './repo-app-paths'

describe('in-repo directory and project config names', () => {
  it('writes under the current brand and keeps the pre-rebrand names readable', () => {
    expect(REPO_APP_DIR_NAME).toBe('.aio-ade')
    expect(PROJECT_CONFIG_FILE_NAME).toBe('aio-ade.yaml')
    // Both pre-rebrand names live in repositories this project does not own: the directory
    // holds per-user issue-command overrides and markdown templates, and the yaml file is
    // committed. Dropping either read makes an existing repo look unconfigured.
    expect(LEGACY_REPO_APP_DIR_NAME).toBe('.orca')
    expect(LEGACY_PROJECT_CONFIG_FILE_NAME).toBe('orca.yaml')
  })
})

describe('getRepoAppPath', () => {
  it('joins with forward slashes so remote worktrees resolve the same way', () => {
    expect(getRepoAppPath('/work/repo', 'drops')).toBe('/work/repo/.aio-ade/drops')
    expect(getRepoAppPath('/work/repo/', 'issue-command')).toBe('/work/repo/.aio-ade/issue-command')
  })

  it('tolerates a Windows-style trailing separator', () => {
    expect(getRepoAppPath('C:\\work\\repo\\', 'drops')).toBe('C:\\work\\repo/.aio-ade/drops')
  })
})

describe('candidate ordering', () => {
  it('puts the canonical directory ahead of the pre-rebrand one', () => {
    expect(getRepoAppDirCandidates('/work/repo')).toEqual([
      '/work/repo/.aio-ade',
      '/work/repo/.orca'
    ])
    expect(getRepoAppPathCandidates('/work/repo', 'templates')).toEqual([
      '/work/repo/.aio-ade/templates',
      '/work/repo/.orca/templates'
    ])
  })

  it('puts the canonical project config ahead of the pre-rebrand one', () => {
    expect(getRepoProjectConfigCandidates('/work/repo')).toEqual([
      '/work/repo/aio-ade.yaml',
      '/work/repo/orca.yaml'
    ])
  })
})
