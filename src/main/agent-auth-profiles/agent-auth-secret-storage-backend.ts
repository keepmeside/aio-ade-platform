// Electron safeStorage adapter for the vault's storage seam, plus the dev-only
// plaintext consent gate. The only module in the agent-auth profile subsystem
// that touches Electron's safeStorage API.
import { app, safeStorage } from 'electron'
import { AgentAuthSecretVault, type AgentAuthSecretStorageBackend } from './agent-auth-secret-vault'
import { getAgentAuthSecretVaultPath } from './agent-auth-profile-storage-paths'

export function createSafeStorageAgentAuthSecretBackend(): AgentAuthSecretStorageBackend {
  return {
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (plainText) => safeStorage.encryptString(plainText).toString('base64'),
    decrypt: (cipherText) => safeStorage.decryptString(Buffer.from(cipherText, 'base64'))
  }
}

// Why: packaged main bundles never define NODE_ENV, so packaged-ness is the
// only reliable production signal for gating dev-only escape hatches.
function isPackagedAioAdeBuild(): boolean {
  try {
    return app?.isPackaged === true
  } catch {
    return false
  }
}

export function allowsPlaintextAgentAuthSecrets(
  env: NodeJS.ProcessEnv = process.env,
  packaged: boolean = isPackagedAioAdeBuild()
): boolean {
  return (
    env.AIO_ADE_AGENT_AUTH_ALLOW_PLAINTEXT_SECRETS === '1' &&
    env.NODE_ENV !== 'production' &&
    !packaged
  )
}

export function createDefaultAgentAuthSecretVault(
  userDataPath: string = app.getPath('userData')
): AgentAuthSecretVault {
  return new AgentAuthSecretVault({
    vaultFilePath: getAgentAuthSecretVaultPath(userDataPath),
    backend: createSafeStorageAgentAuthSecretBackend(),
    allowsPlaintext: () => allowsPlaintextAgentAuthSecrets()
  })
}
