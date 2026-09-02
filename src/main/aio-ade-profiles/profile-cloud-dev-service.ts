import type {
  CreateCloudLinkedAioAdeProfileArgs,
  AioAdeProfileListState
} from '../../shared/aio-ade-profiles'
import type { ActiveAioAdeProfileState } from './profile-index-store'
import {
  createCloudLinkedAioAdeProfileRecord,
  linkAioAdeProfileToCloud
} from './profile-cloud-index'
import {
  readAioAdeCloudSession,
  saveAioAdeCloudSessionExchange
} from './profile-cloud-session-store'
import { createDevAioAdeCloudSession } from './profile-cloud-dev-auth'

type DevProfileListResult = AioAdeProfileListState

type DevCreateProfileResult =
  | {
      status: 'created'
      list: ReturnType<typeof createCloudLinkedAioAdeProfileRecord>
    }
  | { status: 'reconnect-required' }

type DevMutationResult =
  | {
      status: 'updated'
      list: DevProfileListResult
    }
  | { status: 'reconnect-required' }

export function connectDevAioAdeCloudProfile(
  active: ActiveAioAdeProfileState,
  userDataPath: string
): DevProfileListResult {
  const session = createDevAioAdeCloudSession({ localProfileId: active.profile.id })
  saveAioAdeCloudSessionExchange(active.profile.id, userDataPath, session)
  return linkAioAdeProfileToCloud(active.profile.id, session.cloud, userDataPath)
}

export function createDevCloudLinkedAioAdeProfile(
  active: ActiveAioAdeProfileState,
  userDataPath: string,
  args: CreateCloudLinkedAioAdeProfileArgs
): DevCreateProfileResult {
  if (readAioAdeCloudSession(active.profile.id, userDataPath).status !== 'found') {
    return { status: 'reconnect-required' }
  }
  const session = createDevAioAdeCloudSession({ orgId: args.orgId })
  const list = createCloudLinkedAioAdeProfileRecord(
    session.cloud,
    { name: args.name },
    userDataPath
  )
  saveAioAdeCloudSessionExchange(list.profile.id, userDataPath, session)
  return { status: 'created', list }
}

export function refreshDevAioAdeCloudProfile(
  active: ActiveAioAdeProfileState,
  userDataPath: string
): DevMutationResult {
  if (
    !active.profile.cloud ||
    readAioAdeCloudSession(active.profile.id, userDataPath).status !== 'found'
  ) {
    return { status: 'reconnect-required' }
  }
  const session = createDevAioAdeCloudSession({
    localProfileId: active.profile.id,
    cloudProfileId: active.profile.cloud.cloudProfileId,
    orgId: active.profile.cloud.activeOrgId
  })
  saveAioAdeCloudSessionExchange(active.profile.id, userDataPath, session)
  return {
    status: 'updated',
    list: linkAioAdeProfileToCloud(active.profile.id, session.cloud, userDataPath)
  }
}

export function selectDevAioAdeCloudOrg(
  active: ActiveAioAdeProfileState,
  userDataPath: string,
  orgId: string
): DevMutationResult {
  if (
    !active.profile.cloud ||
    readAioAdeCloudSession(active.profile.id, userDataPath).status !== 'found'
  ) {
    return { status: 'reconnect-required' }
  }
  const session = createDevAioAdeCloudSession({
    localProfileId: active.profile.id,
    cloudProfileId: active.profile.cloud.cloudProfileId,
    orgId
  })
  saveAioAdeCloudSessionExchange(active.profile.id, userDataPath, session)
  return {
    status: 'updated',
    list: linkAioAdeProfileToCloud(active.profile.id, session.cloud, userDataPath)
  }
}
