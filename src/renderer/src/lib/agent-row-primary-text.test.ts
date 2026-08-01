import { describe, expect, it } from 'vitest'
import { getAgentRowGeneratedTitleText, getAgentRowPrimaryText } from './agent-row-primary-text'

describe('agent row text', () => {
  it('derives the primary label only from trimmed prompt text', () => {
    expect(getAgentRowPrimaryText({ prompt: '  Fix checkout race  ' })).toBe('Fix checkout race')
  })

  it('preserves prompt text for generated-title input', () => {
    expect(getAgentRowGeneratedTitleText({ prompt: 'Refactor the auth middleware' })).toBe(
      'Refactor the auth middleware'
    )
  })
})
