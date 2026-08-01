import type {
  ComputerUsePermissionSetupResult,
  ComputerUsePermissionStatusResult
} from '../../../../shared/computer-use-permissions-types'
import { BROWSER_USE_ENABLED_STORAGE_KEY } from '@/lib/browser-use-setup-state'
import { e2eConfig } from '@/lib/e2e-config'
import type { EventProps } from '../../../../shared/telemetry-events'

export type OnboardingFeatureSetupId = 'browserUse' | 'computerUse'

export type OnboardingFeatureSetupSelection = Record<OnboardingFeatureSetupId, boolean>

export const DEFAULT_ONBOARDING_FEATURE_SETUP_SELECTION: OnboardingFeatureSetupSelection = {
  browserUse: true,
  computerUse: true
}

export const ONBOARDING_FEATURE_SETUP_IDS: readonly OnboardingFeatureSetupId[] = [
  'browserUse',
  'computerUse'
]

const FEATURE_TELEMETRY_IDS: Record<
  OnboardingFeatureSetupId,
  EventProps<'onboarding_feature_setup_toggled'>['feature']
> = {
  browserUse: 'browser_use',
  computerUse: 'computer_use'
}

export type OnboardingFeatureSetupWarning = {
  featureId: OnboardingFeatureSetupId
  message: string
}

export type OnboardingFeatureSetupResult = {
  selectedIds: OnboardingFeatureSetupId[]
  computerUsePermissionsOpened: boolean
  warnings: OnboardingFeatureSetupWarning[]
}

export type OnboardingFeatureSetupDeps = {
  getComputerUsePermissionStatus: () => Promise<ComputerUsePermissionStatusResult>
  openComputerUsePermissionSetup: () => Promise<ComputerUsePermissionSetupResult>
  setStorageItem: (key: string, value: string) => void
}

export function hasSelectedOnboardingFeatureSetup(
  selection: OnboardingFeatureSetupSelection
): boolean {
  return ONBOARDING_FEATURE_SETUP_IDS.some((id) => selection[id])
}

export function selectedOnboardingFeatureSetupIds(
  selection: OnboardingFeatureSetupSelection
): OnboardingFeatureSetupId[] {
  return ONBOARDING_FEATURE_SETUP_IDS.filter((id) => selection[id])
}

export function onboardingFeatureSetupTelemetryFeature(
  id: OnboardingFeatureSetupId
): EventProps<'onboarding_feature_setup_toggled'>['feature'] {
  return FEATURE_TELEMETRY_IDS[id]
}

export function onboardingFeatureSetupTelemetrySelection(
  selection: OnboardingFeatureSetupSelection
): EventProps<'onboarding_feature_setup_terminal_opened'> {
  return {
    browser_use: selection.browserUse,
    computer_use: selection.computerUse,
    linear_tickets: false,
    selected_count: selectedOnboardingFeatureSetupIds(selection).length
  }
}

export function onboardingFeatureSetupRunTelemetry(
  selection: OnboardingFeatureSetupSelection,
  result: OnboardingFeatureSetupResult
): EventProps<'onboarding_feature_setup_run'> {
  return {
    ...onboardingFeatureSetupTelemetrySelection(selection),
    skill_commands_copied: false,
    skill_install_command_prepared: false,
    computer_use_permissions_opened: result.computerUsePermissionsOpened,
    warning_count: result.warnings.length
  }
}

export function createOnboardingFeatureSetupDeps(): OnboardingFeatureSetupDeps {
  const e2eDeps = getE2EOnboardingFeatureSetupDeps()
  if (e2eDeps) {
    return e2eDeps
  }

  return {
    getComputerUsePermissionStatus: () => window.api.computerUsePermissions.getStatus(),
    openComputerUsePermissionSetup: () => window.api.computerUsePermissions.openSetup(),
    setStorageItem: (key, value) => localStorage.setItem(key, value)
  }
}

function getE2EOnboardingFeatureSetupDeps(): OnboardingFeatureSetupDeps | null {
  if (!e2eConfig.enabled || typeof window === 'undefined') {
    return null
  }
  return (
    (window as unknown as { __onboardingFeatureSetupDeps?: OnboardingFeatureSetupDeps })
      .__onboardingFeatureSetupDeps ?? null
  )
}

export async function runOnboardingFeatureSetup(
  selection: OnboardingFeatureSetupSelection,
  deps: OnboardingFeatureSetupDeps = createOnboardingFeatureSetupDeps()
): Promise<OnboardingFeatureSetupResult> {
  const selectedIds = selectedOnboardingFeatureSetupIds(selection)
  const warnings: OnboardingFeatureSetupWarning[] = []
  let computerUsePermissionsOpened = false

  deps.setStorageItem(BROWSER_USE_ENABLED_STORAGE_KEY, selection.browserUse ? '1' : '0')

  if (selectedIds.length === 0) {
    return {
      selectedIds,
      computerUsePermissionsOpened,
      warnings
    }
  }

  if (selection.computerUse) {
    try {
      const status = await deps.getComputerUsePermissionStatus()
      // Why: when the macOS helper app is missing (e.g. dev builds without
      // `pnpm build:computer-macos`), the status reports all permissions as
      // not-granted alongside a helperUnavailableReason. Without this guard we
      // would call openSetup, which throws an IPC handler error instead of
      // degrading gracefully.
      if (status.helperUnavailableReason) {
        warnings.push({
          featureId: 'computerUse',
          message: status.helperUnavailableReason
        })
      } else {
        const needsMacPermissions =
          status.platform === 'darwin' &&
          status.permissions.some((permission) => permission.status !== 'granted')
        if (needsMacPermissions) {
          await deps.openComputerUsePermissionSetup()
          computerUsePermissionsOpened = true
        }
      }
    } catch (error) {
      warnings.push({
        featureId: 'computerUse',
        message: formatFeatureSetupError(error)
      })
    }
  }

  return {
    selectedIds,
    computerUsePermissionsOpened,
    warnings
  }
}

function formatFeatureSetupError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
