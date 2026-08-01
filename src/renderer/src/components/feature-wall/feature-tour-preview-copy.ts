import { translate } from '@/i18n/i18n'

type FrameId = 1 | 2 | 3

export type FeatureTourPreviewFrameCopy = {
  id: FrameId
  title: string
  caption: string
}

export const FEATURE_TOUR_PREVIEW_COPY: readonly FeatureTourPreviewFrameCopy[] = [
  {
    id: 1,
    get title() {
      return translate(
        'auto.components.feature.wall.FeatureTourPreview.56a0271428',
        'Isolated workspaces'
      )
    },
    get caption() {
      return translate(
        'auto.components.feature.wall.FeatureTourPreview.47f16ecf34',
        'Ship several things at once. Each workspace keeps its branch, terminal, and agent activity together.'
      )
    }
  },
  {
    id: 2,
    get title() {
      return translate(
        'auto.components.feature.wall.FeatureTourPreview.ef737dcee1',
        'GitHub & Linear tasks'
      )
    },
    get caption() {
      return translate(
        'auto.components.feature.wall.FeatureTourPreview.f10c14dd9d',
        'Skip the tab-switching. Pick from your GitHub or Linear backlog and start a workspace in one click.'
      )
    }
  },
  {
    id: 3,
    get title() {
      return translate(
        'auto.components.feature.wall.FeatureTourPreview.1aa8a9a24a',
        'Splittable terminal'
      )
    },
    get caption() {
      return translate(
        'auto.components.feature.wall.FeatureTourPreview.5d6ee181b6',
        'Open any workspace to return to its terminal, then split panes for tests, logs, and agents.'
      )
    }
  }
]
