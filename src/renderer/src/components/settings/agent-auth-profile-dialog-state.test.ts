import { describe, expect, it } from 'vitest'
import {
  CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE,
  buildAgentAuthProfileUpsertInputFromDialogState,
  createAgentAuthProfileDialogState,
  isAgentAuthProfileDialogSubmittable,
  resolveAgentAuthProfileDialogState,
  type AgentAuthProfileDialogState
} from './agent-auth-profile-dialog-state'
import type { AgentAuthProfileListEntry } from '../../../../shared/agent-auth-profile-service-results'

function makeProfile(
  overrides: Partial<AgentAuthProfileListEntry> = {}
): AgentAuthProfileListEntry {
  return {
    id: 'work',
    provider: 'claude',
    label: 'Work',
    apiKeySecretRef: 'vault:v1:work:api-key',
    apiKeyKind: 'api-key',
    baseUrl: 'https://proxy.example.com',
    model: 'claude-sonnet-5-5',
    headers: [{ name: 'x-api-key', secretRef: 'vault:v1:work:header:x-api-key' }],
    proxy: { url: 'https://proxy.example.com', authSecretRef: 'vault:v1:work:proxy-auth' },
    createdAt: 1,
    updatedAt: 2,
    liveSessionCount: 0,
    hasApiKey: true,
    ...overrides
  }
}

describe('createAgentAuthProfileDialogState', () => {
  it('seeds a pristine create session for the opening provider', () => {
    const state = createAgentAuthProfileDialogState(null)
    expect(state.originProfileId).toBeNull()
    expect(state.createProvider).toBe('claude')
    expect(state.provider).toBe('claude')

    const codex = createAgentAuthProfileDialogState(null, 'codex')
    expect(codex.createProvider).toBe('codex')
    expect(codex.provider).toBe('codex')
  })

  it('seeds an edit state from the stored profile', () => {
    const state = createAgentAuthProfileDialogState(makeProfile())
    expect(state.originProfileId).toBe('work')
    expect(state.createProvider).toBeNull()
    expect(state.provider).toBe('claude')
    expect(state.label).toBe('Work')
    expect(state.apiKeyDraft).toBe('')
    expect(state.removeStoredApiKey).toBe(false)
    expect(state.apiKeyKindDraft).toBe('api-key')
    expect(state.baseUrl).toBe('https://proxy.example.com')
    expect(state.model).toBe('claude-sonnet-5-5')
    expect(state.headerDrafts).toEqual([{ name: 'x-api-key', value: '', keepStored: true }])
    expect(state.proxy).toEqual({
      enabled: true,
      url: 'https://proxy.example.com',
      authDraft: '',
      removeStoredAuth: false
    })
    expect(state.hasStoredApiKey).toBe(true)
    expect(state.hasStoredProxyAuth).toBe(true)
  })

  it('seeds stored-secret probes false without stored secrets', () => {
    const state = createAgentAuthProfileDialogState(
      makeProfile({
        apiKeySecretRef: null,
        apiKeyKind: null,
        hasApiKey: false,
        proxy: null
      })
    )
    expect(state.hasStoredApiKey).toBe(false)
    expect(state.hasStoredProxyAuth).toBe(false)
  })

  it('defaults the kind draft when a stored profile carries none', () => {
    const state = createAgentAuthProfileDialogState(
      makeProfile({ apiKeySecretRef: null, apiKeyKind: null, hasApiKey: false })
    )
    expect(state.apiKeyKindDraft).toBe('api-key')
  })
})

describe('resolveAgentAuthProfileDialogState', () => {
  it('preserves identity while the dialog is open for the same target', () => {
    const profile = makeProfile()
    const state = createAgentAuthProfileDialogState(profile)
    expect(resolveAgentAuthProfileDialogState(state, true, profile)).toBe(state)
  })

  it('reseeds when the open target changes underneath the dialog', () => {
    const state = createAgentAuthProfileDialogState(makeProfile())
    const next = resolveAgentAuthProfileDialogState(state, true, makeProfile({ id: 'other' }))
    expect(next).not.toBe(state)
    expect(next.originProfileId).toBe('other')
  })

  it('keeps a create session identity across in-dialog provider switches', () => {
    const state = createAgentAuthProfileDialogState(null, 'codex')
    const switched: AgentAuthProfileDialogState = {
      ...state,
      provider: 'claude',
      apiKeyDraft: 'typed-secret'
    }
    expect(resolveAgentAuthProfileDialogState(switched, true, null, 'codex')).toBe(switched)
  })

  it('reseeds a create session when the opening provider changes', () => {
    const state = createAgentAuthProfileDialogState(null)
    const next = resolveAgentAuthProfileDialogState(state, true, null, 'codex')
    expect(next).not.toBe(state)
    expect(next.provider).toBe('codex')
  })

  it('reseeds an edit state into a create session', () => {
    const state = createAgentAuthProfileDialogState(makeProfile())
    const next = resolveAgentAuthProfileDialogState(state, true, null)
    expect(next).not.toBe(state)
    expect(next.originProfileId).toBeNull()
    expect(next.createProvider).toBe('claude')
  })

  it('folds a drafted state back to pristine on close', () => {
    const state: AgentAuthProfileDialogState = {
      ...createAgentAuthProfileDialogState(makeProfile()),
      apiKeyDraft: 'typed-secret',
      saveState: 'error',
      saveError: 'boom'
    }
    expect(resolveAgentAuthProfileDialogState(state, false, null)).toBe(
      CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE
    )
  })

  it('keeps the pristine closed state identity on close', () => {
    expect(
      resolveAgentAuthProfileDialogState(CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE, false, null)
    ).toBe(CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE)
  })
})

describe('buildAgentAuthProfileUpsertInputFromDialogState', () => {
  it('builds a minimal create input with no secret arms', () => {
    expect(
      buildAgentAuthProfileUpsertInputFromDialogState(CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE)
    ).toEqual({
      provider: 'claude',
      baseUrl: null,
      model: null,
      headers: [],
      proxy: null
    })
  })

  it('pairs a typed claude key with the selected kind', () => {
    const state: AgentAuthProfileDialogState = {
      ...CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE,
      apiKeyDraft: ' sk-ant-test ',
      apiKeyKindDraft: 'auth-token',
      label: ' Work '
    }
    expect(buildAgentAuthProfileUpsertInputFromDialogState(state)).toMatchObject({
      label: 'Work',
      apiKey: 'sk-ant-test',
      apiKeyKind: 'auth-token'
    })
  })

  it('forces the api-key kind for codex profiles', () => {
    const state: AgentAuthProfileDialogState = {
      ...CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE,
      provider: 'codex',
      apiKeyDraft: 'sk-test',
      apiKeyKindDraft: 'auth-token'
    }
    expect(buildAgentAuthProfileUpsertInputFromDialogState(state)).toMatchObject({
      apiKey: 'sk-test',
      apiKeyKind: 'api-key'
    })
  })

  it('keeps the stored key when the edit draft stays blank', () => {
    const state = createAgentAuthProfileDialogState(makeProfile())
    const input = buildAgentAuthProfileUpsertInputFromDialogState(state)
    expect(input).not.toHaveProperty('apiKey')
    expect(input).not.toHaveProperty('apiKeyKind')
  })

  it('removes the stored key when the remove flag is set', () => {
    const state: AgentAuthProfileDialogState = {
      ...createAgentAuthProfileDialogState(makeProfile()),
      removeStoredApiKey: true
    }
    expect(buildAgentAuthProfileUpsertInputFromDialogState(state)).toMatchObject({
      apiKey: null,
      apiKeyKind: null
    })
  })

  it('omits the key arm entirely on create even with a stray remove flag', () => {
    const state: AgentAuthProfileDialogState = {
      ...CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE,
      removeStoredApiKey: true
    }
    expect(buildAgentAuthProfileUpsertInputFromDialogState(state)).not.toHaveProperty('apiKey')
  })

  it('maps header drafts onto keep, rotate, and drop arms', () => {
    const state: AgentAuthProfileDialogState = {
      ...createAgentAuthProfileDialogState(makeProfile()),
      headerDrafts: [
        { name: 'x-api-key', value: '', keepStored: true },
        { name: 'anthropic-beta', value: ' interleaved ', keepStored: false },
        { name: 'x-title', value: '', keepStored: false }
      ]
    }
    expect(buildAgentAuthProfileUpsertInputFromDialogState(state).headers).toEqual([
      { name: 'x-api-key' },
      { name: 'anthropic-beta', value: 'interleaved' }
    ])
  })

  it('drops the proxy when disabled and keeps its stored auth when blank', () => {
    const enabled = createAgentAuthProfileDialogState(makeProfile())
    expect(buildAgentAuthProfileUpsertInputFromDialogState(enabled).proxy).toEqual({
      url: 'https://proxy.example.com'
    })

    const disabled: AgentAuthProfileDialogState = {
      ...enabled,
      proxy: { ...enabled.proxy, enabled: false }
    }
    expect(buildAgentAuthProfileUpsertInputFromDialogState(disabled).proxy).toBeNull()
  })

  it('rotates, removes, and sets proxy auth by draft and flag', () => {
    const seeded = createAgentAuthProfileDialogState(makeProfile())
    const rotate: AgentAuthProfileDialogState = {
      ...seeded,
      proxy: { ...seeded.proxy, authDraft: ' user:pass ' }
    }
    expect(buildAgentAuthProfileUpsertInputFromDialogState(rotate).proxy).toEqual({
      url: 'https://proxy.example.com',
      authValue: 'user:pass'
    })

    const remove: AgentAuthProfileDialogState = {
      ...seeded,
      proxy: { ...seeded.proxy, removeStoredAuth: true }
    }
    expect(buildAgentAuthProfileUpsertInputFromDialogState(remove).proxy).toEqual({
      url: 'https://proxy.example.com',
      authValue: null
    })
  })

  it('sends no proxy auth arm on create with a blank draft', () => {
    const state: AgentAuthProfileDialogState = {
      ...CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE,
      proxy: {
        enabled: true,
        url: 'https://proxy.example.com',
        authDraft: '',
        removeStoredAuth: true
      }
    }
    expect(buildAgentAuthProfileUpsertInputFromDialogState(state).proxy).toEqual({
      url: 'https://proxy.example.com'
    })
  })

  it('nulls blank base URL and model and drops a blank label', () => {
    const state: AgentAuthProfileDialogState = {
      ...createAgentAuthProfileDialogState(makeProfile()),
      label: '   ',
      baseUrl: '  ',
      model: ''
    }
    expect(buildAgentAuthProfileUpsertInputFromDialogState(state)).toMatchObject({
      baseUrl: null,
      model: null
    })
    expect(buildAgentAuthProfileUpsertInputFromDialogState(state)).not.toHaveProperty('label')
  })
})

describe('isAgentAuthProfileDialogSubmittable', () => {
  it('accepts the pristine create state', () => {
    expect(isAgentAuthProfileDialogSubmittable(CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE)).toBe(true)
  })

  it('rejects while a save is in flight', () => {
    const state: AgentAuthProfileDialogState = {
      ...CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE,
      saveState: 'saving'
    }
    expect(isAgentAuthProfileDialogSubmittable(state)).toBe(false)
  })

  it('rejects a newly added header without a value', () => {
    const state: AgentAuthProfileDialogState = {
      ...CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE,
      headerDrafts: [{ name: 'anthropic-beta', value: '', keepStored: false }]
    }
    expect(isAgentAuthProfileDialogSubmittable(state)).toBe(false)
  })

  it('accepts a blank stored header draft', () => {
    const state: AgentAuthProfileDialogState = {
      ...CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE,
      headerDrafts: [{ name: 'anthropic-beta', value: '', keepStored: true }]
    }
    expect(isAgentAuthProfileDialogSubmittable(state)).toBe(true)
  })

  it('rejects an enabled proxy without a URL', () => {
    const state: AgentAuthProfileDialogState = {
      ...CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE,
      proxy: { enabled: true, url: '  ', authDraft: '', removeStoredAuth: false }
    }
    expect(isAgentAuthProfileDialogSubmittable(state)).toBe(false)
  })
})
