import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type {
  SkillFreshnessInstallation,
  SkillFreshnessStatus,
  SkillInstallationTopology
} from '../../shared/skill-freshness'
import { inventorySkillFreshness } from './skill-freshness-inventory'
import { observeSkillPackage } from './skill-package-identity'
import { readGloballyUpdatableSkillLocks } from './skill-update-registration'
import { skillUpdateFailedNames } from './skill-update-outcome'

const noLocks = new Map<string, string>()

function placement(
  name: string,
  status: SkillFreshnessStatus,
  topology: SkillInstallationTopology = 'canonical-copy',
  observedGitTreeSha: string | null = null
): SkillFreshnessInstallation {
  return {
    id: `${name}-${topology}-${status}`,
    name,
    rootId: 'home-agents',
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Agent skills home',
    unresolvedPath: `/home/.agents/skills/${name}`,
    resolvedPath: `/home/.agents/skills/${name}`,
    physicalIdentity: `physical-${name}`,
    topology,
    status,
    installedReleaseRevision: 2,
    installedAppVersion: '2.0.0',
    currentReleaseRevision: 2,
    currentPackageDigest: 'current',
    currentAppVersion: '2.0.0',
    observedPackageDigest: 'current',
    observedGitTreeSha,
    errorCategory: null
  }
}

describe('skillUpdateFailedNames', () => {
  it('treats a convergent copy that is now current as landed', () => {
    expect(
      skillUpdateFailedNames(['computer-use'], [placement('computer-use', 'current')], noLocks)
    ).toEqual([])
  })

  it('reports a copy the run left outdated', () => {
    expect(
      skillUpdateFailedNames(['computer-use'], [placement('computer-use', 'outdated')], noLocks)
    ).toEqual(['computer-use'])
  })

  it('reports a half-written bundle instead of reading it as success', () => {
    // The old "still eligible?" test passed here: an unrecognized copy is not
    // eligible either, so a corrupt write looked identical to a clean update.
    expect(
      skillUpdateFailedNames(['computer-use'], [placement('computer-use', 'unrecognized')], noLocks)
    ).toEqual(['computer-use'])
  })

  it('reports an unreadable copy', () => {
    expect(
      skillUpdateFailedNames(['computer-use'], [placement('computer-use', 'inaccessible')], noLocks)
    ).toEqual(['computer-use'])
  })

  it('reports a skill the run removed outright', () => {
    expect(skillUpdateFailedNames(['computer-use'], [], noLocks)).toEqual(['computer-use'])
  })

  it('accepts a revision newer than this build ships', () => {
    // The CLI pulls from the source repo, which runs ahead of the bundled manifest.
    expect(
      skillUpdateFailedNames(['computer-use'], [placement('computer-use', 'newer-known')], noLocks)
    ).toEqual([])
  })

  it('ignores placements the update command never writes to', () => {
    expect(
      skillUpdateFailedNames(
        ['computer-use'],
        [
          placement('computer-use', 'current'),
          placement('computer-use', 'outdated', 'plugin-cache')
        ],
        noLocks
      )
    ).toEqual([])
  })

  it('fails the name when any convergent alias was left behind', () => {
    expect(
      skillUpdateFailedNames(
        ['computer-use'],
        [
          placement('computer-use', 'current'),
          placement('computer-use', 'outdated', 'provider-alias')
        ],
        noLocks
      )
    ).toEqual(['computer-use'])
  })

  it('judges each requested name independently', () => {
    expect(
      skillUpdateFailedNames(
        ['computer-use', 'linear-tickets'],
        [placement('computer-use', 'current'), placement('linear-tickets', 'outdated')],
        noLocks
      )
    ).toEqual(['linear-tickets'])
  })

  it('treats unrecognized content whose tree sha matches the lock as landed', () => {
    // Source-repo HEAD routinely runs ahead of the bundled registry; the lock is
    // the CLI's own record of what it wrote.
    expect(
      skillUpdateFailedNames(
        ['computer-use'],
        [placement('computer-use', 'unrecognized', 'canonical-copy', 'ahead-of-bundle')],
        new Map([['computer-use', 'ahead-of-bundle']])
      )
    ).toEqual([])
  })

  it('still reports unrecognized content whose bytes do not match the lock', () => {
    expect(
      skillUpdateFailedNames(
        ['computer-use'],
        [placement('computer-use', 'unrecognized', 'canonical-copy', 'half-written-bytes')],
        new Map([['computer-use', 'ahead-of-bundle']])
      )
    ).toEqual(['computer-use'])
  })

  it('still reports unrecognized content when the skill has no lock entry', () => {
    expect(
      skillUpdateFailedNames(
        ['computer-use'],
        [placement('computer-use', 'unrecognized', 'canonical-copy', 'ahead-of-bundle')],
        noLocks
      )
    ).toEqual(['computer-use'])
  })

  it('never forgives an outdated copy, even at the lock hash', () => {
    // Lock == disk on an outdated copy means the command provably wrote nothing.
    expect(
      skillUpdateFailedNames(
        ['computer-use'],
        [placement('computer-use', 'outdated', 'canonical-copy', 'locked-revision')],
        new Map([['computer-use', 'locked-revision']])
      )
    ).toEqual(['computer-use'])
  })

  it('does not let a lock-matching canonical copy excuse a degraded alias', () => {
    expect(
      skillUpdateFailedNames(
        ['computer-use'],
        [
          placement('computer-use', 'unrecognized', 'canonical-copy', 'ahead-of-bundle'),
          placement('computer-use', 'inaccessible', 'provider-alias')
        ],
        new Map([['computer-use', 'ahead-of-bundle']])
      )
    ).toEqual(['computer-use'])
  })
})

describe('skillUpdateFailedNames over a real inventory', () => {
  const fixtureSkillName = 'orca-per-workspace-env'
  const repoRoot = resolve(__dirname, '..', '..', '..')
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
    )
  })

  async function postCutFixture(): Promise<{ homeDir: string; installedTreeSha: string }> {
    const root = await mkdtemp(join(tmpdir(), 'orca-skill-outcome-'))
    temporaryDirectories.push(root)
    const homeDir = join(root, 'home')
    const skillDir = join(homeDir, '.agents', 'skills', fixtureSkillName)
    await mkdir(skillDir, { recursive: true })
    // Current bytes plus one upstream edit: content no snapshot in this build's
    // registry has ever seen, exactly what `skills update` installs after the
    // source repo moves past the release cut.
    const current = await readFile(join(repoRoot, 'skills', fixtureSkillName, 'SKILL.md'))
    await writeFile(
      join(skillDir, 'SKILL.md'),
      Buffer.concat([current, Buffer.from('\nUpstream edit published after this build.\n')])
    )
    return { homeDir, installedTreeSha: (await observeSkillPackage(skillDir)).observedGitTreeSha }
  }

  async function writeLock(homeDir: string, skillFolderHash: string): Promise<void> {
    await writeFile(
      join(homeDir, '.agents', '.skill-lock.json'),
      JSON.stringify({
        version: 3,
        skills: {
          [fixtureSkillName]: {
            skillFolderHash,
            skillPath: `skills/${fixtureSkillName}`,
            source: 'github.com/stablyai/orca'
          }
        }
      })
    )
  }

  it('accepts post-cut source content when the lock records exactly those bytes', async () => {
    const { homeDir, installedTreeSha } = await postCutFixture()
    await writeLock(homeDir, installedTreeSha)

    const inventory = await inventorySkillFreshness({
      currentAppVersion: 'test',
      homeDir,
      resourceRoot: join(repoRoot, 'resources'),
      repos: []
    })
    const locks = await readGloballyUpdatableSkillLocks({ homeDir })

    // Guard the premise: no snapshot knows these bytes, so recognition can only
    // come from the lock — the scan now reclassifies that match to 'newer-known'
    // (the #11220 scan half), and the verdict accepts it either way.
    const canonical = inventory.installations.filter(
      (entry) => entry.name === fixtureSkillName && entry.topology === 'canonical-copy'
    )
    expect(canonical).toHaveLength(1)
    expect(canonical[0].status).toBe('newer-known')
    expect(canonical[0].installedReleaseRevision).toBeNull()

    expect(skillUpdateFailedNames([fixtureSkillName], inventory.installations, locks)).toEqual([])
  })

  it('keeps failing the same content when the lock names different bytes', async () => {
    const { homeDir } = await postCutFixture()
    await writeLock(homeDir, 'f'.repeat(40))

    const inventory = await inventorySkillFreshness({
      currentAppVersion: 'test',
      homeDir,
      resourceRoot: join(repoRoot, 'resources'),
      repos: []
    })
    const locks = await readGloballyUpdatableSkillLocks({ homeDir })

    expect(skillUpdateFailedNames([fixtureSkillName], inventory.installations, locks)).toEqual([
      fixtureSkillName
    ])
  })
})
