import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const fixtureRoot = resolve('tests/fixtures/aio-ade-migration')

function readFixture(name) {
  return JSON.parse(readFileSync(resolve(fixtureRoot, name), 'utf8'))
}

function hashHexChunks(chunks) {
  const hash = createHash('sha256')
  for (const chunk of chunks) {
    expect(chunk.hex).toMatch(/^(?:[0-9a-f]{2})+$/)
    hash.update(Buffer.from(chunk.hex, 'hex'))
  }
  return hash.digest('hex')
}

function expectNoPrivateData(fixture) {
  const serialized = JSON.stringify(fixture)
  expect(serialized).not.toMatch(/(?:api[_-]?key|password|refresh[_-]?token|secret)/i)
  expect(serialized).not.toMatch(/[A-Za-z]:\\|\/(?:Users|home)\//)
}

describe('aio-ade migration fixtures', () => {
  it('locks a raw-byte terminal oracle and Claude Fable launch contract', () => {
    const fixture = readFixture('terminal-oracle.json')

    expect(fixture.schemaVersion).toBe('aio-ade-terminal-oracle/v1')
    expect(fixture.launch).toMatchObject({
      agent: 'claude',
      model: 'fable',
      argv: ['--model', 'fable']
    })
    expect(fixture.launch.workspaceKinds).toEqual(['worktree', 'folder'])
    expect(fixture.launch.transports).toEqual(['local', 'wsl', 'ssh'])
    expect(fixture.actions.map(({ kind }) => kind)).toEqual([
      'write',
      'hide',
      'resize',
      'reveal',
      'paste',
      'ime',
      'disconnect',
      'reconnect'
    ])
    expect(fixture.actions.map(({ seq }) => seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(fixture.actions).toMatchObject([
      {
        payload: { text: 'fable\r', encoding: 'utf8' },
        expected: { ptyWriteHex: '6661626c650d', chunkSeqs: [1, 2, 3, 4] }
      },
      {
        payload: { visibility: 'hidden' },
        expected: { ptyAttached: true, chunkSeqs: [] }
      },
      {
        payload: { rows: 32, cols: 120 },
        expected: { lastResize: { rows: 32, cols: 120 }, chunkSeqs: [] }
      },
      {
        payload: { visibility: 'visible', requestSnapshot: true },
        expected: { snapshotRestored: true, chunkSeqs: [5, 6] }
      },
      {
        payload: { text: 'paste\n', bracketed: true },
        expected: { ptyWriteHex: '1b5b3230307e70617374650a1b5b3230317e', chunkSeqs: [7] }
      },
      {
        payload: { composition: 'xin chao', commit: 'xin chao' },
        expected: { ptyWriteHex: '78696e206368616f', chunkSeqs: [] }
      },
      {
        payload: { transport: 'ssh', reason: 'network-loss' },
        expected: { sessionState: 'reconnecting', chunkSeqs: [] }
      },
      {
        payload: { transport: 'ssh', replayFromSeq: 4 },
        expected: { historyStartSeq: 4, singleExitRecord: true, chunkSeqs: [8] }
      }
    ])
    expect(fixture.contracts).toEqual(
      expect.arrayContaining([
        'raw-bytes',
        'alternate-screen',
        'osc-10-11',
        'kitty-keyboard',
        'paste',
        'ime',
        'reconnect-history'
      ])
    )
    expect(fixture.chunks.map(({ seq }) => seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    for (const action of fixture.actions) {
      expect(
        fixture.chunks.filter(({ actionSeq }) => actionSeq === action.seq).map(({ seq }) => seq)
      ).toEqual(action.expected.chunkSeqs)
    }
    expect(hashHexChunks(fixture.chunks)).toBe(fixture.streamSha256)
    expect(fixture.expected).toEqual({
      reconnectAuthority: 'sidecar',
      replayCursor: 4,
      resize: { rows: 32, cols: 120 },
      preserveInvalidUtf8: true,
      singleExitRecord: true
    })
    expectNoPrivateData(fixture)
  })

  it('locks a secret-free legacy state migration contract', () => {
    const fixture = readFixture('legacy-state.json')

    expect(fixture.schemaVersion).toBe('aio-ade-legacy-state/v1')
    expect(fixture.legacyBrand).toBe('Orca')
    expect(fixture.canonicalBrand).toBe('aio-ade')
    expect(fixture.compatibility.termProgram).toBe('Orca')
    expect(fixture.persistedSettings.terminal).toMatchObject({
      restoreScrollback: true,
      rows: 24,
      cols: 80
    })
    expect(fixture.migration).toMatchObject({
      retainedProviderIds: ['claude', 'codex'],
      removedProviderIds: ['gemini', 'opencode']
    })
    const providerIds = [
      ...fixture.migration.retainedProviderIds,
      ...fixture.migration.removedProviderIds
    ].sort()
    for (const providerMap of Object.values(fixture.providerKeyedState)) {
      expect(Object.keys(providerMap).sort()).toEqual(providerIds)
    }
    expect(fixture.providerKeyedState.rpcPayloads).toMatchObject({
      gemini: { agent: 'gemini', model: 'gemini-2.5-pro' },
      opencode: { agent: 'opencode', model: 'legacy-default' }
    })
    expect(fixture.providerKeyedState.savedSessions).toMatchObject({
      gemini: ['stale-gemini-session'],
      opencode: ['stale-opencode-session']
    })
    expectNoPrivateData(fixture)
  })
})
