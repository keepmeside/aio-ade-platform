import { readFileSync } from 'node:fs'
import { writeFileAtomically } from '../codex-accounts/fs-utils'
import { isWorkspaceKey } from '../../shared/workspace-scope'
import {
  AGENT_AUTH_PROFILE_STORE_VERSION,
  AgentAuthProfileStoreSchema,
  parseErrorToResult,
  type AgentAuthProfile,
  type AgentAuthProfileProvider,
  type AgentAuthProfileStore
} from '../../shared/agent-auth-profile-types'

export type AgentAuthProfileStoreResult =
  | { ok: true; store: AgentAuthProfileStore }
  | { ok: false; error: string }

export type ParsedAgentAuthProfileStore =
  | { ok: true; value: AgentAuthProfileStore }
  | { ok: false; error: string }

export function parseAgentAuthProfileStore(raw: unknown): ParsedAgentAuthProfileStore {
  const result = AgentAuthProfileStoreSchema.safeParse(raw)
  if (result.success) {
    return { ok: true, value: result.data }
  }
  return parseErrorToResult(result.error)
}

export function emptyAgentAuthProfileStore(): AgentAuthProfileStore {
  return {
    version: AGENT_AUTH_PROFILE_STORE_VERSION,
    profiles: [],
    defaultProfileIdByProvider: { claude: null, codex: null },
    workspaceBindings: {}
  }
}

// Durable, secret-free profile store: profiles, provider defaults, and
// workspace bindings in one versioned file. Every mutation re-validates
// through the store schema before the atomic write, so an invalid store can
// never reach disk. A corrupt file fails every operation loudly — the store
// is never silently reset.
export class AgentAuthProfileStoreService {
  constructor(private readonly storeFilePath: string) {}

  load(): AgentAuthProfileStoreResult {
    let raw: string
    try {
      raw = readFileSync(this.storeFilePath, 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { ok: true, store: emptyAgentAuthProfileStore() }
      }
      return { ok: false, error: `Could not read the agent auth profile store: ${String(error)}` }
    }
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(raw)
    } catch {
      return { ok: false, error: 'The agent auth profile store is not valid JSON.' }
    }
    const parsed = parseAgentAuthProfileStore(parsedJson)
    if (!parsed.ok) {
      return parsed
    }
    return { ok: true, store: parsed.value }
  }

  upsertProfile(profile: AgentAuthProfile): AgentAuthProfileStoreResult {
    return this.mutate((store) => {
      const index = store.profiles.findIndex((entry) => entry.id === profile.id)
      if (index === -1) {
        store.profiles.push(profile)
      } else {
        store.profiles[index] = profile
      }
      return null
    })
  }

  deleteProfile(profileId: string): AgentAuthProfileStoreResult {
    return this.mutate((store) => {
      store.profiles = store.profiles.filter((entry) => entry.id !== profileId)
      for (const key of Object.keys(store.workspaceBindings)) {
        if (store.workspaceBindings[key] === profileId) {
          delete store.workspaceBindings[key]
        }
      }
      for (const provider of ['claude', 'codex'] as const) {
        if (store.defaultProfileIdByProvider[provider] === profileId) {
          store.defaultProfileIdByProvider[provider] = null
        }
      }
      return null
    })
  }

  setWorkspaceBinding(key: string, profileId: string): AgentAuthProfileStoreResult {
    if (!isWorkspaceKey(key)) {
      return {
        ok: false,
        error: 'Workspace binding keys must be "worktree:<id>" or "folder:<id>".'
      }
    }
    return this.mutate((store) => {
      if (!store.profiles.some((entry) => entry.id === profileId)) {
        return `Profile "${profileId}" does not exist.`
      }
      store.workspaceBindings[key] = profileId
      return null
    })
  }

  clearWorkspaceBinding(key: string): AgentAuthProfileStoreResult {
    if (!isWorkspaceKey(key)) {
      return {
        ok: false,
        error: 'Workspace binding keys must be "worktree:<id>" or "folder:<id>".'
      }
    }
    return this.mutate((store) => {
      delete store.workspaceBindings[key]
      return null
    })
  }

  setProviderDefault(
    provider: AgentAuthProfileProvider,
    profileId: string | null
  ): AgentAuthProfileStoreResult {
    return this.mutate((store) => {
      store.defaultProfileIdByProvider[provider] = profileId
      return null
    })
  }

  // Returns null to commit, or an error string to abort without writing.
  private mutate(
    apply: (store: AgentAuthProfileStore) => string | null
  ): AgentAuthProfileStoreResult {
    const loaded = this.load()
    if (!loaded.ok) {
      return loaded
    }
    const next = structuredClone(loaded.store)
    const applyError = apply(next)
    if (applyError !== null) {
      return { ok: false, error: applyError }
    }
    const validated = parseAgentAuthProfileStore(next)
    if (!validated.ok) {
      return validated
    }
    try {
      writeFileAtomically(this.storeFilePath, `${JSON.stringify(validated.value, null, 2)}\n`, {
        mode: 0o600
      })
    } catch (error) {
      return { ok: false, error: `Could not save the agent auth profile store: ${String(error)}` }
    }
    return { ok: true, store: validated.value }
  }
}
