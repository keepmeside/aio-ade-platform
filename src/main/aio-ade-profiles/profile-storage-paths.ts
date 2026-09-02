import { app } from 'electron'
import { join } from 'node:path'
import { LEGACY_USER_DATA_FILE_NAME, USER_DATA_FILE_NAME } from '../../shared/user-data-dir-names'

/* Two unrelated senses of "legacy" meet in this file. `PRE_PROFILE_*` is the layout that existed
 * before profiles, at the userData root. `LEGACY_USER_DATA_FILE_NAME` is the pre-rebrand spelling
 * of the same file. Keeping the names distinct is what stops one from being read as the other. */
const PRE_PROFILE_DATA_FILE_NAME = USER_DATA_FILE_NAME
const PRE_PROFILE_BROWSER_SESSION_META_FILE_NAME = 'browser-session-meta.json'
const PROFILE_INDEX_FILE_NAME = 'aio-ade-profile-index.json'
const PROFILE_DATA_FILE_NAME = USER_DATA_FILE_NAME
const PROFILE_BROWSER_SESSION_META_FILE_NAME = 'browser-session-meta.json'
const PROFILE_DIRECTORY_NAME = 'profiles'

export const LEGACY_BACKUP_COUNT = 5

let profileUserDataPath: string | null = null

export function initAioAdeProfilePaths(): void {
  profileUserDataPath = app.getPath('userData')
}

export function getProfileUserDataPath(): string {
  if (!profileUserDataPath) {
    profileUserDataPath = app.getPath('userData')
  }
  return profileUserDataPath
}

export function getAioAdeProfileIndexPath(userDataPath = getProfileUserDataPath()): string {
  return join(userDataPath, PROFILE_INDEX_FILE_NAME)
}

export function getAioAdeProfilesDirectory(userDataPath = getProfileUserDataPath()): string {
  return join(userDataPath, PROFILE_DIRECTORY_NAME)
}

export function getAioAdeProfileDirectory(
  profileId: string,
  userDataPath = getProfileUserDataPath()
): string {
  return join(getAioAdeProfilesDirectory(userDataPath), profileId)
}

export function getAioAdeProfileDataFile(
  profileId: string,
  userDataPath = getProfileUserDataPath()
): string {
  return join(getAioAdeProfileDirectory(profileId, userDataPath), PROFILE_DATA_FILE_NAME)
}

/* Canonical first, then the pre-rebrand spelling. A profile directory adopted from the previous
 * install still holds the old filename, and nothing would fail if it were missed — the profile
 * would just open with default settings. */
export function getAioAdeProfileDataFileCandidates(
  profileId: string,
  userDataPath = getProfileUserDataPath()
): string[] {
  const directory = getAioAdeProfileDirectory(profileId, userDataPath)
  return [join(directory, PROFILE_DATA_FILE_NAME), join(directory, LEGACY_USER_DATA_FILE_NAME)]
}

export function getAioAdeProfileBrowserSessionMetaFile(
  profileId: string,
  userDataPath = getProfileUserDataPath()
): string {
  return join(
    getAioAdeProfileDirectory(profileId, userDataPath),
    PROFILE_BROWSER_SESSION_META_FILE_NAME
  )
}

export function legacyDataFilePath(userDataPath: string): string {
  return join(userDataPath, PRE_PROFILE_DATA_FILE_NAME)
}

export function legacyBrowserSessionMetaPath(userDataPath: string): string {
  return join(userDataPath, PRE_PROFILE_BROWSER_SESSION_META_FILE_NAME)
}

export function legacyBackupPath(userDataPath: string, index: number): string {
  return `${legacyDataFilePath(userDataPath)}.bak.${index}`
}

export function profileBackupPath(profileDataFile: string, index: number): string {
  return `${profileDataFile}.bak.${index}`
}
