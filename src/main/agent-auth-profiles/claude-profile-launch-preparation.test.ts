import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaudeAccountSelectionTarget } from '../claude-accounts/runtime-selection'
import type { ClaudeRuntimeAuthPreparation } from '../claude-accounts/runtime-auth-service'
import {
  buildAgentAuthProfileSecretRef,
  type AgentAuthProfile
} from '../../shared/agent-auth-profile-types'
import type { AgentAuthProfileLaunchResolution } from './agent-auth-profile-launch-resolution'
import { agentAuthProfileLaunchContextFromWorkspaceId } from './agent-auth-profile-launch-resolution'
import { AgentAuthProfileSessionBindings } from './agent-auth-profile-session-bindings'
import { AgentAuthProfileStoreService } from './agent-auth-profile-store'
import type { AgentAuthProfileStoreResult } from './agent-auth-profile-store'
import type { AgentAuthProfileSecretReader } from './agent-auth-profile-env-materialization'
import {
  composeClaudeLaunchPreparation,
  createProfileAwarePrepareClaudeAuth
} from './claude-profile-launch-preparation'

function makeProfile(id: string, overrides: Partial<AgentAuthProfile> = {}): AgentAuthProfile {
  return {
    id,
    label: id,
    provider: 'claude',
    apiKeySecretRef: buildAgentAuthProfileSecretRef(id, 'api-key'),
    apiKeyKind: 'api-key',
    baseUrl: 'https://gw.example.test',
    model: null,
    headers: [],
    proxy: null,
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides
  }
}

function makeBasePreparation(
  overrides: Partial<ClaudeRuntimeAuthPreparation> = {}
): ClaudeRuntimeAuthPreparation {
  return {
    configDir: '/home/user/.claude',
    runtime: 'host',
    wslDistro: null,
    wslLinuxConfigDir: null,
    envPatch: {},
    stripAuthEnv: false,
    provenance: 'system',
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

describe('agentAuthProfileLaunchContextFromWorkspaceId', () => {
  it('maps a plain worktree id to the worktree level', () => {
    expect(agentAuthProfileLaunchContextFromWorkspaceId('sess-1', 'repo-1::/repo/path')).toEqual({
      sessionId: 'sess-1',
      worktreeId: 'repo-1::/repo/path',
      folderWorkspaceId: null
    })
  })

  it('maps a worktree workspace key to the worktree level', () => {
    expect(
      agentAuthProfileLaunchContextFromWorkspaceId('sess-1', 'worktree:repo-1::/repo/path')
    ).toEqual({
      sessionId: 'sess-1',
      worktreeId: 'repo-1::/repo/path',
      folderWorkspaceId: null
    })
  })

  it('maps a folder workspace key to the folder level', () => {
    expect(agentAuthProfileLaunchContextFromWorkspaceId('sess-1', 'folder:folder-1')).toEqual({
      sessionId: 'sess-1',
      worktreeId: null,
      folderWorkspaceId: 'folder-1'
    })
  })

  it('yields null ids when the spawn carries none', () => {
    expect(agentAuthProfileLaunchContextFromWorkspaceId(undefined, undefined)).toEqual({
      sessionId: null,
      worktreeId: null,
      folderWorkspaceId: null
    })
  })
})

describe('composeClaudeLaunchPreparation', () => {
  const profileResolution: AgentAuthProfileLaunchResolution<{
    ANTHROPIC_API_KEY?: string
    ANTHROPIC_BASE_URL?: string
  }> = {
    status: 'profile',
    profileId: 'profile-work',
    envPatch: { ANTHROPIC_API_KEY: 'vault-value', ANTHROPIC_BASE_URL: 'https://gw.example.test' },
    staleRefs: [],
    provenance: {
      sessionId: 'sess-1',
      provider: 'claude',
      level: 'session',
      profileId: 'profile-work',
      accountId: null,
      resolvedAt: 9_000
    }
  }

  it('merges the profile patch over the base patch and forces the strip', () => {
    const base = makeBasePreparation({
      envPatch: { CLAUDE_CONFIG_DIR: '/custom/claude-dir' },
      stripAuthEnv: false,
      provenance: 'system'
    })
    const composed = composeClaudeLaunchPreparation(base, profileResolution)

    expect(composed.stripAuthEnv).toBe(true)
    expect(composed.envPatch).toEqual({
      CLAUDE_CONFIG_DIR: '/custom/claude-dir',
      ANTHROPIC_API_KEY: 'vault-value',
      ANTHROPIC_BASE_URL: 'https://gw.example.test'
    })
    expect(composed.provenance).toBe('profile:profile-work')
    expect(composed.agentProfileProvenance?.profileId).toBe('profile-work')
  })

  it('returns the base untouched for legacy-account and none resolutions', () => {
    const base = makeBasePreparation({ stripAuthEnv: true, provenance: 'managed:account-1' })

    for (const status of ['legacy-account', 'none'] as const) {
      const composed = composeClaudeLaunchPreparation(base, {
        status,
        staleRefs: [],
        provenance: null
      })
      expect(composed).toEqual(base)
      expect(composed.agentProfileProvenance).toBeUndefined()
    }
  })

  it('throws for a failed resolution', () => {
    const base = makeBasePreparation()
    expect(() =>
      composeClaudeLaunchPreparation(base, {
        status: 'error',
        error: 'Agent auth secret "api-key" for profile "profile-work" is missing.'
      })
    ).toThrow(/api-key/)
  })
})

describe('createProfileAwarePrepareClaudeAuth', () => {
  let tempDir: string
  let storePath: string
  let storeService: AgentAuthProfileStoreService
  let sessionBindings: AgentAuthProfileSessionBindings

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'aio-ade-claude-profile-prep-'))
    storePath = join(tempDir, 'profiles.json')
    storeService = new AgentAuthProfileStoreService(storePath)
    sessionBindings = new AgentAuthProfileSessionBindings()
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  function makePrepare(
    basePrepare: (target?: ClaudeAccountSelectionTarget) => Promise<ClaudeRuntimeAuthPreparation>,
    overrides: {
      loadStore?: () => AgentAuthProfileStoreResult
      readSecret?: AgentAuthProfileSecretReader
      getLegacyAccountId?: (target?: ClaudeAccountSelectionTarget) => string | null
    } = {}
  ) {
    return createProfileAwarePrepareClaudeAuth(basePrepare, {
      loadStore: overrides.loadStore ?? (() => storeService.load()),
      sessionBindings,
      readSecret:
        overrides.readSecret ?? vaultReaderWith({ 'profile-work:api-key': 'vault-value' }),
      getLegacyAccountId: overrides.getLegacyAccountId ?? (() => 'account-oauth'),
      now: () => 9_000
    })
  }

  it('resolves a session-pinned profile end to end', async () => {
    storeService.upsertProfile(makeProfile('profile-work'))
    sessionBindings.set('sess-1', 'profile-work')
    const basePrepare = vi.fn(async () =>
      makeBasePreparation({ envPatch: { CLAUDE_CONFIG_DIR: '/custom/claude-dir' } })
    )
    const prepare = makePrepare(basePrepare)

    const preparation = await prepare(undefined, {
      sessionId: 'sess-1',
      worktreeId: null,
      folderWorkspaceId: null
    })

    expect(basePrepare).toHaveBeenCalledWith(undefined)
    expect(preparation.stripAuthEnv).toBe(true)
    expect(preparation.envPatch).toEqual({
      CLAUDE_CONFIG_DIR: '/custom/claude-dir',
      ANTHROPIC_API_KEY: 'vault-value',
      ANTHROPIC_BASE_URL: 'https://gw.example.test'
    })
    expect(preparation.provenance).toBe('profile:profile-work')
    expect(preparation.agentProfileProvenance).toEqual({
      sessionId: 'sess-1',
      provider: 'claude',
      level: 'session',
      profileId: 'profile-work',
      accountId: null,
      resolvedAt: 9_000
    })
  })

  it('resolves the provider default when no session or workspace binds', async () => {
    storeService.upsertProfile(makeProfile('profile-work'))
    storeService.setProviderDefault('claude', 'profile-work')
    const prepare = makePrepare(async () => makeBasePreparation())

    const preparation = await prepare(undefined, {
      sessionId: null,
      worktreeId: null,
      folderWorkspaceId: null
    })

    expect(preparation.provenance).toBe('profile:profile-work')
    expect(preparation.envPatch.ANTHROPIC_API_KEY).toBe('vault-value')
    // Why: no session id means nothing to key a launch record by — the profile
    // still governs the env, but no provenance is recorded.
    expect(preparation.agentProfileProvenance).toBeUndefined()
  })

  it('fails the launch when the profile store is corrupt', async () => {
    writeFileSync(storePath, '{not json', 'utf-8')
    const basePrepare = vi.fn(async () => makeBasePreparation())
    const prepare = makePrepare(basePrepare)

    await expect(
      prepare(undefined, { sessionId: null, worktreeId: null, folderWorkspaceId: null })
    ).rejects.toThrow(/JSON/)
    expect(basePrepare).not.toHaveBeenCalled()
  })

  it('fails the launch when the vault cannot read the profile secret', async () => {
    storeService.upsertProfile(makeProfile('profile-work'))
    storeService.setProviderDefault('claude', 'profile-work')
    const prepare = makePrepare(async () => makeBasePreparation(), {
      readSecret: vaultReaderWith({})
    })

    await expect(
      prepare(undefined, { sessionId: null, worktreeId: null, folderWorkspaceId: null })
    ).rejects.toThrow(/api-key/)
  })

  it('skips profile resolution entirely without a launch context', async () => {
    storeService.upsertProfile(makeProfile('profile-work'))
    storeService.setProviderDefault('claude', 'profile-work')
    const loadStore = vi.fn(() => storeService.load())
    const base = makeBasePreparation({ stripAuthEnv: true, provenance: 'managed:account-1' })
    const prepare = makePrepare(async () => base, { loadStore })

    const preparation = await prepare(undefined, undefined)

    expect(preparation).toEqual(base)
    expect(loadStore).not.toHaveBeenCalled()
  })

  it('keeps the account preparation when the legacy account wins', async () => {
    storeService.upsertProfile(makeProfile('profile-work'))
    const base = makeBasePreparation({ stripAuthEnv: true, provenance: 'managed:account-1' })
    const prepare = makePrepare(async () => base)

    const preparation = await prepare(undefined, {
      sessionId: 'sess-1',
      worktreeId: null,
      folderWorkspaceId: null
    })

    expect(preparation).toEqual(base)
    expect(preparation.agentProfileProvenance).toBeUndefined()
  })
})
