import { describe, expect, it } from 'vitest'
import {
  getActivityThreadStatusPreview,
  getActivityThreadTaskTitle,
  getActivityThreadWorkspaceTitle,
  isTerseAgentFollowUpPrompt,
  resolveActivityThreadStatusPreview
} from './activity-thread-display'

describe('activity thread display', () => {
  const tab = {
    customTitle: null,
    generatedTitle: 'Refactor auth middleware',
    title: 'Claude',
    defaultTitle: 'Claude'
  }

  it('distinguishes terse follow-ups from substantive prompts', () => {
    expect(isTerseAgentFollowUpPrompt('ok proceed')).toBe(true)
    expect(isTerseAgentFollowUpPrompt('Compare gpt5 claude prompting')).toBe(false)
  })

  it('uses the worktree display name before its branch', () => {
    expect(
      getActivityThreadWorkspaceTitle({
        displayName: 'Compound engineering plugin',
        branch: 'main'
      })
    ).toBe('Compound engineering plugin')
  })

  it('prefers custom and generated task titles before prompt history', () => {
    expect(
      getActivityThreadTaskTitle({
        entry: { prompt: 'yes', stateHistory: [] },
        tab: { ...tab, customTitle: 'My rename' },
        generatedTitlesEnabled: true
      })
    ).toBe('My rename')
    expect(
      getActivityThreadTaskTitle({
        entry: { prompt: 'yes', stateHistory: [] },
        tab,
        generatedTitlesEnabled: true
      })
    ).toBe('Refactor auth middleware')
  })

  it('uses the most recent substantive prompt when generated titles are disabled', () => {
    expect(
      getActivityThreadTaskTitle({
        entry: {
          prompt: 'yes',
          stateHistory: [
            { state: 'done', prompt: 'Refactor all authentication middleware', startedAt: 1 },
            { state: 'working', prompt: 'Fix logout', startedAt: 2 }
          ]
        },
        tab,
        generatedTitlesEnabled: false
      })
    ).toBe('Fix logout')
  })

  it('shows tool activity, assistant replies, and interruption state', () => {
    expect(
      getActivityThreadStatusPreview({
        state: 'working',
        toolName: 'Bash',
        toolInput: 'pnpm test',
        prompt: 'Run tests'
      })
    ).toBe('Bash: pnpm test')
    expect(
      getActivityThreadStatusPreview({
        state: 'done',
        prompt: 'yes',
        lastAssistantMessage: 'Implemented the change.'
      })
    ).toBe('Implemented the change.')
    expect(
      getActivityThreadStatusPreview({ state: 'done', interrupted: true, prompt: 'Ship it' })
    ).toBe('Interrupted by user')
  })

  it('keeps the previous assistant preview across a mislabeled terse ping', () => {
    expect(
      resolveActivityThreadStatusPreview(
        { state: 'working', prompt: 'yes', lastAssistantMessage: 'yes' },
        'working',
        'Implemented the change.'
      )
    ).toBe('Implemented the change.')
  })
})
