import { describe, expect, it } from 'vitest'
import type { AgentAuthProfile, AgentAuthProfileProvider } from './agent-auth-profile-types'
import {
  buildAgentAuthProfileLaunchProvenance,
  resolveAgentAuthProfile,
  type AgentAuthProfileBindings
} from './agent-auth-profile-bindings'
import { folderWorkspaceKey, worktreeWorkspaceKey } from './workspace-scope'

function makeProfile(
  id: string,
  provider: AgentAuthProfileProvider,
  overrides: Partial<AgentAuthProfile> = {}
): AgentAuthProfile {
  return {
    id,
    label: id,
    provider,
    apiKeySecretRef: null,
    apiKeyKind: null,
    baseUrl: null,
    model: null,
    headers: [],
    proxy: null,
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides
  }
}

function makeBindings(overrides: Partial<AgentAuthProfileBindings> = {}): AgentAuthProfileBindings {
  return {
    bySession: {},
    byWorkspace: {},
    defaultByProvider: { claude: null, codex: null },
    ...overrides
  }
}

describe('agent auth profile resolution precedence', () => {
  const claudeWork = makeProfile('profile-work', 'claude')
  const claudeAlt = makeProfile('profile-alt', 'claude')
  const codexWork = makeProfile('profile-codex', 'codex')

  it('resolves nothing when no level binds', () => {
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      profiles: [claudeWork],
      bindings: makeBindings(),
      legacyAccountId: null
    })
    expect(resolution).toEqual({ level: 'none', staleRefs: [] })
  })

  it('resolves the legacy account when only the legacy level holds', () => {
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      profiles: [claudeWork],
      bindings: makeBindings(),
      legacyAccountId: 'account-oauth'
    })
    expect(resolution).toEqual({
      level: 'legacy-account',
      accountId: 'account-oauth',
      staleRefs: []
    })
  })

  it('session beats worktree, folder workspace, provider default, and legacy', () => {
    const bindings = makeBindings({
      bySession: { 'session-1': 'profile-work' },
      byWorkspace: {
        [worktreeWorkspaceKey('wt-1')]: 'profile-alt',
        [folderWorkspaceKey('fw-1')]: 'profile-alt'
      },
      defaultByProvider: { claude: 'profile-alt', codex: null }
    })
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      sessionId: 'session-1',
      worktreeId: 'wt-1',
      folderWorkspaceId: 'fw-1',
      profiles: [claudeWork, claudeAlt],
      bindings,
      legacyAccountId: 'account-oauth'
    })
    expect(resolution.level).toBe('session')
    expect(resolution.level === 'session' && resolution.profile.id).toBe('profile-work')
    expect(resolution.staleRefs).toEqual([])
  })

  it('worktree beats folder workspace, provider default, and legacy', () => {
    const bindings = makeBindings({
      byWorkspace: {
        [worktreeWorkspaceKey('wt-1')]: 'profile-work',
        [folderWorkspaceKey('fw-1')]: 'profile-alt'
      },
      defaultByProvider: { claude: 'profile-alt', codex: null }
    })
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      worktreeId: 'wt-1',
      folderWorkspaceId: 'fw-1',
      profiles: [claudeWork, claudeAlt],
      bindings,
      legacyAccountId: 'account-oauth'
    })
    expect(resolution.level).toBe('worktree')
    expect(resolution.level === 'worktree' && resolution.profile.id).toBe('profile-work')
  })

  it('folder workspace beats provider default and legacy', () => {
    const bindings = makeBindings({
      byWorkspace: { [folderWorkspaceKey('fw-1')]: 'profile-work' },
      defaultByProvider: { claude: 'profile-alt', codex: null }
    })
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      folderWorkspaceId: 'fw-1',
      profiles: [claudeWork, claudeAlt],
      bindings,
      legacyAccountId: 'account-oauth'
    })
    expect(resolution.level).toBe('folder-workspace')
    expect(resolution.level === 'folder-workspace' && resolution.profile.id).toBe('profile-work')
  })

  it('provider default beats the legacy account', () => {
    const bindings = makeBindings({
      defaultByProvider: { claude: 'profile-work', codex: 'profile-codex' }
    })
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      profiles: [claudeWork, codexWork],
      bindings,
      legacyAccountId: 'account-oauth'
    })
    expect(resolution.level).toBe('provider-default')
    expect(resolution.level === 'provider-default' && resolution.profile.id).toBe('profile-work')
  })

  it('resolves the codex default for a codex launch from the same bindings', () => {
    const bindings = makeBindings({
      defaultByProvider: { claude: 'profile-work', codex: 'profile-codex' }
    })
    const resolution = resolveAgentAuthProfile({
      provider: 'codex',
      profiles: [claudeWork, codexWork],
      bindings,
      legacyAccountId: null
    })
    expect(resolution.level).toBe('provider-default')
    expect(resolution.level === 'provider-default' && resolution.profile.id).toBe('profile-codex')
  })
})

describe('agent auth profile resolution fall-through', () => {
  const claudeWork = makeProfile('profile-work', 'claude')

  it('falls through a session binding whose profile was deleted, loudly', () => {
    const bindings = makeBindings({
      bySession: { 'session-1': 'profile-gone' },
      byWorkspace: { [worktreeWorkspaceKey('wt-1')]: 'profile-work' }
    })
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      sessionId: 'session-1',
      worktreeId: 'wt-1',
      profiles: [claudeWork],
      bindings,
      legacyAccountId: null
    })
    expect(resolution.level).toBe('worktree')
    expect(resolution.staleRefs).toEqual([
      { level: 'session', profileId: 'profile-gone', reason: 'missing' }
    ])
  })

  it('falls through a binding that names the other provider, loudly', () => {
    const codexProfile = makeProfile('profile-codex', 'codex')
    const bindings = makeBindings({
      bySession: { 'session-1': 'profile-codex' },
      byWorkspace: { [worktreeWorkspaceKey('wt-1')]: 'profile-work' }
    })
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      sessionId: 'session-1',
      worktreeId: 'wt-1',
      profiles: [claudeWork, codexProfile],
      bindings,
      legacyAccountId: null
    })
    expect(resolution.level).toBe('worktree')
    expect(resolution.staleRefs).toEqual([
      { level: 'session', profileId: 'profile-codex', reason: 'provider-mismatch' }
    ])
  })

  it('falls through a stale provider default to the legacy account', () => {
    const bindings = makeBindings({
      defaultByProvider: { claude: 'profile-gone', codex: null }
    })
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      profiles: [claudeWork],
      bindings,
      legacyAccountId: 'account-oauth'
    })
    expect(resolution).toEqual({
      level: 'legacy-account',
      accountId: 'account-oauth',
      staleRefs: [{ level: 'provider-default', profileId: 'profile-gone', reason: 'missing' }]
    })
  })

  it('collects every stale ref encountered on the way down', () => {
    const codexProfile = makeProfile('profile-codex', 'codex')
    const bindings = makeBindings({
      bySession: { 'session-1': 'profile-gone' },
      byWorkspace: { [worktreeWorkspaceKey('wt-1')]: 'profile-codex' },
      defaultByProvider: { claude: 'profile-gone-too', codex: null }
    })
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      sessionId: 'session-1',
      worktreeId: 'wt-1',
      profiles: [claudeWork, codexProfile],
      bindings,
      legacyAccountId: null
    })
    expect(resolution.level).toBe('none')
    expect(resolution.staleRefs).toEqual([
      { level: 'session', profileId: 'profile-gone', reason: 'missing' },
      { level: 'worktree', profileId: 'profile-codex', reason: 'provider-mismatch' },
      { level: 'provider-default', profileId: 'profile-gone-too', reason: 'missing' }
    ])
  })

  it('treats empty-string ids as absent levels', () => {
    const bindings = makeBindings({
      bySession: { '': 'profile-work' },
      byWorkspace: { [worktreeWorkspaceKey('')]: 'profile-work' }
    })
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      sessionId: '',
      worktreeId: '',
      folderWorkspaceId: '',
      profiles: [claudeWork],
      bindings,
      legacyAccountId: null
    })
    expect(resolution).toEqual({ level: 'none', staleRefs: [] })
  })

  it('ignores Object.prototype members reached through prototype-named session ids', () => {
    // Why: session ids arrive as untrusted IPC strings; a plain Record lookup
    // on 'toString' would surface the inherited function as a phantom binding.
    for (const sessionId of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      const bindings = makeBindings({
        byWorkspace: { [worktreeWorkspaceKey('wt-1')]: 'profile-work' }
      })
      const resolution = resolveAgentAuthProfile({
        provider: 'claude',
        sessionId,
        worktreeId: 'wt-1',
        profiles: [claudeWork],
        bindings,
        legacyAccountId: null
      })
      expect(resolution.level).toBe('worktree')
      expect(resolution.staleRefs).toEqual([])
    }
  })
})

describe('agent auth profile launch provenance', () => {
  it('derives a secret-free record from a profile resolution', () => {
    const profile = makeProfile('profile-work', 'claude', {
      label: 'GLM work',
      baseUrl: 'https://open.bigmodel.cn/api/anthropic'
    })
    const resolution = resolveAgentAuthProfile({
      provider: 'claude',
      sessionId: 'session-1',
      profiles: [profile],
      bindings: makeBindings({ bySession: { 'session-1': 'profile-work' } }),
      legacyAccountId: null
    })
    const provenance = buildAgentAuthProfileLaunchProvenance({
      sessionId: 'session-1',
      provider: 'claude',
      resolution,
      now: 1_700_000_000_000
    })
    expect(provenance).toEqual({
      sessionId: 'session-1',
      provider: 'claude',
      level: 'session',
      profileId: 'profile-work',
      accountId: null,
      resolvedAt: 1_700_000_000_000
    })
    // Why: provenance must survive export/diagnostics — no profile fields ride along.
    expect(JSON.stringify(provenance)).not.toContain('bigmodel')
    expect(JSON.stringify(provenance)).not.toContain('GLM')
  })

  it('derives provenance for legacy-account and none resolutions', () => {
    const legacy = buildAgentAuthProfileLaunchProvenance({
      sessionId: 'session-2',
      provider: 'codex',
      resolution: { level: 'legacy-account', accountId: 'account-oauth', staleRefs: [] },
      now: 5
    })
    expect(legacy).toEqual({
      sessionId: 'session-2',
      provider: 'codex',
      level: 'legacy-account',
      profileId: null,
      accountId: 'account-oauth',
      resolvedAt: 5
    })
    const none = buildAgentAuthProfileLaunchProvenance({
      sessionId: 'session-3',
      provider: 'claude',
      resolution: { level: 'none', staleRefs: [] },
      now: 6
    })
    expect(none).toEqual({
      sessionId: 'session-3',
      provider: 'claude',
      level: 'none',
      profileId: null,
      accountId: null,
      resolvedAt: 6
    })
  })
})
