import { lstat, mkdir, readFile, readlink, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import {
  type MacPrivilegedRunner,
  removeManagedMacSymlink,
  runMacPrivilegedCommand
} from './legacy-product-cli-cleanup-macos'
import {
  cleanupLegacyWindowsCliPath,
  cleanupLegacyWslCliRegistrations
} from './legacy-product-cli-cleanup-windows'

const LEGACY_PRODUCT_CLI_CLEANUP_VERSION = 1
const LEGACY_LINUX_BARE_DISPATCHER_MARKER = '# orca-serve-bare-orca-dispatcher'
export const LEGACY_PRODUCT_CLI_CLEANUP_MARKER = 'legacy-product-cli-cleanup-v1.json'

type CleanupFunction = (path: string) => Promise<string[]>
type UnlinkFunction = (path: string) => Promise<void>

type LegacyProductCliCleanupOptions = {
  platform?: NodeJS.Platform
  isPackaged: boolean
  userDataPath: string
  homePath?: string
  resourcesPath: string
  cleanupWindowsPath?: CleanupFunction
  cleanupWslRegistrations?: CleanupFunction
  macCommandPath?: string
  unlinkPath?: UnlinkFunction
  macPrivilegedRunner?: MacPrivilegedRunner
}

export type LegacyProductCliCleanupResult = {
  status: 'completed' | 'already-completed' | 'not-applicable'
  removed: string[]
}

export async function runLegacyProductCliCleanup(
  options: LegacyProductCliCleanupOptions
): Promise<LegacyProductCliCleanupResult> {
  if (
    !options.isPackaged ||
    !['darwin', 'linux', 'win32'].includes(options.platform ?? process.platform)
  ) {
    return { status: 'not-applicable', removed: [] }
  }

  const markerPath = join(options.userDataPath, LEGACY_PRODUCT_CLI_CLEANUP_MARKER)
  if (await hasCompletedMarker(markerPath)) {
    return { status: 'already-completed', removed: [] }
  }

  const platform = options.platform ?? process.platform
  const removed =
    platform === 'win32'
      ? await cleanupWindows(options)
      : await cleanupUnixLaunchers(platform, options.homePath ?? homedir(), options.resourcesPath, {
          macCommandPath: options.macCommandPath,
          unlinkPath: options.unlinkPath ?? unlink,
          macPrivilegedRunner: options.macPrivilegedRunner ?? runMacPrivilegedCommand
        })

  await mkdir(options.userDataPath, { recursive: true })
  await writeFile(
    markerPath,
    `${JSON.stringify({ cleanupVersion: LEGACY_PRODUCT_CLI_CLEANUP_VERSION, platform, removed })}\n`,
    'utf8'
  )
  return { status: 'completed', removed }
}

async function cleanupWindows(options: LegacyProductCliCleanupOptions): Promise<string[]> {
  const cleanupPath = options.cleanupWindowsPath ?? cleanupLegacyWindowsCliPath
  const cleanupWsl = options.cleanupWslRegistrations ?? cleanupLegacyWslCliRegistrations
  return [
    ...(await cleanupPath(options.resourcesPath)),
    ...(await cleanupWsl(options.userDataPath))
  ]
}

async function cleanupUnixLaunchers(
  platform: NodeJS.Platform,
  homePath: string,
  resourcesPath: string,
  dependencies: {
    macCommandPath?: string
    unlinkPath: UnlinkFunction
    macPrivilegedRunner: MacPrivilegedRunner
  }
): Promise<string[]> {
  const candidates =
    platform === 'darwin'
      ? [
          dependencies.macCommandPath ?? '/usr/local/bin/orca',
          join(homePath, '.local', 'bin', 'orca')
        ]
      : [join(homePath, '.local', 'bin', 'orca'), join(homePath, '.local', 'bin', 'orca-ide')]
  const removed: string[] = []
  for (const commandPath of candidates) {
    if (await removeOwnedUnixLauncher(commandPath, resourcesPath, platform, dependencies)) {
      removed.push(commandPath)
    }
  }
  return removed
}

async function removeOwnedUnixLauncher(
  commandPath: string,
  resourcesPath: string,
  platform: NodeJS.Platform,
  dependencies: {
    unlinkPath: UnlinkFunction
    macPrivilegedRunner: MacPrivilegedRunner
  }
): Promise<boolean> {
  let stats: Awaited<ReturnType<typeof lstat>>
  try {
    stats = await lstat(commandPath)
  } catch (error) {
    if (isMissingError(error)) {
      return false
    }
    throw error
  }

  if (stats.isSymbolicLink()) {
    const linkTarget = await readlink(commandPath)
    const target = resolve(dirname(commandPath), linkTarget)
    const managedTargets = new Set([
      resolve(resourcesPath, 'bin', 'orca'),
      resolve(resourcesPath, 'bin', 'orca-ide')
    ])
    if (!managedTargets.has(target)) {
      return false
    }
    if (platform === 'darwin') {
      return removeManagedMacSymlink({
        commandPath,
        linkTarget,
        unlinkPath: dependencies.unlinkPath,
        privilegedRunner: dependencies.macPrivilegedRunner
      })
    }
    await dependencies.unlinkPath(commandPath)
    return true
  } else if (stats.isFile()) {
    if (!isManagedUnixRegularFile(await readFile(commandPath, 'utf8'))) {
      return false
    }
  } else {
    return false
  }

  await dependencies.unlinkPath(commandPath)
  return true
}

function isManagedUnixRegularFile(content: string): boolean {
  return content.includes(LEGACY_LINUX_BARE_DISPATCHER_MARKER) || isManagedAppImageWrapper(content)
}

function isManagedAppImageWrapper(content: string): boolean {
  return [
    'Orca AppImage runtime did not set APPDIR.',
    'app.asar.unpacked","out","cli","index.js',
    'ORCA_NODE_OPTIONS',
    'ELECTRON_RUN_AS_NODE=1 exec "$APPIMAGE" -e'
  ].every((marker) => content.includes(marker))
}

async function hasCompletedMarker(markerPath: string): Promise<boolean> {
  try {
    const marker = JSON.parse(await readFile(markerPath, 'utf8')) as { cleanupVersion?: unknown }
    return marker.cleanupVersion === LEGACY_PRODUCT_CLI_CLEANUP_VERSION
  } catch (error) {
    if (isMissingError(error) || error instanceof SyntaxError) {
      return false
    }
    throw error
  }
}

function isMissingError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}
