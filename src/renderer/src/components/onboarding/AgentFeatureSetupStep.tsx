import { Loader2, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeatureSetupChecklist } from './FeatureSetupChecklist'
import {
  hasSelectedOnboardingFeatureSetup,
  type OnboardingFeatureSetupSelection
} from './onboarding-feature-setup'
import { translate } from '@/i18n/i18n'

type AgentFeatureSetupStepProps = {
  featureSetup: OnboardingFeatureSetupSelection
  onFeatureSetupChange: (value: OnboardingFeatureSetupSelection) => void
  setupBusyLabel: string | null
  onStartFeatureSetup: () => void
}

export function AgentFeatureSetupStep({
  featureSetup,
  onFeatureSetupChange,
  setupBusyLabel,
  onStartFeatureSetup
}: AgentFeatureSetupStepProps): React.JSX.Element {
  const hasSelectedFeatures = hasSelectedOnboardingFeatureSetup(featureSetup)
  return (
    <>
      <FeatureSetupChecklist value={featureSetup} onChange={onFeatureSetupChange} />
      <div className="mt-4 flex items-center">
        <Button
          type="button"
          variant="default"
          className="shrink-0"
          disabled={!hasSelectedFeatures || Boolean(setupBusyLabel)}
          onClick={onStartFeatureSetup}
        >
          {setupBusyLabel ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SlidersHorizontal className="size-4" />
          )}
          {setupBusyLabel ??
            translate(
              'auto.components.onboarding.AgentFeatureSetupStep.setUpFeatures',
              'Set Up Features'
            )}
        </Button>
      </div>
    </>
  )
}
