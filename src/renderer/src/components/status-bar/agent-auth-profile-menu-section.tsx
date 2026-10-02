import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AgentAuthProfileProvider } from '../../../../shared/agent-auth-profile-types'
import type { AgentAuthProfileListSnapshot } from '../../../../shared/agent-auth-profile-service-results'
import { useMountedRef } from '@/hooks/useMountedRef'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import { isWebClientLocation } from '@/lib/web-client-location'
import { useAppStore } from '@/store'

// Quick profile switch inside the Claude/Codex provider menus. It mounts with
// the dropdown content, so the roster loads per open; pty exits re-list so the
// default stays fresh while the menu is up. Only the provider default moves
// here — full profile management lives in Settings.

export function AgentAuthProfileMenuSection({
  provider
}: {
  provider: AgentAuthProfileProvider
}): React.JSX.Element | null {
  const mountedRef = useMountedRef()
  const openSettingsTarget = useAppStore((s) => s.openSettingsTarget)
  const openSettingsPage = useAppStore((s) => s.openSettingsPage)
  const [snapshot, setSnapshot] = useState<AgentAuthProfileListSnapshot | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [switching, setSwitching] = useState(false)
  // Why: profiles live in the desktop main's encrypted vault; the web client has no such IPC.
  const isWebClient = isWebClientLocation()

  const refreshProfiles = useCallback(async (): Promise<void> => {
    try {
      const result = await window.api.agentAuthProfiles.list()
      if (!mountedRef.current) {
        return
      }
      if (result.ok) {
        setSnapshot(result.value)
        setLoadFailed(false)
      } else {
        setLoadFailed(true)
      }
    } catch {
      if (mountedRef.current) {
        setLoadFailed(true)
      }
    }
  }, [mountedRef])

  useEffect(() => {
    if (isWebClient) {
      return
    }
    void refreshProfiles()
  }, [refreshProfiles, isWebClient])

  useEffect(() => {
    if (isWebClient) {
      return
    }
    // Live-session counts change when agent sessions exit.
    return window.api.pty.onExit(() => {
      void refreshProfiles()
    })
  }, [refreshProfiles, isWebClient])

  const handleSelect = async (profileId: string | null): Promise<void> => {
    if (switching) {
      return
    }
    setSwitching(true)
    try {
      const result = await window.api.agentAuthProfiles.setProviderDefault({ provider, profileId })
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
    } finally {
      if (mountedRef.current) {
        setSwitching(false)
      }
    }
  }

  if (isWebClient) {
    return null
  }

  const profiles = (snapshot?.profiles ?? []).filter((profile) => profile.provider === provider)
  const defaultProfileId = snapshot?.defaultProfileIdByProvider[provider] ?? null

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>
        {translate(
          'auto.components.status.bar.AgentAuthProfileMenuSection.profile_label',
          'API Profile'
        )}
      </DropdownMenuLabel>
      {snapshot === null ? (
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
          {loadFailed
            ? translate(
                'auto.components.status.bar.AgentAuthProfileMenuSection.load_failed',
                'Failed to load API profiles'
              )
            : translate(
                'auto.components.status.bar.AgentAuthProfileMenuSection.loading',
                'Loading API profiles…'
              )}
        </div>
      ) : (
        <>
          <DropdownMenuItem
            disabled={switching || defaultProfileId === null}
            onSelect={(event) => {
              // Why: keep the menu open so the new active marker stays visible.
              event.preventDefault()
              void handleSelect(null)
            }}
          >
            <span className="min-w-0 flex-1 truncate">
              {translate(
                'auto.components.status.bar.AgentAuthProfileMenuSection.account_only',
                'Account / CLI default (no profile)'
              )}
            </span>
            {defaultProfileId === null ? (
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                {translate(
                  'auto.components.status.bar.AgentAuthProfileMenuSection.active',
                  'Active'
                )}
              </span>
            ) : null}
          </DropdownMenuItem>
          {profiles.map((profile) => (
            <DropdownMenuItem
              key={profile.id}
              disabled={switching || defaultProfileId === profile.id}
              onSelect={(event) => {
                event.preventDefault()
                void handleSelect(profile.id)
              }}
            >
              <span className="min-w-0 flex-1 truncate">{profile.label ?? profile.id}</span>
              {defaultProfileId === profile.id ? (
                <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                  {translate(
                    'auto.components.status.bar.AgentAuthProfileMenuSection.active',
                    'Active'
                  )}
                </span>
              ) : null}
            </DropdownMenuItem>
          ))}
        </>
      )}
      <DropdownMenuItem
        onSelect={() => {
          openSettingsTarget({
            pane: 'agent-auth-profiles',
            repoId: null,
            sectionId: `agent-auth-profiles-${provider}`
          })
          openSettingsPage()
        }}
      >
        {translate(
          'auto.components.status.bar.AgentAuthProfileMenuSection.manage_profiles',
          'Manage API Profiles…'
        )}
      </DropdownMenuItem>
    </>
  )
}
