import { parseAioAdeYaml } from '../shared/aio-ade-yaml'
import { LEGACY_PROJECT_CONFIG_FILE_NAME, PROJECT_CONFIG_FILE_NAME } from '../shared/repo-app-paths'
import type { AioAdeHooks } from '../shared/types'
import { joinWorktreeRelativePath } from './runtime/runtime-relative-paths'

/* Remote (SSH) reads of the committed project config. A repo cloned before the rebrand still
 * carries the previous file name, and it is committed — so a team can have both names in flight
 * at once while people upgrade. Read the current name first, then fall back. */

type RemoteFileReader = {
  readFile(path: string): Promise<{ isBinary: boolean; content: string }>
}

export type RemoteProjectConfig = {
  path: string
  fileName: string
  hooks: AioAdeHooks | null
}

export async function readRemoteProjectConfig(
  fsProvider: RemoteFileReader,
  repoPath: string
): Promise<RemoteProjectConfig> {
  let firstError: unknown = new Error(`No ${PROJECT_CONFIG_FILE_NAME} in ${repoPath}`)
  let sawFailure = false
  for (const fileName of [PROJECT_CONFIG_FILE_NAME, LEGACY_PROJECT_CONFIG_FILE_NAME]) {
    const path = joinWorktreeRelativePath(repoPath, fileName)
    try {
      const result = await fsProvider.readFile(path)
      return { path, fileName, hooks: result.isBinary ? null : parseAioAdeYaml(result.content) }
    } catch (error) {
      if (!sawFailure) {
        firstError = error
        sawFailure = true
      }
    }
  }
  // Why: surface the first failure so callers can tell "absent" from "unreachable host".
  throw firstError
}
