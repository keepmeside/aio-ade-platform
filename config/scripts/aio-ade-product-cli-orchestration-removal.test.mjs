import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const REMOVED_PRODUCT_SURFACES = [
  'src/cli',
  'src/main/cli',
  'src/main/runtime/orchestration',
  'src/main/startup/packaged-cli-entry-redirect.ts',
  'src/main/startup/serve-desktop-activation.ts',
  'src/shared/claude-agent-teams-tmux-compat.ts',
  'src/shared/orchestration-rpc-contract.ts',
  'native/windows-cli-launcher/OrcaCliLauncher.cs',
  'resources/darwin/bin/orca',
  'resources/linux/bin/orca-ide',
  'resources/win32/bin/orca.cmd',
  'skill-guides/orca-cli.md',
  'skill-guides/orchestration.md',
  'skills/orca-cli/SKILL.md',
  'skills/orchestration/SKILL.md',
  'docs/reference/headless-linux-server.md'
]

const PRESERVED_RUNTIME_SURFACES = [
  'src/main/ipc/pty.ts',
  'src/main/providers/ssh-pty-provider.ts',
  'src/shared/remote-runtime-client.ts',
  'src/main/runtime/runtime-rpc.ts',
  'src/main/runtime/rpc/methods/worktree.ts',
  'src/main/emulator/serve-sim-execution.ts',
  'src/renderer/src/components/terminal-pane/pty-connection.ts',
  'tests/e2e/helpers/local-runtime-rpc-client.ts',
  'tests/e2e/local-worktree-visibility-runtime-active.spec.ts'
]

const REMOVED_UNREACHABLE_AGENT_SKILL_SURFACES = [
  'skill-guides/computer-use.md',
  'skill-guides/linear-tickets.md',
  'skill-guides/orca-linear.md',
  'skill-stubs/computer-use.md',
  'skill-stubs/linear-tickets.md',
  'skill-stubs/orca-linear.md',
  'skills/computer-use',
  'skills/linear-tickets',
  'skills/orca-linear',
  'src/renderer/src/components/settings/ComputerUseSkillSetupPanel.tsx',
  'src/renderer/src/components/settings/LinearAgentSkillPane.tsx',
  'src/renderer/src/components/settings/linear-agent-skill-install-cta.tsx',
  'src/renderer/src/components/sidebar/LinearAgentSkillSetupDialog.tsx',
  'src/renderer/src/components/sidebar/LinearAgentSkillSetupPrompt.tsx',
  'src/renderer/src/components/sidebar/linear-agent-skill-runtime.ts',
  'src/renderer/src/components/sidebar/linear-agent-skill-setup-copy.ts',
  'src/renderer/src/components/sidebar/linear-agent-skill-setup-reminder-toast.ts',
  'src/renderer/src/components/sidebar/linear-agent-skill-setup-reminders.ts',
  'src/renderer/src/components/settings/linear-agent-skill-search.ts',
  'src/renderer/src/lib/agent-skill-nav-install-status.ts',
  'src/renderer/src/lib/linear-agent-skill-update-command.ts',
  'src/renderer/src/lib/linear-usage-examples.ts'
]

const RETAINED_NATIVE_AGENT_FEATURE_SURFACES = [
  'src/renderer/src/components/settings/ComputerUsePane.tsx',
  'src/renderer/src/components/settings/task-tracker-integration-cards.tsx',
  'src/renderer/src/components/LinearIssueWorkspace.tsx',
  'src/main/runtime/rpc/methods/linear-agent-access.ts'
]

const AGENT_SKILL_REFERENCE_FILES = [
  'resources/skills/current-manifest.json',
  'src/shared/agent-feature-install-commands.ts',
  'src/renderer/src/components/feature-wall/AgentCapabilitiesSetupAction.tsx',
  'src/renderer/src/components/feature-wall/agent-capability-setup-status.ts',
  'src/renderer/src/components/onboarding/AgentFeatureSetupStep.tsx',
  'src/renderer/src/components/onboarding/FeatureSetupChecklist.tsx',
  'src/renderer/src/components/onboarding/onboarding-feature-setup.ts',
  'src/renderer/src/components/settings/ComputerUsePane.tsx',
  'src/renderer/src/components/settings/Settings.tsx',
  'src/renderer/src/components/settings/task-tracker-integration-cards.tsx',
  'src/renderer/src/components/sidebar/WorktreeCard.tsx'
]

const FORBIDDEN_AGENT_SKILL_REFERENCES = [
  'COMPUTER_USE_SKILL_',
  'LINEAR_AGENT_SKILL_NAMES',
  'LINEAR_TICKETS_SKILL_',
  'ORCA_LINEAR_SKILL_',
  'ComputerUseSkillSetupPanel',
  'LinearAgentSkill',
  'FeatureSetupInlineTerminal',
  'Install Agent Skills',
  'Linear agent skill',
  '/orca-linear',
  '"name": "computer-use"',
  '"name": "linear-tickets"',
  '"name": "orca-linear"'
]

const HISTORICAL_AGENT_SKILL_NAMES = ['computer-use', 'linear-tickets', 'orca-linear']
const HISTORICAL_AGENT_SKILL_MAX_REVISIONS = {
  'computer-use': 8,
  'linear-tickets': 10,
  'orca-linear': 8
}

const PRODUCT_REFERENCE_FILES = [
  'package.json',
  'config/electron-builder.config.cjs',
  'Casks/orca.rb',
  'Casks/orca@rc.rb',
  'src/main/index.ts',
  'src/main/ipc/pty.ts',
  'src/main/linear/issue-context-workspaces.ts',
  'src/main/linear/issue-context.ts',
  'src/main/runtime/rpc/methods/linear-agent-access.ts',
  'src/main/runtime/orca-runtime.ts',
  'src/preload/api-types.ts',
  'src/preload/index.ts',
  'native/computer-use-macos/Sources/OrcaComputerUseMacOS/main.swift',
  'src/renderer/src/components/feature-wall/FeatureWallBrowserAction.tsx',
  'src/renderer/src/components/onboarding/AgentFeatureSetupStep.tsx',
  'src/renderer/src/components/settings/BrowserUseExamples.tsx',
  'src/renderer/src/components/settings/Settings.tsx',
  'src/renderer/src/components/terminal-pane/terminal-handle-links.ts',
  'src/shared/feature-interaction-catalog.ts'
]

const FORBIDDEN_PRODUCT_REFERENCES = [
  'Install CLI',
  'Orca CLI',
  'window.api.cli',
  'ORCA_AGENT_TEAMS',
  'orca computer permissions',
  'orca linear ',
  '--workspace',
  '--repo',
  '--setup run',
  '--run-hooks',
  '--parent-worktree',
  '--no-parent',
  '--current',
  '--team',
  '--parent-current',
  '--write-id',
  "origin: 'cli'",
  "capture: { source: 'explicit-cli-flag'",
  'orca serve',
  'orca orchestration',
  'orchestration.dispatchShow',
  'Resources/bin/orca'
]

describe('aio-ade product CLI and orchestration removal contract', () => {
  it('removes representative CLI, Agent Teams, orchestration, serve, and shim surfaces', () => {
    expect(REMOVED_PRODUCT_SURFACES.filter((path) => existsSync(resolve(path)))).toEqual([])
  })

  it('preserves generic PTY, SSH, emulator, worktree, and remote runtime surfaces', () => {
    expect(PRESERVED_RUNTIME_SURFACES.filter((path) => !existsSync(resolve(path)))).toEqual([])
  })

  it('removes unreachable Computer Use and Linear agent skill packages and install surfaces', () => {
    expect(
      REMOVED_UNREACHABLE_AGENT_SKILL_SURFACES.filter((path) => existsSync(resolve(path)))
    ).toEqual([])
  })

  it('preserves native Computer Use and Linear runtime surfaces', () => {
    expect(
      RETAINED_NATIVE_AGENT_FEATURE_SURFACES.filter((path) => !existsSync(resolve(path)))
    ).toEqual([])
  })

  it('keeps current bundles and live UI free of removed agent skill install guidance', () => {
    for (const path of AGENT_SKILL_REFERENCE_FILES) {
      const content = readFileSync(resolve(path), 'utf8')
      for (const reference of FORBIDDEN_AGENT_SKILL_REFERENCES) {
        expect(content, `${path} should not include ${reference}`).not.toContain(reference)
      }
    }
  })

  it('keeps removed skill history readable while excluding it from the current bundle', () => {
    const currentManifest = JSON.parse(
      readFileSync(resolve('resources/skills/current-manifest.json'), 'utf8')
    )
    const snapshotRegistry = JSON.parse(
      readFileSync(resolve('resources/skills/snapshot-registry.json'), 'utf8')
    )
    const releaseMapping = JSON.parse(
      readFileSync(resolve('resources/skills/release-mapping.json'), 'utf8')
    )
    const currentNames = new Set(currentManifest.skills.map((skill) => skill.name))
    for (const name of HISTORICAL_AGENT_SKILL_NAMES) {
      expect(currentNames).not.toContain(name)
      const snapshots = snapshotRegistry.skills[name]
      expect(snapshots?.length, `${name} history should remain readable`).toBeGreaterThan(0)
      const mappedMax = Math.max(
        ...releaseMapping.releases
          .map((release) => release.skills?.[name])
          .filter((revision) => Number.isInteger(revision))
      )
      expect(mappedMax).toBe(HISTORICAL_AGENT_SKILL_MAX_REVISIONS[name])
      expect(snapshots.at(-1).releaseRevision).toBe(mappedMax)
    }
  })

  it('keeps representative manifests and executable surfaces free of product commands', () => {
    for (const path of PRODUCT_REFERENCE_FILES) {
      const content = readFileSync(resolve(path), 'utf8')
      for (const reference of FORBIDDEN_PRODUCT_REFERENCES) {
        expect(content).not.toContain(reference)
      }
    }
  })
})
