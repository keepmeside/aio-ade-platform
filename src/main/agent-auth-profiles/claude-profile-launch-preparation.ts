import type { ClaudeRuntimeAuthPreparation } from '../claude-accounts/runtime-auth-service'
import type { ClaudeAccountSelectionTarget } from '../claude-accounts/runtime-selection'
import type { ClaudeEnvPatch } from '../claude-accounts/environment'
import type { AgentAuthProfileLaunchProvenance } from '../../shared/agent-auth-profile-bindings'
import {
  resolveClaudeAgentAuthProfileForLaunch,
  type AgentAuthProfileLaunchContext,
  type AgentAuthProfileLaunchResolution
} from './agent-auth-profile-launch-resolution'
import type { AgentAuthProfileSessionBindings } from './agent-auth-profile-session-bindings'
import type { AgentAuthProfileStoreResult } from './agent-auth-profile-store'
import type { AgentAuthProfileSecretReader } from './agent-auth-profile-env-materialization'

// The launch preparation plus the profile launch record to persist after the
// spawn commits. Base preparations never carry the field; only a profile win
// does, so its absence means account/system auth.
export type ProfileAwareClaudeAuthPreparation = ClaudeRuntimeAuthPreparation & {
  agentProfileProvenance?: AgentAuthProfileLaunchProvenance
}

// A resolved profile is the explicit auth source: force the inherited-auth
// strip, merge the profile patch over the base patch (profile keys win), and
// carry the provenance for post-spawn recording. Legacy-account and none
// resolutions leave the base preparation untouched.
export function composeClaudeLaunchPreparation(
  base: ClaudeRuntimeAuthPreparation,
  resolution: AgentAuthProfileLaunchResolution<ClaudeEnvPatch>
): ProfileAwareClaudeAuthPreparation {
  if (resolution.status === 'error') {
    throw new Error(resolution.error)
  }
  if (resolution.status !== 'profile') {
    return base
  }
  return {
    ...base,
    envPatch: { ...base.envPatch, ...resolution.envPatch },
    stripAuthEnv: true,
    provenance: `profile:${resolution.profileId}`,
    ...(resolution.provenance ? { agentProfileProvenance: resolution.provenance } : {})
  }
}

export type ClaudeProfileLaunchPreparationDependencies = {
  loadStore: () => AgentAuthProfileStoreResult
  sessionBindings: AgentAuthProfileSessionBindings
  readSecret: AgentAuthProfileSecretReader
  getLegacyAccountId: (target?: ClaudeAccountSelectionTarget) => string | null
  now?: () => number
}

// Wraps the account-only claude preparation with profile resolution. A broken
// profile source (corrupt store, unreadable secret) fails the launch loudly
// before any runtime-auth sync — never a silent fall-through to account auth.
export function createProfileAwarePrepareClaudeAuth(
  basePrepare: (target?: ClaudeAccountSelectionTarget) => Promise<ClaudeRuntimeAuthPreparation>,
  deps: ClaudeProfileLaunchPreparationDependencies
): (
  target?: ClaudeAccountSelectionTarget,
  launchContext?: AgentAuthProfileLaunchContext
) => Promise<ProfileAwareClaudeAuthPreparation> {
  return async (target, launchContext) => {
    if (!launchContext) {
      return basePrepare(target)
    }
    const loaded = deps.loadStore()
    if (!loaded.ok) {
      throw new Error(loaded.error)
    }
    const resolution = resolveClaudeAgentAuthProfileForLaunch({
      sessionId: launchContext.sessionId,
      worktreeId: launchContext.worktreeId,
      folderWorkspaceId: launchContext.folderWorkspaceId,
      store: loaded.store,
      sessionBindings: deps.sessionBindings.toRecord(),
      legacyAccountId: deps.getLegacyAccountId(target),
      readSecret: deps.readSecret,
      now: deps.now ? deps.now() : Date.now()
    })
    if (resolution.status === 'error') {
      throw new Error(resolution.error)
    }
    const base = await basePrepare(target)
    return composeClaudeLaunchPreparation(base, resolution)
  }
}
