import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildAgentAuthProfileSecretRef,
  type AgentAuthProfile
} from '../../shared/agent-auth-profile-types'
import {
  codexProfileHomesRoot,
  codexProfileManagedHomePath,
  codexProfileProviderId,
  ensureCodexProfileManagedHome,
  removeCodexProfileManagedHome
} from './codex-profile-home-materialization'

function makeProfile(id: string, overrides: Partial<AgentAuthProfile> = {}): AgentAuthProfile {
  return {
    id,
    label: id,
    provider: 'codex',
    apiKeySecretRef: buildAgentAuthProfileSecretRef(id, 'api-key'),
    apiKeyKind: 'api-key',
    baseUrl: 'https://gw.example.test/v1',
    model: null,
    headers: [],
    proxy: null,
    createdAt: 1_000,
    updatedAt: 2_000,
    ...overrides
  }
}

describe('codex profile managed home materialization', () => {
  let baseDir: string
  let userDataPath: string
  let systemCodexHomePath: string

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'codex-profile-home-'))
    userDataPath = join(baseDir, 'userData')
    systemCodexHomePath = join(baseDir, 'system-home', '.codex')
    mkdirSync(systemCodexHomePath, { recursive: true })
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  function writeSystemConfig(contents: string): void {
    writeFileSync(join(systemCodexHomePath, 'config.toml'), contents, 'utf-8')
  }

  function homePathFor(profileId: string): string {
    return codexProfileManagedHomePath(userDataPath, profileId)
  }

  function expectOk(result: ReturnType<typeof ensureCodexProfileManagedHome>): string {
    if (!result.ok) {
      throw new Error(`expected ok result, got: ${result.error}`)
    }
    return result.homePath
  }

  function expectRefused(
    result: ReturnType<typeof ensureCodexProfileManagedHome>,
    pattern: RegExp
  ): void {
    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected refused result')
    }
    expect(result.error).toMatch(pattern)
  }

  it('derives the managed home and provider id from the profile id', () => {
    expect(codexProfileHomesRoot(userDataPath)).toBe(
      join(userDataPath, 'agent-auth-profiles', 'codex-homes')
    )
    expect(homePathFor('profile-work')).toBe(
      join(codexProfileHomesRoot(userDataPath), 'profile-work', 'home')
    )
    expect(codexProfileProviderId('profile-work')).toBe('aio-ade-profile-work')
  })

  it('creates the home with an ownership marker and seeds config from the system home', () => {
    writeSystemConfig(
      '# seeded-user-preference\ndisable_response_storage = true\n\n[hooks.state]\nfoo = "bar"\n'
    )
    const homePath = expectOk(
      ensureCodexProfileManagedHome({
        profile: makeProfile('profile-work'),
        apiKey: 'profile-key-1',
        userDataPath,
        systemCodexHomePath
      })
    )
    expect(homePath).toBe(realpathSync(homePathFor('profile-work')))
    expect(readFileSync(join(homePath, '.aio-ade-managed-home'), 'utf-8').trim()).toBe(
      'profile-work'
    )
    const config = readFileSync(join(homePath, 'config.toml'), 'utf-8')
    expect(config).toContain('seeded-user-preference')
    expect(config).toContain('disable_response_storage = true')
    // Why: the seed must go through the fresh-runtime mirror, which drops
    // runtime-owned trust state — a raw copy would resurrect it.
    expect(config).not.toContain('[hooks.state]')
  })

  it('upserts the provider table and model_provider pin for a base-URL profile', () => {
    const homePath = expectOk(
      ensureCodexProfileManagedHome({
        profile: makeProfile('profile-work'),
        apiKey: 'profile-key-1',
        userDataPath,
        systemCodexHomePath
      })
    )
    const config = readFileSync(join(homePath, 'config.toml'), 'utf-8')
    expect(config).toContain('[model_providers."aio-ade-profile-work"]')
    expect(config).toContain('base_url = "https://gw.example.test/v1"')
    expect(config).toContain('env_key = "OPENAI_API_KEY"')
    expect(config).toContain('model_provider = "aio-ade-profile-work"')
    expect(config).not.toMatch(/^model = /m)
  })

  it('pins the profile model when one is set', () => {
    const homePath = expectOk(
      ensureCodexProfileManagedHome({
        profile: makeProfile('profile-work', { model: 'glm-4.7' }),
        apiKey: 'profile-key-1',
        userDataPath,
        systemCodexHomePath
      })
    )
    expect(readFileSync(join(homePath, 'config.toml'), 'utf-8')).toContain('model = "glm-4.7"')
  })

  it('skips provider TOML changes for a profile without a base URL', () => {
    writeSystemConfig('# seeded-user-preference\ndisable_response_storage = true\n')
    const homePath = expectOk(
      ensureCodexProfileManagedHome({
        profile: makeProfile('profile-plain', { baseUrl: null }),
        apiKey: 'profile-key-1',
        userDataPath,
        systemCodexHomePath
      })
    )
    const config = readFileSync(join(homePath, 'config.toml'), 'utf-8')
    expect(config).toContain('disable_response_storage')
    expect(config).not.toContain('model_provider')
  })

  it('writes auth.json 0600 with the flat api-key shape', () => {
    const homePath = expectOk(
      ensureCodexProfileManagedHome({
        profile: makeProfile('profile-work'),
        apiKey: 'profile-key-1',
        userDataPath,
        systemCodexHomePath
      })
    )
    const authPath = join(homePath, 'auth.json')
    expect(JSON.parse(readFileSync(authPath, 'utf-8'))).toEqual({ OPENAI_API_KEY: 'profile-key-1' })
    if (process.platform !== 'win32') {
      expect(statSync(authPath).mode & 0o777).toBe(0o600)
    }
  })

  it('skips auth.json when the profile has no api key', () => {
    const homePath = expectOk(
      ensureCodexProfileManagedHome({
        profile: makeProfile('profile-oauth', { apiKeySecretRef: null, apiKeyKind: null }),
        apiKey: null,
        userDataPath,
        systemCodexHomePath
      })
    )
    expect(existsSync(join(homePath, 'auth.json'))).toBe(false)
  })

  it('is idempotent across repeated materializations', () => {
    writeSystemConfig('# seeded-user-preference\n')
    const input = {
      profile: makeProfile('profile-work', { model: 'glm-4.7' }),
      apiKey: 'profile-key-1',
      userDataPath,
      systemCodexHomePath
    }
    const homePath = expectOk(ensureCodexProfileManagedHome(input))
    const configAfterFirst = readFileSync(join(homePath, 'config.toml'), 'utf-8')
    const authAfterFirst = readFileSync(join(homePath, 'auth.json'), 'utf-8')
    expectOk(ensureCodexProfileManagedHome(input))
    expect(readFileSync(join(homePath, 'config.toml'), 'utf-8')).toBe(configAfterFirst)
    expect(readFileSync(join(homePath, 'auth.json'), 'utf-8')).toBe(authAfterFirst)
  })

  it('refuses a home whose marker names another owner', () => {
    const home = homePathFor('profile-work')
    mkdirSync(home, { recursive: true })
    writeFileSync(join(home, '.aio-ade-managed-home'), 'other-profile\n', 'utf-8')
    expectRefused(
      ensureCodexProfileManagedHome({
        profile: makeProfile('profile-work'),
        apiKey: 'profile-key-1',
        userDataPath,
        systemCodexHomePath
      }),
      /marker/
    )
  })

  it('refuses a home that resolves inside the system Codex home', () => {
    expectRefused(
      ensureCodexProfileManagedHome({
        profile: makeProfile('profile-work'),
        apiKey: 'profile-key-1',
        userDataPath: join(systemCodexHomePath, 'nested-user-data'),
        systemCodexHomePath
      }),
      /inside the system Codex home/
    )
  })

  it('refuses a non-Codex profile', () => {
    expectRefused(
      ensureCodexProfileManagedHome({
        profile: makeProfile('profile-claude', { provider: 'claude' }),
        apiKey: 'profile-key-1',
        userDataPath,
        systemCodexHomePath
      }),
      /not a Codex profile/
    )
  })

  it('removes an owned home and its profile wrapper directory', () => {
    writeSystemConfig('# seeded-user-preference\n')
    const homePath = expectOk(
      ensureCodexProfileManagedHome({
        profile: makeProfile('profile-work'),
        apiKey: 'profile-key-1',
        userDataPath,
        systemCodexHomePath
      })
    )
    expect(existsSync(join(homePath, 'auth.json'))).toBe(true)

    const result = removeCodexProfileManagedHome({
      profileId: 'profile-work',
      userDataPath,
      systemCodexHomePath
    })

    expect(result).toEqual({ ok: true, removed: true })
    expect(existsSync(homePath)).toBe(false)
    expect(existsSync(join(codexProfileHomesRoot(userDataPath), 'profile-work'))).toBe(false)
    expect(existsSync(codexProfileHomesRoot(userDataPath))).toBe(true)
  })

  it('treats a never-materialized home as already removed', () => {
    const result = removeCodexProfileManagedHome({
      profileId: 'profile-work',
      userDataPath,
      systemCodexHomePath
    })

    expect(result).toEqual({ ok: true, removed: false })
  })

  it('refuses to remove a home missing the ownership marker', () => {
    const homePath = homePathFor('profile-work')
    mkdirSync(homePath, { recursive: true })
    writeFileSync(join(homePath, 'auth.json'), 'unowned\n', 'utf-8')

    const result = removeCodexProfileManagedHome({
      profileId: 'profile-work',
      userDataPath,
      systemCodexHomePath
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('expected refused result')
    }
    expect(result.error).toMatch(/marker|ownership/)
    expect(existsSync(join(homePath, 'auth.json'))).toBe(true)
  })

  it('refuses to remove a home whose marker names another owner', () => {
    const homePath = homePathFor('profile-work')
    mkdirSync(homePath, { recursive: true })
    writeFileSync(join(homePath, '.aio-ade-managed-home'), 'other-profile\n', 'utf-8')

    const result = removeCodexProfileManagedHome({
      profileId: 'profile-work',
      userDataPath,
      systemCodexHomePath
    })

    expect(result.ok).toBe(false)
    expect(existsSync(homePath)).toBe(true)
  })
})
