import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AgentAuthProfileProvider } from '../../../../shared/agent-auth-profile-types'
import type {
  AgentAuthProfileListEntry,
  AgentAuthProfileListSnapshot
} from '../../../../shared/agent-auth-profile-service-results'
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
import { Separator } from '@/components/ui/separator'
import { translate } from '@/i18n/i18n'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import { useAppStore } from '@/store'
import { matchesSettingsSearch } from './settings-search'
import { AgentAuthProfileDialog } from './AgentAuthProfileDialog'
import {
  AgentAuthProfilesProviderSection,
  type AgentAuthProfilesPaneAction
} from './agent-auth-profiles-provider-section'
import {
  getAgentAuthProfilesClaudeSearchEntries,
  getAgentAuthProfilesCodexSearchEntries
} from './agent-auth-profiles-search'

// Settings pane for agent auth profiles: owns the list snapshot, one in-flight
// action at a time, and the create/edit/delete dialogs. Rows render through the
// per-provider section; search gating decides which sections stay visible.

export function AgentAuthProfilesPane(): React.JSX.Element {
  const mountedRef = useMountedRef()
  const searchQuery = useAppStore((s) => s.settingsSearchQuery)
  const [snapshot, setSnapshot] = useState<AgentAuthProfileListSnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [action, setAction] = useState<AgentAuthProfilesPaneAction>('idle')
  const [createProvider, setCreateProvider] = useState<AgentAuthProfileProvider>('claude')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AgentAuthProfileListEntry | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AgentAuthProfileListEntry | null>(null)

  const refreshProfiles = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.agentAuthProfiles.list()
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        setSnapshot(result.value)
        setLoadError(null)
      } else {
        setLoadError(result.error)
      }
    } catch (error) {
      if (mountedRef.current) {
        setLoadError(extractIpcErrorMessage(error, 'Failed to load API profiles'))
      }
    }
  }, [mountedRef])

  useEffect(() => {
    void refreshProfiles()
  }, [refreshProfiles])

  const runAction = useCallback(
    async (actionId: AgentAuthProfilesPaneAction, run: () => Promise<void>): Promise<void> => {
      if (action !== 'idle') {
        return
      }
      setAction(actionId)
      try {
        await run()
      } finally {
        if (mountedRef.current) {
          setAction('idle')
        }
      }
    },
    [action, mountedRef]
  )

  const handleSetDefault = (provider: AgentAuthProfileProvider, profileId: string): Promise<void> =>
    runAction(`default:${profileId}`, async () => {
      try {
        const result = await window.api.agentAuthProfiles.setProviderDefault({
          provider,
          profileId
        })
        if (!mountedRef.current) {
          return
        }
        if (result.ok) {
          await refreshProfiles()
        } else {
          toast.error(result.error)
        }
      } catch (error) {
        toast.error(extractIpcErrorMessage(error, 'Failed to set the default profile'))
      }
    })

  const handleClearDefault = (provider: AgentAuthProfileProvider): Promise<void> =>
    runAction(`clear-default:${provider}`, async () => {
      try {
        const result = await window.api.agentAuthProfiles.setProviderDefault({
          provider,
          profileId: null
        })
        if (!mountedRef.current) {
          return
        }
        if (result.ok) {
          await refreshProfiles()
        } else {
          toast.error(result.error)
        }
      } catch (error) {
        toast.error(extractIpcErrorMessage(error, 'Failed to clear the default profile'))
      }
    })

  const handleDuplicate = (profile: AgentAuthProfileListEntry): Promise<void> =>
    runAction(`duplicate:${profile.id}`, async () => {
      try {
        const result = await window.api.agentAuthProfiles.duplicate({ profileId: profile.id })
        if (!mountedRef.current) {
          return
        }
        if (result.ok) {
          toast.success(
            translate(
              'auto.components.settings.AgentAuthProfilesPane.duplicatedToast',
              'Duplicated "{{label}}"',
              {
                label: result.value.label ?? result.value.id
              }
            )
          )
          await refreshProfiles()
        } else {
          toast.error(result.error)
        }
      } catch (error) {
        toast.error(extractIpcErrorMessage(error, 'Failed to duplicate the profile'))
      }
    })

  const handleTest = (profile: AgentAuthProfileListEntry): Promise<void> =>
    runAction(`test:${profile.id}`, async () => {
      try {
        const result = await window.api.agentAuthProfiles.testConnection({ profileId: profile.id })
        if (!mountedRef.current) {
          return
        }
        if (result.ok) {
          toast.success(
            translate(
              'auto.components.settings.AgentAuthProfilesPane.testOkToast',
              'Connection OK (HTTP {{status}})',
              {
                status: result.status
              }
            )
          )
        } else {
          toast.error(result.error)
        }
      } catch (error) {
        toast.error(extractIpcErrorMessage(error, 'Connection test failed'))
      }
    })

  const handleDeleteConfirm = (): Promise<void> => {
    const target = deleteTarget
    if (target === null) {
      return Promise.resolve()
    }
    return runAction(`delete:${target.id}`, async () => {
      try {
        const result = await window.api.agentAuthProfiles.delete({ profileId: target.id })
        if (!mountedRef.current) {
          return
        }
        if (result.ok) {
          setDeleteTarget(null)
          toast.success(
            translate(
              'auto.components.settings.AgentAuthProfilesPane.deletedToast',
              'API profile deleted'
            )
          )
          if (result.value.warnings.length > 0) {
            toast.warning(
              translate(
                'auto.components.settings.AgentAuthProfilesPane.deletedWarningsToast',
                'Deleted with cleanup warnings'
              ),
              { description: result.value.warnings.join('\n') }
            )
          }
          await refreshProfiles()
        } else if ((result.liveSessionIds?.length ?? 0) > 0) {
          toast.error(
            translate(
              'auto.components.settings.AgentAuthProfilesPane.liveBlockToast',
              'This profile is still used by live sessions'
            ),
            {
              description: translate(
                'auto.components.settings.AgentAuthProfilesPane.liveBlockToastDescription',
                'Stop the sessions using it, then retry the delete.'
              )
            }
          )
        } else {
          toast.error(result.error)
        }
      } catch (error) {
        toast.error(extractIpcErrorMessage(error, 'Failed to delete the profile'))
      }
    })
  }

  const handleAdd = (provider: AgentAuthProfileProvider): void => {
    setCreateProvider(provider)
    setCreateOpen(true)
  }

  const handleEditProfile = (profile: AgentAuthProfileListEntry): void => {
    setEditTarget(profile)
    setEditOpen(true)
  }

  const handleDeleteProfile = (profile: AgentAuthProfileListEntry): void => {
    setDeleteTarget(profile)
  }

  const handleSaved = (): void => {
    void refreshProfiles()
  }

  const isDeletingTarget = deleteTarget !== null && action === `delete:${deleteTarget.id}`

  const sectionProps = {
    snapshot,
    loadError,
    action,
    onAdd: handleAdd,
    onSetDefault: handleSetDefault,
    onClearDefault: handleClearDefault,
    onTest: handleTest,
    onEdit: handleEditProfile,
    onDuplicate: handleDuplicate,
    onDelete: handleDeleteProfile
  }

  const visibleSections = [
    matchesSettingsSearch(searchQuery, getAgentAuthProfilesClaudeSearchEntries()) ? (
      <AgentAuthProfilesProviderSection key="claude" provider="claude" {...sectionProps} />
    ) : null,
    matchesSettingsSearch(searchQuery, getAgentAuthProfilesCodexSearchEntries()) ? (
      <AgentAuthProfilesProviderSection key="codex" provider="codex" {...sectionProps} />
    ) : null
  ].filter(Boolean)

  return (
    <div className="space-y-8">
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingTarget) {
            setDeleteTarget(null)
          }
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {translate(
                'auto.components.settings.AgentAuthProfilesPane.deleteTitle',
                'Delete API Profile?'
              )}
            </DialogTitle>
            <DialogDescription>
              {translate(
                'auto.components.settings.AgentAuthProfilesPane.deleteDescription',
                'This permanently deletes the stored credentials for "{{label}}". Live sessions keep their launch-time credentials until they exit.',
                { label: deleteTarget?.label ?? deleteTarget?.id ?? '' }
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isDeletingTarget}
              onClick={() => setDeleteTarget(null)}
            >
              {translate('auto.components.settings.AgentAuthProfilesPane.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={isDeletingTarget}
              onClick={() => void handleDeleteConfirm()}
            >
              {isDeletingTarget ? <Loader2 className="size-4 animate-spin" /> : null}
              {translate(
                'auto.components.settings.AgentAuthProfilesPane.deleteConfirm',
                'Delete Profile'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AgentAuthProfileDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        profile={null}
        createProvider={createProvider}
        onSaved={handleSaved}
      />
      <AgentAuthProfileDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditTarget(null)
          }
        }}
        profile={editTarget}
        onSaved={handleSaved}
      />
      {loadError !== null ? (
        <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <p className="text-xs text-destructive">{loadError}</p>
          <Button
            variant="outline"
            size="xs"
            disabled={action !== 'idle'}
            onClick={() => void refreshProfiles()}
          >
            {translate('auto.components.settings.AgentAuthProfilesPane.loadErrorRetry', 'Retry')}
          </Button>
        </div>
      ) : null}
      {visibleSections.map((section, index) => (
        <div key={index} className="space-y-8">
          {index > 0 ? <Separator /> : null}
          {section}
        </div>
      ))}
    </div>
  )
}
