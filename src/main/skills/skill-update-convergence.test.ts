import { describe, expect, it } from 'vitest'
import type { SkillFreshnessInstallation, SkillKnownSnapshot } from '../../shared/skill-freshness'
import { convergableSkillNames } from './skill-update-convergence'

function placement(
  name: string,
  observedPackageDigest: string | null,
  topology: SkillFreshnessInstallation['topology'] = 'canonical-copy'
): SkillFreshnessInstallation {
  return {
    id: `${name}:${observedPackageDigest}:${topology}`,
    name,
    rootId: 'home',
    providers: [],
    sourceKind: 'home',
    sourceLabel: 'home',
    unresolvedPath: `~/.agents/skills/${name}`,
    resolvedPath: `/home/u/.agents/skills/${name}`,
    physicalIdentity: '1:1',
    topology,
    status: 'outdated',
    installedReleaseRevision: null,
    installedAppVersion: null,
    currentReleaseRevision: 8,
    currentPackageDigest: 'digest-current',
    currentAppVersion: '1.4.160',
    observedPackageDigest,
    errorCategory: null
  }
}

function revision(packageDigest: string, gitTreeSha: string): SkillKnownSnapshot {
  return { releaseRevision: 1, packageDigest, gitTreeSha, files: [] }
}

describe('convergableSkillNames', () => {
  // The real reported case: the lock records the stub tree (091d9bcc) while disk
  // still holds the pre-stub revision (f3727995). `skills update` compares lock to
  // source, sees no work, exits 0 and writes nothing — forever.
  it('drops a skill whose lock records a revision the disk does not have', () => {
    const result = convergableSkillNames(
      [placement('aio-ade-linear', 'digest-pre-stub')],
      new Map([['aio-ade-linear', '091d9bcc']]),
      {
        'aio-ade-linear': [
          revision('digest-pre-stub', 'f3727995'),
          revision('digest-stub', '091d9bcc')
        ]
      }
    )
    expect([...result]).toEqual([])
  })

  // The legitimate case that must NOT be gated: lock and disk agree, and the source
  // has simply moved ahead of what this build bundles. The update really can converge.
  it('keeps a skill whose lock matches disk even when it is outdated', () => {
    const result = convergableSkillNames(
      [placement('aio-ade-cli', 'digest-installed')],
      new Map([['aio-ade-cli', 'aaaa1111']]),
      { 'aio-ade-cli': [revision('digest-installed', 'aaaa1111')] }
    )
    expect([...result]).toEqual(['aio-ade-cli'])
  })

  it('keeps a skill whose disk content matches no known revision', () => {
    const result = convergableSkillNames(
      [placement('aio-ade-cli', 'digest-unknown')],
      new Map([['aio-ade-cli', 'aaaa1111']]),
      { 'aio-ade-cli': [revision('digest-other', 'bbbb2222')] }
    )
    expect([...result]).toEqual(['aio-ade-cli'])
  })

  it('keeps a skill with no observable placement', () => {
    const result = convergableSkillNames(
      [placement('aio-ade-cli', null)],
      new Map([['aio-ade-cli', 'aaaa1111']]),
      { 'aio-ade-cli': [revision('digest-installed', 'aaaa1111')] }
    )
    expect([...result]).toEqual(['aio-ade-cli'])
  })

  // One placement still matching the lock means the command has an anchor to write.
  it('keeps a skill when any placement still matches the lock', () => {
    const result = convergableSkillNames(
      [placement('aio-ade-cli', 'digest-installed'), placement('aio-ade-cli', 'digest-pre-stub')],
      new Map([['aio-ade-cli', 'aaaa1111']]),
      {
        'aio-ade-cli': [
          revision('digest-installed', 'aaaa1111'),
          revision('digest-pre-stub', 'f3727995')
        ]
      }
    )
    expect([...result]).toEqual(['aio-ade-cli'])
  })

  // A lock hash we cannot place is not evidence the command is stuck.
  it('keeps a skill whose lock names no revision we know', () => {
    const result = convergableSkillNames(
      [placement('aio-ade-cli', 'digest-pre-stub')],
      new Map([['aio-ade-cli', 'not-a-known-tree']]),
      { 'aio-ade-cli': [revision('digest-pre-stub', 'f3727995')] }
    )
    expect([...result]).toEqual(['aio-ade-cli'])
  })

  // Why: `diskTreeShas` silently drops digests that match no known revision, so a
  // stale copy sitting beside an unidentifiable one must NOT gate the name — the
  // unknown half could be anything, including a copy the command would converge.
  it('keeps a skill when one placement is stale but another is unidentifiable', () => {
    const result = convergableSkillNames(
      [placement('aio-ade-cli', 'digest-pre-stub'), placement('aio-ade-cli', 'digest-unknown')],
      new Map([['aio-ade-cli', '091d9bcc']]),
      {
        'aio-ade-cli': [
          revision('digest-pre-stub', 'f3727995'),
          revision('digest-stub', '091d9bcc')
        ]
      }
    )
    expect([...result]).toEqual(['aio-ade-cli'])
  })

  // Why: copies the command never writes must not defeat the gate. An
  // unidentifiable plugin-cache repack would otherwise read as an unresolved
  // placement and re-arm the unwinnable update on the drifted canonical.
  it('ignores an unidentifiable plugin-cache copy when judging the canonical', () => {
    const result = convergableSkillNames(
      [
        placement('aio-ade-linear', 'digest-pre-stub'),
        placement('aio-ade-linear', 'digest-cache-repack', 'plugin-cache')
      ],
      new Map([['aio-ade-linear', '091d9bcc']]),
      {
        'aio-ade-linear': [
          revision('digest-pre-stub', 'f3727995'),
          revision('digest-stub', '091d9bcc')
        ]
      }
    )
    expect([...result]).toEqual([])
  })

  // A cache copy parked at the lock's own revision is not an anchor either —
  // the command only writes the canonical, which is still drifted.
  it('ignores a plugin-cache copy that matches the lock', () => {
    const result = convergableSkillNames(
      [
        placement('aio-ade-linear', 'digest-pre-stub'),
        placement('aio-ade-linear', 'digest-stub', 'plugin-cache')
      ],
      new Map([['aio-ade-linear', '091d9bcc']]),
      {
        'aio-ade-linear': [
          revision('digest-pre-stub', 'f3727995'),
          revision('digest-stub', '091d9bcc')
        ]
      }
    )
    expect([...result]).toEqual([])
  })

  it('judges each locked skill independently', () => {
    const result = convergableSkillNames(
      [
        placement('aio-ade-linear', 'digest-pre-stub'),
        placement('aio-ade-cli', 'digest-installed')
      ],
      new Map([
        ['aio-ade-linear', '091d9bcc'],
        ['aio-ade-cli', 'aaaa1111']
      ]),
      {
        'aio-ade-linear': [
          revision('digest-pre-stub', 'f3727995'),
          revision('digest-stub', '091d9bcc')
        ],
        'aio-ade-cli': [revision('digest-installed', 'aaaa1111')]
      }
    )
    expect([...result]).toEqual(['aio-ade-cli'])
  })
})
