import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collectPreflightBaseline } from './aio-ade-preflight-baseline.mjs'

function writeFixtureFile(root, pathSegments, content = 'export const fixture = true\n') {
  const filePath = join(root, ...pathSegments)
  mkdirSync(join(filePath, '..'), { recursive: true })
  writeFileSync(filePath, content, 'utf8')
}

describe('aio-ade preflight scope matching', () => {
  it('resolves local module specifiers against destructive-scope owned files', () => {
    const root = mkdtempSync(join(tmpdir(), 'aio ade scope matching '))
    try {
      writeFixtureFile(root, ['package.json'], '{"name":"fixture","version":"1.0.0"}\n')
      writeFixtureFile(root, ['src', 'cli', 'launcher.ts'])
      writeFixtureFile(
        root,
        ['src', 'feature', 'consumer.ts'],
        "import '../cli/launcher'\nexport const consumer = true\n"
      )

      const result = collectPreflightBaseline({
        repoRoot: root,
        commandRunner: () => '1.0.0\n'
      })
      const productCli = result.scopes.find(({ id }) => id === 'product-cli')

      expect(productCli.matchedPaths).toEqual(['src/cli/launcher.ts'])
      expect(productCli.reverseImportPaths).toEqual(['src/feature/consumer.ts'])
      expect(productCli.couplingReferences).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('covers Phase 04 roster stewards and reports cross-phase ownership overlaps', () => {
    const root = mkdtempSync(join(tmpdir(), 'aio ade roster matching '))
    try {
      writeFixtureFile(root, ['package.json'], '{"name":"fixture","version":"1.0.0"}\n')
      writeFixtureFile(root, ['src', 'shared', 'types.ts'])
      writeFixtureFile(root, ['src', 'shared', 'tui-agent-config.ts'])
      writeFixtureFile(root, ['src', 'main', 'codex-cli', 'command.ts'])
      writeFixtureFile(root, ['src', 'main', 'runtime', 'claude-agent-teams-service.ts'])

      const result = collectPreflightBaseline({
        repoRoot: root,
        commandRunner: () => '1.0.0\n'
      })
      const roster = result.scopes.find(({ id }) => id === 'agent-roster')

      expect(roster.matchedPaths).toEqual([
        'src/main/codex-cli/command.ts',
        'src/main/runtime/claude-agent-teams-service.ts',
        'src/shared/tui-agent-config.ts',
        'src/shared/types.ts'
      ])
      expect(result.ownershipOverlaps).toEqual([
        {
          path: 'src/main/runtime/claude-agent-teams-service.ts',
          owners: [
            { id: 'agent-teams', ownerPhase: 3, action: 'delete' },
            { id: 'agent-roster', ownerPhase: 4, action: 'narrow' }
          ],
          effectiveOwner: { id: 'agent-teams', ownerPhase: 3, action: 'delete' }
        }
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
