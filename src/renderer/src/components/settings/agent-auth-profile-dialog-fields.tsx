import { useId } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import type { AgentAuthProfileDialogState } from './agent-auth-profile-dialog-state'
import {
  AgentAuthProfileDialogApiKeyFields,
  AgentAuthProfileDialogHeaderProxyFields,
  type AgentAuthProfileDialogPatch
} from './agent-auth-profile-dialog-secret-fields'

// Identity, credential, endpoint, header, and proxy fields in the dialog's
// fixed order; the save error alert stays anchored to the API key input.

export function AgentAuthProfileDialogFields({
  state,
  patch,
  isSaving
}: {
  state: AgentAuthProfileDialogState
  patch: AgentAuthProfileDialogPatch
  isSaving: boolean
}): React.JSX.Element {
  const providerInputId = useId()
  const labelInputId = useId()
  const baseUrlInputId = useId()
  const modelInputId = useId()
  const apiKeyErrorId = useId()
  const { provider, label, baseUrl, model, saveState, saveError } = state
  const isEdit = state.originProfileId !== null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={providerInputId} className="text-xs">
            {translate('auto.components.settings.AgentAuthProfileDialog.providerLabel', 'Provider')}
          </Label>
          <Select
            value={provider}
            disabled={isEdit || isSaving}
            onValueChange={(nextProvider) => {
              patch((current) => ({
                ...current,
                provider: nextProvider as AgentAuthProfileDialogState['provider']
              }))
            }}
          >
            <SelectTrigger id={providerInputId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude">
                {translate(
                  'auto.components.settings.AgentAuthProfileDialog.providerClaude',
                  'Claude'
                )}
              </SelectItem>
              <SelectItem value="codex">
                {translate(
                  'auto.components.settings.AgentAuthProfileDialog.providerCodex',
                  'Codex'
                )}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={labelInputId} className="text-xs">
            {translate('auto.components.settings.AgentAuthProfileDialog.labelLabel', 'Label')}
          </Label>
          <Input
            id={labelInputId}
            maxLength={64}
            value={label}
            placeholder={translate(
              'auto.components.settings.AgentAuthProfileDialog.labelPlaceholder',
              'Optional label'
            )}
            disabled={isSaving}
            onChange={(event) => {
              const nextLabel = event.target.value
              patch((current) => ({ ...current, label: nextLabel }))
            }}
          />
        </div>
      </div>
      <AgentAuthProfileDialogApiKeyFields
        state={state}
        patch={patch}
        isSaving={isSaving}
        saveErrorId={apiKeyErrorId}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={baseUrlInputId} className="text-xs">
            {translate('auto.components.settings.AgentAuthProfileDialog.baseUrlLabel', 'Base URL')}
          </Label>
          <Input
            id={baseUrlInputId}
            value={baseUrl}
            placeholder={translate(
              'auto.components.settings.AgentAuthProfileDialog.baseUrlPlaceholder',
              'Optional endpoint override'
            )}
            disabled={isSaving}
            onChange={(event) => {
              const nextBaseUrl = event.target.value
              patch((current) => ({ ...current, baseUrl: nextBaseUrl }))
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={modelInputId} className="text-xs">
            {translate('auto.components.settings.AgentAuthProfileDialog.modelLabel', 'Model')}
          </Label>
          <Input
            id={modelInputId}
            value={model}
            placeholder={translate(
              'auto.components.settings.AgentAuthProfileDialog.modelPlaceholder',
              'Optional model override'
            )}
            disabled={isSaving}
            onChange={(event) => {
              const nextModel = event.target.value
              patch((current) => ({ ...current, model: nextModel }))
            }}
          />
        </div>
      </div>
      <AgentAuthProfileDialogHeaderProxyFields state={state} patch={patch} isSaving={isSaving} />
      {saveState === 'error' && saveError ? (
        <p id={apiKeyErrorId} role="alert" className="text-xs text-destructive">
          {saveError}
        </p>
      ) : null}
    </div>
  )
}
