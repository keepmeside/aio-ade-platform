import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import {
  collectPreflightBaseline,
  isGitVersionCompatible,
  redactSensitiveText,
  resolveVersionCommand
} from './aio-ade-preflight-baseline.mjs'

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'aio ade preflight fixture '))
  mkdirSync(join(root, 'mobile'), { recursive: true })
  mkdirSync(join(root, 'src', 'feature'), { recursive: true })
  writeFileSync(join(root, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n', 'utf8')
  writeFileSync(join(root, 'mobile', 'screen.tsx'), 'export const screen = true\n', 'utf8')
  writeFileSync(
    join(root, 'src', 'feature', 'consumer.ts'),
    "import '../mobile/screen' // token=super-secret\n",
    'utf8'
  )
  writeFileSync(
    join(root, 'src', 'feature', 'prose.md'),
    'The mobile companion keeps the testflight checklist current.\n',
    'utf8'
  )
  writeFileSync(join(root, '.env'), 'SECRET_VALUE=do-not-report\n', 'utf8')
  return root
}

describe('aio-ade preflight baseline', () => {
  it('captures deterministic runtime data and reverse-import inventory without secrets', () => {
    const root = makeFixture()
    try {
      const commandRunner = (command) => {
        const versions = {
          pnpm: '10.24.0\n',
          git: 'git version 2.52.0.windows.1\n'
        }
        if (command === 'rustc' || command === 'cargo') {
          throw new Error('not installed')
        }
        return versions[command]
      }

      const result = collectPreflightBaseline({ repoRoot: root, commandRunner })
      const mobile = result.scopes.find((scope) => scope.id === 'mobile')

      expect(result.schemaVersion).toBe('aio-ade-preflight-baseline/v1')
      expect(result.runtime.pnpm.version).toBe('10.24.0')
      expect(result.runtime.git.version).toBe('2.52.0.windows.1')
      expect(result.runtime.rustc.status).toBe('missing')
      expect(result.runtime.cargo.status).toBe('missing')
      expect(result.gitCompatibility).toMatchObject({ minimum: '2.25.0', status: 'compatible' })
      expect(mobile.fileCount).toBe(1)
      expect(mobile.reverseImportPaths).toEqual(['src/feature/consumer.ts'])
      expect(mobile.reverseImportPaths).not.toContain('src/feature/prose.md')
      expect(mobile.couplingReferences).toEqual([
        { path: 'src/feature/consumer.ts', matchedTerms: ['mobile/'] },
        {
          path: 'src/feature/prose.md',
          matchedTerms: ['mobile companion', 'testflight']
        }
      ])

      const serialized = JSON.stringify(result)
      expect(serialized).not.toContain('super-secret')
      expect(serialized).not.toContain('do-not-report')
      expect(serialized).not.toContain(root)
      expect(serialized).not.toContain(process.env.PATH ?? '')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('sorts paths and normalizes separators across input styles', () => {
    const root = makeFixture()
    try {
      const result = collectPreflightBaseline({
        repoRoot: root.replaceAll('/', '\\'),
        commandRunner: () => '1.0.0\n'
      })
      const mobile = result.scopes.find((scope) => scope.id === 'mobile')

      expect(mobile.reverseImportPaths).toEqual(['src/feature/consumer.ts'])
      expect(mobile.reverseImportPaths.every((path) => !path.includes('\\'))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('matches leading double-star scope patterns at arbitrary directory depth', () => {
    const root = makeFixture()
    const deepScopeFiles = [
      ['src', 'main', 'runtime', 'teams', 'agent-team-worker.ts'],
      ['src', 'main', 'runtime', 'control', 'orchestration-controller.ts'],
      ['src', 'main', 'accounts', 'persisted', 'profile-state.ts'],
      ['src', 'main', 'observability', 'events', 'telemetry-client.ts']
    ]
    try {
      for (const pathSegments of deepScopeFiles) {
        const filePath = join(root, ...pathSegments)
        mkdirSync(join(filePath, '..'), { recursive: true })
        writeFileSync(filePath, 'export const fixture = true\n', 'utf8')
      }

      const result = collectPreflightBaseline({
        repoRoot: root,
        commandRunner: () => '1.0.0\n'
      })
      const scopes = Object.fromEntries(result.scopes.map((scope) => [scope.id, scope]))

      expect(scopes).toMatchObject({
        'agent-teams': {
          fileCount: 1,
          matchedPaths: ['src/main/runtime/teams/agent-team-worker.ts']
        },
        orchestration: {
          fileCount: 1,
          matchedPaths: ['src/main/runtime/control/orchestration-controller.ts']
        },
        profiles: {
          fileCount: 1,
          matchedPaths: ['src/main/accounts/persisted/profile-state.ts']
        },
        'telemetry-updater-release': {
          fileCount: 1,
          matchedPaths: ['src/main/observability/events/telemetry-client.ts']
        }
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('uses the Git 2.25 compatibility floor', () => {
    expect(isGitVersionCompatible('2.25.0')).toBe(true)
    expect(isGitVersionCompatible('git version 2.25.0')).toBe(true)
    expect(isGitVersionCompatible('2.52.0.windows.1')).toBe(true)
    expect(isGitVersionCompatible('2.24.9')).toBe(false)
    expect(isGitVersionCompatible(null)).toBe(null)
  })

  it('uses the Windows pnpm command shim without changing native executables', () => {
    expect(resolveVersionCommand('pnpm', ['--version'], 'win32', 'cmd.exe')).toEqual({
      executable: 'cmd.exe',
      args: ['/d', '/s', '/c', 'pnpm.cmd --version']
    })
    expect(resolveVersionCommand('git', ['--version'], 'win32')).toEqual({
      executable: 'git',
      args: ['--version']
    })
    expect(resolveVersionCommand('pnpm', ['--version'], 'linux')).toEqual({
      executable: 'pnpm',
      args: ['--version']
    })
  })

  it('redacts secret-like values without changing safe text', () => {
    expect(redactSensitiveText('token=abc123 password: hello')).toBe(
      'token=[REDACTED] password: [REDACTED]'
    )
    expect(redactSensitiveText('src/feature/consumer.ts')).toBe('src/feature/consumer.ts')
  })

  it('supports a spaced repository path and writes only with explicit --output', () => {
    const root = makeFixture()
    const outputPath = join(root, 'baseline report.json')
    const scriptPath = join(process.cwd(), 'config', 'scripts', 'aio-ade-preflight-baseline.mjs')
    try {
      const readOnlyRun = spawnSync(process.execPath, [scriptPath, '--repo', root], {
        cwd: process.cwd(),
        encoding: 'utf8'
      })
      expect(readOnlyRun.status, readOnlyRun.stderr).toBe(0)
      expect(readOnlyRun.stdout).toContain('aio-ade-preflight-baseline/v1')
      expect(readOnlyRun.stdout).not.toContain('baseline report.json')

      const outputRun = spawnSync(
        process.execPath,
        [scriptPath, '--repo', root, '--output', outputPath],
        {
          cwd: process.cwd(),
          encoding: 'utf8'
        }
      )
      expect(outputRun.status, outputRun.stderr).toBe(0)
      expect(JSON.parse(readFileSync(outputPath, 'utf8')).schemaVersion).toBe(
        'aio-ade-preflight-baseline/v1'
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
