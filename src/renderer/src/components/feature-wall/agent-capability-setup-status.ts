import { useEffect, useMemo, useState } from 'react'
import type {
  OnboardingFeatureSetupId,
  OnboardingFeatureSetupSelection
} from '../onboarding/onboarding-feature-setup'
import { translate } from '@/i18n/i18n'

export type AgentCapabilityInstallStatusTone = 'ready' | 'pending' | 'checking' | 'error'

export type AgentCapabilityInstallStatus = {
  label: string
  tone: AgentCapabilityInstallStatusTone
  installed?: boolean
}

export type AgentCapabilityReadiness = {
  browserUseSkillInstalled: boolean
  browserUseSkillLoading: boolean
  computerUseReady: boolean
  computerUseChecking: boolean
  computerUseUnavailable: boolean
}

export type AgentCapabilitySetupStatus = {
  readiness: AgentCapabilityReadiness
  installStatus: Record<OnboardingFeatureSetupId, AgentCapabilityInstallStatus>
}

export function useAgentCapabilitySetupStatus(): AgentCapabilitySetupStatus {
  const computerUsePermissionStatus = useComputerUsePermissionStatus(true)
  const readiness: AgentCapabilityReadiness = useMemo(
    () => ({
      browserUseSkillInstalled: true,
      browserUseSkillLoading: false,
      computerUseReady: computerUsePermissionStatus.ready,
      computerUseChecking: computerUsePermissionStatus.checking,
      computerUseUnavailable: computerUsePermissionStatus.unavailableReason !== null
    }),
    [
      computerUsePermissionStatus.checking,
      computerUsePermissionStatus.ready,
      computerUsePermissionStatus.unavailableReason
    ]
  )

  const installStatus = useMemo(
    () => ({
      browserUse: getBrowserUseInstallStatus(),
      computerUse: getComputerUseInstallStatus(computerUsePermissionStatus)
    }),
    [computerUsePermissionStatus]
  )

  return { readiness, installStatus }
}

export function getDefaultAgentCapabilitySetupSelection(
  readiness: AgentCapabilityReadiness
): OnboardingFeatureSetupSelection {
  return {
    browserUse: false,
    computerUse: !readiness.computerUseReady && !readiness.computerUseUnavailable
  }
}

export function isAgentCapabilityReadinessChecking(readiness: AgentCapabilityReadiness): boolean {
  return readiness.browserUseSkillLoading || readiness.computerUseChecking
}

export function getAgentCapabilityStatusClassName(tone: AgentCapabilityInstallStatusTone): string {
  switch (tone) {
    case 'ready':
      return 'text-green-600 dark:text-green-300'
    case 'error':
      return 'text-destructive'
    case 'checking':
    case 'pending':
      return 'text-muted-foreground'
  }
}

function getBrowserUseInstallStatus(): AgentCapabilityInstallStatus {
  return {
    label: translate(
      'auto.components.feature.wall.agent.capability.setup.status.browserReady',
      'Available in Orca'
    ),
    tone: 'ready',
    installed: true
  }
}

function getComputerUseInstallStatus(permissions: {
  ready: boolean
  checking: boolean
  unavailableReason: string | null
}): AgentCapabilityInstallStatus {
  if (permissions.checking) {
    return {
      label: translate(
        'auto.components.feature.wall.agent.capability.setup.status.5c9293e51a',
        'checking app access'
      ),
      tone: 'checking',
      installed: true
    }
  }
  if (permissions.unavailableReason) {
    return {
      label:
        permissions.unavailableReason === 'web_client'
          ? translate(
              'auto.components.feature.wall.agent.capability.setup.status.4c8e1f92a7',
              'open Orca Desktop on this Mac'
            )
          : translate(
              'auto.components.feature.wall.agent.capability.setup.status.6d2b0a84e1',
              'Unavailable in this build'
            ),
      tone: 'pending',
      installed: true
    }
  }
  if (!permissions.ready) {
    return {
      label: translate(
        'auto.components.feature.wall.agent.capability.setup.status.clickSetUpFeaturesMacAccess',
        'click Set Up Features to open macOS access settings'
      ),
      tone: 'pending',
      installed: true
    }
  }
  return {
    label: translate(
      'auto.components.feature.wall.agent.capability.setup.status.browserReady',
      'Available in Orca'
    ),
    tone: 'ready',
    installed: true
  }
}

function useComputerUsePermissionStatus(enabled: boolean): {
  ready: boolean
  checking: boolean
  unavailableReason: string | null
} {
  const [status, setStatus] = useState<{
    ready: boolean
    checking: boolean
    unavailableReason: string | null
  }>({
    ready: false,
    checking: enabled,
    unavailableReason: null
  })

  useEffect(() => {
    if (!enabled) {
      setStatus({ ready: false, checking: false, unavailableReason: null })
      return
    }

    let stale = false
    const refresh = (): void => {
      setStatus((current) => ({ ...current, checking: true }))
      window.api.computerUsePermissions
        .getStatus()
        .then((next) => {
          if (stale) {
            return
          }
          setStatus({
            ready:
              next.helperUnavailableReason === null &&
              next.permissions.every((permission) => permission.status !== 'not-granted'),
            checking: false,
            unavailableReason: next.helperUnavailableReason
          })
        })
        .catch(() => {
          if (stale) {
            return
          }
          setStatus({ ready: false, checking: false, unavailableReason: null })
        })
    }

    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      stale = true
      window.removeEventListener('focus', refresh)
    }
  }, [enabled])

  return status
}
