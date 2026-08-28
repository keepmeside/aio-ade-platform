import { describe, expect, it } from 'vitest'
import { resolvePaneDisplayTitle, resolvePaneTitleDecision } from './terminal-title-evidence'

describe('resolvePaneDisplayTitle', () => {
  it('passes an unowned title through unchanged', () => {
    expect(resolvePaneDisplayTitle('bash', undefined)).toBe('bash')
  })

  it('passes a shipped agent title through unchanged', () => {
    expect(resolvePaneDisplayTitle('✳ Claude Code', 'claude')).toBe('✳ Claude Code')
  })
})

describe('resolvePaneTitleDecision', () => {
  it('keeps the raw title beside the display label', () => {
    const decision = resolvePaneTitleDecision({
      normalizedTitle: '✳ ship the carve',
      rawTitle: '✳ ship the carve',
      displayOwnerAgentType: 'claude',
      rendererOwnerAgentType: 'claude',
      userGpuMode: 'auto'
    })
    expect(decision.displayTitle).toBe('✳ ship the carve')
    expect(decision.rawTitle).toBe('✳ ship the carve')
    expect(decision.rendererPolicy.gpuEnabled).toBe(true)
  })

  it('uses the renderer owner, not the display owner, for the GPU veto', () => {
    const decision = resolvePaneTitleDecision({
      normalizedTitle: '✦ Gemini CLI',
      rawTitle: '✦ Gemini CLI',
      // A sticky/tab-scoped owner keeps GPU for the label's pane, but the veto reads the
      // pane-scoped owner, which here is absent — so the hand-run Gemini pane goes DOM.
      displayOwnerAgentType: 'claude',
      rendererOwnerAgentType: undefined,
      userGpuMode: 'auto'
    })
    expect(decision.rendererPolicy.gpuEnabled).toBe(false)
    expect(decision.rendererPolicy.reason).toBe('agent-compatibility')
  })

  it('keeps GPU when a shipped agent owns a pane whose text mentions Gemini', () => {
    const decision = resolvePaneTitleDecision({
      normalizedTitle: '✦ Gemini CLI',
      rawTitle: '✦ Gemini CLI',
      displayOwnerAgentType: 'claude',
      rendererOwnerAgentType: 'claude',
      userGpuMode: 'auto'
    })
    expect(decision.rendererPolicy.gpuEnabled).toBe(true)
  })

  it('DOM-gates a hand-run Gemini pane while preserving its raw title', () => {
    const decision = resolvePaneTitleDecision({
      normalizedTitle: '✦ Gemini CLI',
      rawTitle: '✦ Gemini CLI',
      displayOwnerAgentType: 'gemini',
      rendererOwnerAgentType: 'gemini',
      userGpuMode: 'auto'
    })
    expect(decision.rawTitle).toBe('✦ Gemini CLI')
    expect(decision.rendererPolicy.gpuEnabled).toBe(false)
    expect(decision.rendererPolicy.reason).toBe('agent-compatibility')
  })
})
