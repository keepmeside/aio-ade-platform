/* Guard: headless `serve` ships feature-flagged off.
 *
 * Decision 2026-08-21: headless `serve` ships **feature-flagged OFF** in the first release. The code
 * stays — the real delete decision is deferred to phase 09, pending whether remote development is a
 * feature worth selling.
 *
 * Why an env flag rather than deleting the handler now: `serve` pulls in the runtime server,
 * pairing, the web client bundle and the update supervisor. Removing it is a large blast radius,
 * and phase 09 wants the dependency inventory before deciding. Gating at the handler keeps the
 * surface unreachable for users while leaving the code intact and measurable.
 *
 * Why the spec stays registered: `registry-parity.test.ts` asserts specs and handlers stay in
 * lockstep, so removing the spec while keeping the handler would fail that guard. The command
 * remains discoverable in help and fails with a clear reason instead of vanishing. */
import { describe, expect, it } from 'vitest'
import { CORE_HANDLERS } from './core'
import { COMMAND_SPECS } from '../specs'
import { HANDLER_COMMAND_KEYS } from '../dispatch'
import { SERVE_DISABLED_MESSAGE, isServeEnabled } from '../serve-feature-flag'

const ORIGINAL = process.env.AIO_ADE_ENABLE_SERVE

function withServeEnv<T>(value: string | undefined, fn: () => T): T {
  if (value === undefined) {
    delete process.env.AIO_ADE_ENABLE_SERVE
  } else {
    process.env.AIO_ADE_ENABLE_SERVE = value
  }
  try {
    return fn()
  } finally {
    if (ORIGINAL === undefined) {
      delete process.env.AIO_ADE_ENABLE_SERVE
    } else {
      process.env.AIO_ADE_ENABLE_SERVE = ORIGINAL
    }
  }
}

describe('serve is feature-flagged off by default', () => {
  it('reports disabled when the flag is unset', () => {
    expect(withServeEnv(undefined, isServeEnabled)).toBe(false)
  })

  it.each(['1', 'true', 'TRUE'])('reports enabled for opt-in value %s', (value) => {
    expect(withServeEnv(value, isServeEnabled)).toBe(true)
  })

  it.each(['0', 'false', '', 'yes-please'])('stays disabled for value %s', (value) => {
    // Fail closed: only explicit, recognized opt-in values enable a surface we do not support yet.
    expect(withServeEnv(value, isServeEnabled)).toBe(false)
  })

  it('rejects the serve command with an actionable reason when disabled', async () => {
    const handler = CORE_HANDLERS.serve
    expect(handler).toBeTruthy()

    await expect(
      withServeEnv(undefined, () =>
        handler!({
          client: null as never,
          flags: new Map(),
          json: false,
          args: []
        } as never)
      )
    ).rejects.toThrow(SERVE_DISABLED_MESSAGE)
  })

  it('names the opt-in variable in the rejection so the message is actionable', () => {
    expect(SERVE_DISABLED_MESSAGE).toContain('AIO_ADE_ENABLE_SERVE')
  })
})

describe('gating serve does not break the CLI registries', () => {
  it('keeps the serve spec registered so help and registry parity stay intact', () => {
    expect(COMMAND_SPECS.some((spec) => spec.path.join(' ') === 'serve')).toBe(true)
  })

  it('keeps the serve handler key registered', () => {
    expect(HANDLER_COMMAND_KEYS.has('serve')).toBe(true)
  })
})
