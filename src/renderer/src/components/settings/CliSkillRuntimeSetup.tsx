import type { GlobalSettings } from '../../../../shared/types'
import {
  deriveGlobalWindowsRuntimeDefaultFromLegacySettings,
  normalizeGlobalWindowsRuntimeDefault
} from '../../../../shared/project-execution-runtime'
import {
  quotePowerShellLiteral,
  quotePowerShellNativeArgument
} from '../../../../shared/powershell-native-argument'
import { buildWslLoginShellCommand } from '../../../../shared/wsl-login-shell-command'
import { buildAgentFeatureSkillInstallCommand } from '../../../../shared/agent-feature-install-commands'
import { translate } from '@/i18n/i18n'

export type LocalAgentRuntime = {
  runtime: 'host' | 'wsl'
  wslDistro?: string | null
  label: string
}
const LOCAL_HOST_AGENT_RUNTIME: LocalAgentRuntime = {
  runtime: 'host',
  label: ''
}

export function getHostRuntimeLabel(): string {
  return navigator.userAgent.includes('Windows') ? 'Windows' : 'This device'
}

export function getSelectedAgentRuntime(
  settings: GlobalSettings,
  wslSupportedPlatform: boolean,
  wslAvailable: boolean,
  wslCapabilitiesLoading: boolean
): LocalAgentRuntime {
  const defaultRuntime = normalizeGlobalWindowsRuntimeDefault(
    settings.localWindowsRuntimeDefault ??
      deriveGlobalWindowsRuntimeDefaultFromLegacySettings(settings, {
        wslAvailable: wslCapabilitiesLoading ? undefined : wslAvailable
      }).defaultRuntime
  )
  if (wslSupportedPlatform && defaultRuntime.kind === 'wsl') {
    const selectedDistro = defaultRuntime.distro?.trim() || null
    return {
      runtime: 'wsl',
      wslDistro: selectedDistro,
      label: selectedDistro
        ? `WSL ${selectedDistro}`
        : translate('auto.components.settings.CliSkillRuntimeSetup.c47127f222', 'WSL default')
    }
  }
  return { runtime: 'host', label: getHostRuntimeLabel() }
}

function encodeWslLoginShellScript(command: string): string {
  const bytes = new TextEncoder().encode(buildWslLoginShellCommand(command))
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export function buildSkillCommandForRuntime(
  command: string,
  runtime?: LocalAgentRuntime,
  currentPlatform = getSkillCommandPlatform()
): string {
  const resolvedRuntime = runtime ?? LOCAL_HOST_AGENT_RUNTIME
  const normalizedCommand = normalizeWindowsSkillUpdateCommand(
    command,
    resolvedRuntime,
    currentPlatform
  )
  if (resolvedRuntime.runtime !== 'wsl') {
    return normalizedCommand
  }

  const distroArg = resolvedRuntime.wslDistro?.trim()
    ? ` -d ${quotePowerShellLiteral(resolvedRuntime.wslDistro.trim())}`
    : ''
  // Why: encoding preserves the user's configured login-shell PATH while
  // avoiding raw multiline and nested quotes at the copy/paste boundary.
  const encodedScript = encodeWslLoginShellScript(normalizedCommand)
  const visibleCommand = normalizedCommand.replace(/[\r\n]+/g, ' ')
  const shellScript = `eval "\`printf %s ${encodedScript} | base64 -d\`"`
  const wslCommand = `wsl.exe${distroArg} -- sh -c ${quotePowerShellNativeArgument(shellScript)}`
  // Why: scope Legacy argv parsing to this invocation so Windows PowerShell
  // 5.1 and PowerShell 7 pass the same embedded quotes to wsl.exe.
  return `& { $PSNativeCommandArgumentPassing = 'Legacy'; ${wslCommand} } # Runs: ${visibleCommand}`
}

function normalizeWindowsSkillUpdateCommand(
  command: string,
  runtime: LocalAgentRuntime,
  currentPlatform: NodeJS.Platform
): string {
  if (runtime.runtime === 'wsl' || currentPlatform !== 'win32') {
    return command
  }

  const trimmedCommand = command.trim()
  const updateMatch = /^npx\s+skills\s+update\s+([A-Za-z0-9_-]+)\s+--global$/i.exec(trimmedCommand)
  if (!updateMatch) {
    return command
  }

  // Why: the `skills update` subcommand is currently unreliable on native
  // Windows, while reinstalling from the same repo source is idempotent and
  // keeps the setup affordance working.
  return buildAgentFeatureSkillInstallCommand([updateMatch[1]])
}

function getSkillCommandPlatform(): NodeJS.Platform {
  const platform =
    typeof window === 'undefined' ? undefined : window.api?.platform?.get?.()?.platform
  if (platform) {
    return platform
  }

  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  if (userAgent.includes('Windows')) {
    return 'win32'
  }
  if (userAgent.includes('Mac')) {
    return 'darwin'
  }
  return 'linux'
}

export function buildSkillInstallCommandForRuntime(
  command: string,
  runtime: LocalAgentRuntime
): string {
  return buildSkillCommandForRuntime(command, runtime)
}

export function getSkillDiscoveryTargetForRuntime(
  runtime: LocalAgentRuntime
): { runtime: 'wsl'; wslDistro?: string | null } | undefined {
  return runtime.runtime === 'wsl'
    ? { runtime: 'wsl', wslDistro: runtime.wslDistro ?? null }
    : undefined
}

export function getAgentSkillTerminalShellOverride(
  currentPlatform: string,
  settings: GlobalSettings,
  runtime: LocalAgentRuntime
): string | undefined {
  if (currentPlatform !== 'win32') {
    return undefined
  }
  if (runtime.runtime === 'wsl') {
    return 'powershell.exe'
  }
  return settings.terminalWindowsShell.toLowerCase() === 'wsl.exe' ? 'powershell.exe' : undefined
}
