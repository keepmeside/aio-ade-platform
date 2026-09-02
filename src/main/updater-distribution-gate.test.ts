import { beforeEach, describe, expect, it, vi } from 'vitest'

/* The release decision is "no auto-update until the artifacts are signed". That is a distribution
 * safety property, not a preference: a self-replacing binary fetched over a channel the OS cannot
 * authenticate is a worse position than having no updater. These assertions exist so turning the
 * updater back on has to be a deliberate edit to the gate, rather than something that follows from
 * a build flag flipping to packaged. */

const { mockApp, mockIs } = vi.hoisted(() => ({
  mockApp: { isPackaged: false },
  mockIs: { dev: false }
}))

vi.mock('electron', () => ({ app: mockApp }))
vi.mock('@electron-toolkit/utils', () => ({ is: mockIs }))

const { getUpdaterDisabledReason, isUpdaterDisabled } = await import('./updater-distribution-gate')

describe('updater distribution gate', () => {
  beforeEach(() => {
    mockApp.isPackaged = false
    mockIs.dev = false
  })

  it('stays disabled in an unpackaged build and says so', () => {
    expect(getUpdaterDisabledReason()).toBe('unpackaged-build')
    expect(isUpdaterDisabled()).toBe(true)
  })

  it('stays disabled in a dev run even when the build reports packaged', () => {
    mockApp.isPackaged = true
    mockIs.dev = true

    expect(getUpdaterDisabledReason()).toBe('unpackaged-build')
  })

  /* The one that matters: a real packaged install a user downloaded. Before signing exists this
   * must still refuse, and it must report the signing reason rather than claiming the build is
   * unpackaged — the UI turns that reason into user-facing copy. */
  it('refuses a packaged build while the channel is unauthenticated, naming signing as the cause', () => {
    mockApp.isPackaged = true
    mockIs.dev = false

    expect(getUpdaterDisabledReason()).toBe('unsigned-artifacts')
    expect(isUpdaterDisabled()).toBe(true)
  })
})
