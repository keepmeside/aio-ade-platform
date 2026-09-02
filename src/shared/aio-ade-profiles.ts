import { AIO_ADE_BROWSER_PARTITION } from './constants'
import type { ExecutionHostId } from './execution-host'

export const AIO_ADE_PROFILE_INDEX_SCHEMA_VERSION = 1
export const DEFAULT_LOCAL_AIO_ADE_PROFILE_ID = 'local-default'
export const DEFAULT_LOCAL_AIO_ADE_PROFILE_NAME = 'Personal'
/* Partition prefix for browser sessions owned by the default local profile.
 *
 * Exported because the main-process registry validates renderer-supplied partitions against this
 * same prefix before attaching a webview. When the two spellings drifted apart, every session the
 * default profile created was rejected by that gate. */
export const DEFAULT_PROFILE_BROWSER_SESSION_PARTITION_PREFIX = 'persist:aio-ade-browser-session-'

export type AioAdeProfileAvatar = {
  kind: 'initials'
  initials: string
  color: 'neutral'
}

export type AioAdeProfileKind = 'local' | 'cloud-linked'

export type AioAdeProfileCloudSummary = {
  cloudProfileId: string
  userId: string
  email: string
  displayName?: string
  activeOrgId?: string
  activeOrgName?: string
  linkedAt: number
}

export type AioAdeCloudOrgSummary = {
  orgId: string
  name: string
  role?: string
}

export type AioAdeCloudCapabilityFlags = Record<string, boolean>

export type AioAdeCloudCapabilities = {
  flags: AioAdeCloudCapabilityFlags
  refreshedAt: number
}

export type AioAdeCloudSessionPersistence = 'none' | 'encrypted' | 'memory-only' | 'dev-plaintext'

export type AioAdeProfileAuthState = 'local' | 'unconfigured' | 'connected' | 'reconnect-required'

export type AioAdeProfileAuthStatus = {
  activeProfileId: string
  configured: boolean
  state: AioAdeProfileAuthState
  persistence: AioAdeCloudSessionPersistence
  cloud?: AioAdeProfileCloudSummary
  organizations?: AioAdeCloudOrgSummary[]
  capabilities?: AioAdeCloudCapabilities
  credentialError?: string
  setupMessage?: string
}

export type AioAdeProfileSummary = {
  id: string
  name: string
  avatar: AioAdeProfileAvatar
  kind: AioAdeProfileKind
  createdAt: number
  updatedAt: number
  lastOpenedAt: number
  cloud?: AioAdeProfileCloudSummary
}

export type AioAdeProfileIndex = {
  schemaVersion: number
  activeProfileId: string
  profiles: AioAdeProfileSummary[]
}

export type AioAdeProfileListState = {
  activeProfileId: string
  profiles: AioAdeProfileSummary[]
}

export type AioAdeProfileListResult = AioAdeProfileListState & {
  // Why: gates the full multi-profile switcher UI; default builds show a
  // single-profile account menu instead.
  multiProfileUi: boolean
}

export type CreateLocalAioAdeProfileArgs = {
  name?: string
}

export type CreateLocalAioAdeProfileResult = AioAdeProfileListState & {
  profile: AioAdeProfileSummary
}

export type CreateCloudLinkedAioAdeProfileArgs = {
  orgId?: string
  name?: string
}

export type SwitchAioAdeProfileArgs = {
  profileId: string
}

export type SwitchAioAdeProfileResult = {
  status: 'already-active' | 'relaunching'
}

export type TransferAioAdeProfileProjectMode = 'move' | 'copy'

export type TransferAioAdeProfileProjectArgs = {
  sourceProfileId: string
  targetProfileId: string
  repoId: string
  mode: TransferAioAdeProfileProjectMode
}

export type FindAioAdeProfileProjectsByPathArgs = {
  path: string
  connectionId?: string | null
  executionHostId?: ExecutionHostId | null
  excludeProfileId?: string | null
}

export type AioAdeProfileProjectPresence = {
  profileId: string
  profileName: string
  profileKind: AioAdeProfileKind
  repoId: string
  repoName: string
}

export type FindAioAdeProfileProjectsByPathResult = {
  projects: AioAdeProfileProjectPresence[]
}

export type TransferAioAdeProfileProjectResult =
  | {
      status: 'transferred'
      mode: TransferAioAdeProfileProjectMode
      sourceProfileId: string
      targetProfileId: string
      sourceRepoId: string
      targetRepoId: string
      targetProjectId: string | null
      willRelaunch?: boolean
    }
  | {
      status: 'duplicate-target'
      sourceProfileId: string
      targetProfileId: string
      sourceRepoId: string
      duplicateRepoId: string
    }

export type ConnectCurrentAioAdeProfileResult =
  | {
      status: 'connected'
      auth: AioAdeProfileAuthStatus
      activeProfileId: string
      profiles: AioAdeProfileSummary[]
    }
  | {
      status: 'unconfigured'
      auth: AioAdeProfileAuthStatus
    }
  | {
      status: 'cancelled'
      auth: AioAdeProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: AioAdeProfileAuthStatus
      error: string
    }

export type CreateCloudLinkedAioAdeProfileResult =
  | {
      status: 'created'
      auth: AioAdeProfileAuthStatus
      activeProfileId: string
      profiles: AioAdeProfileSummary[]
      profile: AioAdeProfileSummary
    }
  | {
      status: 'unconfigured' | 'reconnect-required'
      auth: AioAdeProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: AioAdeProfileAuthStatus
      error: string
    }

export type SignOutCurrentAioAdeProfileResult = {
  status: 'signed-out'
  auth: AioAdeProfileAuthStatus
  activeProfileId: string
  profiles: AioAdeProfileSummary[]
}

export type SelectAioAdeProfileOrgArgs = {
  orgId: string
}

export type SelectAioAdeProfileOrgResult =
  | {
      status: 'selected'
      auth: AioAdeProfileAuthStatus
      activeProfileId: string
      profiles: AioAdeProfileSummary[]
    }
  | {
      status: 'unconfigured' | 'reconnect-required'
      auth: AioAdeProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: AioAdeProfileAuthStatus
      error: string
    }

export type RefreshCurrentAioAdeProfileAuthResult =
  | {
      status: 'refreshed'
      auth: AioAdeProfileAuthStatus
      activeProfileId: string
      profiles: AioAdeProfileSummary[]
    }
  | {
      status: 'local' | 'unconfigured' | 'reconnect-required'
      auth: AioAdeProfileAuthStatus
    }
  | {
      status: 'failed'
      auth: AioAdeProfileAuthStatus
      error: string
    }

// Why: organization roles are a fixed server-side enum; the desktop UI mirrors
// exactly these three so role selects can't drift from what the API accepts.
export type AioAdeOrgRole = 'owner' | 'admin' | 'member'

export type AioAdeOrgMember = {
  // Why: null for teammates provisioned server-side who never signed into AIO-ADE;
  // mutation actions are disabled for them since the API keys on a real userId.
  userId: string | null
  email: string
  displayName?: string
  role: AioAdeOrgRole
}

export type AioAdeOrgPendingInvite = {
  email: string
  role: AioAdeOrgRole
  createdAt: number
}

export type AioAdeOrgMembersRoster = {
  members: AioAdeOrgMember[]
  pendingInvites: AioAdeOrgPendingInvite[]
  viewerRole: AioAdeOrgRole
  canManageMembers: boolean
}

export type AioAdeProfileOrgMembersListArgs = {
  orgId: string
}

export type AioAdeProfileOrgMemberInviteArgs = {
  orgId: string
  email: string
  role: AioAdeOrgRole
}

export type AioAdeProfileOrgInviteRevokeArgs = {
  orgId: string
  email: string
}

export type AioAdeProfileOrgMemberChangeRoleArgs = {
  orgId: string
  userId: string
  role: AioAdeOrgRole
}

export type AioAdeProfileOrgMemberRemoveArgs = {
  orgId: string
  userId: string
}

export type AioAdeProfileOrgMembersListResult =
  | { status: 'ok'; roster: AioAdeOrgMembersRoster }
  | { status: 'unconfigured' | 'reconnect-required' }
  | { status: 'failed'; error: string }

export type AioAdeOrgInviteConflictReason = 'already_member' | 'already_invited'
export type AioAdeOrgMutationInvalidReason = 'cannot_change_own_role' | 'cannot_remove_self'

export type AioAdeProfileOrgMemberMutationResult =
  | { status: 'ok' }
  | { status: 'unconfigured' | 'reconnect-required' | 'forbidden' | 'not-found' }
  | { status: 'conflict'; reason: AioAdeOrgInviteConflictReason }
  | { status: 'invalid'; reason: AioAdeOrgMutationInvalidReason }
  | { status: 'failed'; error: string }

export function createDefaultLocalAioAdeProfile(now: number): AioAdeProfileSummary {
  return {
    id: DEFAULT_LOCAL_AIO_ADE_PROFILE_ID,
    name: DEFAULT_LOCAL_AIO_ADE_PROFILE_NAME,
    avatar: { kind: 'initials', initials: 'P', color: 'neutral' },
    kind: 'local',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now
  }
}

function profilePartitionHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function getAioAdeProfileBrowserPartitionSegment(profileId: string): string {
  const safe = profileId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48) || 'profile'
  return `${safe}-${profilePartitionHash(profileId)}`
}

export function getAioAdeProfileBrowserDefaultPartition(profileId: string): string {
  if (profileId === DEFAULT_LOCAL_AIO_ADE_PROFILE_ID) {
    return AIO_ADE_BROWSER_PARTITION
  }
  return `persist:aio-ade-profile-${getAioAdeProfileBrowserPartitionSegment(profileId)}-browser-default`
}

export function getAioAdeProfileBrowserSessionPartition(
  profileId: string,
  browserSessionProfileId: string
): string {
  if (profileId === DEFAULT_LOCAL_AIO_ADE_PROFILE_ID) {
    return `${DEFAULT_PROFILE_BROWSER_SESSION_PARTITION_PREFIX}${browserSessionProfileId}`
  }
  return `persist:aio-ade-profile-${getAioAdeProfileBrowserPartitionSegment(
    profileId
  )}-browser-session-${browserSessionProfileId}`
}
