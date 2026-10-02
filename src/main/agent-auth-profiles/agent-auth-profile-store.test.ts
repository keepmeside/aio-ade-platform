import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildAgentAuthProfileSecretRef,
  AGENT_AUTH_PROFILE_STORE_VERSION,
  type AgentAuthProfile
} from '../../shared/agent-auth-profile-types'
import {
  AgentAuthProfileStoreService,
  parseAgentAuthProfileStore
} from './agent-auth-profile-store'

function makeProfile(id: string, overrides: Partial<AgentAuthProfile> = {}): AgentAuthProfile {
  return {
    id,
    label: id,
    provider: 'claude',
    apiKeySecretRef: buildAgentAuthProfileSecretRef(id, 'api-key'),
    apiKeyKind: 'api-key',
    baseUrl: 'https://api.example.test',
    model: null,
    headers: [],
    proxy: null,
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides
  }
}

describe('agent auth profile store service', () => {
  let tempDir: string
  let storePath: string
  let service: AgentAuthProfileStoreService

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'aio-ade-agent-auth-store-'))
    storePath = join(tempDir, 'profiles.json')
    service = new AgentAuthProfileStoreService(storePath)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('loads an empty store when the file is missing', () => {
    const loaded = service.load()
    expect(loaded).toEqual({
      ok: true,
      store: {
        version: 1,
        profiles: [],
        defaultProfileIdByProvider: { claude: null, codex: null },
        workspaceBindings: {}
      }
    })
  })

  it('round-trips an upserted profile through disk', () => {
    const result = service.upsertProfile(makeProfile('profile-work'))
    expect(result.ok).toBe(true)

    const raw = JSON.parse(readFileSync(storePath, 'utf-8')) as { profiles: { id: string }[] }
    expect(raw.profiles.map((profile) => profile.id)).toEqual(['profile-work'])

    const loaded = service.load()
    expect(loaded.ok && loaded.store.profiles[0]?.id).toBe('profile-work')
  })

  it('replaces an existing profile in place, keeping order', () => {
    service.upsertProfile(makeProfile('profile-a'))
    service.upsertProfile(makeProfile('profile-b'))
    service.upsertProfile(makeProfile('profile-a', { label: 'renamed' }))

    const loaded = service.load()
    expect(loaded.ok && loaded.store.profiles.map((profile) => profile.id)).toEqual([
      'profile-a',
      'profile-b'
    ])
    expect(loaded.ok && loaded.store.profiles[0]?.label).toBe('renamed')
  })

  it('fails loudly on corrupt JSON and leaves the file untouched', () => {
    writeFileSync(storePath, '{not json', 'utf-8')
    const loaded = service.load()
    expect(loaded.ok).toBe(false)
    if (!loaded.ok) {
      expect(loaded.error).toMatch(/JSON/)
    }
    expect(readFileSync(storePath, 'utf-8')).toBe('{not json')

    const mutated = service.upsertProfile(makeProfile('profile-work'))
    expect(mutated.ok).toBe(false)
    expect(readFileSync(storePath, 'utf-8')).toBe('{not json')
  })

  it('fails loudly on schema-invalid store content', () => {
    writeFileSync(
      storePath,
      JSON.stringify({ version: 1, profiles: [], defaultProfileIdByProvider: {} }),
      'utf-8'
    )
    const loaded = service.load()
    expect(loaded.ok).toBe(false)
  })

  it('rejects an invalid profile without creating the file', () => {
    const bad = makeProfile('profile-work', { apiKeySecretRef: null, apiKeyKind: 'api-key' })
    const result = service.upsertProfile(bad)
    expect(result.ok).toBe(false)

    const loaded = service.load()
    expect(loaded.ok && loaded.store.profiles).toEqual([])
  })

  it('deletes a profile and prunes its bindings and default in one write', () => {
    service.upsertProfile(makeProfile('profile-work'))
    service.upsertProfile(makeProfile('profile-other'))
    service.setWorkspaceBinding('worktree:repo-1::/repo/path', 'profile-work')
    service.setWorkspaceBinding('folder:folder-1', 'profile-other')
    service.setProviderDefault('claude', 'profile-work')

    const result = service.deleteProfile('profile-work')
    expect(result.ok).toBe(true)

    const loaded = service.load()
    expect(loaded.ok && loaded.store.profiles.map((profile) => profile.id)).toEqual([
      'profile-other'
    ])
    expect(loaded.ok && loaded.store.workspaceBindings).toEqual({
      'folder:folder-1': 'profile-other'
    })
    expect(loaded.ok && loaded.store.defaultProfileIdByProvider.claude).toBeNull()
  })

  it('binds a workspace to an existing profile of any provider', () => {
    service.upsertProfile(makeProfile('profile-codex', { provider: 'codex' }))
    const bound = service.setWorkspaceBinding('worktree:repo-1::/repo/path', 'profile-codex')
    expect(bound.ok).toBe(true)

    const loaded = service.load()
    expect(loaded.ok && loaded.store.workspaceBindings['worktree:repo-1::/repo/path']).toBe(
      'profile-codex'
    )
  })

  it('rejects workspace bindings with a bad key or a missing target', () => {
    service.upsertProfile(makeProfile('profile-work'))
    expect(service.setWorkspaceBinding('bogus-key', 'profile-work').ok).toBe(false)
    expect(service.setWorkspaceBinding('worktree:repo-1::/repo/path', 'profile-gone').ok).toBe(
      false
    )
    const loaded = service.load()
    expect(loaded.ok && loaded.store.workspaceBindings).toEqual({})
  })

  it('clears a single workspace binding', () => {
    service.upsertProfile(makeProfile('profile-work'))
    service.setWorkspaceBinding('worktree:repo-1::/repo/path', 'profile-work')
    service.setWorkspaceBinding('folder:folder-1', 'profile-work')

    expect(service.clearWorkspaceBinding('worktree:repo-1::/repo/path').ok).toBe(true)
    const loaded = service.load()
    expect(loaded.ok && loaded.store.workspaceBindings).toEqual({
      'folder:folder-1': 'profile-work'
    })
  })

  it('sets and clears a provider default with schema cross-validation', () => {
    service.upsertProfile(makeProfile('profile-work'))
    service.upsertProfile(makeProfile('profile-codex', { provider: 'codex' }))

    expect(service.setProviderDefault('claude', 'profile-work').ok).toBe(true)
    expect(service.setProviderDefault('claude', 'profile-codex').ok).toBe(false)
    expect(service.setProviderDefault('claude', 'profile-gone').ok).toBe(false)

    const cleared = service.setProviderDefault('claude', null)
    expect(cleared.ok).toBe(true)
    const loaded = service.load()
    expect(loaded.ok && loaded.store.defaultProfileIdByProvider.claude).toBeNull()
  })

  it('parses into a discriminated union without throwing', () => {
    const ok = parseAgentAuthProfileStore({
      version: AGENT_AUTH_PROFILE_STORE_VERSION,
      defaultProfileIdByProvider: { claude: null, codex: null },
      workspaceBindings: {},
      profiles: [makeProfile('profile-work')]
    })
    expect(ok.ok).toBe(true)

    for (const bad of [
      null,
      'x',
      7,
      { version: 2, profiles: [] },
      { version: 1, profiles: 'nope' },
      { version: 1 }
    ]) {
      const result = parseAgentAuthProfileStore(bad)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(typeof result.error).toBe('string')
        expect(result.error.length).toBeGreaterThan(0)
      }
    }
  })
})
