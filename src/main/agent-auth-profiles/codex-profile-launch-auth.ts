import type { CodexAccountSelectionTarget } from '../codex-accounts/runtime-selection'
import type { CodexEnvPatch } from '../codex-accounts/environment'
import type { AgentAuthProfileLaunchProvenance } from '../../shared/agent-auth-profile-bindings'
import {
  resolveCodexAgentAuthProfileForLaunch,
  type AgentAuthProfileLaunchContext
} from './agent-auth-profile-launch-resolution'
import type { AgentAuthProfileSessionBindings } from './agent-auth-profile-session-bindings'
import type { AgentAuthProfileStoreResult } from './agent-auth-profile-store'
import type { AgentAuthProfileSecretReader } from './agent-auth-profile-env-materialization'
import { ensureCodexProfileManagedHome } from './codex-profile-home-materialization'

// The profile-managed CODEX_HOME plus the env overlay the launch needs: custom
// providers read their key from env_key, so the patch must ride the spawn env
// next to the CODEX_HOME injection. Null means no profile is bound and the
// caller falls back to account/system home resolution.
export type CodexProfileLaunchAuth = {
  codexHomePath: string
  envPatch: CodexEnvPatch
  agentProfileProvenance: AgentAuthProfileLaunchProvenance | null
}

export type CodexProfileLaunchAuthRequest = {
  target: CodexAccountSelectionTarget
  launchContext: AgentAuthProfileLaunchContext
  workspacePath?: string
}

export type ResolveCodexProfileLaunchAuth = (
  request: CodexProfileLaunchAuthRequest
) => CodexProfileLaunchAuth | null

export type CodexProfileLaunchAuthDependencies = {
  loadStore: () => AgentAuthProfileStoreResult
  sessionBindings: AgentAuthProfileSessionBindings
  readSecret: AgentAuthProfileSecretReader
  getLegacyAccountId: (target?: CodexAccountSelectionTarget) => string | null
  getUserDataPath: () => string
  getSystemCodexHomePath: () => string
  // Best-effort launch prep for the materialized home (trust pre-mark, hook
  // install); failures warn and never block the launch.
  prepareLaunchHome?: (
    homePath: string,
    target: CodexAccountSelectionTarget,
    workspacePath?: string
  ) => void
  now?: () => number
}

// Resolves the codex profile bound to the launch context and materializes its
// managed CODEX_HOME. Fail-loud: a corrupt store, unreadable secret, or failed
// materialization throws — never a silent fall-through to account auth. WSL
// targets return null: profile propagation into distro lanes is a separate,
// explicit decision.
export function createCodexProfileLaunchAuthResolver(
  deps: CodexProfileLaunchAuthDependencies
): ResolveCodexProfileLaunchAuth {
  return (request) => {
    if (request.target.runtime === 'wsl') {
      return null
    }
    const loaded = deps.loadStore()
    if (!loaded.ok) {
      throw new Error(loaded.error)
    }
    const resolution = resolveCodexAgentAuthProfileForLaunch({
      sessionId: request.launchContext.sessionId,
      worktreeId: request.launchContext.worktreeId,
      folderWorkspaceId: request.launchContext.folderWorkspaceId,
      store: loaded.store,
      sessionBindings: deps.sessionBindings.toRecord(),
      legacyAccountId: deps.getLegacyAccountId(request.target),
      readSecret: deps.readSecret,
      now: deps.now ? deps.now() : Date.now()
    })
    if (resolution.status === 'error') {
      throw new Error(resolution.error)
    }
    if (resolution.status !== 'profile') {
      return null
    }
    const profile = loaded.store.profiles.find((entry) => entry.id === resolution.profileId)
    if (!profile) {
      throw new Error(`Agent auth profile "${resolution.profileId}" disappeared from the store.`)
    }
    const ensured = ensureCodexProfileManagedHome({
      profile,
      apiKey: resolution.envPatch.OPENAI_API_KEY ?? null,
      userDataPath: deps.getUserDataPath(),
      systemCodexHomePath: deps.getSystemCodexHomePath()
    })
    if (!ensured.ok) {
      throw new Error(
        `Failed to materialize the managed Codex home for profile "${profile.id}": ${ensured.error}`
      )
    }
    deps.prepareLaunchHome?.(ensured.homePath, request.target, request.workspacePath)
    return {
      codexHomePath: ensured.homePath,
      envPatch: resolution.envPatch,
      agentProfileProvenance: resolution.provenance
    }
  }
}
