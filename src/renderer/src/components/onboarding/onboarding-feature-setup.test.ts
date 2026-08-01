import { describe, expect, it, vi } from 'vitest'
import type {
  ComputerUsePermissionSetupResult,
  ComputerUsePermissionStatusResult
} from '../../../../shared/computer-use-permissions-types'
import { BROWSER_USE_ENABLED_STORAGE_KEY } from '@/lib/browser-use-setup-state'
import {
  DEFAULT_ONBOARDING_FEATURE_SETUP_SELECTION,
  onboardingFeatureSetupRunTelemetry,
  runOnboardingFeatureSetup,
  type OnboardingFeatureSetupDeps
} from './onboarding-feature-setup'

const GRANTED_STATUS: ComputerUsePermissionStatusResult = {
  platform: 'darwin',
  helperAppPath: '/Applications/Orca Computer Use.app',
  helperUnavailableReason: null,
  permissions: [
    { id: 'accessibility', status: 'granted' },
    { id: 'screenshots', status: 'granted' }
  ]
}

const OPENED_SETUP: ComputerUsePermissionSetupResult = {
  platform: 'darwin',
  helperAppPath: '/Applications/Orca.app',
  openedSettings: true,
  launchedHelper: true
}

function createDeps(
  overrides: Partial<OnboardingFeatureSetupDeps> = {}
): OnboardingFeatureSetupDeps & { storage: Map<string, string> } {
  const storage = new Map<string, string>()
  return {
    storage,
    getComputerUsePermissionStatus: vi.fn(async () => GRANTED_STATUS),
    openComputerUsePermissionSetup: vi.fn(async () => OPENED_SETUP),
    setStorageItem: vi.fn((key, value) => storage.set(key, value)),
    ...overrides
  }
}

describe('onboarding feature setup runner', () => {
  it('defaults the in-app feature choices', () => {
    expect(DEFAULT_ONBOARDING_FEATURE_SETUP_SELECTION).toEqual({
      browserUse: true,
      computerUse: true
    })
  })

  it('enables browser state and checks Computer Use permissions', async () => {
    const deps = createDeps({
      getComputerUsePermissionStatus: vi.fn(
        async (): Promise<ComputerUsePermissionStatusResult> => ({
          ...GRANTED_STATUS,
          permissions: [
            { id: 'accessibility', status: 'not-granted' },
            { id: 'screenshots', status: 'granted' }
          ]
        })
      )
    })

    const result = await runOnboardingFeatureSetup({ browserUse: true, computerUse: true }, deps)

    expect(result).toMatchObject({
      selectedIds: ['browserUse', 'computerUse'],
      computerUsePermissionsOpened: true,
      warnings: []
    })
    expect(deps.storage.get(BROWSER_USE_ENABLED_STORAGE_KEY)).toBe('1')
  })

  it('prepares no global command when only the in-app browser is selected', async () => {
    const deps = createDeps()
    const result = await runOnboardingFeatureSetup({ browserUse: true, computerUse: false }, deps)

    expect(result).toMatchObject({ selectedIds: ['browserUse'] })
  })

  it('emits setup telemetry without preparing a global skill command', () => {
    expect(
      onboardingFeatureSetupRunTelemetry(
        { browserUse: true, computerUse: false },
        {
          selectedIds: ['browserUse'],
          computerUsePermissionsOpened: false,
          warnings: []
        }
      )
    ).toMatchObject({
      browser_use: true,
      skill_commands_copied: false,
      skill_install_command_prepared: false,
      warning_count: 0
    })
  })
})
