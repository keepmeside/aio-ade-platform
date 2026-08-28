import { describe, expect, it, vi } from 'vitest'
import type { SFTPWrapper } from 'ssh2'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/orca-user-data'
  }
}))

import { CodexHookService, codexHookService } from '../codex/hook-service'
import { ClaudeHookService, claudeHookService } from '../claude/hook-service'
import { MANAGED_AGENT_HOOK_INSTALLERS } from './managed-agent-hook-controls'
import {
  installRemoteManagedAgentHooks,
  REMOTE_MANAGED_HOOK_INSTALLER_AGENTS
} from './remote-managed-hook-installers'

type FakeFs = {
  files: Map<string, string>
  dirs: Set<string>
  modes: Map<string, number>
  failRenameTo: Set<string>
}

function createFakeSftp(initialFiles: Record<string, string> = {}): {
  sftp: SFTPWrapper
  fs: FakeFs
} {
  const fs: FakeFs = {
    files: new Map(Object.entries(initialFiles)),
    dirs: new Set(['/']),
    modes: new Map(),
    failRenameTo: new Set()
  }
  const noEntryError = (path: string): { code: number; message: string } => ({
    code: 2,
    message: `ENOENT ${path}`
  })
  const fakeStats = (mode: number): { mode: number } => ({ mode })

  const sftp = {
    readFile: (path: string, _enc: string, cb: (err: unknown, data?: string) => void): void => {
      const v = fs.files.get(path)
      if (v === undefined) {
        cb(noEntryError(path))
        return
      }
      cb(null, v)
    },
    writeFile: (
      path: string,
      content: string,
      options: string | { mode?: number },
      cb: (err: unknown) => void
    ): void => {
      fs.files.set(path, content)
      if (typeof options !== 'string' && options.mode !== undefined) {
        fs.modes.set(path, options.mode)
      }
      cb(null)
    },
    rename: (src: string, dst: string, cb: (err: unknown) => void): void => {
      if (fs.failRenameTo.has(dst)) {
        cb({ code: 4, message: `rename failed ${dst}` })
        return
      }
      const v = fs.files.get(src)
      if (v === undefined) {
        cb(noEntryError(src))
        return
      }
      fs.files.set(dst, v)
      fs.files.delete(src)
      const mode = fs.modes.get(src)
      if (mode !== undefined) {
        fs.modes.set(dst, mode)
        fs.modes.delete(src)
      }
      cb(null)
    },
    unlink: (path: string, cb: (err: unknown) => void): void => {
      fs.files.delete(path)
      fs.modes.delete(path)
      cb(null)
    },
    chmod: (path: string, mode: number, cb: (err: unknown) => void): void => {
      fs.modes.set(path, mode)
      cb(null)
    },
    stat: (path: string, cb: (err: unknown, stats?: { mode: number }) => void): void => {
      if (!fs.files.has(path)) {
        cb(noEntryError(path))
        return
      }
      cb(null, fakeStats(fs.modes.get(path) ?? 0o100644))
    },
    readdir: (path: string, cb: (err: unknown, list?: { filename: string }[]) => void): void => {
      if (fs.dirs.has(path)) {
        cb(null, [])
        return
      }
      cb(noEntryError(path))
    },
    mkdir: (path: string, cb: (err: unknown) => void): void => {
      fs.dirs.add(path)
      cb(null)
    }
  } as unknown as SFTPWrapper
  return { sftp, fs }
}

describe('remote hook service installers', () => {
  it('always writes POSIX scripts for SSH remotes even from a Windows host', async () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'win32' })
    try {
      const installers = [
        {
          path: '/home/dev/.orca/agent-hooks/claude-hook.sh',
          install: (sftp: SFTPWrapper) => new ClaudeHookService().installRemote(sftp, '/home/dev')
        },
        {
          path: '/home/dev/.orca/agent-hooks/codex-hook.sh',
          install: (sftp: SFTPWrapper) => new CodexHookService().installRemote(sftp, '/home/dev')
        }
      ]

      for (const { install, path } of installers) {
        const { sftp, fs } = createFakeSftp()
        const status = await install(sftp)
        expect(status.state).toBe('installed')
        const script = fs.files.get(path)
        if (path.includes('/.config/amp/plugins/')) {
          expect(script).toContain('/hook/amp')
          expect(script).toContain("amp.on('agent.start'")
        } else {
          expect(script).toMatch(/^#!\/bin\/sh\n/)
        }
        expect(script).not.toContain('@echo off')
        expect(script).not.toContain('powershell -NoProfile')
      }
    } finally {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }
    }
  })

  it('installs remote Codex hooks with matching trust entries', async () => {
    const { sftp, fs } = createFakeSftp({
      '/home/dev/.codex/hooks.json': `${JSON.stringify({
        hooks: {},
        _managed: {
          'external-manager': {
            Stop: [0]
          }
        }
      })}\n`
    })

    const status = await new CodexHookService().installRemote(sftp, '/home/dev/')

    expect(status.state).toBe('installed')
    expect(status.configPath).toBe('/home/dev/.codex/hooks.json')
    const hooks = JSON.parse(fs.files.get('/home/dev/.codex/hooks.json')!) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>
      _managed?: unknown
    }
    expect(hooks._managed).toEqual({ 'external-manager': { Stop: [0] } })
    for (const eventName of [
      'SessionStart',
      'UserPromptSubmit',
      'PreToolUse',
      'PermissionRequest',
      'PostToolUse',
      'Stop'
    ]) {
      const command = hooks.hooks[eventName]?.[0]?.hooks?.[0]?.command
      expect(command).toContain('/home/dev/.orca/agent-hooks/codex-hook.sh')
      expect(command).toMatch(/^if \[ -f /)
    }
    expect(fs.files.get('/home/dev/.orca/agent-hooks/codex-hook.sh')).toContain('#!/bin/sh')
    expect(fs.modes.get('/home/dev/.orca/agent-hooks/codex-hook.sh')).toBe(0o755)
    const toml = fs.files.get('/home/dev/.codex/config.toml')
    expect(toml).toContain('/home/dev/.codex/hooks.json:permission_request:0:0')
    expect(toml).toContain('trusted_hash = "sha256:')
  })

  it('installs Codex hooks into an explicit redirected CODEX_HOME (WSL managed runtime home)', async () => {
    const runtimeHome = '/home/dev/.local/share/orca/codex-runtime-home/home'
    const { sftp, fs } = createFakeSftp({
      [`${runtimeHome}/config.toml`]: 'model = "gpt-5.2-codex"\n'
    })

    const status = await new CodexHookService().installRemote(sftp, '/home/dev', {
      codexHomeDir: runtimeHome,
      deferTrustUntilConfigToml: true
    })

    expect(status.state).toBe('installed')
    expect(status.configPath).toBe(`${runtimeHome}/hooks.json`)
    expect(fs.files.has('/home/dev/.codex/hooks.json')).toBe(false)
    const hooks = JSON.parse(fs.files.get(`${runtimeHome}/hooks.json`)!) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>
    }
    expect(hooks.hooks.Stop?.[0]?.hooks?.[0]?.command).toContain(
      '/home/dev/.orca/agent-hooks/codex-hook.sh'
    )
    const toml = fs.files.get(`${runtimeHome}/config.toml`)
    expect(toml).toContain('model = "gpt-5.2-codex"')
    expect(toml).toContain(`${runtimeHome}/hooks.json:stop:0:0`)
  })

  it('defers Codex trust writes until the redirected config.toml exists (launch-path seed race)', async () => {
    const runtimeHome = '/home/dev/.local/share/orca/codex-runtime-home/home'
    const { sftp, fs } = createFakeSftp()

    const status = await new CodexHookService().installRemote(sftp, '/home/dev', {
      codexHomeDir: runtimeHome,
      deferTrustUntilConfigToml: true
    })

    expect(status.state).toBe('installed')
    expect(status.detail).toContain('deferred')
    expect(fs.files.get(`${runtimeHome}/hooks.json`)).toContain('codex-hook.sh')
    // Why: creating config.toml here would make the launch path's
    // only-if-absent seed skip the user's real config.
    expect(fs.files.has(`${runtimeHome}/config.toml`)).toBe(false)
  })

  it('reports Codex trust-write failures without rolling back installed hooks', async () => {
    const { sftp, fs } = createFakeSftp()
    fs.failRenameTo.add('/home/dev/.codex/config.toml')

    const status = await new CodexHookService().installRemote(sftp, '/home/dev')

    expect(status.state).toBe('error')
    expect(status.managedHooksPresent).toBe(true)
    expect(status.detail).toContain('trust entries could not be written')
    expect(fs.files.get('/home/dev/.codex/hooks.json')).toContain('codex-hook.sh')
    expect(fs.files.get('/home/dev/.orca/agent-hooks/codex-hook.sh')).toContain('#!/bin/sh')
  })

  it('registers every managed agent that implements installRemote in the remote installer', () => {
    const servicesByAgent = new Map<string, { installRemote?: unknown }>([
      ['claude', claudeHookService],
      ['codex', codexHookService]
    ])

    // Guard against a service silently missing from the map above as new agents land.
    for (const [agent] of MANAGED_AGENT_HOOK_INSTALLERS) {
      expect(servicesByAgent.has(agent)).toBe(true)
    }

    const registered = new Set<string>(REMOTE_MANAGED_HOOK_INSTALLER_AGENTS)
    const missing: string[] = []
    for (const [agent, service] of servicesByAgent) {
      if (typeof service.installRemote === 'function' && !registered.has(agent)) {
        missing.push(agent)
      }
    }
    expect(missing).toEqual([])
  })

  it('stops before the next installer when its relay request is cancelled', async () => {
    const controller = new AbortController()
    const claudeInstall = vi
      .spyOn(claudeHookService, 'installRemote')
      .mockImplementation(async () => {
        controller.abort()
        return {
          agent: 'claude',
          state: 'installed',
          configPath: '/home/dev/.claude/settings.json',
          managedHooksPresent: true,
          detail: null
        }
      })
    const codexInstall = vi.spyOn(codexHookService, 'installRemote')
    try {
      const { sftp } = createFakeSftp()

      await expect(
        installRemoteManagedAgentHooks(sftp, '/home/dev', { signal: controller.signal })
      ).rejects.toMatchObject({ name: 'AbortError' })
      expect(claudeInstall).toHaveBeenCalledTimes(1)
      expect(codexInstall).not.toHaveBeenCalled()
    } finally {
      claudeInstall.mockRestore()
      codexInstall.mockRestore()
    }
  })
})
