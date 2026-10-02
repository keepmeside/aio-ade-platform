import type { ClaudeEnvPatch } from '../claude-accounts/environment'
import type { CodexEnvPatch } from '../codex-accounts/environment'
import {
  buildAgentAuthProfileLaunchProvenance,
  resolveAgentAuthProfile,
  type AgentAuthProfileBindings,
  type AgentAuthProfileLaunchProvenance,
  type AgentAuthProfileResolution,
  type AgentAuthProfileStaleRef
} from '../../shared/agent-auth-profile-bindings'
import { isWorkspaceKey } from '../../shared/workspace-scope'
import type { WorkspaceKey } from '../../shared/types'
import type { AgentAuthProfile, AgentAuthProfileStore } from '../../shared/agent-auth-profile-types'
import {
  buildClaudeAgentAuthProfileEnvPatch,
  buildCodexAgentAuthProfileEnvPatch,
  type AgentAuthProfileSecretReader
} from './agent-auth-profile-env-materialization'

// Composes the durable store and the ephemeral session pins into the
// resolver's bindings view. Workspace keys are re-narrowed here so a
// hand-edited store file can never smuggle a non-workspace key into the
// resolver even if a future parse change loosens the schema.
export function buildAgentAuthProfileBindingsSnapshot(
  store: AgentAuthProfileStore,
  sessionBindings: Record<string, string>
): AgentAuthProfileBindings {
  const byWorkspace: Record<WorkspaceKey, string> = {}
  for (const [key, profileId] of Object.entries(store.workspaceBindings)) {
    if (isWorkspaceKey(key)) {
      byWorkspace[key] = profileId
    }
  }
  return {
    bySession: { ...sessionBindings },
    byWorkspace,
    defaultByProvider: store.defaultProfileIdByProvider
  }
}

export type AgentAuthProfileLaunchResolution<T> =
  | {
      status: 'profile'
      profileId: string
      envPatch: T
      staleRefs: AgentAuthProfileStaleRef[]
      provenance: AgentAuthProfileLaunchProvenance | null
    }
  | {
      status: 'legacy-account' | 'none'
      staleRefs: AgentAuthProfileStaleRef[]
      provenance: AgentAuthProfileLaunchProvenance | null
    }
  | { status: 'error'; error: string }

type LaunchResolutionArgs = {
  sessionId: string | null
  worktreeId: string | null
  folderWorkspaceId: string | null
  store: AgentAuthProfileStore
  sessionBindings: Record<string, string>
  legacyAccountId: string | null
  readSecret: AgentAuthProfileSecretReader
  now: number
}

// A resolved profile is the explicit auth source for the launch: a broken
// vault read fails the launch loudly instead of falling through to a lower
// precedence level the user did not ask for.
function resolveForLaunch<T>(
  provider: 'claude' | 'codex',
  args: LaunchResolutionArgs,
  buildPatch: (profile: AgentAuthProfile) => { ok: true; patch: T } | { ok: false; error: string }
): AgentAuthProfileLaunchResolution<T> {
  const resolution: AgentAuthProfileResolution = resolveAgentAuthProfile({
    provider,
    sessionId: args.sessionId,
    worktreeId: args.worktreeId,
    folderWorkspaceId: args.folderWorkspaceId,
    profiles: args.store.profiles,
    bindings: buildAgentAuthProfileBindingsSnapshot(args.store, args.sessionBindings),
    legacyAccountId: args.legacyAccountId
  })

  const provenance =
    args.sessionId !== null
      ? buildAgentAuthProfileLaunchProvenance({
          sessionId: args.sessionId,
          provider,
          resolution,
          now: args.now
        })
      : null

  if (resolution.level === 'legacy-account' || resolution.level === 'none') {
    return { status: resolution.level, staleRefs: resolution.staleRefs, provenance }
  }

  const patch = buildPatch(resolution.profile)
  if (!patch.ok) {
    return { status: 'error', error: patch.error }
  }
  return {
    status: 'profile',
    profileId: resolution.profile.id,
    envPatch: patch.patch,
    staleRefs: resolution.staleRefs,
    provenance
  }
}

export function resolveClaudeAgentAuthProfileForLaunch(
  args: LaunchResolutionArgs
): AgentAuthProfileLaunchResolution<ClaudeEnvPatch> {
  return resolveForLaunch('claude', args, (profile) =>
    buildClaudeAgentAuthProfileEnvPatch(profile, args.readSecret)
  )
}

export function resolveCodexAgentAuthProfileForLaunch(
  args: LaunchResolutionArgs
): AgentAuthProfileLaunchResolution<CodexEnvPatch> {
  return resolveForLaunch('codex', args, (profile) =>
    buildCodexAgentAuthProfileEnvPatch(profile, args.readSecret)
  )
}
