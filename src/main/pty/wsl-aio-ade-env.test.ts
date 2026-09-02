import { describe, expect, it } from 'vitest'
import { addAioAdeWslInteropEnv, addWorktreeSetupWslInteropEnv } from './wsl-aio-ade-env'

describe('addAioAdeWslInteropEnv', () => {
  it('marks the AIO-ADE terminal handle for Windows to WSL env import', () => {
    const env: Record<string, string> = { AIO_ADE_TERMINAL_HANDLE: 'term_wsl' }

    addAioAdeWslInteropEnv(env)

    expect(env.WSLENV).toBe('AIO_ADE_TERMINAL_HANDLE/u')
  })

  it('preserves existing WSLENV entries and does not duplicate the handle entry', () => {
    const env: Record<string, string> = {
      WSLENV: 'FOO/u:AIO_ADE_TERMINAL_HANDLE/u:BAR/p'
    }

    addAioAdeWslInteropEnv(env)

    expect(env.WSLENV).toBe('FOO/u:AIO_ADE_TERMINAL_HANDLE/u:BAR/p')
  })

  it('marks pane identity and hook env for Windows to WSL import', () => {
    const env: Record<string, string> = {
      AIO_ADE_TERMINAL_HANDLE: 'term_wsl',
      AIO_ADE_USER_DATA_PATH: 'C:\\Users\\jin\\AppData\\Roaming\\AIO-ADE',
      AIO_ADE_CLI_COMMAND: 'aio-ade',
      AIO_ADE_PANE_KEY: 'tab-1:leaf-1',
      AIO_ADE_TAB_ID: 'tab-1',
      AIO_ADE_WORKTREE_ID: 'repo::\\\\wsl.localhost\\Ubuntu\\home\\jin\\repo',
      AIO_ADE_AGENT_HOOK_PORT: '4567',
      AIO_ADE_AGENT_HOOK_TOKEN: 'token',
      AIO_ADE_AGENT_HOOK_ENV: 'dev',
      AIO_ADE_AGENT_HOOK_VERSION: '1'
    }

    addAioAdeWslInteropEnv(env)

    expect(env.WSLENV).toContain('AIO_ADE_TERMINAL_HANDLE/u')
    expect(env.WSLENV).toContain('AIO_ADE_USER_DATA_PATH/p')
    expect(env.WSLENV).toContain('AIO_ADE_CLI_COMMAND/u')
    expect(env.WSLENV).toContain('AIO_ADE_PANE_KEY/u')
    expect(env.WSLENV).toContain('AIO_ADE_TAB_ID/u')
    expect(env.WSLENV).toContain('AIO_ADE_WORKTREE_ID/u')
    expect(env.WSLENV).toContain('AIO_ADE_AGENT_HOOK_PORT/u')
    expect(env.WSLENV).toContain('AIO_ADE_AGENT_HOOK_TOKEN/u')
    expect(env.WSLENV).toContain('AIO_ADE_AGENT_HOOK_ENV/u')
    expect(env.WSLENV).toContain('AIO_ADE_AGENT_HOOK_VERSION/u')
  })

  it('path-translates a Windows hook endpoint but passes a guest-side one untouched', () => {
    const windowsEnv: Record<string, string> = {
      AIO_ADE_AGENT_HOOK_ENDPOINT:
        'C:\\Users\\jin\\AppData\\Roaming\\AIO-ADE\\agent-hooks\\endpoint.cmd'
    }
    addAioAdeWslInteropEnv(windowsEnv)
    expect(windowsEnv.WSLENV).toContain('AIO_ADE_AGENT_HOOK_ENDPOINT/p')

    const guestEnv: Record<string, string> = {
      AIO_ADE_AGENT_HOOK_ENDPOINT: '/home/jin/.aio-ade-wsl/agent-hooks/port-4567/endpoint.env'
    }
    addAioAdeWslInteropEnv(guestEnv)
    expect(guestEnv.WSLENV).toContain('AIO_ADE_AGENT_HOOK_ENDPOINT/u')
    expect(guestEnv.WSLENV).not.toContain('AIO_ADE_AGENT_HOOK_ENDPOINT/p')
  })

  it('tags pre-translated Linux setup paths /u so WSLENV does not translate them again (#9206)', () => {
    const env: Record<string, string> = {
      AIO_ADE_ROOT_PATH: '/home/jin/repo',
      AIO_ADE_WORKTREE_PATH: '/home/jin/repo-worktrees/fix-1',
      AIO_ADE_WORKSPACE_NAME: 'fix-1',
      CONDUCTOR_ROOT_PATH: '/home/jin/repo',
      GHOSTX_ROOT_PATH: '/home/jin/repo'
    }

    addAioAdeWslInteropEnv(env)

    // /u (not /p): hooks.ts already converted these to Linux paths before
    // spawn, so a /p flag would make WSLENV double-translate them.
    expect(env.WSLENV).toContain('AIO_ADE_ROOT_PATH/u')
    expect(env.WSLENV).toContain('AIO_ADE_WORKTREE_PATH/u')
    expect(env.WSLENV).toContain('CONDUCTOR_ROOT_PATH/u')
    expect(env.WSLENV).toContain('GHOSTX_ROOT_PATH/u')
    expect(env.WSLENV).not.toContain('AIO_ADE_ROOT_PATH/p')
    expect(env.WSLENV).not.toContain('AIO_ADE_WORKTREE_PATH/p')
    // The value itself must stay the already-Linux path.
    expect(env.AIO_ADE_ROOT_PATH).toBe('/home/jin/repo')
    expect(env.AIO_ADE_WORKTREE_PATH).toBe('/home/jin/repo-worktrees/fix-1')
  })

  it('tags untranslated Windows setup paths /p so WSLENV translates them (wsl.exe shell over a Windows worktree)', () => {
    const env: Record<string, string> = {
      AIO_ADE_ROOT_PATH: 'C:\\Users\\jin\\repo',
      AIO_ADE_WORKTREE_PATH: 'C:\\Users\\jin\\repo-worktrees\\fix-1',
      CONDUCTOR_ROOT_PATH: 'C:\\Users\\jin\\repo',
      GHOSTX_ROOT_PATH: 'C:\\Users\\jin\\repo'
    }

    addAioAdeWslInteropEnv(env)

    expect(env.WSLENV).toContain('AIO_ADE_ROOT_PATH/p')
    expect(env.WSLENV).toContain('AIO_ADE_WORKTREE_PATH/p')
    expect(env.WSLENV).toContain('CONDUCTOR_ROOT_PATH/p')
    expect(env.WSLENV).toContain('GHOSTX_ROOT_PATH/p')
    expect(env.WSLENV).not.toContain('AIO_ADE_ROOT_PATH/u')
    expect(env.WSLENV).not.toContain('AIO_ADE_WORKTREE_PATH/u')
  })

  it('always tags AIO_ADE_WORKSPACE_NAME /u because it is a name, not a path', () => {
    const env: Record<string, string> = { AIO_ADE_WORKSPACE_NAME: 'fix-1' }

    addAioAdeWslInteropEnv(env)

    expect(env.WSLENV).toBe('AIO_ADE_WORKSPACE_NAME/u')
  })

  it('does not register setup vars that are absent from the env', () => {
    const env: Record<string, string> = { AIO_ADE_TERMINAL_HANDLE: 'term_wsl' }

    addAioAdeWslInteropEnv(env)

    expect(env.WSLENV).toBe('AIO_ADE_TERMINAL_HANDLE/u')
  })

  it('marks the WSL hook relay version for import on relay spawn envs', () => {
    const env: Record<string, string> = {
      AIO_ADE_WSL_HOOK_RELAY_VERSION: '0.1.0+abc'
    }
    addAioAdeWslInteropEnv(env)
    expect(env.WSLENV).toBe('AIO_ADE_WSL_HOOK_RELAY_VERSION/u')
  })

  it('no longer crosses a config overlay for an agent this build cannot launch', () => {
    const env: Record<string, string> = {
      AIO_ADE_TERMINAL_HANDLE: 'term_wsl',
      OPENCODE_CONFIG_DIR: '/home/jin/.aio-ade-relay/opencode-overlays/abc',
      AIO_ADE_OPENCODE_CONFIG_DIR: '/home/jin/.aio-ade-relay/opencode-overlays/abc'
    }
    addAioAdeWslInteropEnv(env)
    expect(env.WSLENV).toContain('AIO_ADE_TERMINAL_HANDLE/u')
    expect(env.WSLENV).not.toContain('OPENCODE_CONFIG_DIR')
  })
})

describe('addWorktreeSetupWslInteropEnv', () => {
  it('registers only setup vars, sharing the /u-vs-/p flag logic with the PTY path (#9206)', () => {
    const env: Record<string, string | undefined> = {
      AIO_ADE_ROOT_PATH: '/mnt/c/Users/jin/repo',
      AIO_ADE_WORKTREE_PATH: 'C:\\Users\\jin\\repo-worktrees\\fix-1',
      AIO_ADE_WORKSPACE_NAME: 'fix-1',
      // Terminal-only vars must not leak into runHook's WSLENV.
      AIO_ADE_TERMINAL_HANDLE: 'term_wsl'
    }

    addWorktreeSetupWslInteropEnv(env)

    expect(env.WSLENV).toBe('AIO_ADE_ROOT_PATH/u:AIO_ADE_WORKTREE_PATH/p:AIO_ADE_WORKSPACE_NAME/u')
  })
})
