import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { app } from 'electron'
import { writeFileAtomically } from '../codex-accounts/fs-utils'
import { MANAGED_AUTH_MARKER, readManagedAuthMarkerAccountId } from './managed-auth-marker'

export function getClaudeManagedAccountsRoot(): string {
  return join(app.getPath('userData'), 'claude-accounts')
}

export function resolveOwnedClaudeManagedAuthPath(
  accountId: string,
  candidatePath: string,
  options: { adoptLegacyMarker?: boolean } = {}
): string | null {
  const rootPath = getClaudeManagedAccountsRoot()
  const resolvedCandidate = resolve(candidatePath)
  if (!existsSync(resolvedCandidate) || !existsSync(rootPath)) {
    return null
  }
  try {
    if (lstatSync(resolvedCandidate).isSymbolicLink()) {
      return null
    }
    const canonicalCandidate = realpathSync(resolvedCandidate)
    const canonicalRoot = realpathSync(rootPath)
    if (
      canonicalCandidate === canonicalRoot ||
      !canonicalCandidate.startsWith(canonicalRoot + sep)
    ) {
      return null
    }
    const relativePath = relative(canonicalRoot, canonicalCandidate)
    const relativeParts = relativePath.split(sep)
    const escaped = relativePath.startsWith('..') || relativePath.includes(`..${sep}`)
    if (
      escaped ||
      relativeParts.length !== 2 ||
      relativeParts[0] !== accountId ||
      relativeParts[1] !== 'auth'
    ) {
      return null
    }
    const markerValid = readManagedAuthMarkerAccountId(canonicalCandidate) === accountId
    if (!markerValid && options.adoptLegacyMarker) {
      writeFileSync(join(canonicalCandidate, MANAGED_AUTH_MARKER), `${accountId}\n`, {
        encoding: 'utf-8',
        mode: 0o600,
        flag: 'wx'
      })
    }
    if (!markerValid && readManagedAuthMarkerAccountId(canonicalCandidate) !== accountId) {
      return null
    }
    return canonicalCandidate
  } catch {
    return null
  }
}

export function readClaudeManagedAuthFile(
  managedAuthPath: string,
  filename: '.credentials.json' | 'oauth-account.json'
): string | null {
  const filePath = resolve(managedAuthPath, filename)
  try {
    if (!isOwnedChildFile(managedAuthPath, filePath)) {
      return null
    }
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

export function writeClaudeManagedAuthFile(
  managedAuthPath: string,
  filename: '.credentials.json' | 'oauth-account.json',
  contents: string
): void {
  const filePath = resolve(managedAuthPath, filename)
  if (existsSync(filePath) && !isOwnedChildFile(managedAuthPath, filePath)) {
    throw new Error('Managed Claude auth child file is not owned by AIO-ADE.')
  }
  writeFileAtomically(filePath, contents, { mode: 0o600 })
}

function isOwnedChildFile(managedAuthPath: string, filePath: string): boolean {
  if (
    !existsSync(filePath) ||
    lstatSync(filePath).isSymbolicLink() ||
    !lstatSync(filePath).isFile()
  ) {
    return false
  }
  const canonicalAuthPath = realpathSync(managedAuthPath)
  const canonicalFilePath = realpathSync(filePath)
  return canonicalFilePath.startsWith(canonicalAuthPath + sep)
}
