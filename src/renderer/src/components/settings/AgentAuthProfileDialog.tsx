import { useState } from 'react'
import { LoaderCircle, Zap } from 'lucide-react'
import type {
  AgentAuthProfile,
  AgentAuthProfileProvider
} from '../../../../shared/agent-auth-profile-types'
import type { AgentAuthProfileListEntry } from '../../../../shared/agent-auth-profile-service-results'
import { useMountedRef } from '@/hooks/useMountedRef'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import { translate } from '@/i18n/i18n'
import {
  buildAgentAuthProfileUpsertInputFromDialogState,
  createAgentAuthProfileDialogState,
  isAgentAuthProfileDialogSubmittable,
  resolveAgentAuthProfileDialogState,
  type AgentAuthProfileDialogState
} from './agent-auth-profile-dialog-state'
import { AgentAuthProfileDialogFields } from './agent-auth-profile-dialog-fields'

type AgentAuthProfileConnectionTestState = 'idle' | 'testing' | 'ok' | 'error'

type AgentAuthProfileDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: AgentAuthProfileListEntry | null
  /** Provider a create dialog opens preselected with; ignored when editing. */
  createProvider?: AgentAuthProfileProvider
  onSaved: (profile: AgentAuthProfile) => void
  overlayClassName?: string
  contentClassName?: string
}

export function AgentAuthProfileDialog({
  open,
  onOpenChange,
  profile,
  createProvider = 'claude',
  onSaved,
  overlayClassName,
  contentClassName
}: AgentAuthProfileDialogProps): React.JSX.Element {
  const mountedRef = useMountedRef()
  const [dialogState, setDialogState] = useState(() => createAgentAuthProfileDialogState(null))
  const [testState, setTestState] = useState<AgentAuthProfileConnectionTestState>('idle')
  const [testMessage, setTestMessage] = useState<string | null>(null)

  const resolvedDialogState = resolveAgentAuthProfileDialogState(
    dialogState,
    open,
    profile,
    createProvider
  )
  if (resolvedDialogState !== dialogState) {
    // Why: parent-controlled close or an edit-target swap must not leak drafts,
    // errors, or a stale connection-test verdict into the next dialog session.
    setDialogState(resolvedDialogState)
    setTestState('idle')
    setTestMessage(null)
  }
  const isEdit = resolvedDialogState.originProfileId !== null
  const isSaving = resolvedDialogState.saveState === 'saving'
  const submittable = isAgentAuthProfileDialogSubmittable(resolvedDialogState)

  // Field edits invalidate the last connection-test verdict along with the draft.
  const patchDialogState = (
    patch: (current: AgentAuthProfileDialogState) => AgentAuthProfileDialogState
  ): void => {
    setDialogState(patch)
    setTestState('idle')
    setTestMessage(null)
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!isSaving) {
      onOpenChange(nextOpen)
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!submittable) {
      return
    }
    const input = buildAgentAuthProfileUpsertInputFromDialogState(resolvedDialogState)
    setDialogState((current) => ({ ...current, saveState: 'saving', saveError: null }))
    try {
      const result =
        resolvedDialogState.originProfileId === null
          ? await window.api.agentAuthProfiles.create({ input })
          : await window.api.agentAuthProfiles.update({
              profileId: resolvedDialogState.originProfileId,
              input
            })
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        onOpenChange(false)
        onSaved(result.value)
        return
      }
      setDialogState((current) => ({ ...current, saveState: 'error', saveError: result.error }))
    } catch (error) {
      if (mountedRef.current) {
        setDialogState((current) => ({
          ...current,
          saveState: 'error',
          saveError: extractIpcErrorMessage(error, 'Failed to save the profile')
        }))
      }
    }
  }

  const handleTest = async (): Promise<void> => {
    if (testState === 'testing' || isSaving) {
      return
    }
    const input = buildAgentAuthProfileUpsertInputFromDialogState(resolvedDialogState)
    setTestState('testing')
    setTestMessage(null)
    try {
      const result = await window.api.agentAuthProfiles.testConnection({
        ...(resolvedDialogState.originProfileId !== null
          ? { profileId: resolvedDialogState.originProfileId }
          : {}),
        input
      })
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        setTestState('ok')
        setTestMessage(
          translate(
            'auto.components.settings.AgentAuthProfileDialog.testOk',
            'Connection OK (HTTP {{status}})',
            {
              status: result.status
            }
          )
        )
      } else {
        setTestState('error')
        setTestMessage(result.error)
      }
    } catch (error) {
      if (mountedRef.current) {
        setTestState('error')
        setTestMessage(extractIpcErrorMessage(error, 'Connection test failed'))
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName={overlayClassName}
        className={cn('sm:max-w-xl', contentClassName)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && submittable) {
            event.preventDefault()
            void handleSave()
          }
        }}
      >
        <DialogHeader className="gap-3">
          <DialogTitle className="leading-tight">
            {isEdit
              ? translate(
                  'auto.components.settings.AgentAuthProfileDialog.editTitle',
                  'Edit API profile'
                )
              : translate(
                  'auto.components.settings.AgentAuthProfileDialog.addTitle',
                  'Add API profile'
                )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.settings.AgentAuthProfileDialog.description',
              'Configure the credentials and endpoint overrides agent sessions launch with. Stored secrets stay encrypted on this device and are never shown again after saving.'
            )}
          </DialogDescription>
        </DialogHeader>
        <AgentAuthProfileDialogFields
          state={resolvedDialogState}
          patch={patchDialogState}
          isSaving={isSaving}
        />
        {testMessage ? (
          <p
            className={cn(
              'text-xs',
              testState === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'
            )}
          >
            {testMessage}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {translate('auto.components.settings.AgentAuthProfileDialog.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSaving || testState === 'testing'}
            onClick={() => void handleTest()}
          >
            {testState === 'testing' ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                {translate('auto.components.settings.AgentAuthProfileDialog.testing', 'Testing...')}
              </>
            ) : (
              <>
                <Zap className="size-4" />
                {translate(
                  'auto.components.settings.AgentAuthProfileDialog.testConnection',
                  'Test connection'
                )}
              </>
            )}
          </Button>
          <Button type="button" disabled={!submittable} onClick={() => void handleSave()}>
            {isSaving ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                {translate('auto.components.settings.AgentAuthProfileDialog.saving', 'Saving...')}
              </>
            ) : isEdit ? (
              translate('auto.components.settings.AgentAuthProfileDialog.saveEdit', 'Save changes')
            ) : (
              translate('auto.components.settings.AgentAuthProfileDialog.saveCreate', 'Add profile')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
