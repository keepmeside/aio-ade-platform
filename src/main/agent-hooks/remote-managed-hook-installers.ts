import type { SFTPWrapper } from 'ssh2'
import type { AgentHookInstallStatus } from '../../shared/agent-hook-types'
import { claudeHookService } from '../claude/hook-service'
import { codexHookService } from '../codex/hook-service'

export type RemoteManagedHookInstallOptions = {
  /** Explicit CODEX_HOME dir for redirected runtimes (WSL managed runtime
   *  home). Codex-only: it is the one agent whose home AIO-ADE redirects. Also
   *  defers the config.toml trust write until that file exists, so the
   *  launch path's only-if-absent seed is never pre-empted. */
  codexHomeDir?: string
  /** Stops before starting the next installer when the owning relay request
   *  is cancelled. Individual filesystem mutations remain atomic. */
  signal?: AbortSignal
}

type RemoteManagedHookInstaller = readonly [
  AgentHookInstallStatus['agent'],
  (
    sftp: SFTPWrapper,
    remoteHome: string,
    options?: RemoteManagedHookInstallOptions
  ) => Promise<AgentHookInstallStatus>
]

const REMOTE_MANAGED_HOOK_INSTALLERS: readonly RemoteManagedHookInstaller[] = [
  ['claude', (sftp, remoteHome) => claudeHookService.installRemote(sftp, remoteHome)],
  [
    'codex',
    (sftp, remoteHome, options) =>
      codexHookService.installRemote(
        sftp,
        remoteHome,
        options?.codexHomeDir
          ? { codexHomeDir: options.codexHomeDir, deferTrustUntilConfigToml: true }
          : undefined
      )
  ]
]

/** Agents wired into the remote (SSH) hook installer. Exported so an invariant
 *  test can assert every locally-managed agent that implements `installRemote`
 *  is registered here — the omission that hid Droid/Copilot status over SSH. */
export const REMOTE_MANAGED_HOOK_INSTALLER_AGENTS: readonly AgentHookInstallStatus['agent'][] =
  REMOTE_MANAGED_HOOK_INSTALLERS.map(([agent]) => agent)

export async function installRemoteManagedAgentHooks(
  sftp: SFTPWrapper,
  remoteHome: string,
  options?: RemoteManagedHookInstallOptions
): Promise<AgentHookInstallStatus[]> {
  const results: AgentHookInstallStatus[] = []
  for (const [agent, install] of REMOTE_MANAGED_HOOK_INSTALLERS) {
    // Why: relay requests can disappear during reconnect; do not start more
    // user-config mutations after their client has gone away.
    options?.signal?.throwIfAborted()
    try {
      const result = await install(sftp, remoteHome, options)
      results.push(result)
      if (result.state === 'error') {
        console.warn(
          `[agent-hooks] Remote ${agent} managed hook install failed for ${result.configPath}: ${
            result.detail ?? 'unknown error'
          }`
        )
      }
    } catch (error) {
      // Why: remote hook installation must not block SSH workspace startup.
      // A broken agent config or transient SFTP failure should degrade status
      // reporting only, while terminals/filesystem/git still come online.
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(`[agent-hooks] Remote ${agent} managed hook install threw: ${detail}`)
      results.push({
        agent,
        state: 'error',
        configPath: remoteHome,
        managedHooksPresent: false,
        detail
      })
    }
  }
  return results
}
