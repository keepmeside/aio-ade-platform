import { describe, expect, it } from 'vitest'
import { pickRemoteCliEnv } from './remote-cli-env'

describe('pickRemoteCliEnv', () => {
  it('forwards SSH AIO-ADE terminal and worktree context for remote CLI calls', () => {
    expect(
      pickRemoteCliEnv({
        AIO_ADE_TERMINAL_HANDLE: 'term_ssh',
        AIO_ADE_WORKTREE_ID: 'repo::remote',
        AIO_ADE_PANE_KEY: 'pane-1',
        AIO_ADE_WORKSPACE_ID: 'workspace-1',
        AIO_ADE_USER_DATA_PATH: '/tmp/aio-ade',
        PATH: '/usr/bin',
        SECRET_TOKEN: 'nope'
      })
    ).toEqual({
      AIO_ADE_TERMINAL_HANDLE: 'term_ssh',
      AIO_ADE_WORKTREE_ID: 'repo::remote',
      AIO_ADE_PANE_KEY: 'pane-1',
      AIO_ADE_WORKSPACE_ID: 'workspace-1',
      AIO_ADE_USER_DATA_PATH: '/tmp/aio-ade',
      PATH: '/usr/bin'
    })
  })
})
