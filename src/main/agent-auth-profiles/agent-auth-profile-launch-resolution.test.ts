import { describe, expect, it } from 'vitest'
import type { AgentAuthProfile, AgentAuthProfileStore } from '../../shared/agent-auth-profile-types'
import { buildAgentAuthProfileSecretRef } from '../../shared/agent-auth-profile-types'
import type { AgentAuthSecretRead } from './agent-auth-secret-vault'
import {
  buildAgentAuthProfileBindingsSnapshot,
  resolveClaudeAgentAuthProfileForLaunch,
  resolveCodexAgentAuthProfileForLaunch
} from './agent-auth-profile-launch-resolution'

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

function makeStore(overrides: Partial<AgentAuthProfileStore> = {}): AgentAuthProfileStore {
  return {
    version: 1,
    profiles: [],
    defaultProfileIdByProvider: { claude: null, codex: null },
    workspaceBindings: {},
    ...overrides
  }
}

function vaultReaderWith(
  values: Record<string, string>
): (profileId: string, secretName: string) => AgentAuthSecretRead {
  return (profileId, secretName) => {
    const value = values[`${profileId}:${secretName}`]
    if (value === undefined) {
      return { status: 'missing' }
    }
    return { status: 'found', value, persistence: 'encrypted' }
  }
}

describe('agent auth profile bindings snapshot', () => {
  it('composes session pins, workspace bindings, and provider defaults', () => {
    const snapshot = buildAgentAuthProfileBindingsSnapshot(
      makeStore({
        workspaceBindings: {
          'worktree:repo-1::/repo/path': 'profile-work',
          'folder:folder-1': 'profile-alt'
        },
        defaultProfileIdByProvider: { claude: 'profile-work', codex: null }
      }),
      { 'session-1': 'profile-work' }
    )
    expect(snapshot.bySession).toEqual({ 'session-1': 'profile-work' })
    expect(snapshot.byWorkspace).toEqual({
      'worktree:repo-1::/repo/path': 'profile-work',
      'folder:folder-1': 'profile-alt'
    })
    expect(snapshot.defaultByProvider).toEqual({ claude: 'profile-work', codex: null })
  })

  it('drops workspace binding keys that are not workspace keys', () => {
    const snapshot = buildAgentAuthProfileBindingsSnapshot(
      makeStore({
        workspaceBindings: {
          'worktree:repo-1::/repo/path': 'profile-work',
          'bogus-key': 'profile-alt'
        } as AgentAuthProfileStore['workspaceBindings']
      }),
      {}
    )
    expect(snapshot.byWorkspace).toEqual({ 'worktree:repo-1::/repo/path': 'profile-work' })
  })
})

describe('claude launch profile resolution', () => {
  const profile = makeProfile('profile-work')

  it('resolves a session-bound profile into an env patch and provenance', () => {
    const result = resolveClaudeAgentAuthProfileForLaunch({
      sessionId: 'session-1',
      worktreeId: null,
      folderWorkspaceId: null,
      store: makeStore({ profiles: [profile] }),
      sessionBindings: { 'session-1': 'profile-work' },
      legacyAccountId: 'account-oauth',
      readSecret: vaultReaderWith({ 'profile-work:api-key': 'vault-value' }),
      now: 5_000
    })
    expect(result.status).toBe('profile')
    if (result.status !== 'profile') {
      throw new Error('unreachable')
    }
    expect(result.envPatch).toEqual({
      ANTHROPIC_API_KEY: 'vault-value',
      ANTHROPIC_BASE_URL: 'https://api.example.test'
    })
    expect(result.provenance).toEqual({
      sessionId: 'session-1',
      provider: 'claude',
      level: 'session',
      profileId: 'profile-work',
      accountId: null,
      resolvedAt: 5_000
    })
    expect(result.staleRefs).toEqual([])
  })

  it('fails loudly when the vault cannot supply the profile secret', () => {
    const result = resolveClaudeAgentAuthProfileForLaunch({
      sessionId: 'session-1',
      worktreeId: null,
      folderWorkspaceId: null,
      store: makeStore({ profiles: [profile] }),
      sessionBindings: { 'session-1': 'profile-work' },
      legacyAccountId: 'account-oauth',
      readSecret: vaultReaderWith({}),
      now: 5_000
    })
    expect(result.status).toBe('error')
    if (result.status !== 'error') {
      throw new Error('unreachable')
    }
    expect(result.error).toMatch(/api-key/)
  })

  it('falls back to the legacy account when no profile level binds', () => {
    const result = resolveClaudeAgentAuthProfileForLaunch({
      sessionId: 'session-1',
      worktreeId: null,
      folderWorkspaceId: null,
      store: makeStore({ profiles: [profile] }),
      sessionBindings: {},
      legacyAccountId: 'account-oauth',
      readSecret: vaultReaderWith({}),
      now: 5_000
    })
    expect(result.status).toBe('legacy-account')
    if (result.status !== 'legacy-account') {
      throw new Error('unreachable')
    }
    expect(result.provenance?.accountId).toBe('account-oauth')
  })

  it('resolves none without provenance when the launch has no session id', () => {
    const result = resolveClaudeAgentAuthProfileForLaunch({
      sessionId: null,
      worktreeId: 'repo-1::/repo/path',
      folderWorkspaceId: null,
      store: makeStore({
        profiles: [profile],
        workspaceBindings: { 'worktree:repo-1::/repo/path': 'profile-gone' }
      }),
      sessionBindings: {},
      legacyAccountId: null,
      readSecret: vaultReaderWith({}),
      now: 5_000
    })
    expect(result.status).toBe('none')
    if (result.status !== 'none') {
      throw new Error('unreachable')
    }
    // Why loud: the stale worktree binding must surface even when nothing wins.
    expect(result.staleRefs).toEqual([
      { level: 'worktree', profileId: 'profile-gone', reason: 'missing' }
    ])
    expect(result.provenance).toBeNull()
  })
})

describe('codex launch profile resolution', () => {
  const codexProfile = makeProfile('profile-codex', {
    provider: 'codex',
    baseUrl: 'https://codex-gw.example.test'
  })

  it('resolves a worktree-bound codex profile into a codex env patch', () => {
    const result = resolveCodexAgentAuthProfileForLaunch({
      sessionId: 'session-1',
      worktreeId: 'repo-1::/repo/path',
      folderWorkspaceId: null,
      store: makeStore({
        profiles: [codexProfile],
        workspaceBindings: { 'worktree:repo-1::/repo/path': 'profile-codex' }
      }),
      sessionBindings: {},
      legacyAccountId: null,
      readSecret: vaultReaderWith({ 'profile-codex:api-key': 'vault-value' }),
      now: 7_000
    })
    expect(result.status).toBe('profile')
    if (result.status !== 'profile') {
      throw new Error('unreachable')
    }
    expect(result.envPatch).toEqual({
      OPENAI_API_KEY: 'vault-value',
      OPENAI_BASE_URL: 'https://codex-gw.example.test'
    })
    expect(result.provenance?.level).toBe('worktree')
    expect(result.provenance?.provider).toBe('codex')
  })
})
