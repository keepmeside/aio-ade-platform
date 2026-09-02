import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  CircleUserRound,
  Cloud,
  Laptop,
  Loader2,
  Plus,
  Settings2,
  Users
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import type {
  AioAdeCloudOrgSummary,
  AioAdeProfileSummary
} from '../../../../shared/aio-ade-profiles'
import { AioAdeProfileAvatar } from './AioAdeProfileAvatar'
import { AioAdeProfileCloudMenuItems } from './AioAdeProfileCloudMenuItems'
import { AioAdeProfileCreateDialog } from './AioAdeProfileCreateDialog'
import { AioAdeProfileOrgMembersDialog } from './AioAdeProfileOrgMembersDialog'
import { AioAdeProfileManagementDialog } from './AioAdeProfileManagementDialog'
import { AioAdeProfileMenuHeader } from './AioAdeProfileMenuHeader'
import { AioAdeProfileSignOutConfirmDialog } from './AioAdeProfileSignOutConfirmDialog'
import { AioAdeProfileSwitchConfirmDialog } from './AioAdeProfileSwitchConfirmDialog'
import { getAioAdeAccountIdentity } from './aio-ade-account-identity'
import { getAioAdeProfileSwitchLiveWorkSummary } from './aio-ade-profile-switch-liveness'

function isWebClient(): boolean {
  return Boolean((window as unknown as { __AIO_ADE_WEB_CLIENT__?: boolean }).__AIO_ADE_WEB_CLIENT__)
}

function getProfileSubtitle(profile: AioAdeProfileSummary): string {
  if (profile.cloud?.activeOrgName) {
    return profile.cloud.activeOrgName
  }
  if (profile.cloud?.email) {
    return profile.cloud.email
  }
  return translate('auto.components.aio-ade.profiles.switcher.b4f9d1125d', 'Local')
}

export function AioAdeProfileSwitcher({
  placement = 'titlebar'
}: {
  placement?: 'titlebar' | 'sidebar'
}): React.JSX.Element | null {
  const profiles = useAppStore((s) => s.aioAdeProfiles)
  const activeProfileId = useAppStore((s) => s.activeAioAdeProfileId)
  const loading = useAppStore((s) => s.aioAdeProfilesLoading)
  const switching = useAppStore((s) => s.aioAdeProfileSwitching)
  const connecting = useAppStore((s) => s.aioAdeProfileConnecting)
  const authStatus = useAppStore((s) => s.aioAdeProfileAuthStatus)
  const multiProfileUi = useAppStore((s) => s.aioAdeProfilesMultiProfileUi)
  const fetchProfiles = useAppStore((s) => s.fetchAioAdeProfiles)
  const createLocalProfile = useAppStore((s) => s.createLocalAioAdeProfile)
  const createCloudLinkedProfile = useAppStore((s) => s.createCloudLinkedAioAdeProfile)
  const connectCurrentProfile = useAppStore((s) => s.connectCurrentAioAdeProfile)
  const signOutCurrentProfile = useAppStore((s) => s.signOutCurrentAioAdeProfile)
  const selectOrg = useAppStore((s) => s.selectAioAdeProfileOrg)
  const switchProfile = useAppStore((s) => s.switchAioAdeProfile)
  const liveWorkSummary = useAppStore(useShallow((s) => getAioAdeProfileSwitchLiveWorkSummary(s)))
  const [dialogOpen, setDialogOpen] = useState(false)
  const [managementOpen, setManagementOpen] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [creating, setCreating] = useState(false)
  const [creatingCloudProfile, setCreatingCloudProfile] = useState(false)
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [orgMembersOpen, setOrgMembersOpen] = useState(false)
  const [pendingSwitchProfileId, setPendingSwitchProfileId] = useState<string | null>(null)
  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null,
    [activeProfileId, profiles]
  )
  const pendingSwitchProfile = useMemo(
    () => profiles.find((profile) => profile.id === pendingSwitchProfileId) ?? null,
    [pendingSwitchProfileId, profiles]
  )

  // Why: one attempt per mount — retrying on every loading toggle would spin
  // an unbounded IPC loop when the list call persistently fails.
  const fetchAttemptedRef = useRef(false)
  useEffect(() => {
    if (profiles.length === 0 && !loading && !fetchAttemptedRef.current) {
      fetchAttemptedRef.current = true
      void fetchProfiles()
    }
  }, [fetchProfiles, loading, profiles.length])

  // Why: the AIO-ADE Cloud account UX isn't ready for production users yet, so the
  // trigger stays hidden in packaged builds. Dev builds still show it when cloud
  // auth is configured. electron-vite build forces NODE_ENV=production, so PROD
  // is baked true even for the e2e bundle; exempt MODE==='e2e' so the switcher
  // specs can exercise the render path while real packaged prod builds stay hidden.
  if (import.meta.env.PROD && import.meta.env.MODE !== 'e2e') {
    return null
  }

  // Why: paired web/mobile clients only see the desktop stub's fabricated
  // profile list; showing a switcher there would misreport the active profile
  // and none of its actions can work remotely.
  if (isWebClient() || !activeProfile) {
    return null
  }

  // Why: with multi-profile UI downscoped, local-only builds (no cloud
  // configured) have nothing to offer in an account menu — show no trigger.
  if (!multiProfileUi && authStatus?.configured !== true) {
    return null
  }

  const handleCreateProfile = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (creating || switching) {
      return
    }
    setCreating(true)
    const profile = await createLocalProfile(newProfileName)
    setCreating(false)
    if (!profile) {
      return
    }
    setNewProfileName('')
    setDialogOpen(false)
    if (liveWorkSummary.hasLiveWork) {
      setPendingSwitchProfileId(profile.id)
      return
    }
    await switchProfile(profile.id)
  }

  const handleSwitchProfile = (profileId: string): void => {
    if (profileId === activeProfileId || switching) {
      return
    }
    if (liveWorkSummary.hasLiveWork) {
      setPendingSwitchProfileId(profileId)
      return
    }
    void switchProfile(profileId)
  }

  const handleConfirmSwitchProfile = (): void => {
    if (!pendingSwitchProfileId || switching) {
      return
    }
    void switchProfile(pendingSwitchProfileId)
  }

  const handleCreateCloudProfileForOrg = async (
    organization: AioAdeCloudOrgSummary
  ): Promise<void> => {
    if (creatingCloudProfile || switching) {
      return
    }
    setCreatingCloudProfile(true)
    const result = await createCloudLinkedProfile({
      orgId: organization.orgId,
      name: organization.name
    })
    setCreatingCloudProfile(false)
    if (result?.status !== 'created') {
      return
    }
    if (liveWorkSummary.hasLiveWork) {
      setPendingSwitchProfileId(result.profile.id)
      return
    }
    await switchProfile(result.profile.id)
  }

  const handleConfirmSignOut = async (): Promise<void> => {
    if (signingOut) {
      return
    }
    setSigningOut(true)
    const result = await signOutCurrentProfile()
    setSigningOut(false)
    if (result) {
      setSignOutConfirmOpen(false)
    }
  }

  const profileActionDisabled =
    switching || creating || creatingCloudProfile || connecting || signingOut
  // Why: teammate management needs a connected cloud profile scoped to an org;
  // the server enforces role permissions, and the dialog adapts via
  // canManageMembers, so cloud-linked + org + connected is enough to reveal it.
  const activeOrgId = activeProfile.cloud?.activeOrgId
  const showOrgMembers =
    activeProfile.kind === 'cloud-linked' &&
    Boolean(activeOrgId) &&
    authStatus?.state === 'connected'
  const sidebarPlacement = placement === 'sidebar'
  const triggerLabel = multiProfileUi
    ? translate('auto.components.aio-ade.profiles.switcher.4815f7d163', 'Switch profile')
    : translate('auto.components.aio-ade.profiles.switcher.account', 'Account')
  const accountIdentity = getAioAdeAccountIdentity(activeProfile, authStatus)
  const showAccountIdentity =
    multiProfileUi ||
    authStatus?.state === 'connected' ||
    authStatus?.state === 'reconnect-required'

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size={sidebarPlacement ? 'icon-xs' : 'xs'}
                className={cn(
                  'text-muted-foreground titlebar-profile-switcher',
                  sidebarPlacement ? 'px-0' : 'mr-2 max-w-[180px] gap-1.5 px-1.5'
                )}
                disabled={profileActionDisabled}
                aria-label={triggerLabel}
              >
                {sidebarPlacement && switching ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : !multiProfileUi ? (
                  <CircleUserRound className="size-4" />
                ) : (
                  <AioAdeProfileAvatar
                    profile={activeProfile}
                    className={
                      sidebarPlacement
                        ? 'size-4 border-worktree-sidebar-border bg-worktree-sidebar-accent text-[10px] text-worktree-sidebar-accent-foreground'
                        : undefined
                    }
                  />
                )}
                {!sidebarPlacement ? (
                  <>
                    <span className="hidden max-w-[108px] truncate text-xs font-medium sm:inline">
                      {multiProfileUi
                        ? activeProfile.name
                        : showAccountIdentity
                          ? accountIdentity.title
                          : triggerLabel}
                    </span>
                    {switching ? <Loader2 className="size-3 animate-spin" /> : <ChevronDown />}
                  </>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side={sidebarPlacement ? 'top' : 'bottom'} sideOffset={6}>
            {triggerLabel}
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent
          align={sidebarPlacement ? 'start' : 'end'}
          side={sidebarPlacement ? 'top' : 'bottom'}
          sideOffset={sidebarPlacement ? 8 : 6}
          className="w-64"
        >
          {showAccountIdentity ? (
            <>
              <AioAdeProfileMenuHeader
                profile={activeProfile}
                title={multiProfileUi ? activeProfile.name : accountIdentity.title}
                subtitle={
                  multiProfileUi ? getProfileSubtitle(activeProfile) : accountIdentity.subtitle
                }
                showProfileAvatar={multiProfileUi}
              />
              <DropdownMenuSeparator />
            </>
          ) : null}
          {multiProfileUi
            ? profiles.map((profile) => {
                const active = profile.id === activeProfileId
                return (
                  <DropdownMenuItem
                    key={profile.id}
                    disabled={profileActionDisabled}
                    onSelect={() => handleSwitchProfile(profile.id)}
                    className="min-w-0"
                  >
                    <AioAdeProfileAvatar profile={profile} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{profile.name}</span>
                      <span className="block truncate text-[11px] font-normal text-muted-foreground">
                        {getProfileSubtitle(profile)}
                      </span>
                    </span>
                    {profile.kind === 'cloud-linked' ? <Cloud className="size-3.5" /> : <Laptop />}
                    {active && <Check className="size-3.5 text-foreground" />}
                  </DropdownMenuItem>
                )
              })
            : null}
          {showOrgMembers ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={profileActionDisabled}
                onSelect={() => setOrgMembersOpen(true)}
              >
                <Users />
                {translate(
                  'auto.components.aio-ade.profiles.switcher.org.members',
                  'Organization members'
                )}
              </DropdownMenuItem>
            </>
          ) : null}
          <AioAdeProfileCloudMenuItems
            activeProfile={activeProfile}
            authStatus={authStatus}
            connecting={connecting}
            profileActionDisabled={profileActionDisabled}
            allowProfileCreation={multiProfileUi}
            separateAuthActions={showAccountIdentity || showOrgMembers}
            onConnect={() => {
              void connectCurrentProfile()
            }}
            onCreateProfileForOrg={(organization) => {
              void handleCreateCloudProfileForOrg(organization)
            }}
            onSelectOrg={(orgId) => {
              void selectOrg(orgId)
            }}
            onRequestSignOut={() => setSignOutConfirmOpen(true)}
          />
          {multiProfileUi ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={profileActionDisabled}
                onSelect={() => {
                  setManagementOpen(true)
                }}
              >
                <Settings2 />
                {translate(
                  'auto.components.aio-ade.profiles.switcher.d00d853e2a',
                  'Manage profiles'
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={profileActionDisabled}
                onSelect={() => {
                  setDialogOpen(true)
                }}
              >
                <Plus />
                {translate(
                  'auto.components.aio-ade.profiles.switcher.c106c674fe',
                  'New local profile'
                )}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {multiProfileUi ? (
        <>
          <AioAdeProfileCreateDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            name={newProfileName}
            onNameChange={setNewProfileName}
            creating={creating}
            switching={switching}
            onSubmit={handleCreateProfile}
          />
          <AioAdeProfileManagementDialog
            open={managementOpen}
            onOpenChange={setManagementOpen}
            activeProfile={activeProfile}
            profiles={profiles}
          />
        </>
      ) : null}
      {showOrgMembers && activeOrgId ? (
        <AioAdeProfileOrgMembersDialog
          open={orgMembersOpen}
          onOpenChange={setOrgMembersOpen}
          orgId={activeOrgId}
          orgName={activeProfile.cloud?.activeOrgName}
          viewerUserId={activeProfile.cloud?.userId}
        />
      ) : null}
      <AioAdeProfileSignOutConfirmDialog
        open={signOutConfirmOpen}
        onOpenChange={(open) => {
          if (!signingOut) {
            setSignOutConfirmOpen(open)
          }
        }}
        onConfirm={() => {
          void handleConfirmSignOut()
        }}
        signingOut={signingOut}
      />
      {multiProfileUi ? (
        <AioAdeProfileSwitchConfirmDialog
          open={Boolean(pendingSwitchProfileId)}
          onOpenChange={(open) => {
            if (!open && !switching) {
              setPendingSwitchProfileId(null)
            }
          }}
          onConfirm={handleConfirmSwitchProfile}
          activeProfileName={activeProfile.name}
          targetProfile={pendingSwitchProfile}
          liveWorkSummary={liveWorkSummary}
          switching={switching}
        />
      ) : null}
    </>
  )
}
