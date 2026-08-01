export const ORCA_SKILLS_REPOSITORY_URL = 'https://github.com/stablyai/orca'

export const EPHEMERAL_VMS_SKILL_NAME = 'orca-per-workspace-env'

export function buildAgentFeatureSkillInstallCommand(skillNames: readonly string[]): string {
  if (skillNames.length === 0) {
    throw new Error('At least one skill name is required.')
  }
  return `npx skills add ${ORCA_SKILLS_REPOSITORY_URL} --skill ${skillNames.join(' ')} --global`
}

export function buildAgentFeatureSkillUpdateCommand(skillName: string): string {
  const trimmedSkillName = skillName.trim()
  if (!trimmedSkillName) {
    throw new Error('A skill name is required.')
  }
  return `npx skills update ${trimmedSkillName} --global`
}

export const EPHEMERAL_VMS_SKILL_INSTALL_COMMAND = buildAgentFeatureSkillInstallCommand([
  EPHEMERAL_VMS_SKILL_NAME
])

export const EPHEMERAL_VMS_SKILL_UPDATE_COMMAND =
  buildAgentFeatureSkillUpdateCommand(EPHEMERAL_VMS_SKILL_NAME)
