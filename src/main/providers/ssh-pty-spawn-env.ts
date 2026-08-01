import { seedPowerlevel10kWizardEnv } from '../pty/powerlevel10k-wizard-env'

export function buildSshPtySpawnEnv(args: {
  env: Record<string, string> | undefined
  envToDelete?: readonly string[]
}): Record<string, string> {
  const merged = { ...args.env }
  // Why: match local/daemon precedence—managed defaults cannot restore explicitly removed values.
  for (const key of args.envToDelete ?? []) {
    delete merged[key]
  }
  seedPowerlevel10kWizardEnv(merged, { envToDelete: args.envToDelete })
  return merged
}
