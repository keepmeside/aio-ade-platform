import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectPreflightBaseline } from './aio-ade-preflight-baseline.mjs'

function makeRepository() {
  const root = mkdtempSync(join(tmpdir(), 'aio ade resolution fixture '))
  writeFixture(root, 'package.json', '{"name":"fixture","version":"1.0.0"}\n')
  return root
}

function writeFixture(root, relativePath, content) {
  const filePath = join(root, ...relativePath.split('/'))
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, content, 'utf8')
}

function collectFixture(root) {
  return collectPreflightBaseline({
    repoRoot: root,
    commandRunner: () => '1.0.0\n'
  })
}

describe('aio-ade preflight resolution contracts', () => {
  it('classifies mobile-only desktop source outside the mobile package', () => {
    const root = makeRepository()
    try {
      const mobilePath = 'src/renderer/src/components/mobile/MobilePane.tsx'
      const genericMobilePath = 'src/renderer/src/components/mobile/PhoneCarousel.tsx'
      const emulatorPath = 'src/renderer/src/components/settings/MobileEmulatorSettingsPane.tsx'
      const browserDriverPath =
        'src/renderer/src/components/browser-pane/BrowserMobileDriverOverlay.tsx'
      writeFixture(root, mobilePath, 'export const MobilePane = true\n')
      writeFixture(root, genericMobilePath, 'export const PhoneCarousel = true\n')
      writeFixture(root, emulatorPath, 'export const MobileEmulatorSettingsPane = true\n')
      writeFixture(root, browserDriverPath, 'export const BrowserMobileDriverOverlay = true\n')

      const result = collectFixture(root)
      const mobile = result.scopes.find((scope) => scope.id === 'mobile')

      expect(mobile.matchedPaths).toEqual([mobilePath, genericMobilePath])
      expect(mobile.effectiveOwnedPaths).toEqual([mobilePath, genericMobilePath])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('resolves tsconfig-style alias imports to owned files', () => {
    const root = makeRepository()
    try {
      writeFixture(
        root,
        'tsconfig.json',
        `${JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: { '@shared/*': ['mobile/shared/*'] }
          }
        })}\n`
      )
      writeFixture(root, 'mobile/shared/api.ts', 'export const api = true\n')
      writeFixture(root, 'src/feature/alias-consumer.ts', "import { api } from '@shared/api'\n")

      const result = collectFixture(root)
      const mobile = result.scopes.find((scope) => scope.id === 'mobile')

      expect(mobile.reverseImportPaths).toEqual(['src/feature/alias-consumer.ts'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('resolves JavaScript specifiers to existing TypeScript files', () => {
    const root = makeRepository()
    try {
      writeFixture(root, 'src/domain/agents/catalog.ts', 'export const agents = true\n')
      writeFixture(
        root,
        'src/feature/js-extension-consumer.ts',
        "import { agents } from '../domain/agents/catalog.js'\n"
      )

      const result = collectFixture(root)
      const agentRoster = result.scopes.find((scope) => scope.id === 'agent-roster')

      expect(agentRoster.reverseImportPaths).toEqual(['src/feature/js-extension-consumer.ts'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('resolves require.resolve specifiers to owned files', () => {
    const root = makeRepository()
    try {
      writeFixture(root, 'mobile/shared/api.ts', 'export const api = true\n')
      writeFixture(
        root,
        'src/feature/require-resolve-consumer.cjs',
        "const entry = require.resolve('../../mobile/shared/api')\nexport { entry }\n"
      )

      const result = collectFixture(root)
      const mobile = result.scopes.find((scope) => scope.id === 'mobile')

      expect(mobile.reverseImportPaths).toEqual(['src/feature/require-resolve-consumer.cjs'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('assigns overlapping paths to the earliest owner phase', () => {
    const root = makeRepository()
    const overlapPath = 'mobile/agent-team-profile-telemetry.ts'
    try {
      writeFixture(root, overlapPath, 'export const overlap = true\n')

      const result = collectFixture(root)
      const scopes = Object.fromEntries(result.scopes.map((scope) => [scope.id, scope]))
      const [overlap] = result.ownershipOverlaps

      expect(result.ownershipOverlaps).toHaveLength(1)
      expect(overlap.path).toBe(overlapPath)
      expect(overlap.owners.map(({ id, ownerPhase }) => ({ id, ownerPhase }))).toEqual([
        { id: 'mobile', ownerPhase: 2 },
        { id: 'agent-teams', ownerPhase: 3 },
        { id: 'profiles', ownerPhase: 10 },
        { id: 'telemetry-updater-release', ownerPhase: 12 }
      ])
      expect(overlap.effectiveOwner).toEqual({ id: 'mobile', ownerPhase: 2, action: 'delete' })
      expect(scopes.mobile.effectiveOwnedPaths).toEqual([overlapPath])
      expect(scopes['agent-teams'].effectiveOwnedPaths).toEqual([])
      expect(scopes.profiles.effectiveOwnedPaths).toEqual([])
      expect(scopes['telemetry-updater-release'].effectiveOwnedPaths).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
