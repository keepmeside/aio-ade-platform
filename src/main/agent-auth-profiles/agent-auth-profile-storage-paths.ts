import { join } from 'node:path'

// Sibling to `claude-accounts`/`codex-accounts` at the userData root. The
// agent-auth profile subsystem owns this tree; the desktop `profiles/<id>/`
// tree is a different product concept and must never be reused for it.
const AGENT_AUTH_PROFILES_DIRECTORY_NAME = 'agent-auth-profiles'
const AGENT_AUTH_SECRET_VAULT_FILE_NAME = 'secrets.json.enc'

export function getAgentAuthProfilesDirectory(userDataPath: string): string {
  return join(userDataPath, AGENT_AUTH_PROFILES_DIRECTORY_NAME)
}

export function getAgentAuthSecretVaultPath(userDataPath: string): string {
  return join(getAgentAuthProfilesDirectory(userDataPath), AGENT_AUTH_SECRET_VAULT_FILE_NAME)
}
