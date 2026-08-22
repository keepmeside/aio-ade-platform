/* Phase-01 safety net (plans/260730-0117-aio-ide-rebrand-and-integration/phase-01).
 *
 * The 2026-08-21 telemetry decision points diagnostics at a Keepmeside endpoint, and gates
 * turning it on behind "redaction tests prove no API key / secretRef / personal path in the
 * payload". This file is that proof, written before the endpoint moves so the endpoint change
 * cannot quietly ship a leak.
 *
 * Distinct from redactor.test.ts (unit rules) — this asserts the leak classes the phase-06
 * account/profile work will introduce: provider API keys and profile secret references. The
 * third class the decision names, personal filesystem paths, has NO rule today; the last test
 * pins that gap so it is visible rather than assumed handled. */
import { describe, expect, it } from 'vitest'
import { redactAttributes, redactSpan, redactString, type RedactableSpan } from './redactor'

function span(overrides: Partial<RedactableSpan> = {}): RedactableSpan {
  return {
    name: 'account.switch',
    traceId: 'a'.repeat(32),
    spanId: 'b'.repeat(16),
    kind: 'internal',
    startTimeUnixNano: '1',
    endTimeUnixNano: '2',
    durationMs: 1,
    attributes: {},
    events: [],
    exit: { _tag: 'Success' },
    ...overrides
  }
}

describe('phase-01 safety net: provider API keys never reach a payload', () => {
  it.each([
    ['anthropic', 'sk-ant-api03-0123456789abcdefghijklmnopqrstuvwxyz0123456789ABCDEF'],
    ['openai', 'sk-proj-0123456789abcdefghijklmnopqrstuvwxyz0123'],
    ['github', 'ghp_0123456789abcdefghijklmnopqrstuvwxyz'],
    ['aws', 'AKIAIOSFODNN7EXAMPLE']
  ])('redacts a bare %s key found in free text', (_provider, key) => {
    expect(redactString(`launch failed with ${key} in argv`)).not.toContain(key)
  })

  it('drops the value of any attribute whose key names a credential', () => {
    const out = redactAttributes({
      ANTHROPIC_API_KEY: 'sk-ant-secret-value',
      'x-api-key': 'plain-value-no-provider-prefix',
      authorization: 'Bearer abc.def.ghi',
      profileSecretRef: 'vault://profiles/prod',
      // A benign neighbor must survive, or diagnostics become useless.
      accountId: 'acct-123'
    })

    expect(Object.keys(out)).not.toContain('ANTHROPIC_API_KEY')
    expect(Object.keys(out)).not.toContain('x-api-key')
    expect(Object.keys(out)).not.toContain('authorization')
    expect(JSON.stringify(out)).not.toContain('plain-value-no-provider-prefix')
    expect(JSON.stringify(out)).not.toContain('vault://profiles/prod')
    expect(out.accountId).toBe('acct-123')
  })

  it('redacts a key that only appears inside a stack trace on the exit cause', () => {
    const key = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH'
    const redacted = redactSpan(
      span({
        exit: {
          _tag: 'Failure',
          cause: `Error: spawn failed\n  at launch (env ANTHROPIC_API_KEY=${key})`
        }
      })
    )

    expect(redacted.exit.cause).not.toContain(key)
  })

  it('redacts credentials carried on span events, not just top-level attributes', () => {
    const redacted = redactSpan(
      span({
        events: [
          {
            name: 'profile.resolved',
            timeUnixNano: '1',
            attributes: { api_key: 'sk-proj-abcdefghijklmnopqrstuvwxyz0123456789' }
          }
        ]
      })
    )

    expect(JSON.stringify(redacted.events)).not.toContain('sk-proj-')
  })

  it('redacts an env-shaped line even when the var name is unknown to the blocklist', () => {
    const out = redactString('AIO_ADE_FUTURE_PROVIDER_TOKEN=super-secret-value')
    expect(out).not.toContain('super-secret-value')
  })

  it('strips credentials embedded in a remote URL', () => {
    const out = redactString(
      'fatal: could not read from https://user:hunter2@git.example.com/x.git'
    )
    expect(out).not.toContain('hunter2')
    // Host stays: it is the diagnostic value of the line.
    expect(out).toContain('git.example.com')
  })

  it('is idempotent, which is what makes three-location redaction safe', () => {
    const input = 'token: ghp_0123456789abcdefghijklmnopqrstuvwxyz'
    const once = redactString(input)
    expect(redactString(once)).toBe(once)
  })

  it('drops PostHog identity keys from server-mode payloads so bundles cannot be re-identified', () => {
    const out = redactAttributes({ install_id: 'abc', distinct_id: 'def', keep: 'yes' }, 'server')

    expect(Object.keys(out)).not.toContain('install_id')
    expect(Object.keys(out)).not.toContain('distinct_id')
    expect(out.keep).toBe('yes')
  })

  // KNOWN GAP, pinned deliberately. The telemetry decision requires proving no "personal path"
  // reaches the payload, but no home-path rule exists — stack traces and file errors carry the
  // OS username verbatim. This test documents current behavior so the gap is a visible
  // precondition on enabling the Keepmeside endpoint, not a surprise found after shipping.
  // When a rule lands, invert these assertions.
  it('does NOT yet redact a personal home path (blocks enabling the endpoint)', () => {
    const out = redactString('ENOENT: /home/janedoe/Projects/secret-client/app.ts')

    expect(out).toContain('janedoe')
  })
})
