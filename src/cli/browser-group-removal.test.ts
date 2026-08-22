/* Phase-03 carve (plans/260730-0117-aio-ade-rebrand-and-integration/phase-03).
 *
 * "Minimal agent bridge" means the CLI keeps only what the desktop actually invokes across the
 * process boundary. The browser command group — 77 commands across 8 handler groups — is the
 * largest surface with no consumer at all:
 *
 *   - nothing outside src/cli imports its handlers, specs or formatters
 *   - `orca browser` appears nowhere in the repo outside src/cli
 *   - zero shipped skill-guide references, so no agent workflow teaches it
 *   - zero e2e specs and zero reliability gates cite it
 *
 * That last point matters: dropping a group whose guides still teach it fails
 * `verify:bundled-skill-guides` inside `pnpm lint`, and worse, breaks documented agent workflows
 * silently. Browser has none, which is why it goes first and alone.
 *
 * This suite is the executable spec for the carve: it fails while the group is still registered. */
import { describe, expect, it } from 'vitest'
import { COMMAND_SPECS } from './specs'
import { HANDLER_COMMAND_KEYS } from './dispatch'
import { effectiveAllowedFlags } from './args'

const BROWSER_COMMAND_PREFIXES = ['browser', 'snapshot', 'screenshot', 'tab ', 'cookie ']

function specKeys(): string[] {
  return COMMAND_SPECS.map((spec) => spec.path.join(' '))
}

describe('phase-03 carve: the browser command group is gone', () => {
  it('registers no browser-prefixed command spec', () => {
    const remaining = specKeys().filter((key) =>
      BROWSER_COMMAND_PREFIXES.some((prefix) => key === prefix.trim() || key.startsWith(prefix))
    )

    expect(remaining).toEqual([])
  })

  it('registers no browser-prefixed handler key', () => {
    const remaining = [...HANDLER_COMMAND_KEYS].filter((key) =>
      BROWSER_COMMAND_PREFIXES.some((prefix) => key === prefix.trim() || key.startsWith(prefix))
    )

    expect(remaining).toEqual([])
  })

  it('drops the whole group rather than leaving a partial surface', () => {
    // A half-removed group is worse than either end state: help still advertises commands that
    // dispatch cannot route, and registry-parity would be the only thing catching it.
    const browserish = specKeys().filter((key) =>
      /browser|snapshot|screenshot|dialog|viewport/.test(key)
    )

    expect(browserish).toEqual([])
  })
})

describe('phase-03 carve: no leftover browser-only flag machinery', () => {
  it('advertises --page on nothing, since only browser commands targeted a page', () => {
    // The flag was allowed by exclusion ("everything except these groups"), so removing browser
    // left it silently advertised on ten unrelated commands like `serve` and `environment list`.
    // An allow-nothing result is the proof the exclusion list was retired, not just trimmed.
    const withPage = COMMAND_SPECS.filter((spec) =>
      effectiveAllowedFlags(spec).includes('page')
    ).map((spec) => spec.path.join(' '))

    expect(withPage).toEqual([])
  })
})

describe('phase-03 carve: the keep-set survives', () => {
  it.each([
    'orchestration send',
    'orchestration check',
    'orchestration ask',
    'orchestration reply',
    'orchestration worker-start',
    'orchestration dispatch',
    'terminal send',
    'terminal read',
    'terminal wait',
    'open',
    'status',
    'claude-teams',
    'agent-context',
    'agent hooks status'
  ])('keeps %s, which the orchestration preamble or a launch mode depends on', (key) => {
    expect(specKeys()).toContain(key)
    expect(HANDLER_COMMAND_KEYS.has(key)).toBe(true)
  })

  it('keeps groups whose removal is still an open scope decision', () => {
    // Linear (115 shipped guide refs), emulator and computer are deliberately NOT carved here.
    const keys = specKeys()
    expect(keys).toContain('linear issue')
    expect(keys).toContain('emulator list')
    expect(keys).toContain('computer capabilities')
  })
})
