import { describe, expect, it } from 'vitest'
import {
  buildAgentFeatureSkillInstallCommand,
  buildAgentFeatureSkillUpdateCommand,
  COMPUTER_USE_SKILL_UPDATE_COMMAND,
  EPHEMERAL_VMS_SKILL_UPDATE_COMMAND,
  LINEAR_TICKETS_SKILL_UPDATE_COMMAND,
  AIO_ADE_LINEAR_SKILL_UPDATE_COMMAND,
  AIO_ADE_CLI_ORCHESTRATION_SKILL_INSTALL_COMMAND,
  AIO_ADE_CLI_SKILL_UPDATE_COMMAND,
  ORCHESTRATION_SKILL_UPDATE_COMMAND
} from './agent-feature-install-commands'

describe('agent feature skill commands', () => {
  it('builds single-skill update commands', () => {
    expect(buildAgentFeatureSkillUpdateCommand('orchestration')).toBe(
      'npx skills update orchestration --global'
    )
  })

  it('trims and rejects blank update skill names', () => {
    expect(buildAgentFeatureSkillUpdateCommand('  aio-ade-cli  ')).toBe(
      'npx skills update aio-ade-cli --global'
    )
    expect(() => buildAgentFeatureSkillUpdateCommand('   ')).toThrow('A skill name is required.')
  })

  it('exports single-skill update constants without changing install bundles', () => {
    expect(AIO_ADE_CLI_SKILL_UPDATE_COMMAND).toBe('npx skills update aio-ade-cli --global')
    expect(COMPUTER_USE_SKILL_UPDATE_COMMAND).toBe('npx skills update computer-use --global')
    expect(ORCHESTRATION_SKILL_UPDATE_COMMAND).toBe('npx skills update orchestration --global')
    expect(EPHEMERAL_VMS_SKILL_UPDATE_COMMAND).toBe(
      'npx skills update aio-ade-per-workspace-env --global'
    )
    expect(AIO_ADE_LINEAR_SKILL_UPDATE_COMMAND).toBe('npx skills update aio-ade-linear --global')
    expect(LINEAR_TICKETS_SKILL_UPDATE_COMMAND).toBe('npx skills update linear-tickets --global')
    expect(AIO_ADE_CLI_ORCHESTRATION_SKILL_INSTALL_COMMAND).toBe(
      buildAgentFeatureSkillInstallCommand(['aio-ade-cli', 'orchestration'])
    )
  })
})
