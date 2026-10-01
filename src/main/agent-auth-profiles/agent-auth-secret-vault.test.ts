import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { AgentAuthSecretStorageBackend } from './agent-auth-secret-vault'
import {
  AGENT_AUTH_SECRET_VAULT_MAX_FILE_BYTES,
  AGENT_AUTH_SECRET_VAULT_MAX_KEYS,
  AgentAuthSecretVault
} from './agent-auth-secret-vault'

const testState = {
  dir: '',
  safeStorageAvailable: true
}

vi.mock('electron', () => ({
  app: {
    getPath: () => testState.dir,
    isPackaged: false
  },
  safeStorage: {
    isEncryptionAvailable: () => testState.safeStorageAvailable,
    encryptString: (plain: string) => Buffer.from(`mock-enc:${plain}`, 'utf8'),
    decryptString: (cipher: Buffer) => {
      const text = cipher.toString('utf8')
      if (!text.startsWith('mock-enc:')) {
        throw new Error('decrypt failed')
      }
      return text.slice('mock-enc:'.length)
    }
  }
}))

function makeFakeBackend() {
  const state = { available: true, decryptCalls: 0, encryptCalls: 0 }
  const backend: AgentAuthSecretStorageBackend = {
    isEncryptionAvailable: () => state.available,
    encrypt: (plain) => {
      state.encryptCalls += 1
      return `fake-enc:${Buffer.from(plain, 'utf8').toString('base64')}`
    },
    decrypt: (cipher) => {
      state.decryptCalls += 1
      if (!cipher.startsWith('fake-enc:')) {
        throw new Error('undecryptable')
      }
      return Buffer.from(cipher.slice('fake-enc:'.length), 'base64').toString('utf8')
    }
  }
  return { backend, state }
}

function makeVault(
  dir: string,
  backend: AgentAuthSecretStorageBackend,
  options: { allowsPlaintext?: () => boolean; maxKeys?: number; maxFileBytes?: number } = {}
) {
  return new AgentAuthSecretVault({
    vaultFilePath: join(dir, 'agent-auth-profiles', 'secrets.json.enc'),
    backend,
    allowsPlaintext: options.allowsPlaintext ?? (() => false),
    maxKeys: options.maxKeys,
    maxFileBytes: options.maxFileBytes,
    now: () => 1_700_000_000_000
  })
}

function vaultFilePathOf(dir: string): string {
  return join(dir, 'agent-auth-profiles', 'secrets.json.enc')
}

function readEnvelope(dir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(vaultFilePathOf(dir), 'utf-8')) as Record<string, unknown>
}

function writeEnvelope(dir: string, envelope: unknown): void {
  mkdirSync(join(dir, 'agent-auth-profiles'), { recursive: true })
  writeFileSync(vaultFilePathOf(dir), JSON.stringify(envelope, null, 2), 'utf-8')
}

describe('agent auth secret vault', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agent-auth-vault-test-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('round-trips a secret through an encrypted envelope without plaintext on disk', () => {
    const { backend } = makeFakeBackend()
    const vault = makeVault(dir, backend)

    const write = vault.set('profile-work-glm', 'api-key', 'my-secret-value')
    expect(write).toEqual({ ok: true, persistence: 'encrypted' })

    const envelope = readEnvelope(dir)
    expect(envelope.version).toBe(1)
    expect(envelope.format).toBe('electron-safe-storage-v1')
    expect(typeof envelope.savedAt).toBe('number')
    const secrets = envelope.secrets as Record<string, string>
    expect(Object.keys(secrets)).toEqual(['profile-work-glm\0api-key'])
    // Why: the on-disk envelope must never carry the raw secret.
    expect(readFileSync(vaultFilePathOf(dir), 'utf-8')).not.toContain('my-secret-value')

    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'found',
      value: 'my-secret-value',
      persistence: 'encrypted'
    })
  })

  it('keeps secrets memory-only when encryption is unavailable without consent', () => {
    const { backend, state } = makeFakeBackend()
    state.available = false
    const vault = makeVault(dir, backend)

    expect(vault.set('profile-work-glm', 'api-key', 'my-secret-value')).toEqual({
      ok: true,
      persistence: 'memory-only'
    })
    expect(existsSync(vaultFilePathOf(dir))).toBe(false)
    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'found',
      value: 'my-secret-value',
      persistence: 'memory-only'
    })

    // Restart: memory-only secrets never reached disk.
    state.available = true
    const restarted = makeVault(dir, backend)
    expect(restarted.get('profile-work-glm', 'api-key')).toEqual({ status: 'missing' })
  })

  it('writes an envelope-tagged dev-plaintext file only with explicit consent', () => {
    const { backend, state } = makeFakeBackend()
    state.available = false
    const vault = makeVault(dir, backend, { allowsPlaintext: () => true })

    expect(vault.set('profile-work-glm', 'api-key', 'my-secret-value')).toEqual({
      ok: true,
      persistence: 'dev-plaintext'
    })
    const envelope = readEnvelope(dir)
    expect(envelope.format).toBe('dev-plaintext-v1')
    expect((envelope.secrets as Record<string, string>)['profile-work-glm\0api-key']).toBe(
      'my-secret-value'
    )

    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'found',
      value: 'my-secret-value',
      persistence: 'dev-plaintext'
    })
  })

  it('refuses a dev-plaintext file once consent no longer holds', () => {
    const { backend, state } = makeFakeBackend()
    state.available = false
    makeVault(dir, backend, { allowsPlaintext: () => true }).set(
      'profile-work-glm',
      'api-key',
      'my-secret-value'
    )

    const strictVault = makeVault(dir, backend, { allowsPlaintext: () => false })
    expect(strictVault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'decrypt-failed',
      error: 'Unsafe agent auth secret vault format.'
    })
  })

  it('reports missing secrets without touching the backend', () => {
    const { backend, state } = makeFakeBackend()
    const vault = makeVault(dir, backend)

    expect(vault.get('profile-work-glm', 'api-key')).toEqual({ status: 'missing' })
    vault.set('profile-work-glm', 'api-key', 'my-secret-value')
    expect(vault.get('profile-work-glm', 'proxy-auth')).toEqual({ status: 'missing' })
    expect(state.decryptCalls).toBe(0)
  })

  it('surfaces per-key decrypt failure and recovers through re-prompt (set)', () => {
    const { backend } = makeFakeBackend()
    const vault = makeVault(dir, backend)
    vault.set('profile-work-glm', 'api-key', 'my-secret-value')

    const envelope = readEnvelope(dir)
    ;(envelope.secrets as Record<string, string>)['profile-work-glm\0api-key'] =
      Buffer.from('tampered-ciphertext').toString('base64')
    writeEnvelope(dir, envelope)

    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'decrypt-failed',
      error: 'Could not decrypt stored agent auth secret.'
    })

    expect(vault.set('profile-work-glm', 'api-key', 're-entered-value')).toEqual({
      ok: true,
      persistence: 'encrypted'
    })
    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'found',
      value: 're-entered-value',
      persistence: 'encrypted'
    })
  })

  it('blocks reads and writes on a corrupt envelope until resetVault', () => {
    const { backend } = makeFakeBackend()
    const vault = makeVault(dir, backend)
    vault.set('profile-work-glm', 'api-key', 'my-secret-value')
    writeFileSync(vaultFilePathOf(dir), '{ not json', 'utf-8')

    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'decrypt-failed',
      error: 'Agent auth secret vault file is corrupt.'
    })
    const write = vault.set('profile-work-glm', 'api-key', 'another-value')
    expect(write.ok).toBe(false)
    if (!write.ok) {
      expect(write.error).toContain('corrupt')
    }

    vault.resetVault()
    expect(existsSync(vaultFilePathOf(dir))).toBe(false)
    expect(vault.set('profile-work-glm', 'api-key', 'fresh-value')).toEqual({
      ok: true,
      persistence: 'encrypted'
    })
    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'found',
      value: 'fresh-value',
      persistence: 'encrypted'
    })
  })

  it('refuses unsupported or unknown envelope formats loudly', () => {
    const { backend } = makeFakeBackend()
    const vault = makeVault(dir, backend)
    writeEnvelope(dir, { version: 2, format: 'electron-safe-storage-v1', savedAt: 1, secrets: {} })
    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'decrypt-failed',
      error: 'Unsupported agent auth secret vault format.'
    })

    writeEnvelope(dir, { version: 1, format: 'weird-v9', savedAt: 1, secrets: {} })
    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'decrypt-failed',
      error: 'Unsafe agent auth secret vault format.'
    })
  })

  it('fails closed when an encrypted vault exists but encryption is unavailable', () => {
    const { backend, state } = makeFakeBackend()
    const vault = makeVault(dir, backend)
    vault.set('profile-work-glm', 'api-key', 'my-secret-value')

    state.available = false
    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'decrypt-failed',
      error: 'OS-backed encryption is unavailable.'
    })
  })

  it('never downgrades an encrypted vault to dev-plaintext', () => {
    const { backend, state } = makeFakeBackend()
    const vault = makeVault(dir, backend)
    vault.set('profile-work-glm', 'api-key', 'my-secret-value')
    const before = readFileSync(vaultFilePathOf(dir), 'utf-8')

    state.available = false
    expect(vault.set('profile-work-glm', 'proxy-auth', 'proxy-secret')).toEqual({
      ok: true,
      persistence: 'memory-only'
    })
    // Why: rewriting as dev-plaintext would expose the existing ciphertext's
    // secrets — the encrypted file must stay byte-identical instead.
    expect(readFileSync(vaultFilePathOf(dir), 'utf-8')).toBe(before)
  })

  it('upgrades a dev-plaintext vault to encrypted once encryption returns', () => {
    const { backend, state } = makeFakeBackend()
    const vault = makeVault(dir, backend, { allowsPlaintext: () => true })
    state.available = false
    vault.set('profile-work-glm', 'api-key', 'my-secret-value')

    state.available = true
    expect(vault.set('profile-work-glm', 'proxy-auth', 'proxy-secret')).toEqual({
      ok: true,
      persistence: 'encrypted'
    })
    expect(readEnvelope(dir).format).toBe('electron-safe-storage-v1')
    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'found',
      value: 'my-secret-value',
      persistence: 'encrypted'
    })
    expect(readFileSync(vaultFilePathOf(dir), 'utf-8')).not.toContain('my-secret-value')
  })

  it('deletes single secrets and whole profiles without touching other profiles', () => {
    const { backend, state } = makeFakeBackend()
    const vault = makeVault(dir, backend)
    vault.set('profile-one', 'api-key', 'one')
    vault.set('profile-one', 'proxy-auth', 'one-proxy')
    vault.set('profile-two', 'api-key', 'two')

    expect(vault.has('profile-one', 'api-key')).toBe(true)
    expect(vault.has('profile-one', 'header:x-title')).toBe(false)
    expect(state.decryptCalls).toBe(0)

    vault.delete('profile-one', 'api-key')
    expect(vault.has('profile-one', 'api-key')).toBe(false)
    expect(vault.get('profile-one', 'proxy-auth')).toEqual({
      status: 'found',
      value: 'one-proxy',
      persistence: 'encrypted'
    })

    vault.deleteProfile('profile-one')
    expect(vault.get('profile-one', 'proxy-auth')).toEqual({ status: 'missing' })
    expect(vault.get('profile-two', 'api-key')).toEqual({
      status: 'found',
      value: 'two',
      persistence: 'encrypted'
    })
  })

  it('enforces key and byte limits', () => {
    const { backend } = makeFakeBackend()
    const vault = makeVault(dir, backend, { maxKeys: 2, maxFileBytes: 1_000_000 })

    expect(vault.set('profile-a', 'api-key', 'a').ok).toBe(true)
    expect(vault.set('profile-a', 'proxy-auth', 'b').ok).toBe(true)
    // Overwrites stay within the limit; only new keys count.
    expect(vault.set('profile-a', 'api-key', 'a2').ok).toBe(true)
    const rejected = vault.set('profile-b', 'api-key', 'c')
    expect(rejected.ok).toBe(false)
    if (!rejected.ok) {
      expect(rejected.error).toContain('key limit')
    }

    const byteLimited = makeVault(dir, backend, { maxFileBytes: 16 })
    const byteRejected = byteLimited.set('profile-c', 'api-key', 'a-fairly-long-secret-value')
    expect(byteRejected.ok).toBe(false)
    if (!byteRejected.ok) {
      expect(byteRejected.error).toContain('bytes')
    }
  })

  it('exposes the default limits as constants', () => {
    expect(AGENT_AUTH_SECRET_VAULT_MAX_KEYS).toBeGreaterThan(0)
    expect(AGENT_AUTH_SECRET_VAULT_MAX_FILE_BYTES).toBeGreaterThan(0)
  })

  it('rejects empty secret values and invalid key parts', () => {
    const { backend } = makeFakeBackend()
    const vault = makeVault(dir, backend)

    const empty = vault.set('profile-work-glm', 'api-key', '')
    expect(empty.ok).toBe(false)

    expect(() => vault.set('BAD ID', 'api-key', 'x')).toThrow()
    expect(() => vault.set('profile-work-glm', 'not-a-known-kind', 'x')).toThrow()
    expect(() => vault.get('BAD ID', 'api-key')).toThrow()
  })
})

describe('agent auth secret vault electron wiring', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agent-auth-vault-wiring-test-'))
    testState.dir = dir
    testState.safeStorageAvailable = true
    vi.resetModules()
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('places the vault beside the account stores and round-trips through safeStorage', async () => {
    const { getAgentAuthProfilesDirectory, getAgentAuthSecretVaultPath } =
      await import('./agent-auth-profile-storage-paths')
    expect(getAgentAuthProfilesDirectory('user-data')).toBe(
      join('user-data', 'agent-auth-profiles')
    )
    expect(getAgentAuthSecretVaultPath('user-data')).toBe(
      join('user-data', 'agent-auth-profiles', 'secrets.json.enc')
    )

    const { createDefaultAgentAuthSecretVault } =
      await import('./agent-auth-secret-storage-backend')
    const vault = createDefaultAgentAuthSecretVault()
    expect(vault.set('profile-work-glm', 'api-key', 'wired-secret')).toEqual({
      ok: true,
      persistence: 'encrypted'
    })
    expect(existsSync(join(dir, 'agent-auth-profiles', 'secrets.json.enc'))).toBe(true)
    expect(
      readFileSync(join(dir, 'agent-auth-profiles', 'secrets.json.enc'), 'utf-8')
    ).not.toContain('wired-secret')
    expect(vault.get('profile-work-glm', 'api-key')).toEqual({
      status: 'found',
      value: 'wired-secret',
      persistence: 'encrypted'
    })
  })

  it('gates the dev-plaintext consent on env, non-production, and unpackaged builds', async () => {
    const { allowsPlaintextAgentAuthSecrets } = await import('./agent-auth-secret-storage-backend')
    expect(
      allowsPlaintextAgentAuthSecrets(
        {
          AIO_ADE_AGENT_AUTH_ALLOW_PLAINTEXT_SECRETS: '1',
          NODE_ENV: 'development'
        } as NodeJS.ProcessEnv,
        false
      )
    ).toBe(true)
    expect(
      allowsPlaintextAgentAuthSecrets(
        {
          AIO_ADE_AGENT_AUTH_ALLOW_PLAINTEXT_SECRETS: '1',
          NODE_ENV: 'production'
        } as NodeJS.ProcessEnv,
        false
      )
    ).toBe(false)
    expect(
      allowsPlaintextAgentAuthSecrets(
        {
          AIO_ADE_AGENT_AUTH_ALLOW_PLAINTEXT_SECRETS: '1',
          NODE_ENV: 'development'
        } as NodeJS.ProcessEnv,
        true
      )
    ).toBe(false)
    expect(
      allowsPlaintextAgentAuthSecrets({ NODE_ENV: 'development' } as NodeJS.ProcessEnv, false)
    ).toBe(false)
  })
})
