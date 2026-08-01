import { describe, expect, it } from 'vitest'
import { getDefaultAgentCapabilitySetupSelection } from './agent-capability-setup-status'

const READY_INPUT = {
  browserUseSkillInstalled: true,
  browserUseSkillLoading: false,
  computerUseReady: true,
  computerUseChecking: false,
  computerUseUnavailable: false
}

describe('getDefaultAgentCapabilitySetupSelection', () => {
  it('leaves already-ready capabilities unchecked by default', () => {
    expect(getDefaultAgentCapabilitySetupSelection(READY_INPUT)).toEqual({
      browserUse: false,
      computerUse: false
    })
  })

  it('keeps Computer Use selected when permissions still need setup', () => {
    expect(
      getDefaultAgentCapabilitySetupSelection({
        ...READY_INPUT,
        computerUseReady: false
      })
    ).toEqual({
      browserUse: false,
      computerUse: true
    })
  })

  it('leaves Computer Use unchecked when this build cannot enable it', () => {
    expect(
      getDefaultAgentCapabilitySetupSelection({
        ...READY_INPUT,
        computerUseReady: false,
        computerUseUnavailable: true
      })
    ).toEqual({
      browserUse: false,
      computerUse: false
    })
  })
})
