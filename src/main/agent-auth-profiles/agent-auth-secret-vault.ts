import { existsSync, readFileSync, rmSync, statSync } from 'node:fs'
import { writeSecureFile } from '../../shared/secure-file'
import {
  isValidAgentAuthProfileId,
  isValidAgentAuthProfileSecretName
} from '../../shared/agent-auth-profile-types'

/**
 * Secret vault for agent auth profiles, keyed by (profileId, secretName) —
 * the exact vocabulary `vault:v1` secret refs in the profile schema name.
 *
 * Persistence ladder, fail-closed at rest: (1) encrypted envelope via the
 * storage backend; (2) dev-plaintext envelope only under explicit dev consent
 * and never by downgrading an existing encrypted vault; (3) memory-only.
 * Reads return typed results — corrupt envelopes block loudly until
 * `resetVault()` instead of reading as empty, and per-key decrypt failures
 * surface as `decrypt-failed` so the UI can re-prompt for that secret.
 *
 * All mutations are synchronous on purpose: the main process is the vault's
 * single writer, and a synchronous read-modify-write cycle cannot interleave
 * with another turn. Making any of this async requires real locking first.
 */

export const AGENT_AUTH_SECRET_VAULT_MAX_KEYS = 512
export const AGENT_AUTH_SECRET_VAULT_MAX_FILE_BYTES = 1_048_576
/** Hard read ceiling against tampered giant files; independent of the write limit. */
const AGENT_AUTH_SECRET_VAULT_READ_CEILING_BYTES = 16 * 1024 * 1024

/** The narrow storage seam the vault depends on. Swapping it (e.g. for a
 * keychain-FFI implementation) must not require touching the vault's envelope,
 * ladder, or limits. */
export type AgentAuthSecretStorageBackend = {
  isEncryptionAvailable(): boolean
  /** Returns opaque ciphertext; throws when encryption fails. */
  encrypt(plainText: string): string
  /** Takes opaque ciphertext; throws when decryption fails. */
  decrypt(cipherText: string): string
}

export type AgentAuthSecretPersistence = 'encrypted' | 'dev-plaintext' | 'memory-only'

export type AgentAuthSecretRead =
  | { status: 'found'; value: string; persistence: AgentAuthSecretPersistence }
  | { status: 'missing' }
  | { status: 'decrypt-failed'; error: string }

export type AgentAuthSecretWriteResult =
  | { ok: true; persistence: AgentAuthSecretPersistence }
  | { ok: false; error: string }

export type AgentAuthSecretVaultOptions = {
  vaultFilePath: string
  backend: AgentAuthSecretStorageBackend
  allowsPlaintext?: () => boolean
  maxKeys?: number
  maxFileBytes?: number
  now?: () => number
}

type VaultFormat = 'electron-safe-storage-v1' | 'dev-plaintext-v1'

type PersistedVaultFile = {
  version: 1
  format: VaultFormat
  savedAt: number
  secrets: Record<string, string>
}

type VaultFileState =
  | { kind: 'missing' }
  | { kind: 'ok'; file: PersistedVaultFile }
  | { kind: 'unsupported' }
  | { kind: 'unsafe' }
  | { kind: 'corrupt' }

const VAULT_KEY_SEPARATOR = '\0'
const CORRUPT_VAULT_ERROR = 'Agent auth secret vault file is corrupt.'

function vaultKey(profileId: string, secretName: string): string {
  return `${profileId}${VAULT_KEY_SEPARATOR}${secretName}`
}

export class AgentAuthSecretVault {
  private readonly vaultFilePath: string
  private readonly backend: AgentAuthSecretStorageBackend
  private readonly allowsPlaintext: () => boolean
  private readonly maxKeys: number
  private readonly maxFileBytes: number
  private readonly now: () => number
  private readonly memoryOnlySecrets = new Map<string, string>()

  constructor(options: AgentAuthSecretVaultOptions) {
    this.vaultFilePath = options.vaultFilePath
    this.backend = options.backend
    this.allowsPlaintext = options.allowsPlaintext ?? (() => false)
    this.maxKeys = options.maxKeys ?? AGENT_AUTH_SECRET_VAULT_MAX_KEYS
    this.maxFileBytes = options.maxFileBytes ?? AGENT_AUTH_SECRET_VAULT_MAX_FILE_BYTES
    this.now = options.now ?? Date.now
  }

  get(profileId: string, secretName: string): AgentAuthSecretRead {
    this.assertKeyParts(profileId, secretName)
    const key = vaultKey(profileId, secretName)
    const memoryValue = this.memoryOnlySecrets.get(key)
    if (memoryValue !== undefined) {
      return { status: 'found', value: memoryValue, persistence: 'memory-only' }
    }
    const state = this.readVaultFile()
    if (state.kind === 'missing') {
      return { status: 'missing' }
    }
    if (state.kind === 'corrupt') {
      return { status: 'decrypt-failed', error: CORRUPT_VAULT_ERROR }
    }
    if (state.kind === 'unsupported') {
      return { status: 'decrypt-failed', error: 'Unsupported agent auth secret vault format.' }
    }
    if (state.kind === 'unsafe') {
      return { status: 'decrypt-failed', error: 'Unsafe agent auth secret vault format.' }
    }
    const stored = state.file.secrets[key]
    if (typeof stored !== 'string') {
      return { status: 'missing' }
    }
    if (state.file.format === 'electron-safe-storage-v1') {
      if (!this.backend.isEncryptionAvailable()) {
        return { status: 'decrypt-failed', error: 'OS-backed encryption is unavailable.' }
      }
      try {
        return { status: 'found', value: this.backend.decrypt(stored), persistence: 'encrypted' }
      } catch {
        return { status: 'decrypt-failed', error: 'Could not decrypt stored agent auth secret.' }
      }
    }
    if (!this.allowsPlaintext()) {
      return { status: 'decrypt-failed', error: 'Unsafe agent auth secret vault format.' }
    }
    return { status: 'found', value: stored, persistence: 'dev-plaintext' }
  }

  set(profileId: string, secretName: string, value: string): AgentAuthSecretWriteResult {
    this.assertKeyParts(profileId, secretName)
    if (value === '') {
      return { ok: false, error: 'Secret value must not be empty.' }
    }
    const key = vaultKey(profileId, secretName)
    const state = this.readVaultFile()
    if (state.kind === 'corrupt') {
      return { ok: false, error: CORRUPT_VAULT_ERROR }
    }
    if (state.kind === 'unsupported' || state.kind === 'unsafe') {
      return {
        ok: false,
        error: `Refusing to overwrite an ${state.kind} agent auth secret vault format.`
      }
    }
    const existingFile = state.kind === 'ok' ? state.file : null

    if (this.backend.isEncryptionAvailable()) {
      const secrets: Record<string, string> = {}
      if (existingFile?.format === 'electron-safe-storage-v1') {
        // Ciphertext carries over untouched — no backend round-trip needed.
        Object.assign(secrets, existingFile.secrets)
      } else if (existingFile) {
        // Security upgrade: re-encrypt every dev-plaintext entry in place.
        for (const [existingKey, plainValue] of Object.entries(existingFile.secrets)) {
          secrets[existingKey] = this.backend.encrypt(plainValue)
        }
      }
      const keyLimitError = this.checkKeyLimit(secrets, key)
      if (keyLimitError) {
        return { ok: false, error: keyLimitError }
      }
      secrets[key] = this.backend.encrypt(value)
      return this.persistVault('electron-safe-storage-v1', secrets)
    }

    // Why: rewriting an encrypted vault as plaintext would expose every
    // existing ciphertext's secret — an encrypted vault stays on disk
    // untouched and the new secret lives in memory only.
    const consentedDevPlaintext =
      this.allowsPlaintext() &&
      (existingFile === null || existingFile.format === 'dev-plaintext-v1')
    if (!consentedDevPlaintext) {
      this.memoryOnlySecrets.set(key, value)
      return { ok: true, persistence: 'memory-only' }
    }
    const secrets = { ...existingFile?.secrets }
    const keyLimitError = this.checkKeyLimit(secrets, key)
    if (keyLimitError) {
      return { ok: false, error: keyLimitError }
    }
    secrets[key] = value
    return this.persistVault('dev-plaintext-v1', secrets)
  }

  /** Existence-only check — never prompts the OS keychain. */
  has(profileId: string, secretName: string): boolean {
    this.assertKeyParts(profileId, secretName)
    const key = vaultKey(profileId, secretName)
    if (this.memoryOnlySecrets.has(key)) {
      return true
    }
    const state = this.readVaultFile()
    return state.kind === 'ok' && typeof state.file.secrets[key] === 'string'
  }

  delete(profileId: string, secretName: string): void {
    this.assertKeyParts(profileId, secretName)
    const key = vaultKey(profileId, secretName)
    this.memoryOnlySecrets.delete(key)
    const state = this.readVaultFile()
    if (state.kind !== 'ok' || !Object.hasOwn(state.file.secrets, key)) {
      return
    }
    const secrets = { ...state.file.secrets }
    delete secrets[key]
    this.persistVault(state.file.format, secrets)
  }

  /** Removes every secret scoped to one profile so profile deletion can never
   * strand ciphertext. Other profiles' secrets are untouched. */
  deleteProfile(profileId: string): void {
    if (!isValidAgentAuthProfileId(profileId)) {
      throw new Error(
        'Agent auth profile id must start alphanumeric and use only letters, digits, dots, and hyphens.'
      )
    }
    const prefix = `${profileId}${VAULT_KEY_SEPARATOR}`
    // Map iteration tolerates deletion of visited/pending entries.
    for (const key of this.memoryOnlySecrets.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryOnlySecrets.delete(key)
      }
    }
    const state = this.readVaultFile()
    if (state.kind !== 'ok') {
      return
    }
    const secrets: Record<string, string> = {}
    let removed = false
    for (const [key, value] of Object.entries(state.file.secrets)) {
      if (key.startsWith(prefix)) {
        removed = true
        continue
      }
      secrets[key] = value
    }
    if (removed) {
      this.persistVault(state.file.format, secrets)
    }
  }

  /** Explicit recovery for a corrupt vault: drops the file after user
   * confirmation. This is the only path that discards stored ciphertext. */
  resetVault(): void {
    this.memoryOnlySecrets.clear()
    if (existsSync(this.vaultFilePath)) {
      rmSync(this.vaultFilePath, { force: true })
    }
  }

  private checkKeyLimit(secrets: Record<string, string>, key: string): string | null {
    if (!Object.hasOwn(secrets, key) && Object.keys(secrets).length >= this.maxKeys) {
      return `agent auth secret vault exceeds the ${this.maxKeys}-key limit`
    }
    return null
  }

  private persistVault(
    format: VaultFormat,
    secrets: Record<string, string>
  ): AgentAuthSecretWriteResult {
    const file: PersistedVaultFile = { version: 1, format, savedAt: this.now(), secrets }
    const serialized = JSON.stringify(file, null, 2)
    if (Buffer.byteLength(serialized, 'utf8') > this.maxFileBytes) {
      return { ok: false, error: `agent auth secret vault exceeds ${this.maxFileBytes} bytes` }
    }
    writeSecureFile(this.vaultFilePath, serialized)
    return {
      ok: true,
      persistence: format === 'electron-safe-storage-v1' ? 'encrypted' : 'dev-plaintext'
    }
  }

  private readVaultFile(): VaultFileState {
    if (!existsSync(this.vaultFilePath)) {
      return { kind: 'missing' }
    }
    try {
      if (statSync(this.vaultFilePath).size > AGENT_AUTH_SECRET_VAULT_READ_CEILING_BYTES) {
        return { kind: 'corrupt' }
      }
      const parsed: unknown = JSON.parse(readFileSync(this.vaultFilePath, 'utf-8'))
      if (typeof parsed !== 'object' || parsed === null) {
        return { kind: 'corrupt' }
      }
      const candidate = parsed as Record<string, unknown>
      if (candidate.version !== 1) {
        return { kind: 'unsupported' }
      }
      if (
        candidate.format !== 'electron-safe-storage-v1' &&
        candidate.format !== 'dev-plaintext-v1'
      ) {
        return { kind: 'unsafe' }
      }
      if (
        typeof candidate.savedAt !== 'number' ||
        !Number.isFinite(candidate.savedAt) ||
        typeof candidate.secrets !== 'object' ||
        candidate.secrets === null ||
        Array.isArray(candidate.secrets)
      ) {
        return { kind: 'corrupt' }
      }
      return { kind: 'ok', file: candidate as PersistedVaultFile }
    } catch {
      return { kind: 'corrupt' }
    }
  }

  private assertKeyParts(profileId: string, secretName: string): void {
    if (!isValidAgentAuthProfileId(profileId)) {
      throw new Error(
        'Agent auth profile id must start alphanumeric and use only letters, digits, dots, and hyphens.'
      )
    }
    if (!isValidAgentAuthProfileSecretName(secretName)) {
      throw new Error(
        'Agent auth profile secret name must be "api-key", "proxy-auth", or "header:<lowercase-name>".'
      )
    }
  }
}
