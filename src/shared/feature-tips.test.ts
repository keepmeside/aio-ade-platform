import { describe, expect, it } from 'vitest'
import {
  FEATURE_TIPS,
  getCompletedFeatureTipIds,
  getOrderedUnseenFeatureTips,
  normalizeFeatureTipIds,
  type FeatureTipId
} from './feature-tips'

describe('feature tips', () => {
  it('orders new unseen tips before older unseen tips', () => {
    const tips = getOrderedUnseenFeatureTips({ seenTipIds: new Set<FeatureTipId>() })

    expect(tips.map((tip) => tip.id)).toEqual(['cmd-j-palette', 'voice-dictation'])
  })

  it('skips seen and completed tips', () => {
    const tips = getOrderedUnseenFeatureTips({
      seenTipIds: new Set<FeatureTipId>(['cmd-j-palette']),
      completedTipIds: getCompletedFeatureTipIds({ voiceDictationEnabled: true })
    })

    expect(tips).toEqual([])
  })

  it('uses feature interactions to complete tips', () => {
    const completed = getCompletedFeatureTipIds({
      voiceDictationEnabled: false,
      featureInteractions: {
        'voice-dictation': { firstInteractedAt: 100, interactionCount: 1 }
      }
    })

    expect(completed).toEqual(new Set<FeatureTipId>(['voice-dictation']))
  })

  it('drops removed and unknown persisted tip ids', () => {
    expect(
      normalizeFeatureTipIds(['retired-tip', 'bogus', 'cmd-j-palette', 'voice-dictation'])
    ).toEqual(['cmd-j-palette', 'voice-dictation'])
  })

  it('keeps the command palette and voice tips', () => {
    expect(FEATURE_TIPS.map((tip) => tip.action)).toEqual(['learn-cmd-j-palette', 'enable-voice'])
  })
})
