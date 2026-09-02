import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { clearRuntimeCompatibilityCacheForTests } from '../../runtime/runtime-rpc-client'
import { createTestStore } from './store-test-helpers'

const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()

beforeEach(() => {
  clearRuntimeCompatibilityCacheForTests()
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall }
    }
  })
})

describe('repo slice runtime project groups', () => {
  it('keeps runtime copies of a grouped canonical project in the same project group', async () => {
    const gitRemoteIdentity = {
      canonicalKey: 'github.com/keepmeside/aio-ade-platform',
      remoteName: 'origin',
      remoteUrl: 'https://github.com/keepmeside/aio-ade-platform.git'
    }
    const localAioAde: Repo = {
      id: 'local-aio-ade',
      path: '/Users/alice/stably/aio-ade',
      displayName: 'aio-ade',
      badgeColor: '#000',
      addedAt: 1,
      executionHostId: 'local',
      gitRemoteIdentity,
      projectGroupId: 'group-aio-ade'
    }
    const runtimeAioAde: Repo = {
      id: 'runtime-aio-ade',
      path: '/vercel/sandbox/aio-ade',
      displayName: 'aio-ade',
      badgeColor: '#111',
      addedAt: 2,
      gitRemoteIdentity
    }
    runtimeEnvironmentCall.mockResolvedValue({
      id: 'rpc-runtime-aio-ade',
      ok: true,
      result: { repos: [runtimeAioAde] },
      _meta: { runtimeId: 'runtime-remote' }
    })
    const store = createTestStore()
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
      repos: [localAioAde]
    })

    await store.getState().fetchRepos()

    expect(store.getState().repos).toEqual([
      localAioAde,
      {
        ...runtimeAioAde,
        executionHostId: 'runtime:env-1',
        projectGroupId: 'group-aio-ade'
      }
    ])
  })
})
