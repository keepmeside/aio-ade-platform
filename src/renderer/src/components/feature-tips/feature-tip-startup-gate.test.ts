import { describe, expect, it } from 'vitest'
import { getDefaultOnboardingState, getDefaultVoiceSettings } from '../../../../shared/constants'
import type { GlobalSettings, OnboardingState } from '../../../../shared/types'
import { getFeatureTipsAppOpenDecision } from './feature-tip-startup-gate'

const existingUserOnboarding: OnboardingState = {
  ...getDefaultOnboardingState(),
  closedAt: Date.parse('2026-05-17T00:00:00.000Z'),
  outcome: 'completed',
  lastCompletedStep: 4
}

function makeSettings(voiceEnabled = false): Pick<GlobalSettings, 'voice'> {
  return { voice: { ...getDefaultVoiceSettings(), enabled: voiceEnabled } }
}

function makeArgs(overrides: Partial<Parameters<typeof getFeatureTipsAppOpenDecision>[0]> = {}) {
  return {
    activeModal: 'none',
    featureTipsSeenIds: [],
    featureInteractions: {},
    onboarding: existingUserOnboarding,
    persistedUIReady: true,
    promptedThisSession: false,
    settings: makeSettings(),
    suppressedByOnboardingThisSession: false,
    ...overrides
  }
}

describe('feature tip startup gate', () => {
  it('opens the command palette tip for an existing user', () => {
    expect(getFeatureTipsAppOpenDecision(makeArgs())).toEqual({
      kind: 'open',
      tipId: 'cmd-j-palette'
    })
  })

  it('suppresses feature tips while onboarding is showing', () => {
    expect(
      getFeatureTipsAppOpenDecision(makeArgs({ onboarding: getDefaultOnboardingState() }))
    ).toEqual({ kind: 'suppress-for-onboarding' })
  })

  it('skips when the app is not ready or another modal is active', () => {
    expect(getFeatureTipsAppOpenDecision(makeArgs({ persistedUIReady: false }))).toEqual({
      kind: 'skip'
    })
    expect(getFeatureTipsAppOpenDecision(makeArgs({ activeModal: 'settings' }))).toEqual({
      kind: 'skip'
    })
  })

  it('skips a tip completed by voice settings or feature interaction', () => {
    expect(
      getFeatureTipsAppOpenDecision(
        makeArgs({
          featureTipsSeenIds: ['cmd-j-palette'],
          settings: makeSettings(true)
        })
      )
    ).toEqual({ kind: 'skip' })
  })
})
