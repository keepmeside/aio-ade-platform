import type { AgentAuthProfileListEntry } from '../../../../shared/agent-auth-profile-service-results'
import type {
  AgentAuthProfileHeaderInput,
  AgentAuthProfileUpsertInput
} from '../../../../shared/agent-auth-profile-upsert-input'
import type { AgentAuthProfileProvider } from '../../../../shared/agent-auth-profile-types'

// Dialog state machine for creating or editing an agent auth profile. Stored
// secrets are never re-displayed, so seeded secret fields are tri-state: a
// blank draft keeps the stored value, an explicit remove flag carries the
// null arm, and a typed draft rotates it.

export type AgentAuthProfileDialogHeaderDraft = {
  // Draft names are the allowed header names; the input schema enforces the enum.
  name: AgentAuthProfileHeaderInput['name']
  value: string
  keepStored: boolean
}

export type AgentAuthProfileDialogProxyDraft = {
  enabled: boolean
  url: string
  authDraft: string
  removeStoredAuth: boolean
}

export type AgentAuthProfileDialogSaveState = 'idle' | 'saving' | 'error'

export type AgentAuthProfileDialogState = {
  // Session identity: an edit session carries the profile id, a create session
  // carries the provider the pane opened it for (the user may still switch the
  // provider select inside without reseeding), closed carries neither.
  originProfileId: string | null
  createProvider: AgentAuthProfileProvider | null
  provider: AgentAuthProfileProvider
  label: string
  apiKeyDraft: string
  removeStoredApiKey: boolean
  apiKeyKindDraft: 'api-key' | 'auth-token'
  baseUrl: string
  model: string
  headerDrafts: AgentAuthProfileDialogHeaderDraft[]
  proxy: AgentAuthProfileDialogProxyDraft
  // Vault probes captured at seed time; drive keep/remove affordances without
  // the components re-deriving them from a possibly-stale profile prop.
  hasStoredApiKey: boolean
  hasStoredProxyAuth: boolean
  saveState: AgentAuthProfileDialogSaveState
  saveError: string | null
}

export const CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE: AgentAuthProfileDialogState = Object.freeze({
  originProfileId: null,
  createProvider: null,
  provider: 'claude',
  label: '',
  apiKeyDraft: '',
  removeStoredApiKey: false,
  apiKeyKindDraft: 'api-key',
  baseUrl: '',
  model: '',
  headerDrafts: [],
  proxy: { enabled: false, url: '', authDraft: '', removeStoredAuth: false },
  hasStoredApiKey: false,
  hasStoredProxyAuth: false,
  saveState: 'idle',
  saveError: null
})

// Pristine create states per provider; frozen so a re-open reuses the same
// identity and the render-phase reconcile stays stable.
const CREATE_AGENT_AUTH_PROFILE_DIALOG_STATE_BY_PROVIDER: Readonly<
  Record<AgentAuthProfileProvider, AgentAuthProfileDialogState>
> = Object.freeze({
  claude: Object.freeze({ ...CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE, createProvider: 'claude' }),
  codex: Object.freeze({
    ...CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE,
    createProvider: 'codex',
    provider: 'codex'
  })
})

export function createAgentAuthProfileDialogState(
  profile: AgentAuthProfileListEntry | null,
  createProvider: AgentAuthProfileProvider = 'claude'
): AgentAuthProfileDialogState {
  if (profile === null) {
    return CREATE_AGENT_AUTH_PROFILE_DIALOG_STATE_BY_PROVIDER[createProvider]
  }
  return {
    originProfileId: profile.id,
    createProvider: null,
    provider: profile.provider,
    label: profile.label ?? '',
    apiKeyDraft: '',
    removeStoredApiKey: false,
    apiKeyKindDraft: profile.apiKeyKind ?? 'api-key',
    baseUrl: profile.baseUrl ?? '',
    model: profile.model ?? '',
    headerDrafts: profile.headers.map((header) => ({
      name: header.name,
      value: '',
      keepStored: true
    })),
    proxy: {
      enabled: profile.proxy !== null,
      url: profile.proxy?.url ?? '',
      authDraft: '',
      removeStoredAuth: false
    },
    hasStoredApiKey: profile.hasApiKey,
    hasStoredProxyAuth: profile.proxy?.authSecretRef != null,
    saveState: 'idle',
    saveError: null
  }
}

// Identity-preserving reconcile against parent-controlled open state: an open
// dialog keeps its state unless the target session changed underneath it, and
// closing always folds back to the pristine closed state so drafts and errors
// never leak into the next session.
export function resolveAgentAuthProfileDialogState(
  state: AgentAuthProfileDialogState,
  open: boolean,
  profile: AgentAuthProfileListEntry | null,
  createProvider: AgentAuthProfileProvider = 'claude'
): AgentAuthProfileDialogState {
  if (!open) {
    return state === CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE
      ? state
      : CLOSED_AGENT_AUTH_PROFILE_DIALOG_STATE
  }
  if (profile === null) {
    return state.originProfileId === null && state.createProvider === createProvider
      ? state
      : CREATE_AGENT_AUTH_PROFILE_DIALOG_STATE_BY_PROVIDER[createProvider]
  }
  if (state.originProfileId === profile.id && state.createProvider === null) {
    return state
  }
  return createAgentAuthProfileDialogState(profile)
}

function resolveApiKeyDraft(
  state: AgentAuthProfileDialogState,
  isEdit: boolean
): string | null | undefined {
  const trimmed = state.apiKeyDraft.trim()
  if (trimmed !== '') {
    return trimmed
  }
  if (isEdit && state.removeStoredApiKey) {
    return null
  }
  return undefined
}

// Codex only ever consumes OPENAI_API_KEY, so its kind is fixed; the
// api-key/auth-token split is a Claude-only distinction.
function resolveApiKeyKind(
  state: AgentAuthProfileDialogState,
  apiKey: string | null
): 'api-key' | 'auth-token' | null {
  if (apiKey === null) {
    return null
  }
  return state.provider === 'claude' ? state.apiKeyKindDraft : 'api-key'
}

function buildProxyInput(
  proxy: AgentAuthProfileDialogProxyDraft,
  isEdit: boolean
): AgentAuthProfileUpsertInput['proxy'] {
  if (!proxy.enabled) {
    return null
  }
  const auth = proxy.authDraft.trim()
  return {
    url: proxy.url.trim(),
    ...(auth !== ''
      ? { authValue: auth }
      : isEdit && proxy.removeStoredAuth
        ? { authValue: null }
        : {})
  }
}

export function buildAgentAuthProfileUpsertInputFromDialogState(
  state: AgentAuthProfileDialogState
): AgentAuthProfileUpsertInput {
  const isEdit = state.originProfileId !== null
  const apiKey = resolveApiKeyDraft(state, isEdit)
  const headers: AgentAuthProfileHeaderInput[] = []
  for (const draft of state.headerDrafts) {
    const value = draft.value.trim()
    if (value !== '') {
      headers.push({ name: draft.name, value })
    } else if (draft.keepStored) {
      // Blank + stored: keep the stored secret; absence from the list would drop it.
      headers.push({ name: draft.name })
    }
  }
  const label = state.label.trim()
  const baseUrl = state.baseUrl.trim()
  const model = state.model.trim()
  return {
    provider: state.provider,
    ...(label !== '' ? { label } : {}),
    ...(apiKey !== undefined ? { apiKey, apiKeyKind: resolveApiKeyKind(state, apiKey) } : {}),
    baseUrl: baseUrl !== '' ? baseUrl : null,
    model: model !== '' ? model : null,
    headers,
    proxy: buildProxyInput(state.proxy, isEdit)
  }
}

export function isAgentAuthProfileDialogSubmittable(state: AgentAuthProfileDialogState): boolean {
  if (state.saveState === 'saving') {
    return false
  }
  for (const draft of state.headerDrafts) {
    if (draft.value.trim() === '' && !draft.keepStored) {
      return false
    }
  }
  return !(state.proxy.enabled && state.proxy.url.trim() === '')
}
