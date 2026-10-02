import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAgentAuthProfileSecretRef,
  type AgentAuthProfile
} from '../../shared/agent-auth-profile-types'
import type { CodexAccountSelectionTarget } from '../codex-accounts/runtime-selection'
import { AgentAuthProfileSessionBindings } from './agent-auth-profile-session-bindings'
import { AgentAuthProfileStoreService } from './agent-auth-profile-store'
import type { AgentAuthProfileStoreResult } from './agent-auth-profile-store'
import type { AgentAuthProfileSecretReader } from './agent-auth-profile-env-materialization'
import { codexProfileManagedHomePath } from './codex-profile-home-materialization'
import {
  createCodexProfileLaunchAuthResolver,
  type CodexProfileLaunchAuthDependencies
} from './codex-profile-launch-auth'

function makeProfile(id: string, overrides: Partial<AgentAuthProfile> = {}): AgentAuthProfile {
  return {
    id,
    label: id,
    provider: 'codex',
    apiKeySecretRef: buildAgentAuthProfileSecretRef(id, 'api-key'),
    apiKeyKind: 'api-key',
    baseUrl: 'https://gw.example.test/v1',
    model: null,
    headers: [],
    proxy: null,
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides
  }
}

function vaultReaderWith(values: Record<string, string>): AgentAuthProfileSecretReader {
  return (profileId, secretName) => {
    const value = values[`${profileId}:${secretName}`]
    if (value === undefined) {
      return { status: 'missing' }
    }
    return { status: 'found', value, persistence: 'encrypted' }
  }
}

describe('createCodexProfileLaunchAuthResolver', () => {
  let tempDir: string
  let storePath: string
  let storeService: AgentAuthProfileStoreService
  let sessionBindings: AgentAuthProfileSessionBindings
  let userDataPath: string
  let systemCodexHomePath: string
  const hostTarget: CodexAccountSelectionTarget = { runtime: 'host' }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'codex-profile-launch-'))
    storePath = join(tempDir, 'profiles.json')
    storeService = new AgentAuthProfileStoreService(storePath)
    sessionBindings = new AgentAuthProfileSessionBindings()
    userDataPath = join(tempDir, 'userData')
    systemCodexHomePath = join(tempDir, 'system-home', '.codex')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  function makeResolver(
    overrides: {
      loadStore?: () => AgentAuthProfileStoreResult
      readSecret?: AgentAuthProfileSecretReader
      prepareLaunchHome?: NonNullable<CodexProfileLaunchAuthDependencies['prepareLaunchHome']>
    } = {}
  ) {
    const prepareLaunchHome =
      overrides.prepareLaunchHome ??
      vi.fn<NonNullable<CodexProfileLaunchAuthDependencies['prepareLaunchHome']>>()
    const resolver = createCodexProfileLaunchAuthResolver({
      loadStore: overrides.loadStore ?? (() => storeService.load()),
      sessionBindings,
      readSecret:
        overrides.readSecret ?? vaultReaderWith({ 'profile-work:api-key': 'vault-value' }),
      getLegacyAccountId: () => 'account-oauth',
      getUserDataPath: () => userDataPath,
      getSystemCodexHomePath: () => systemCodexHomePath,
      prepareLaunchHome,
      now: () => 9_000
    })
    return { resolver, prepareLaunchHome }
  }

  it('returns null on the WSL lane without touching the store', () => {
    const loadStore = vi.fn(() => storeService.load())
    const { resolver } = makeResolver({ loadStore })

    expect(
      resolver({
        target: { runtime: 'wsl', wslDistro: 'Ubuntu' },
        launchContext: { sessionId: 'sess-1', worktreeId: null, folderWorkspaceId: null }
      })
    ).toBeNull()
    expect(loadStore).not.toHaveBeenCalled()
  })

  it('resolves a session-pinned profile into a materialized home', () => {
    storeService.upsertProfile(makeProfile('profile-work'))
    sessionBindings.set('sess-1', 'profile-work')
    const { resolver, prepareLaunchHome } = makeResolver()

    const auth = resolver({
      target: hostTarget,
      launchContext: { sessionId: 'sess-1', worktreeId: null, folderWorkspaceId: null },
      workspacePath: '/repo/path'
    })

    expect(auth).not.toBeNull()
    const homePath = realpathSync(codexProfileManagedHomePath(userDataPath, 'profile-work'))
    expect(auth?.codexHomePath).toBe(homePath)
    expect(auth?.envPatch).toEqual({
      OPENAI_API_KEY: 'vault-value',
      OPENAI_BASE_URL: 'https://gw.example.test/v1'
    })
    expect(auth?.agentProfileProvenance).toEqual({
      sessionId: 'sess-1',
      provider: 'codex',
      level: 'session',
      profileId: 'profile-work',
      accountId: null,
      resolvedAt: 9_000
    })
    expect(JSON.parse(readFileSync(join(homePath, 'auth.json'), 'utf-8'))).toEqual({
      OPENAI_API_KEY: 'vault-value'
    })
    expect(readFileSync(join(homePath, 'config.toml'), 'utf-8')).toContain(
      '[model_providers."aio-ade-profile-work"]'
    )
    expect(prepareLaunchHome).toHaveBeenCalledWith(homePath, hostTarget, '/repo/path')
  })

  it('returns null when only the legacy account is selected', () => {
    storeService.upsertProfile(makeProfile('profile-work'))
    const { resolver, prepareLaunchHome } = makeResolver()

    expect(
      resolver({
        target: hostTarget,
        launchContext: { sessionId: 'sess-1', worktreeId: null, folderWorkspaceId: null }
      })
    ).toBeNull()
    expect(prepareLaunchHome).not.toHaveBeenCalled()
  })

  it('fails the launch when the profile store is corrupt', () => {
    writeFileSync(storePath, '{not json', 'utf-8')
    const { resolver } = makeResolver()

    expect(() =>
      resolver({
        target: hostTarget,
        launchContext: { sessionId: null, worktreeId: null, folderWorkspaceId: null }
      })
    ).toThrow(/JSON/)
  })

  it('fails the launch when the vault cannot read the profile secret', () => {
    storeService.upsertProfile(makeProfile('profile-work'))
    storeService.setProviderDefault('codex', 'profile-work')
    const { resolver } = makeResolver({ readSecret: vaultReaderWith({}) })

    expect(() =>
      resolver({
        target: hostTarget,
        launchContext: { sessionId: null, worktreeId: null, folderWorkspaceId: null }
      })
    ).toThrow(/api-key/)
  })

  it('fails the launch when home materialization is refused', () => {
    storeService.upsertProfile(makeProfile('profile-work'))
    sessionBindings.set('sess-1', 'profile-work')
    const foreignHome = codexProfileManagedHomePath(userDataPath, 'profile-work')
    mkdirSync(foreignHome, { recursive: true })
    writeFileSync(join(foreignHome, '.aio-ade-managed-home'), 'other-profile\n', 'utf-8')
    const { resolver } = makeResolver()

    expect(() =>
      resolver({
        target: hostTarget,
        launchContext: { sessionId: 'sess-1', worktreeId: null, folderWorkspaceId: null }
      })
    ).toThrow(/Failed to materialize/)
  })

  it('falls through when the binding points at another provider', () => {
    storeService.upsertProfile(makeProfile('profile-claude', { provider: 'claude' }))
    sessionBindings.set('sess-1', 'profile-claude')
    const { resolver } = makeResolver()

    expect(
      resolver({
        target: hostTarget,
        launchContext: { sessionId: 'sess-1', worktreeId: null, folderWorkspaceId: null }
      })
    ).toBeNull()
  })
})
