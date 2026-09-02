import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import type {
  AioAdeProfileCloudSummary,
  AioAdeProfileListState,
  AioAdeProfileSummary
} from '../../shared/aio-ade-profiles'
import {
  getAioAdeProfileDirectory,
  getAioAdeProfileIndexPath,
  loadOrCreateProfileIndex,
  writeProfileIndex
} from './profile-index-store'

export type CreateCloudLinkedAioAdeProfileRecordResult = AioAdeProfileListState & {
  profile: AioAdeProfileSummary
}

function sanitizeProfileName(value: unknown, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return (trimmed || fallback).slice(0, 80)
}

function profileInitial(name: string): string {
  return (name.match(/[A-Za-z0-9]/)?.[0] ?? 'C').toUpperCase()
}

function toCloudLinkedProfile(
  profile: AioAdeProfileSummary,
  cloud: AioAdeProfileCloudSummary,
  now: number
): AioAdeProfileSummary {
  return {
    ...profile,
    kind: 'cloud-linked',
    cloud,
    updatedAt: now,
    lastOpenedAt: now
  }
}

function toLocalProfile(profile: AioAdeProfileSummary, now: number): AioAdeProfileSummary {
  const { cloud: _cloud, ...localProfile } = profile
  return {
    ...localProfile,
    kind: 'local',
    updatedAt: now,
    lastOpenedAt: now
  }
}

export function createCloudLinkedAioAdeProfileRecord(
  cloud: AioAdeProfileCloudSummary,
  args: { name?: string },
  userDataPath: string
): CreateCloudLinkedAioAdeProfileRecordResult {
  const index = loadOrCreateProfileIndex(userDataPath)
  const now = Date.now()
  const fallbackName = cloud.activeOrgName ?? cloud.displayName ?? cloud.email
  const name = sanitizeProfileName(args.name, fallbackName)
  const profile: AioAdeProfileSummary = {
    id: `cloud-${randomUUID()}`,
    name,
    avatar: {
      kind: 'initials',
      initials: profileInitial(name),
      color: 'neutral'
    },
    kind: 'cloud-linked',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    cloud
  }
  const nextIndex = {
    ...index,
    profiles: [...index.profiles, profile]
  }
  mkdirSync(getAioAdeProfileDirectory(profile.id, userDataPath), { recursive: true })
  writeProfileIndex(getAioAdeProfileIndexPath(userDataPath), nextIndex)
  return {
    activeProfileId: nextIndex.activeProfileId,
    profiles: nextIndex.profiles,
    profile
  }
}

export function linkAioAdeProfileToCloud(
  profileId: string,
  cloud: AioAdeProfileCloudSummary,
  userDataPath: string
): AioAdeProfileListState {
  const index = loadOrCreateProfileIndex(userDataPath)
  const now = Date.now()
  let found = false
  const profiles = index.profiles.map((profile) => {
    if (profile.id !== profileId) {
      return profile
    }
    found = true
    return toCloudLinkedProfile(profile, cloud, now)
  })
  if (!found) {
    throw new Error('unknown_aio_ade_profile')
  }
  const nextIndex = {
    ...index,
    profiles
  }
  writeProfileIndex(getAioAdeProfileIndexPath(userDataPath), nextIndex)
  return {
    activeProfileId: nextIndex.activeProfileId,
    profiles: nextIndex.profiles
  }
}

export function unlinkAioAdeProfileFromCloud(
  profileId: string,
  userDataPath: string
): AioAdeProfileListState {
  const index = loadOrCreateProfileIndex(userDataPath)
  const now = Date.now()
  let found = false
  const profiles = index.profiles.map((profile) => {
    if (profile.id !== profileId) {
      return profile
    }
    found = true
    return toLocalProfile(profile, now)
  })
  if (!found) {
    throw new Error('unknown_aio_ade_profile')
  }
  const nextIndex = {
    ...index,
    profiles
  }
  writeProfileIndex(getAioAdeProfileIndexPath(userDataPath), nextIndex)
  return {
    activeProfileId: nextIndex.activeProfileId,
    profiles: nextIndex.profiles
  }
}
