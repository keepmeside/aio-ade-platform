import type { AiVaultAgent } from '../../shared/ai-vault-types'

import { codexFixture } from './session-scanner-codex-fixtures'

// Line builders for the incremental-parse differential tests: each agent gets
// a seed transcript, an appended continuation, and a truncated rewrite, all in
// that agent's real on-disk JSONL record shapes.

export type IncrementalAgentFixture = {
  agent: AiVaultAgent
  fileName: string
  seedLines: string[]
  appendLines: string[]
  truncatedLines: string[]
}

export function allIncrementalAgentFixtures(): IncrementalAgentFixture[] {
  return [codexFixture()]
}
