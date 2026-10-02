import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomically } from '../codex-accounts/fs-utils'
import { assertOwnedHostCodexManagedHomePath } from '../codex-accounts/host-codex-managed-home-ownership'
import {
  prepareSystemConfigForFreshRuntimeMirror,
  resolveCodexConfigMirrorSourceDirectory
} from '../codex/codex-config-mirror'
import {
  upsertCodexProfileProviderSettings,
  type CodexProfileProviderSettings
} from '../codex/codex-profile-provider-settings-upsert'
import type { AgentAuthProfile } from '../../shared/agent-auth-profile-types'

const MANAGED_HOME_MARKER_FILENAME = '.aio-ade-managed-home'
const CODEX_CONFIG_FILENAME = 'config.toml'
const CODEX_AUTH_FILENAME = 'auth.json'
const CODEX_PROFILE_PROVIDER_ENV_KEY = 'OPENAI_API_KEY'

export function codexProfileHomesRoot(userDataPath: string): string {
  return join(userDataPath, 'agent-auth-profiles', 'codex-homes')
}

export function codexProfileManagedHomePath(userDataPath: string, profileId: string): string {
  return join(codexProfileHomesRoot(userDataPath), profileId, 'home')
}

export function codexProfileProviderId(profileId: string): string {
  return `aio-ade-${profileId}`
}

export type EnsureCodexProfileManagedHomeInput = {
  profile: AgentAuthProfile
  apiKey: string | null
  userDataPath: string
  systemCodexHomePath: string
}

export type EnsureCodexProfileManagedHomeResult =
  | { ok: true; homePath: string }
  | { ok: false; error: string }

/**
 * Materializes a Codex API profile's managed CODEX_HOME under the dedicated
 * profile-homes root: ownership marker, config.toml seeded once from the
 * system home, provider table + pins for base-URL profiles, and a 0600
 * api-key auth.json. Never writes outside the profile-homes root.
 */
export function ensureCodexProfileManagedHome({
  profile,
  apiKey,
  userDataPath,
  systemCodexHomePath
}: EnsureCodexProfileManagedHomeInput): EnsureCodexProfileManagedHomeResult {
  if (profile.provider !== 'codex') {
    return { ok: false, error: `Profile "${profile.id}" is not a Codex profile.` }
  }
  const root = codexProfileHomesRoot(userDataPath)
  const homePath = join(root, profile.id, 'home')
  try {
    mkdirSync(homePath, { recursive: true })
    const markerPath = join(homePath, MANAGED_HOME_MARKER_FILENAME)
    if (!existsSync(markerPath)) {
      // Why: marker lets future cleanup prove the path is AIO-ADE-owned before deleting anything.
      writeFileSync(markerPath, `${profile.id}\n`, 'utf-8')
    }
    const ownedHomePath = assertOwnedHostCodexManagedHomePath({
      candidatePath: homePath,
      managedAccountsRoot: root,
      systemCodexHomePath,
      expectedAccountId: profile.id
    })

    const configPath = join(ownedHomePath, CODEX_CONFIG_FILENAME)
    if (!existsSync(configPath)) {
      const systemConfigPath = join(systemCodexHomePath, CODEX_CONFIG_FILENAME)
      const seeded = existsSync(systemConfigPath)
        ? prepareSystemConfigForFreshRuntimeMirror(
            readFileSync(systemConfigPath, 'utf-8'),
            resolveCodexConfigMirrorSourceDirectory(systemCodexHomePath)
          )
        : ''
      // Why: an empty seed means nothing to configure — codex treats a missing
      // config.toml the same as an empty one, so skip the empty file.
      if (seeded !== '') {
        writeFileAtomically(configPath, seeded)
      }
    }
    if (profile.baseUrl !== null) {
      const settings: CodexProfileProviderSettings = {
        providerId: codexProfileProviderId(profile.id),
        baseUrl: profile.baseUrl,
        envKey: CODEX_PROFILE_PROVIDER_ENV_KEY,
        model: profile.model
      }
      const current = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : ''
      writeFileIfChanged(configPath, upsertCodexProfileProviderSettings(current, settings))
    }

    if (apiKey !== null) {
      const authContents = `${JSON.stringify({ OPENAI_API_KEY: apiKey }, null, 2)}\n`
      writeFileIfChanged(join(ownedHomePath, CODEX_AUTH_FILENAME), authContents, { mode: 0o600 })
    }

    return { ok: true, homePath: ownedHomePath }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function writeFileIfChanged(
  targetPath: string,
  contents: string,
  options?: { mode?: number }
): void {
  try {
    if (existsSync(targetPath) && readFileSync(targetPath, 'utf-8') === contents) {
      return
    }
  } catch {
    // Why: a read error must not make a stale file look current; the atomic write owns error surfacing.
  }
  writeFileAtomically(targetPath, contents, options)
}
