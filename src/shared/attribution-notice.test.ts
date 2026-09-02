import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/* Attribution guard. The MIT License grants redistribution only on the condition that the
 * upstream copyright notice travels with the software, so losing this line during a rebrand is a
 * licensing failure, not a cosmetic one — and nothing else in the build would fail. */

function readRepoFile(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('NOTICE', () => {
  const notice = readRepoFile('NOTICE')

  it('reproduces the upstream copyright line verbatim', () => {
    expect(notice).toContain('MIT License')
    expect(notice).toContain('Copyright (c) 2026 Lovecast Inc.')
  })

  it('states this project and its authors', () => {
    expect(notice).toContain('AIO-ADE')
    expect(notice).toContain('Keepmeside')
    expect(notice).toContain('SalyyS1')
  })

  it('records the Apache-2.0 components whose own notices must ship', () => {
    // Apache-2.0 §4(d) obligates carrying each component's NOTICE, so these entries are the
    // reminder that packaging must preserve them.
    for (const component of ['sherpa-onnx', 'agent-browser', 'serve-sim']) {
      expect(notice).toContain(component)
    }
    expect(notice).toContain('Apache-2.0')
  })

  it('does not claim a trademark the MIT grant never conveyed', () => {
    expect(notice).toContain('no trademark')
  })
})

describe('LICENSE', () => {
  it('keeps the upstream MIT text and copyright holder', () => {
    const license = readRepoFile('LICENSE')

    expect(license).toContain('MIT License')
    expect(license).toContain('Copyright (c) 2026 Lovecast Inc.')
    expect(license).toContain('THE SOFTWARE IS PROVIDED "AS IS"')
  })
})

describe('package manifest attribution', () => {
  const manifest = JSON.parse(readRepoFile('package.json')) as {
    license?: string
    author?: string
    contributors?: string[]
  }

  it('declares the license so publication tooling can read it', () => {
    expect(manifest.license).toBe('MIT')
  })

  it('names the authors of this fork', () => {
    expect(manifest.author).toBe('Keepmeside')
    expect(manifest.contributors).toEqual(['Keepmeside', 'SalyyS1'])
  })
})
