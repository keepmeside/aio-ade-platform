import type { AgentHookInstallStatus } from '../../shared/agent-hook-types'
import type { HookInstallAgent } from '../../shared/telemetry-events'
import type { GlobalSettings } from '../../shared/types'
import { claudeHookService } from '../claude/hook-service'
import { codexHookService } from '../codex/hook-service'

export type ManagedAgentHookInstaller = readonly [HookInstallAgent, () => void]
type ManagedHookRemover = readonly [HookInstallAgent, () => AgentHookInstallStatus]
type ManagedHookStatusReader = readonly [HookInstallAgent, () => AgentHookInstallStatus]

export const MANAGED_AGENT_HOOK_INSTALLERS: readonly ManagedAgentHookInstaller[] = [
  ['claude', () => claudeHookService.install()],
  ['codex', () => codexHookService.install()]
]

const LOCAL_MANAGED_HOOK_REMOVERS: readonly ManagedHookRemover[] = [
  ['claude', () => claudeHookService.remove()],
  ['codex', () => codexHookService.remove()]
]

const LOCAL_MANAGED_HOOK_STATUS_READERS: readonly ManagedHookStatusReader[] = [
  ['claude', () => claudeHookService.getStatus()],
  ['codex', () => codexHookService.getStatus()]
]

export function isAgentStatusHooksEnabled(
  settings: Pick<GlobalSettings, 'agentStatusHooksEnabled'> | null | undefined
): boolean {
  return settings?.agentStatusHooksEnabled !== false
}

export function installManagedAgentHooks(): void {
  for (const [agent, install] of MANAGED_AGENT_HOOK_INSTALLERS) {
    try {
      install()
    } catch (error) {
      console.warn(`[agent-hooks] Failed to install ${agent} managed hooks:`, error)
    }
  }
}

function errorStatus(agent: HookInstallAgent, error: unknown): AgentHookInstallStatus {
  return {
    agent,
    state: 'error',
    configPath: '',
    managedHooksPresent: false,
    detail: error instanceof Error ? error.message : String(error)
  }
}

export function removeManagedAgentHooks(): AgentHookInstallStatus[] {
  return LOCAL_MANAGED_HOOK_REMOVERS.map(([agent, remove]) => {
    try {
      return remove()
    } catch (error) {
      return errorStatus(agent, error)
    }
  })
}

export function getManagedAgentHookStatuses(): AgentHookInstallStatus[] {
  return LOCAL_MANAGED_HOOK_STATUS_READERS.map(([agent, getStatus]) => {
    try {
      return getStatus()
    } catch (error) {
      return errorStatus(agent, error)
    }
  })
}

export function applyAgentStatusHooksEnabled(enabled: boolean): AgentHookInstallStatus[] {
  if (enabled) {
    installManagedAgentHooks()
    return getManagedAgentHookStatuses()
  }
  return removeManagedAgentHooks()
}
