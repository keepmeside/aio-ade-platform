/* Safety net: persisted agent ids and account paths survive a roster narrowing and a rebrand.
 *
 * These are characterization tests: they pin the behavior that phases 04 (roster narrowed to
 * claude|codex) and 05 (rebrand aio-ade -> aio-ade) are most likely to break silently. They must
 * pass BEFORE those phases start and keep passing after, so a regression shows up as a failing
 * assertion rather than a user losing their agent config or their account.
 *
 * Why a separate file rather than additions to persistence.test.ts: that suite is already at its
 * max-lines budget, and these assertions belong to a migration contract with its own lifetime. */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const testState = { dir: '' }

const { trackMock, getCohortAtEmitMock } = vi.hoisted(() => ({
  trackMock: vi.fn(),
  getCohortAtEmitMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => testState.dir
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plaintext: string) => Buffer.from(`encrypted:${plaintext}`, 'utf-8'),
    decryptString: (ciphertext: Buffer) => {
      const decoded = ciphertext.toString('utf-8')
      if (!decoded.startsWith('encrypted:')) {
        throw new Error('invalid ciphertext')
      }
      return decoded.slice('encrypted:'.length)
    }
  }
}))

vi.mock('./telemetry/client', () => ({ track: trackMock }))
vi.mock('./telemetry/cohort-classifier', () => ({ getCohortAtEmit: getCohortAtEmitMock }))
vi.mock('./ssh/ssh-config-parser', () => ({
  loadUserSshConfig: vi.fn(() => []),
  sshConfigHostsToTargets: vi.fn(() => [])
}))

/** Agent ids phase 04 deletes. `claude-agent-teams` is deliberately absent: it is KEPT. */
const REMOVED_AGENT_IDS = ['gemini', 'droid', 'cursor', 'aider', 'opencode'] as const

function dataFile(): string {
  return join(testState.dir, 'aio-ade-data.json')
}

function writeDataFile(data: unknown): void {
  mkdirSync(testState.dir, { recursive: true })
  writeFileSync(dataFile(), JSON.stringify(data, null, 2), 'utf-8')
}

async function createStore() {
  vi.resetModules()
  const { Store, initDataPath } = await import('./persistence')
  initDataPath()
  return new Store()
}

beforeEach(() => {
  testState.dir = mkdtempSync(join(tmpdir(), 'aio-ade-preflight-'))
  trackMock.mockReset()
  getCohortAtEmitMock.mockReset()
})

afterEach(() => {
  rmSync(testState.dir, { recursive: true, force: true })
})

describe('persisted removed-agent ids', () => {
  it('loads a profile whose roster-keyed fields are entirely removed agents without throwing', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: {
        defaultTuiAgent: 'gemini',
        disabledTuiAgents: REMOVED_AGENT_IDS,
        agentCmdOverrides: Object.fromEntries(
          REMOVED_AGENT_IDS.map((id) => [id, `/usr/local/bin/${id}`])
        ),
        agentDefaultArgs: Object.fromEntries(REMOVED_AGENT_IDS.map((id) => [id, '--yolo'])),
        agentDefaultEnv: Object.fromEntries(REMOVED_AGENT_IDS.map((id) => [id, { SOME_FLAG: '1' }]))
      },
      ui: {},
      githubCache: { pr: {}, issue: {} }
    })

    const store = await createStore()

    // The contract is survival, not any particular coercion: a stale roster must never
    // take down load, because load failure resets the whole profile.
    expect(store.getSettings()).toBeTruthy()
    expect(store.getRepos()).toEqual([])
  })

  it('keeps unrelated settings intact when the roster contains removed agents', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: {
        defaultTuiAgent: 'droid',
        disabledTuiAgents: ['droid', 'cursor'],
        // Neighboring, non-roster settings that must not be collateral damage.
        pluginSystemEnabled: true,
        minimaxUsageModels: 'abab6.5',
        agentStatusHooksEnabled: false
      },
      ui: {},
      githubCache: { pr: {}, issue: {} }
    })

    const settings = (await createStore()).getSettings()

    expect(settings.pluginSystemEnabled).toBe(true)
    expect(settings.minimaxUsageModels).toBe('abab6.5')
    expect(settings.agentStatusHooksEnabled).toBe(false)
  })

  it('normalizes disabledTuiAgents through the update boundary, not just on load', async () => {
    const store = await createStore()

    store.updateSettings({
      disabledTuiAgents: ['codex', 'not-an-agent', 'codex', null] as never
    })

    const disabled = store.getSettings().disabledTuiAgents
    expect(disabled).toContain('codex')
    expect(disabled).not.toContain('not-an-agent')
    // Dedupe is part of the contract; a duplicate id would double-hide a picker row.
    expect(disabled.filter((id) => id === 'codex')).toHaveLength(1)
  })

  it('preserves claude-agent-teams as a valid roster id (kept by the 2026-08-21 decision)', async () => {
    const { isTuiAgent } = await import('../shared/tui-agent-config')
    const { normalizeDisabledTuiAgents } = await import('../shared/tui-agent-selection')

    expect(isTuiAgent('claude-agent-teams')).toBe(true)
    expect(normalizeDisabledTuiAgents(['claude-agent-teams'])).toEqual(['claude-agent-teams'])
  })

  it('keeps host-scoped source-control model maps loadable when keyed by removed agents', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: {
        sourceControlAi: {
          enabled: true,
          agentId: 'cursor',
          selectedModelByAgent: { cursor: 'gpt-5.2', gemini: 'gemini-2.5-pro' },
          selectedModelByAgentByHost: {
            'ssh:conn-1': { cursor: 'remote-model', droid: 'droid-model' }
          },
          selectedThinkingByModel: {},
          customPrompt: ''
        }
      },
      ui: {},
      githubCache: { pr: {}, issue: {} }
    })

    const store = await createStore()

    expect(store.getSettings().sourceControlAi?.enabled).toBe(true)
  })
})

describe('profile file identity', () => {
  it('reads and writes the aio-ade-data.json filename', async () => {
    // Why pinned: phase 05 renames branding tokens. The on-disk profile name is a data
    // contract, so a rename here must be a deliberate migration with a dual-read, not a
    // side effect of a global find-and-replace.
    const store = await createStore()
    store.updateSettings({ pluginSystemEnabled: true })
    store.flushOrThrow()

    const raw = JSON.parse(readFileSync(dataFile(), 'utf-8')) as { settings?: unknown }
    expect(raw.settings).toBeTruthy()
  })
})
