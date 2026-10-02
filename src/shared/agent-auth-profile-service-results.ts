import type { AgentAuthProfile, AgentAuthProfileStore } from './agent-auth-profile-types'
import type { AgentAuthProfileLaunchProvenance } from './agent-auth-profile-bindings'

// IPC-facing results of the agent auth profile service: the list snapshot,
// the envelope every mutation returns (service errors ride the envelope so
// the renderer branches on `ok` without exception plumbing), and the
// connection test outcome. Raw secrets never appear here — entries carry
// vault refs and booleans only.

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

export type AgentAuthProfileHealthTestKind =
  | 'missing-secret'
  | 'decrypt-failed'
  | 'timeout'
  | 'network'
  | 'rejected'
  | 'server-error'
  | 'profile-missing'
  | 'invalid-input'

export type AgentAuthProfileHealthTestResult =
  | { ok: true; status: number }
  | { ok: false; kind: AgentAuthProfileHealthTestKind; error: string }
