import { describe, expect, it } from 'vitest'
import {
  buildAgentFeatureSkillUpdateCommand,
  EPHEMERAL_VMS_SKILL_UPDATE_COMMAND
} from './agent-feature-install-commands'

describe('agent feature skill commands', () => {
  it('builds single-skill update commands', () => {
    expect(buildAgentFeatureSkillUpdateCommand('orca-per-workspace-env')).toBe(
      'npx skills update orca-per-workspace-env --global'
    )
  })

  it('trims and rejects blank update skill names', () => {
    expect(buildAgentFeatureSkillUpdateCommand('  orca-per-workspace-env  ')).toBe(
      'npx skills update orca-per-workspace-env --global'
    )
    expect(() => buildAgentFeatureSkillUpdateCommand('   ')).toThrow('A skill name is required.')
  })

  it('exports the retained single-skill update command', () => {
    expect(EPHEMERAL_VMS_SKILL_UPDATE_COMMAND).toBe(
      'npx skills update orca-per-workspace-env --global'
    )
  })
})
