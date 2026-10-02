import type {
  AgentAuthProfile,
  AgentAuthProfileProvider,
  AgentAuthProfileStore
} from '../../shared/agent-auth-profile-types'
import type { AgentAuthProfileUpsertInput } from '../../shared/agent-auth-profile-upsert-input'
import type { AgentAuthProfileLaunchProvenance } from '../../shared/agent-auth-profile-bindings'
import type {
  AgentAuthProfileHealthTestFetch,
  AgentAuthProfileHealthTestResult
} from './agent-auth-profile-health-test'
import {
  resolveAgentAuthProfileHealthTest,
  testAgentAuthProfileHealth
} from './agent-auth-profile-health-test'
import {
  listAgentAuthProfileLaunches,
  sessionIdsForAgentAuthProfileLaunch
} from './agent-auth-profile-launch-records'
import {
  type StagedAgentAuthProfileResult,
  stageCreatedProfile,
  stageUpdatedProfile
} from './agent-auth-profile-upsert-staging'
import { stageDuplicatedProfile } from './agent-auth-profile-duplicate-staging'
import type { AgentAuthProfileSessionBindings } from './agent-auth-profile-session-bindings'
import type { AgentAuthProfileStoreService } from './agent-auth-profile-store'
import type { AgentAuthSecretVault } from './agent-auth-secret-vault'
import { removeCodexProfileManagedHome } from './codex-profile-home-materialization'

export type AgentAuthProfileServiceError = { ok: false; error: string; liveSessionIds?: string[] }

export type AgentAuthProfileServiceResult<T> = { ok: true; value: T } | AgentAuthProfileServiceError

export type AgentAuthProfileListEntry = AgentAuthProfile & {
  liveSessionCount: number
  hasApiKey: boolean
}

export type AgentAuthProfileListSnapshot = {
  profiles: AgentAuthProfileListEntry[]
  defaultProfileIdByProvider: AgentAuthProfileStore['defaultProfileIdByProvider']
  workspaceBindings: AgentAuthProfileStore['workspaceBindings']
  liveLaunches: AgentAuthProfileLaunchProvenance[]
}

export type AgentAuthProfileServiceDeps = {
  store: AgentAuthProfileStoreService
  vault: AgentAuthSecretVault
  sessionBindings: AgentAuthProfileSessionBindings
  mintProfileId: () => string
  now: () => number
  healthFetch: AgentAuthProfileHealthTestFetch
  userDataPath: string
  systemCodexHomePath: string
}

// Orchestration facade over the store, vault, session bindings, and managed
// codex homes. The staging modules resolve an input into the next profile
// plus its vault writes — pure, so a validation failure never touches the
// vault. This class owns minting, the live-PTY gate, executing staged writes
// before the store commit, rollback for fresh ids, and best-effort cleanup.
// Edit and delete are gated on live PTY launches so a running session never
// loses its profile's env/home out from under it; the gate's session ids
// ride the error so the UI can offer stop-and-retry.
export class AgentAuthProfileService {
  constructor(private readonly deps: AgentAuthProfileServiceDeps) {}

  list(): AgentAuthProfileServiceResult<AgentAuthProfileListSnapshot> {
    const loaded = this.deps.store.load()
    if (!loaded.ok) {
      return { ok: false, error: loaded.error }
    }
    const liveLaunches = listAgentAuthProfileLaunches()
    const liveCountByProfileId = new Map<string, number>()
    for (const launch of liveLaunches) {
      // Account-level launches carry no profile id to attribute.
      if (launch.profileId === null) {
        continue
      }
      liveCountByProfileId.set(
        launch.profileId,
        (liveCountByProfileId.get(launch.profileId) ?? 0) + 1
      )
    }
    const profiles: AgentAuthProfileListEntry[] = loaded.store.profiles.map((profile) => ({
      ...profile,
      liveSessionCount: liveCountByProfileId.get(profile.id) ?? 0,
      hasApiKey: profile.apiKeySecretRef !== null && this.deps.vault.has(profile.id, 'api-key')
    }))
    return {
      ok: true,
      value: {
        profiles,
        defaultProfileIdByProvider: loaded.store.defaultProfileIdByProvider,
        workspaceBindings: loaded.store.workspaceBindings,
        liveLaunches
      }
    }
  }

  create(input: AgentAuthProfileUpsertInput): AgentAuthProfileServiceResult<AgentAuthProfile> {
    const minted = this.mintUniqueId()
    if (!minted.ok) {
      return minted
    }
    return this.commitStagedProfile(
      minted.value,
      stageCreatedProfile({ profileId: minted.value, input, timestamp: this.deps.now() }),
      true
    )
  }

  update(
    profileId: string,
    input: AgentAuthProfileUpsertInput
  ): AgentAuthProfileServiceResult<AgentAuthProfile> {
    const existing = this.findProfile(profileId)
    if (!existing.ok) {
      return existing
    }
    const gated = this.gateLiveSessions(profileId)
    if (gated !== null) {
      return gated
    }
    return this.commitStagedProfile(
      profileId,
      stageUpdatedProfile({
        existingProfile: existing.value,
        input,
        timestamp: this.deps.now()
      }),
      false
    )
  }

  duplicate(profileId: string, label?: string): AgentAuthProfileServiceResult<AgentAuthProfile> {
    const existing = this.findProfile(profileId)
    if (!existing.ok) {
      return existing
    }
    const minted = this.mintUniqueId()
    if (!minted.ok) {
      return minted
    }
    return this.commitStagedProfile(
      minted.value,
      stageDuplicatedProfile({
        vault: this.deps.vault,
        existingProfile: existing.value,
        newProfileId: minted.value,
        label,
        timestamp: this.deps.now()
      }),
      true
    )
  }

  delete(profileId: string): AgentAuthProfileServiceResult<{ warnings: string[] }> {
    const existing = this.findProfile(profileId)
    if (!existing.ok) {
      return existing
    }
    const gated = this.gateLiveSessions(profileId)
    if (gated !== null) {
      return gated
    }
    const removed = this.deps.store.deleteProfile(profileId)
    if (!removed.ok) {
      return { ok: false, error: removed.error }
    }
    // Best-effort cleanup: the store row is gone, so leftovers are warnings, not failures.
    const warnings: string[] = []
    this.deps.vault.deleteProfile(profileId)
    this.deps.sessionBindings.deleteProfile(profileId)
    if (existing.value.provider === 'codex') {
      const home = removeCodexProfileManagedHome({
        profileId,
        userDataPath: this.deps.userDataPath,
        systemCodexHomePath: this.deps.systemCodexHomePath
      })
      if (!home.ok) {
        warnings.push(home.error)
      }
    }
    return { ok: true, value: { warnings } }
  }

  async testConnection(args: {
    profileId?: string
    input?: AgentAuthProfileUpsertInput
  }): Promise<AgentAuthProfileHealthTestResult> {
    let storedProfile: AgentAuthProfile | undefined
    if (args.profileId !== undefined) {
      const existing = this.findProfile(args.profileId)
      if (!existing.ok) {
        return {
          ok: false,
          kind: 'profile-missing',
          error: `Agent auth profile "${args.profileId}" does not exist.`
        }
      }
      storedProfile = existing.value
    }
    const subject = resolveAgentAuthProfileHealthTest({
      storedProfile,
      input: args.input,
      readStoredApiKey: (profileId) => this.deps.vault.get(profileId, 'api-key')
    })
    if (!subject.ok) {
      return subject
    }
    return testAgentAuthProfileHealth({
      profile: subject.profile,
      readApiKey: subject.readApiKey,
      fetch: this.deps.healthFetch
    })
  }

  setProviderDefault(
    provider: AgentAuthProfileProvider,
    profileId: string | null
  ): AgentAuthProfileServiceResult<AgentAuthProfileStore['defaultProfileIdByProvider']> {
    const saved = this.deps.store.setProviderDefault(provider, profileId)
    if (!saved.ok) {
      return { ok: false, error: saved.error }
    }
    return { ok: true, value: saved.store.defaultProfileIdByProvider }
  }

  setSessionBinding(
    sessionId: string,
    profileId: string | null
  ): AgentAuthProfileServiceResult<true> {
    if (profileId === null) {
      this.deps.sessionBindings.clear(sessionId)
      return { ok: true, value: true }
    }
    const existing = this.findProfile(profileId)
    if (!existing.ok) {
      return { ok: false, error: existing.error }
    }
    this.deps.sessionBindings.set(sessionId, profileId)
    return { ok: true, value: true }
  }

  setWorkspaceBinding(key: string, profileId: string | null): AgentAuthProfileServiceResult<true> {
    const saved =
      profileId === null
        ? this.deps.store.clearWorkspaceBinding(key)
        : this.deps.store.setWorkspaceBinding(key, profileId)
    if (!saved.ok) {
      return { ok: false, error: saved.error }
    }
    return { ok: true, value: true }
  }

  private findProfile(profileId: string): AgentAuthProfileServiceResult<AgentAuthProfile> {
    const loaded = this.deps.store.load()
    if (!loaded.ok) {
      return { ok: false, error: loaded.error }
    }
    const profile = loaded.store.profiles.find((entry) => entry.id === profileId)
    if (profile === undefined) {
      return { ok: false, error: `Profile "${profileId}" does not exist.` }
    }
    return { ok: true, value: profile }
  }

  // Commits a staged profile: staged vault writes first (fail-loud), then
  // the store row, then best-effort drops. `freshId` marks a brand-new id no
  // other row can reference, so any failure rolls its secrets back; an
  // update keeps its row's refs — a partially rotated value beats deleting
  // a live ref, and a retry or re-edit converges.
  private commitStagedProfile(
    profileId: string,
    staged: StagedAgentAuthProfileResult,
    freshId: boolean
  ): AgentAuthProfileServiceResult<AgentAuthProfile> {
    if (!staged.ok) {
      return staged
    }
    for (const write of staged.staged.secretWrites) {
      const saved = this.deps.vault.set(profileId, write.secretName, write.value)
      if (!saved.ok) {
        if (freshId) {
          this.deps.vault.deleteProfile(profileId)
        }
        return { ok: false, error: `Could not store the ${write.fieldLabel}: ${saved.error}` }
      }
    }
    const stored = this.deps.store.upsertProfile(staged.staged.profile)
    if (!stored.ok) {
      if (freshId) {
        this.deps.vault.deleteProfile(profileId)
      }
      return { ok: false, error: stored.error }
    }
    for (const secretName of staged.staged.droppedSecretNames) {
      this.deps.vault.delete(profileId, secretName)
    }
    return { ok: true, value: staged.staged.profile }
  }

  private gateLiveSessions(profileId: string): AgentAuthProfileServiceError | null {
    const liveSessionIds = sessionIdsForAgentAuthProfileLaunch(profileId)
    if (liveSessionIds.length === 0) {
      return null
    }
    return {
      ok: false,
      error: 'This profile is still used by live sessions. Stop them and retry.',
      liveSessionIds
    }
  }

  private mintUniqueId(): AgentAuthProfileServiceResult<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = this.deps.mintProfileId()
      const loaded = this.deps.store.load()
      if (!loaded.ok) {
        return { ok: false, error: loaded.error }
      }
      if (!loaded.store.profiles.some((profile) => profile.id === candidate)) {
        return { ok: true, value: candidate }
      }
    }
    return { ok: false, error: 'Could not generate a unique profile id.' }
  }
}
