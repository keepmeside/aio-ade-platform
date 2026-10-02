import type { AgentAuthProfile, AgentAuthProfileProvider } from './agent-auth-profile-types'
import type { WorkspaceKey } from './types'
import { folderWorkspaceKey, worktreeWorkspaceKey } from './workspace-scope'

// Precedence contract for agent auth profile resolution:
// session > worktree > folder workspace > provider default > legacy account.
// Bindings hold profile ids only and the resolver never touches secret
// material, so a resolution and its provenance are secret-free by
// construction. Stale bindings (deleted profile, other provider) fall through
// loudly instead of masking lower levels silently.

export type AgentAuthProfileBindingLevel =
  | 'session'
  | 'worktree'
  | 'folder-workspace'
  | 'provider-default'

export type AgentAuthProfileStaleRefReason = 'missing' | 'provider-mismatch'

export type AgentAuthProfileStaleRef = {
  level: AgentAuthProfileBindingLevel
  profileId: string
  reason: AgentAuthProfileStaleRefReason
}

export type AgentAuthProfileBindings = {
  /** PTY session id -> profile id. */
  bySession: Record<string, string>
  /** WorkspaceKey ('worktree:<id>' | 'folder:<id>') -> profile id. */
  byWorkspace: Record<WorkspaceKey, string>
  /** Provider -> profile id; the versioned profile store owns this level. */
  defaultByProvider: Record<AgentAuthProfileProvider, string | null>
}

export type AgentAuthProfileResolution =
  | {
      level: AgentAuthProfileBindingLevel
      profile: AgentAuthProfile
      staleRefs: AgentAuthProfileStaleRef[]
    }
  | { level: 'legacy-account'; accountId: string; staleRefs: AgentAuthProfileStaleRef[] }
  | { level: 'none'; staleRefs: AgentAuthProfileStaleRef[] }

export type AgentAuthProfileResolutionInput = {
  provider: AgentAuthProfileProvider
  sessionId?: string | null
  worktreeId?: string | null
  folderWorkspaceId?: string | null
  profiles: readonly AgentAuthProfile[]
  bindings: AgentAuthProfileBindings
  /** Already lane-resolved by the caller; profile levels are lane-agnostic. */
  legacyAccountId?: string | null
}

export function resolveAgentAuthProfile(
  input: AgentAuthProfileResolutionInput
): AgentAuthProfileResolution {
  const staleRefs: AgentAuthProfileStaleRef[] = []
  const candidates: { level: AgentAuthProfileBindingLevel; profileId: string }[] = []

  if (input.sessionId) {
    // Why: session ids are untrusted strings; an own-key check keeps
    // prototype-named ids ('toString') from surfacing inherited members.
    const profileId = Object.hasOwn(input.bindings.bySession, input.sessionId)
      ? input.bindings.bySession[input.sessionId]
      : undefined
    if (profileId !== undefined) {
      candidates.push({ level: 'session', profileId })
    }
  }
  if (input.worktreeId) {
    const profileId = input.bindings.byWorkspace[worktreeWorkspaceKey(input.worktreeId)]
    if (profileId !== undefined) {
      candidates.push({ level: 'worktree', profileId })
    }
  }
  if (input.folderWorkspaceId) {
    const profileId = input.bindings.byWorkspace[folderWorkspaceKey(input.folderWorkspaceId)]
    if (profileId !== undefined) {
      candidates.push({ level: 'folder-workspace', profileId })
    }
  }
  const defaultProfileId = input.bindings.defaultByProvider[input.provider] ?? null
  if (defaultProfileId !== null) {
    candidates.push({ level: 'provider-default', profileId: defaultProfileId })
  }

  for (const candidate of candidates) {
    const profile = input.profiles.find((entry) => entry.id === candidate.profileId)
    if (profile === undefined) {
      staleRefs.push({ level: candidate.level, profileId: candidate.profileId, reason: 'missing' })
      continue
    }
    if (profile.provider !== input.provider) {
      staleRefs.push({
        level: candidate.level,
        profileId: candidate.profileId,
        reason: 'provider-mismatch'
      })
      continue
    }
    return { level: candidate.level, profile, staleRefs }
  }

  if (input.legacyAccountId) {
    return { level: 'legacy-account', accountId: input.legacyAccountId, staleRefs }
  }
  return { level: 'none', staleRefs }
}

export type AgentAuthProfileLaunchProvenance = {
  sessionId: string
  provider: AgentAuthProfileProvider
  level: AgentAuthProfileBindingLevel | 'legacy-account' | 'none'
  profileId: string | null
  accountId: string | null
  resolvedAt: number
}

// Why ids only: provenance crosses into UI, diagnostics and export lanes where
// a profile record (even ref-only) would go stale and invite over-sharing.
export function buildAgentAuthProfileLaunchProvenance(args: {
  sessionId: string
  provider: AgentAuthProfileProvider
  resolution: AgentAuthProfileResolution
  now: number
}): AgentAuthProfileLaunchProvenance {
  const { resolution } = args
  const isProfileLevel = resolution.level !== 'legacy-account' && resolution.level !== 'none'
  return {
    sessionId: args.sessionId,
    provider: args.provider,
    level: resolution.level,
    profileId: isProfileLevel ? resolution.profile.id : null,
    accountId: resolution.level === 'legacy-account' ? resolution.accountId : null,
    resolvedAt: args.now
  }
}
