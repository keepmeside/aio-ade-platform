import { describe, expect, it } from 'vitest'
import {
  getDefaultSourceControlAiSettings,
  normalizeRepoSourceControlAiOverrides,
  normalizeSourceControlAiSettings,
  sourceControlAiSettingsFromLegacy
} from './source-control-ai'
import type { SourceControlAiSettings } from './source-control-ai-types'
import type { CommitMessageAiSettings } from './types'

/* A profile written by a build with a wider agent roster keeps its shape on disk. Reading it must
 * drop only the parts that name an agent this build cannot launch — everything else has to survive,
 * because these maps sit next to user-authored prompts and command templates. */

const CLAUDE_MODEL = 'claude-sonnet-4-6'
const CAPABILITY = { id: CLAUDE_MODEL, label: 'Sonnet' }

function settingsWithWiderRoster(): SourceControlAiSettings {
  return {
    ...getDefaultSourceControlAiSettings(),
    agentId: 'claude',
    selectedModelByAgent: { claude: CLAUDE_MODEL, gemini: 'gemini-2.5-pro' } as never,
    selectedModelByAgentByHost: {
      local: { claude: CLAUDE_MODEL, droid: 'droid-1' },
      'ssh:retired-box': { cursor: 'cursor-fast' }
    } as never,
    discoveredModelsByAgent: {
      claude: [CAPABILITY],
      gemini: [{ id: 'gemini-2.5-pro', label: 'Pro' }]
    } as never,
    discoveredModelsByAgentByHost: {
      local: { claude: [CAPABILITY], cursor: [{ id: 'cursor-fast', label: 'Fast' }] }
    } as never,
    selectedThinkingByModel: { [CLAUDE_MODEL]: 'high' },
    customAgentCommand: 'my-agent --json',
    instructionsByOperation: { commitMessage: 'keep it terse' }
  }
}

describe('normalizeSourceControlAiSettings', () => {
  it('drops model selections keyed by an agent this build cannot launch', () => {
    const normalized = normalizeSourceControlAiSettings(settingsWithWiderRoster())

    expect(normalized.selectedModelByAgent).toEqual({ claude: CLAUDE_MODEL })
    expect(normalized.discoveredModelsByAgent).toEqual({ claude: [CAPABILITY] })
  })

  it('drops a host whose only model selections named agents this build cannot launch', () => {
    const normalized = normalizeSourceControlAiSettings(settingsWithWiderRoster())

    expect(normalized.selectedModelByAgentByHost).toEqual({ local: { claude: CLAUDE_MODEL } })
    expect(normalized.discoveredModelsByAgentByHost).toEqual({ local: { claude: [CAPABILITY] } })
  })

  it('clears an agent selection this build cannot launch', () => {
    const normalized = normalizeSourceControlAiSettings({
      ...settingsWithWiderRoster(),
      agentId: 'gemini' as never
    })

    expect(normalized.agentId).toBeNull()
  })

  /* Per-action recipes inherit the top-level agent. Seeding them from the raw persisted value
   * left the dropped id in every action even though the top level read back as null, and
   * resolveSourceControlAiForOperation then hard-failed with "does not support" instead of
   * falling back — so commit-message generation broke for an upgrading profile. */
  it('does not leak an unlaunchable agent into the per-action recipes', () => {
    const normalized = normalizeSourceControlAiSettings({
      ...settingsWithWiderRoster(),
      agentId: 'gemini' as never
    })

    expect(normalized.agentId).toBeNull()
    for (const actionId of ['commitMessage', 'pullRequest', 'branchName'] as const) {
      expect(normalized.actions?.[actionId]?.agentId).toBeUndefined()
    }
  })

  it('still seeds the per-action recipes from a launchable top-level agent', () => {
    const normalized = normalizeSourceControlAiSettings({
      ...settingsWithWiderRoster(),
      agentId: 'codex'
    })

    expect(normalized.actions?.commitMessage?.agentId).toBe('codex')
  })

  it('keeps the custom-command agent selection', () => {
    const normalized = normalizeSourceControlAiSettings({
      ...settingsWithWiderRoster(),
      agentId: 'custom'
    })

    expect(normalized.agentId).toBe('custom')
  })

  it('leaves settings that do not name an agent untouched', () => {
    const normalized = normalizeSourceControlAiSettings(settingsWithWiderRoster())

    expect(normalized.customAgentCommand).toBe('my-agent --json')
    expect(normalized.selectedThinkingByModel).toEqual({ [CLAUDE_MODEL]: 'high' })
    expect(normalized.instructionsByOperation.commitMessage).toBe('keep it terse')
  })

  it('filters per-operation model overrides', () => {
    const normalized = normalizeSourceControlAiSettings({
      ...settingsWithWiderRoster(),
      modelOverridesByOperation: {
        commitMessage: {
          selectedModelByAgent: { claude: CLAUDE_MODEL, cursor: 'cursor-fast' } as never,
          selectedThinkingByModel: { [CLAUDE_MODEL]: 'max' }
        }
      }
    })

    expect(normalized.modelOverridesByOperation?.commitMessage).toEqual({
      selectedModelByAgent: { claude: CLAUDE_MODEL },
      selectedThinkingByModel: { [CLAUDE_MODEL]: 'max' }
    })
  })
})

describe('sourceControlAiSettingsFromLegacy', () => {
  it('filters the legacy commit-message projection the same way', () => {
    const legacy: CommitMessageAiSettings = {
      enabled: true,
      agentId: 'claude',
      selectedModelByAgent: { claude: CLAUDE_MODEL, gemini: 'gemini-2.5-pro' } as never,
      selectedModelByAgentByHost: { 'ssh:retired-box': { droid: 'droid-1' } } as never,
      discoveredModelsByAgent: { cursor: [{ id: 'cursor-fast', label: 'Fast' }] } as never,
      discoveredModelsByAgentByHost: { local: { claude: [CAPABILITY] } } as never,
      selectedThinkingByModel: { [CLAUDE_MODEL]: 'high' },
      customPrompt: 'mention the ticket id',
      customAgentCommand: ''
    }

    const normalized = sourceControlAiSettingsFromLegacy(legacy)

    expect(normalized.selectedModelByAgent).toEqual({ claude: CLAUDE_MODEL })
    expect(normalized.selectedModelByAgentByHost).toEqual({})
    expect(normalized.discoveredModelsByAgent).toEqual({})
    expect(normalized.discoveredModelsByAgentByHost).toEqual({ local: { claude: [CAPABILITY] } })
    expect(normalized.instructionsByOperation.commitMessage).toBe('mention the ticket id')
  })

  it('clears a legacy agent selection this build cannot launch', () => {
    const normalized = sourceControlAiSettingsFromLegacy({
      ...getDefaultSourceControlAiSettings(),
      agentId: 'droid' as never,
      customPrompt: ''
    } as never as CommitMessageAiSettings)

    expect(normalized.agentId).toBeNull()
  })
})

describe('normalizeRepoSourceControlAiOverrides', () => {
  it('filters repo-scoped model overrides', () => {
    const normalized = normalizeRepoSourceControlAiOverrides({
      modelOverridesByOperation: {
        pullRequest: {
          selectedModelByAgent: { codex: 'gpt-5-codex', gemini: 'gemini-2.5-pro' },
          selectedModelByAgentByHost: { 'ssh:retired-box': { cursor: 'cursor-fast' } }
        }
      }
    })

    expect(normalized?.modelOverridesByOperation?.pullRequest).toEqual({
      selectedModelByAgent: { codex: 'gpt-5-codex' }
    })
  })
})
