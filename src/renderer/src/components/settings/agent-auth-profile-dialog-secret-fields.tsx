import { useId } from 'react'
import { X } from 'lucide-react'
import { AGENT_AUTH_PROFILE_ALLOWED_HEADER_NAMES } from '../../../../shared/agent-auth-profile-types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import type {
  AgentAuthProfileDialogHeaderDraft,
  AgentAuthProfileDialogState
} from './agent-auth-profile-dialog-state'

// The dialog's tri-state secret fields. Stored secrets are never re-displayed,
// so every row offers blank-keeps-stored, typed-rotates, and an explicit remove
// toggle; edits flow through one patch helper so the last test verdict drops.

export type AgentAuthProfileDialogPatch = (
  patch: (current: AgentAuthProfileDialogState) => AgentAuthProfileDialogState
) => void

export function AgentAuthProfileDialogApiKeyFields({
  state,
  patch,
  isSaving,
  saveErrorId
}: {
  state: AgentAuthProfileDialogState
  patch: AgentAuthProfileDialogPatch
  isSaving: boolean
  saveErrorId: string
}): React.JSX.Element {
  const apiKeyInputId = useId()
  const apiKeyKindId = useId()
  const { provider, apiKeyDraft, removeStoredApiKey, apiKeyKindDraft } = state
  const { hasStoredApiKey, saveState, saveError } = state
  const isEdit = state.originProfileId !== null

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={apiKeyInputId} className="text-xs">
          {translate('auto.components.settings.AgentAuthProfileDialog.apiKeyLabel', 'API key')}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id={apiKeyInputId}
            autoFocus
            type="password"
            value={apiKeyDraft}
            placeholder={
              hasStoredApiKey && !removeStoredApiKey
                ? translate(
                    'auto.components.settings.AgentAuthProfileDialog.apiKeyKeepPlaceholder',
                    'Blank keeps the stored key'
                  )
                : translate(
                    'auto.components.settings.AgentAuthProfileDialog.apiKeyPlaceholder',
                    'Paste the API key'
                  )
            }
            disabled={isSaving || (isEdit && removeStoredApiKey)}
            aria-invalid={saveState === 'error'}
            aria-describedby={saveState === 'error' && saveError ? saveErrorId : undefined}
            onChange={(event) => {
              const nextDraft = event.target.value
              patch((current) => ({
                ...current,
                apiKeyDraft: nextDraft,
                saveState: current.saveState === 'error' ? 'idle' : current.saveState,
                saveError: current.saveState === 'error' ? null : current.saveError
              }))
            }}
          />
          {hasStoredApiKey ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="shrink-0"
              disabled={isSaving}
              onClick={() => {
                patch((current) => ({
                  ...current,
                  removeStoredApiKey: !current.removeStoredApiKey
                }))
              }}
            >
              {removeStoredApiKey
                ? translate(
                    'auto.components.settings.AgentAuthProfileDialog.keepStoredKey',
                    'Keep stored key'
                  )
                : translate(
                    'auto.components.settings.AgentAuthProfileDialog.removeStoredKey',
                    'Remove stored key'
                  )}
            </Button>
          ) : null}
        </div>
      </div>
      {provider === 'claude' ? (
        <div className="space-y-2">
          <Label htmlFor={apiKeyKindId} className="text-xs">
            {translate(
              'auto.components.settings.AgentAuthProfileDialog.apiKeyKindLabel',
              'Key type'
            )}
          </Label>
          <Select
            value={apiKeyKindDraft}
            disabled={isSaving}
            onValueChange={(nextKind) => {
              patch((current) => ({
                ...current,
                apiKeyKindDraft: nextKind as AgentAuthProfileDialogState['apiKeyKindDraft']
              }))
            }}
          >
            <SelectTrigger id={apiKeyKindId} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="api-key">
                {translate(
                  'auto.components.settings.AgentAuthProfileDialog.apiKeyKindApiKey',
                  'ANTHROPIC_API_KEY (x-api-key header)'
                )}
              </SelectItem>
              <SelectItem value="auth-token">
                {translate(
                  'auto.components.settings.AgentAuthProfileDialog.apiKeyKindAuthToken',
                  'ANTHROPIC_AUTH_TOKEN (bearer)'
                )}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </>
  )
}

export function AgentAuthProfileDialogHeaderProxyFields({
  state,
  patch,
  isSaving
}: {
  state: AgentAuthProfileDialogState
  patch: AgentAuthProfileDialogPatch
  isSaving: boolean
}): React.JSX.Element {
  const proxyCheckboxId = useId()
  const proxyUrlInputId = useId()
  const proxyAuthInputId = useId()
  const { headerDrafts, proxy, hasStoredProxyAuth } = state
  const isEdit = state.originProfileId !== null
  const usedHeaderNames = new Set(headerDrafts.map((draft) => draft.name))
  const unusedHeaderNames = AGENT_AUTH_PROFILE_ALLOWED_HEADER_NAMES.filter(
    (name) => !usedHeaderNames.has(name)
  )

  return (
    <>
      <div className="space-y-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium">
            {translate(
              'auto.components.settings.AgentAuthProfileDialog.headersLabel',
              'Custom headers'
            )}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {translate(
              'auto.components.settings.AgentAuthProfileDialog.headersCaption',
              'Values are encrypted locally and never shown again after saving.'
            )}
          </span>
        </div>
        {headerDrafts.map((draft, index) => (
          <div key={draft.name} className="flex items-center gap-2">
            <span className="w-40 shrink-0 truncate font-mono text-[11px] uppercase text-muted-foreground">
              {draft.name}
            </span>
            <Input
              type="password"
              value={draft.value}
              placeholder={
                draft.keepStored
                  ? translate(
                      'auto.components.settings.AgentAuthProfileDialog.headerValueKeepPlaceholder',
                      'Keep stored value'
                    )
                  : translate(
                      'auto.components.settings.AgentAuthProfileDialog.headerValuePlaceholder',
                      'Header value'
                    )
              }
              disabled={isSaving}
              aria-label={draft.name}
              onChange={(event) => {
                const nextValue = event.target.value
                patch((current) => ({
                  ...current,
                  headerDrafts: current.headerDrafts.map((header, headerIndex) =>
                    headerIndex === index ? { ...header, value: nextValue } : header
                  )
                }))
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0 text-muted-foreground"
              disabled={isSaving}
              aria-label={translate(
                'auto.components.settings.AgentAuthProfileDialog.removeHeader',
                'Remove header'
              )}
              onClick={() => {
                patch((current) => ({
                  ...current,
                  headerDrafts: current.headerDrafts.filter(
                    (_, headerIndex) => headerIndex !== index
                  )
                }))
              }}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
        {unusedHeaderNames.length > 0 ? (
          <Select
            value=""
            disabled={isSaving}
            onValueChange={(nextName) => {
              // The select only offers allowed header names.
              const name = nextName as AgentAuthProfileDialogHeaderDraft['name']
              patch((current) => ({
                ...current,
                headerDrafts: [...current.headerDrafts, { name, value: '', keepStored: false }]
              }))
            }}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue
                placeholder={translate(
                  'auto.components.settings.AgentAuthProfileDialog.addHeaderPlaceholder',
                  'Add header…'
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {unusedHeaderNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={proxyCheckboxId}
            checked={proxy.enabled}
            disabled={isSaving}
            onCheckedChange={(checked) => {
              const nextEnabled = checked === true
              patch((current) => ({
                ...current,
                proxy: { ...current.proxy, enabled: nextEnabled }
              }))
            }}
          />
          <Label htmlFor={proxyCheckboxId} className="text-xs">
            {translate(
              'auto.components.settings.AgentAuthProfileDialog.useProxyLabel',
              'Route requests through a proxy'
            )}
          </Label>
        </div>
        {proxy.enabled ? (
          <div className="space-y-2">
            <div className="space-y-2">
              <Label htmlFor={proxyUrlInputId} className="text-xs">
                {translate(
                  'auto.components.settings.AgentAuthProfileDialog.proxyUrlLabel',
                  'Proxy URL'
                )}
              </Label>
              <Input
                id={proxyUrlInputId}
                value={proxy.url}
                placeholder={translate(
                  'auto.components.settings.AgentAuthProfileDialog.proxyUrlPlaceholder',
                  'https://proxy.example.com'
                )}
                disabled={isSaving}
                onChange={(event) => {
                  const nextUrl = event.target.value
                  patch((current) => ({
                    ...current,
                    proxy: { ...current.proxy, url: nextUrl }
                  }))
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={proxyAuthInputId} className="text-xs">
                {translate(
                  'auto.components.settings.AgentAuthProfileDialog.proxyAuthLabel',
                  'Proxy auth'
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={proxyAuthInputId}
                  type="password"
                  value={proxy.authDraft}
                  placeholder={
                    hasStoredProxyAuth && !proxy.removeStoredAuth
                      ? translate(
                          'auto.components.settings.AgentAuthProfileDialog.proxyAuthKeepPlaceholder',
                          'Blank keeps the stored auth'
                        )
                      : translate(
                          'auto.components.settings.AgentAuthProfileDialog.proxyAuthPlaceholder',
                          'Optional proxy credentials'
                        )
                  }
                  disabled={isSaving || (isEdit && proxy.removeStoredAuth)}
                  onChange={(event) => {
                    const nextAuth = event.target.value
                    patch((current) => ({
                      ...current,
                      proxy: { ...current.proxy, authDraft: nextAuth }
                    }))
                  }}
                />
                {hasStoredProxyAuth ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="shrink-0"
                    disabled={isSaving}
                    onClick={() => {
                      patch((current) => ({
                        ...current,
                        proxy: {
                          ...current.proxy,
                          removeStoredAuth: !current.proxy.removeStoredAuth
                        }
                      }))
                    }}
                  >
                    {proxy.removeStoredAuth
                      ? translate(
                          'auto.components.settings.AgentAuthProfileDialog.keepStoredProxyAuth',
                          'Keep stored auth'
                        )
                      : translate(
                          'auto.components.settings.AgentAuthProfileDialog.removeStoredProxyAuth',
                          'Remove stored auth'
                        )}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
