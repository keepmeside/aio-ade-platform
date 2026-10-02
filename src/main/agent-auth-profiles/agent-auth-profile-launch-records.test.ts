import { beforeEach, describe, expect, it } from 'vitest'
import type { AgentAuthProfileLaunchProvenance } from '../../shared/agent-auth-profile-bindings'
import {
  clearAgentAuthProfileLaunchRegistryForTests,
  forgetAgentAuthProfileLaunch,
  lookupAgentAuthProfileLaunch,
  recordAgentAuthProfileLaunch,
  sessionIdsForAgentAuthProfileLaunch
} from './agent-auth-profile-launch-records'

function makeProvenance(
  sessionId: string,
  profileId: string,
  overrides: Partial<AgentAuthProfileLaunchProvenance> = {}
): AgentAuthProfileLaunchProvenance {
  return {
    sessionId,
    provider: 'claude',
    level: 'session',
    profileId,
    accountId: null,
    resolvedAt: 1_000,
    ...overrides
  }
}

describe('agent auth profile launch records', () => {
  beforeEach(() => {
    clearAgentAuthProfileLaunchRegistryForTests()
  })

  it('records and looks up a launch by session id', () => {
    recordAgentAuthProfileLaunch(makeProvenance('sess-1', 'profile-work'))

    expect(lookupAgentAuthProfileLaunch('sess-1')?.profileId).toBe('profile-work')
    expect(lookupAgentAuthProfileLaunch('sess-other')).toBeNull()
  })

  it('keeps the first record for a session id', () => {
    recordAgentAuthProfileLaunch(makeProvenance('sess-1', 'profile-first'))
    recordAgentAuthProfileLaunch(makeProvenance('sess-1', 'profile-second'))

    expect(lookupAgentAuthProfileLaunch('sess-1')?.profileId).toBe('profile-first')
  })

  it('forgets a launch on PTY teardown', () => {
    recordAgentAuthProfileLaunch(makeProvenance('sess-1', 'profile-work'))

    forgetAgentAuthProfileLaunch('sess-1')

    expect(lookupAgentAuthProfileLaunch('sess-1')).toBeNull()
  })

  it('lists the live session ids using one profile', () => {
    recordAgentAuthProfileLaunch(makeProvenance('sess-1', 'profile-work'))
    recordAgentAuthProfileLaunch(makeProvenance('sess-2', 'profile-work'))
    recordAgentAuthProfileLaunch(makeProvenance('sess-3', 'profile-other'))

    expect(sessionIdsForAgentAuthProfileLaunch('profile-work')).toEqual(['sess-1', 'sess-2'])
  })
})
