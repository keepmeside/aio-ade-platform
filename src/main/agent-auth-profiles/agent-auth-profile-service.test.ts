import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentAuthProfileUpsertInput } from '../../shared/agent-auth-profile-upsert-input'
import { buildAgentAuthProfileSecretRef } from '../../shared/agent-auth-profile-types'
import type { AgentAuthProfileHealthTestFetch } from './agent-auth-profile-health-test'
import {
  clearAgentAuthProfileLaunchRegistryForTests,
  recordAgentAuthProfileLaunch
} from './agent-auth-profile-launch-records'
import { AgentAuthProfileSessionBindings } from './agent-auth-profile-session-bindings'
import { AgentAuthProfileStoreService } from './agent-auth-profile-store'
import { AgentAuthSecretVault, type AgentAuthSecretStorageBackend } from './agent-auth-secret-vault'
import {
  codexProfileManagedHomePath,
  ensureCodexProfileManagedHome
} from './codex-profile-home-materialization'
import { AgentAuthProfileService } from './agent-auth-profile-service'

function makeBackend(): AgentAuthSecretStorageBackend {
  return {
    isEncryptionAvailable: () => true,
    encrypt: (plain) => `fake-enc:${Buffer.from(plain, 'utf8').toString('base64')}`,
    decrypt: (cipher) => {
      if (!cipher.startsWith('fake-enc:')) {
        throw new Error('undecryptable')
      }
      return Buffer.from(cipher.slice('fake-enc:'.length), 'base64').toString('utf8')
    }
  }
}

function makeProvenance(sessionId: string, profileId: string) {
  return {
    sessionId,
    provider: 'claude' as const,
    level: 'session' as const,
    profileId,
    accountId: null,
    resolvedAt: 1_000
  }
}

describe('agent auth profile service', () => {
  let baseDir: string
  let store: AgentAuthProfileStoreService
  let vault: AgentAuthSecretVault
  let sessionBindings: AgentAuthProfileSessionBindings
  let service: AgentAuthProfileService
  let healthFetch: AgentAuthProfileHealthTestFetch
  let healthFetchCalls: [string, Record<string, string>][]
  let mintCounter: number
  let userDataPath: string
  let systemCodexHomePath: string

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'agent-auth-profile-service-'))
    store = new AgentAuthProfileStoreService(join(baseDir, 'profiles.json'))
    vault = new AgentAuthSecretVault({
      vaultFilePath: join(baseDir, 'secrets.enc'),
      backend: makeBackend()
    })
    sessionBindings = new AgentAuthProfileSessionBindings()
    healthFetchCalls = []
    healthFetch = async (url, init) => {
      healthFetchCalls.push([url, init.headers])
      return { status: 200, ok: true }
    }
    mintCounter = 0
    userDataPath = join(baseDir, 'userData')
    systemCodexHomePath = join(baseDir, 'system-home', '.codex')
    service = new AgentAuthProfileService({
      store,
      vault,
      sessionBindings,
      mintProfileId: () => `minted-${(mintCounter += 1)}`,
      now: () => 42_000,
      healthFetch,
      userDataPath,
      systemCodexHomePath
    })
    clearAgentAuthProfileLaunchRegistryForTests()
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
    clearAgentAuthProfileLaunchRegistryForTests()
  })

  function makeCreateInput(
    overrides: Partial<AgentAuthProfileUpsertInput> = {}
  ): AgentAuthProfileUpsertInput {
    return {
      provider: 'claude',
      label: 'Work',
      apiKey: 'profile-key-1',
      apiKeyKind: 'api-key',
      baseUrl: null,
      model: null,
      headers: [{ name: 'x-title', value: 'profile-title-1' }],
      proxy: null,
      ...overrides
    }
  }

  function expectError<T extends { ok: boolean; error?: string }>(
    result: T,
    pattern: RegExp
  ): void {
    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected failed result')
    }
    expect(result.error).toMatch(pattern)
  }

  function createProfile(overrides: Partial<AgentAuthProfileUpsertInput> = {}): string {
    const result = service.create(makeCreateInput(overrides))
    if (!result.ok) {
      throw new Error(`expected created profile, got: ${result.error}`)
    }
    return result.value.id
  }

  it('lists profiles with live counts, key presence, defaults, bindings, and live launches', () => {
    const claudeId = createProfile()
    const codexId = createProfile({
      provider: 'codex',
      label: 'Codex work',
      apiKey: undefined,
      apiKeyKind: undefined,
      headers: []
    })
    service.setProviderDefault('claude', claudeId)
    service.setWorkspaceBinding('worktree:wt-1', claudeId)
    recordAgentAuthProfileLaunch(makeProvenance('sess-live-1', claudeId))

    const listed = service.list()

    expect(listed.ok).toBe(true)
    if (!listed.ok) {
      throw new Error('expected listed result')
    }
    const claudeEntry = listed.value.profiles.find((profile) => profile.id === claudeId)
    const codexEntry = listed.value.profiles.find((profile) => profile.id === codexId)
    expect(claudeEntry?.liveSessionCount).toBe(1)
    expect(claudeEntry?.hasApiKey).toBe(true)
    expect(codexEntry?.liveSessionCount).toBe(0)
    expect(codexEntry?.hasApiKey).toBe(false)
    expect(listed.value.defaultProfileIdByProvider.claude).toBe(claudeId)
    expect(listed.value.workspaceBindings['worktree:wt-1']).toBe(claudeId)
    expect(listed.value.liveLaunches).toEqual([
      {
        sessionId: 'sess-live-1',
        profileId: claudeId,
        provider: 'claude',
        level: 'session',
        accountId: null,
        resolvedAt: 1_000
      }
    ])
    expect(JSON.stringify(listed.value)).not.toContain('profile-key-1')
  })

  it('surfaces a corrupt store as a list error', () => {
    writeFileSync(join(baseDir, 'profiles.json'), 'not json', 'utf-8')

    expectError(service.list(), /not valid JSON/)
  })

  it('creates a profile with a minted id and vaulted secrets', () => {
    const result = service.create(makeCreateInput())

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('expected created profile')
    }
    expect(result.value.id).toBe('minted-1')
    expect(result.value.apiKeySecretRef).toBe(buildAgentAuthProfileSecretRef('minted-1', 'api-key'))
    expect(result.value.headers[0]?.secretRef).toBe(
      buildAgentAuthProfileSecretRef('minted-1', 'header:x-title')
    )
    expect(JSON.stringify(result.value)).not.toContain('profile-key-1')

    const stored = store.load()
    expect(stored.ok && stored.store.profiles.some((profile) => profile.id === 'minted-1')).toBe(
      true
    )
    expect(vault.get('minted-1', 'api-key')).toMatchObject({
      status: 'found',
      value: 'profile-key-1'
    })
    expect(vault.get('minted-1', 'header:x-title')).toMatchObject({
      status: 'found',
      value: 'profile-title-1'
    })
  })

  it('rejects a create that carries an id', () => {
    expectError(service.create(makeCreateInput({ id: 'profile-x' })), /must not carry an id/)
  })

  it('aborts a create when the vault refuses the write', () => {
    writeFileSync(join(baseDir, 'secrets.enc'), 'garbage', 'utf-8')

    expectError(service.create(makeCreateInput()), /vault/i)

    const stored = store.load()
    expect(stored.ok && stored.store.profiles).toHaveLength(0)
  })

  it('rolls back vaulted secrets when the store write fails', () => {
    vi.spyOn(store, 'upsertProfile').mockImplementationOnce(() => ({
      ok: false,
      error: 'Could not save the agent auth profile store: simulated write failure.'
    }))

    expectError(service.create(makeCreateInput()), /Could not save/)

    expect(vault.get('minted-1', 'api-key')).toMatchObject({ status: 'missing' })
  })

  it('blocks the update while live sessions run the profile', () => {
    const profileId = createProfile()
    recordAgentAuthProfileLaunch(makeProvenance('sess-live-1', profileId))

    const blocked = service.update(profileId, makeCreateInput({ label: 'Renamed' }))

    expect(blocked.ok).toBe(false)
    if (blocked.ok) {
      throw new Error('expected blocked result')
    }
    expect(blocked.error).toMatch(/live session/i)
    expect(blocked.liveSessionIds).toEqual(['sess-live-1'])
  })

  it('replaces non-secret state and keeps omitted secrets', () => {
    const profileId = createProfile({
      proxy: { url: 'https://proxy.example.test', authValue: 'proxy-auth-1' }
    })

    const updated = service.update(profileId, {
      provider: 'claude',
      label: 'Renamed',
      baseUrl: 'https://gw.example.test',
      model: 'glm-4.7',
      headers: [{ name: 'x-title' }],
      proxy: { url: 'https://proxy.example.test' }
    })

    expect(updated.ok).toBe(true)
    if (!updated.ok) {
      throw new Error('expected updated profile')
    }
    expect(updated.value.label).toBe('Renamed')
    expect(updated.value.baseUrl).toBe('https://gw.example.test')
    expect(updated.value.model).toBe('glm-4.7')
    expect(updated.value.apiKeySecretRef).toBe(buildAgentAuthProfileSecretRef(profileId, 'api-key'))
    expect(updated.value.headers[0]?.secretRef).toBe(
      buildAgentAuthProfileSecretRef(profileId, 'header:x-title')
    )
    expect(updated.value.proxy?.authSecretRef).toBe(
      buildAgentAuthProfileSecretRef(profileId, 'proxy-auth')
    )
    expect(vault.get(profileId, 'header:x-title')).toMatchObject({
      status: 'found',
      value: 'profile-title-1'
    })
    expect(vault.get(profileId, 'proxy-auth')).toMatchObject({
      status: 'found',
      value: 'proxy-auth-1'
    })
  })

  it('rotates and removes the api key', () => {
    const profileId = createProfile()

    const rotated = service.update(
      profileId,
      makeCreateInput({ apiKey: 'rotated-key', apiKeyKind: 'auth-token' })
    )
    expect(rotated.ok && rotated.value.apiKeyKind).toBe('auth-token')
    expect(vault.get(profileId, 'api-key')).toMatchObject({ status: 'found', value: 'rotated-key' })

    const removed = service.update(profileId, makeCreateInput({ apiKey: null, apiKeyKind: null }))
    expect(removed.ok && removed.value.apiKeySecretRef).toBeNull()
    expect(removed.ok && removed.value.apiKeyKind).toBeNull()
    expect(vault.get(profileId, 'api-key')).toMatchObject({ status: 'missing' })
  })

  it('adds, rotates, and removes headers', () => {
    const profileId = createProfile()

    const added = service.update(
      profileId,
      makeCreateInput({
        headers: [
          { name: 'x-title', value: 'rotated-title' },
          { name: 'anthropic-beta', value: 'beta-1' }
        ]
      })
    )
    expect(added.ok && added.value.headers.map((header) => header.name)).toEqual([
      'x-title',
      'anthropic-beta'
    ])
    expect(vault.get(profileId, 'header:x-title')).toMatchObject({
      status: 'found',
      value: 'rotated-title'
    })
    expect(vault.get(profileId, 'header:anthropic-beta')).toMatchObject({
      status: 'found',
      value: 'beta-1'
    })

    const removed = service.update(profileId, makeCreateInput({ headers: [{ name: 'x-title' }] }))
    expect(removed.ok && removed.value.headers.map((header) => header.name)).toEqual(['x-title'])
    expect(vault.get(profileId, 'header:anthropic-beta')).toMatchObject({ status: 'missing' })
  })

  it('removes the proxy and its auth secret', () => {
    const profileId = createProfile({
      proxy: { url: 'https://proxy.example.test', authValue: 'proxy-auth-1' }
    })

    const removed = service.update(profileId, makeCreateInput({ proxy: null }))

    expect(removed.ok && removed.value.proxy).toBeNull()
    expect(vault.get(profileId, 'proxy-auth')).toMatchObject({ status: 'missing' })
  })

  it('rejects an update for a missing profile', () => {
    expectError(service.update('profile-missing', makeCreateInput()), /does not exist/)
  })

  it('rejects a provider change', () => {
    const profileId = createProfile()

    expectError(service.update(profileId, makeCreateInput({ provider: 'codex' })), /provider/i)
  })

  it('duplicates a profile with copied secrets and a copy label', () => {
    const profileId = createProfile({
      proxy: { url: 'https://proxy.example.test', authValue: 'proxy-auth-1' }
    })

    const duplicated = service.duplicate(profileId)

    expect(duplicated.ok).toBe(true)
    if (!duplicated.ok) {
      throw new Error('expected duplicated profile')
    }
    expect(duplicated.value.id).toBe('minted-2')
    expect(duplicated.value.id).not.toBe(profileId)
    expect(duplicated.value.label).toBe('Work (copy)')
    expect(duplicated.value.apiKeySecretRef).toBe(
      buildAgentAuthProfileSecretRef('minted-2', 'api-key')
    )
    expect(vault.get('minted-2', 'api-key')).toMatchObject({
      status: 'found',
      value: 'profile-key-1'
    })
    expect(vault.get('minted-2', 'header:x-title')).toMatchObject({
      status: 'found',
      value: 'profile-title-1'
    })
    expect(vault.get('minted-2', 'proxy-auth')).toMatchObject({
      status: 'found',
      value: 'proxy-auth-1'
    })
    const stored = store.load()
    expect(stored.ok && stored.store.profiles).toHaveLength(2)
  })

  it('aborts a duplicate when a secret cannot be read', () => {
    const profileId = createProfile()
    // Why: hand-craft an api-key entry whose ciphertext fails the fake backend.
    writeFileSync(
      join(baseDir, 'secrets.enc'),
      JSON.stringify({
        version: 1,
        format: 'electron-safe-storage-v1',
        savedAt: 1,
        secrets: { [`${profileId}\u0000api-key`]: 'undecryptable-cipher' }
      }),
      'utf-8'
    )
    expect(vault.get(profileId, 'api-key').status).toBe('decrypt-failed')

    expectError(service.duplicate(profileId), /decrypt/i)

    const stored = store.load()
    expect(stored.ok && stored.store.profiles).toHaveLength(1)
  })

  it('blocks the delete while live sessions run the profile', () => {
    const profileId = createProfile()
    recordAgentAuthProfileLaunch(makeProvenance('sess-live-1', profileId))

    const blocked = service.delete(profileId)

    expect(blocked.ok).toBe(false)
    if (blocked.ok) {
      throw new Error('expected blocked result')
    }
    expect(blocked.error).toMatch(/live session/i)
    expect(blocked.liveSessionIds).toEqual(['sess-live-1'])
    const stored = store.load()
    expect(stored.ok && stored.store.profiles).toHaveLength(1)
  })

  it('deletes the store profile, vault secrets, session pins, and codex home', () => {
    const profileId = createProfile({
      provider: 'codex',
      apiKey: undefined,
      apiKeyKind: undefined,
      headers: []
    })
    const stored = store.load()
    const profile = stored.ok ? stored.store.profiles[0] : undefined
    expect(profile).toBeDefined()
    ensureCodexProfileManagedHome({
      profile: profile!,
      apiKey: null,
      userDataPath,
      systemCodexHomePath
    })
    expect(service.setSessionBinding('sess-pinned', profileId).ok).toBe(true)

    const deleted = service.delete(profileId)

    expect(deleted).toEqual({ ok: true, value: { warnings: [] } })
    const after = store.load()
    expect(after.ok && after.store.profiles).toHaveLength(0)
    expect(after.ok && after.store.defaultProfileIdByProvider.codex).toBeNull()
    expect(vault.get(profileId, 'api-key')).toMatchObject({ status: 'missing' })
    expect(sessionBindings.resolve('sess-pinned')).toBeNull()
    expect(existsSync(codexProfileManagedHomePath(userDataPath, profileId))).toBe(false)
  })

  it('collects a warning when the codex home cannot be removed', () => {
    const profileId = createProfile({
      provider: 'codex',
      apiKey: undefined,
      apiKeyKind: undefined,
      headers: []
    })
    const stored = store.load()
    const profile = stored.ok ? stored.store.profiles[0] : undefined
    expect(profile).toBeDefined()
    const homePath = ensureCodexProfileManagedHome({
      profile: profile!,
      apiKey: null,
      userDataPath,
      systemCodexHomePath
    })
    expect(homePath.ok).toBe(true)
    if (!homePath.ok) {
      throw new Error('expected materialized home')
    }
    writeFileSync(join(homePath.homePath, '.aio-ade-managed-home'), 'other\n', 'utf-8')

    const deleted = service.delete(profileId)

    expect(deleted.ok).toBe(true)
    if (!deleted.ok) {
      throw new Error('expected deleted result')
    }
    expect(deleted.value.warnings).toHaveLength(1)
    expect(deleted.value.warnings[0]).toMatch(/marker|ownership/)
  })

  it('rejects a delete for a missing profile', () => {
    expectError(service.delete('profile-missing'), /does not exist/)
  })

  it('tests a stored profile through the vault', async () => {
    const profileId = createProfile()

    const result = await service.testConnection({ profileId })

    expect(result).toEqual({ ok: true, status: 200 })
    expect(healthFetchCalls).toHaveLength(1)
    expect(healthFetchCalls[0]?.[0]).toBe('https://api.anthropic.com/v1/models')
    expect(healthFetchCalls[0]?.[1]['x-api-key']).toBe('profile-key-1')
  })

  it('reports a missing profile for a connection test', async () => {
    const result = await service.testConnection({ profileId: 'profile-missing' })

    expect(result).toEqual({
      ok: false,
      kind: 'profile-missing',
      error: 'Agent auth profile "profile-missing" does not exist.'
    })
  })

  it('rejects a connection test with neither a profile id nor draft input', async () => {
    const result = await service.testConnection({})

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected failed result')
    }
    expect(result.kind).toBe('invalid-input')
  })

  it('rejects an update draft that changes the provider', async () => {
    const profileId = createProfile()

    const result = await service.testConnection({
      profileId,
      input: makeCreateInput({ provider: 'codex' })
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected failed result')
    }
    expect(result.kind).toBe('invalid-input')
    expect(result.error).toMatch(/provider/)
  })

  it('tests an unsaved draft with its raw key', async () => {
    const result = await service.testConnection({ input: makeCreateInput() })

    expect(result).toEqual({ ok: true, status: 200 })
    expect(healthFetchCalls[0]?.[1]['x-api-key']).toBe('profile-key-1')
    const stored = store.load()
    expect(stored.ok && stored.store.profiles).toHaveLength(0)
  })

  it('falls back to the stored key for an update draft', async () => {
    const profileId = createProfile()

    const result = await service.testConnection({
      profileId,
      input: makeCreateInput({ apiKey: undefined, apiKeyKind: undefined, label: 'Renamed' })
    })

    expect(result).toEqual({ ok: true, status: 200 })
    expect(healthFetchCalls[0]?.[1]['x-api-key']).toBe('profile-key-1')
  })

  it('sets and clears the provider default with schema validation', () => {
    const claudeId = createProfile()
    const codexId = createProfile({
      provider: 'codex',
      apiKey: undefined,
      apiKeyKind: undefined,
      headers: []
    })

    expect(service.setProviderDefault('claude', claudeId).ok).toBe(true)
    const stored = store.load()
    expect(stored.ok && stored.store.defaultProfileIdByProvider.claude).toBe(claudeId)

    expect(service.setProviderDefault('claude', null).ok).toBe(true)
    const cleared = store.load()
    expect(cleared.ok && cleared.store.defaultProfileIdByProvider.claude).toBeNull()

    expectError(service.setProviderDefault('claude', codexId), /provider/)
  })

  it('pins and clears a session binding with profile validation', () => {
    const profileId = createProfile()

    expect(service.setSessionBinding('sess-1', profileId).ok).toBe(true)
    expect(sessionBindings.resolve('sess-1')).toBe(profileId)

    expect(service.setSessionBinding('sess-1', null).ok).toBe(true)
    expect(sessionBindings.resolve('sess-1')).toBeNull()

    expectError(service.setSessionBinding('sess-1', 'profile-missing'), /does not exist/)
  })

  it('sets and clears a workspace binding through the store', () => {
    const profileId = createProfile()

    expect(service.setWorkspaceBinding('worktree:wt-1', profileId).ok).toBe(true)
    const stored = store.load()
    expect(stored.ok && stored.store.workspaceBindings['worktree:wt-1']).toBe(profileId)

    expect(service.setWorkspaceBinding('worktree:wt-1', null).ok).toBe(true)
    const cleared = store.load()
    expect(cleared.ok && cleared.store.workspaceBindings['worktree:wt-1']).toBeUndefined()

    expectError(service.setWorkspaceBinding('bad-key', profileId), /Workspace binding keys/)
  })
})
