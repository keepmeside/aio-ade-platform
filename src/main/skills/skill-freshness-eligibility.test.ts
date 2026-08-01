import { describe, expect, it } from 'vitest'
import {
  buildTargetedSkillUpdateCommand,
  type SkillFreshnessInstallation
} from '../../shared/skill-freshness'
import { eligibleSkillUpdateNames } from './skill-freshness-eligibility'

const globallyUpdatableNames = new Set(['computer-use', 'sample-skill', 'control-skill'])

function eligible(installations: SkillFreshnessInstallation[]): string[] {
  return eligibleSkillUpdateNames(installations, globallyUpdatableNames)
}

function placement(
  name: string,
  overrides: Partial<SkillFreshnessInstallation> = {}
): SkillFreshnessInstallation {
  return {
    id: `${name}-${overrides.rootId ?? 'home-agents'}`,
    name,
    rootId: 'home-agents',
    providers: ['agent-skills'],
    sourceKind: 'home',
    sourceLabel: 'Agent skills home',
    unresolvedPath: `/home/.agents/skills/${name}`,
    resolvedPath: `/home/.agents/skills/${name}`,
    physicalIdentity: `physical-${name}`,
    topology: 'canonical-copy',
    status: 'outdated',
    installedReleaseRevision: 1,
    installedAppVersion: '1.0.0',
    currentReleaseRevision: 2,
    currentPackageDigest: 'current',
    currentAppVersion: '2.0.0',
    observedPackageDigest: 'old',
    errorCategory: null,
    ...overrides
  }
}

describe('skill freshness name-scoped update eligibility', () => {
  it('offers a name when at least one supported placement is outdated and all are official', () => {
    expect(
      eligible([
        placement('sample-skill'),
        placement('sample-skill', {
          id: 'sample-skill-claude',
          rootId: 'home-claude',
          topology: 'provider-alias',
          status: 'current'
        })
      ])
    ).toEqual(['sample-skill'])
  })

  it.each([
    ['newer-known', 'independent-copy'],
    ['unrecognized', 'independent-copy'],
    ['inaccessible', 'broken-link'],
    ['current', 'external-link'],
    ['current', 'read-only'],
    ['current', 'repo-scope'],
    ['current', 'plugin-cache']
  ] as const)(
    'still updates the canonical copy despite a %s placement in %s topology',
    (status, topology) => {
      // Why: `--global` provably never writes these placements, so withholding the
      // update over one refuses work the command could do to a copy that is never at
      // stake. The canonical copy converges and the outlier is reported separately.
      expect(
        eligible([
          placement('sample-skill'),
          placement('sample-skill', { id: `outlier-${status}-${topology}`, status, topology })
        ])
      ).toEqual(['sample-skill'])
    }
  )

  it.each(['unrecognized', 'inaccessible', 'newer-known'] as const)(
    'withholds the update when the convergent copy itself is %s',
    (status) => {
      // Why: this is the placement the command writes to, so overwriting it is the
      // real data-loss case the rail exists to avoid.
      expect(
        eligible([
          placement('sample-skill', { id: 'blocked-canonical', status }),
          placement('sample-skill', {
            id: 'sample-skill-claude',
            rootId: 'home-claude',
            topology: 'provider-alias',
            status: 'outdated'
          })
        ])
      ).toEqual([])
    }
  )

  it('still updates the canonical copy when a clean standalone duplicate exists', () => {
    // Why: a duplicate no longer omits the whole name — the canonical copy converges
    // and the duplicate row is flagged as maybe-not-reached rather than blocking.
    expect(
      eligible([
        placement('sample-skill'),
        placement('sample-skill', {
          id: 'sample-skill-gemini',
          rootId: 'home-gemini',
          unresolvedPath: '/home/.gemini/skills/sample-skill',
          resolvedPath: '/home/.gemini/skills/sample-skill',
          topology: 'independent-copy',
          status: 'current'
        })
      ])
    ).toEqual(['sample-skill'])
  })

  it('does not promise an update when only an unreachable duplicate is outdated', () => {
    // Why: `--global` converges the canonical copy and its aliases only. Offering the
    // name here advertises an update the command reports as already up to date, so the
    // badge could never clear; the dialog explains the duplicate as skipped instead.
    expect(
      eligible([
        placement('control-skill', { status: 'current' }),
        placement('control-skill', {
          id: 'control-skill-factory',
          rootId: 'home-factory',
          unresolvedPath: '/home/.factory/skills/control-skill',
          resolvedPath: '/home/.factory/skills/control-skill',
          physicalIdentity: 'physical-control-skill-factory',
          topology: 'independent-copy',
          status: 'outdated'
        })
      ])
    ).toEqual([])
  })

  it('does not offer a skill that exists only as a standalone copy', () => {
    // Why: with no canonical or alias to anchor `--global`, the command has no
    // reliable target, so a duplicate-only skill stays unoffered.
    expect(
      eligible([
        placement('sample-skill', {
          rootId: 'home-gemini',
          unresolvedPath: '/home/.gemini/skills/sample-skill',
          resolvedPath: '/home/.gemini/skills/sample-skill',
          topology: 'independent-copy',
          status: 'outdated'
        })
      ])
    ).toEqual([])
  })

  it('scopes each name independently and leaves an all-current name alone', () => {
    // Why: a project copy is never written by `--global`, so it does not speak for
    // the global one — while a name whose convergent copy is current stays unoffered.
    expect(
      eligible([
        placement('computer-use', { status: 'current' }),
        placement('control-skill'),
        placement('control-skill', {
          id: 'control-skill-project',
          status: 'unrecognized',
          topology: 'repo-scope'
        })
      ])
    ).toEqual(['control-skill'])
  })

  it('does not offer an official canonical copy missing from the updater lock (#10791)', () => {
    expect(eligibleSkillUpdateNames([placement('sample-skill')], new Set())).toEqual([])
  })

  it('builds only an explicit, deterministic global command', () => {
    expect(buildTargetedSkillUpdateCommand(['control-skill', 'sample-skill', 'sample-skill'])).toBe(
      'npx skills update control-skill sample-skill --global'
    )
    expect(buildTargetedSkillUpdateCommand([])).toBeNull()
    expect(buildTargetedSkillUpdateCommand(['sample-skill;echo unsafe'])).toBeNull()
  })
})
