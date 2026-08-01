import { describe, expect, it } from 'vitest'
import { shouldQuitWhenAllWindowsClosed } from './window-all-closed-quit-policy'

describe('shouldQuitWhenAllWindowsClosed', () => {
  it('keeps normal macOS close-all behavior outside quit', () => {
    expect(
      shouldQuitWhenAllWindowsClosed({
        platform: 'darwin',
        isQuitting: false
      })
    ).toBe(false)
  })

  it('quits desktop Linux when all windows close', () => {
    expect(
      shouldQuitWhenAllWindowsClosed({
        platform: 'linux',
        isQuitting: false
      })
    ).toBe(true)
  })

  it('continues a committed quit on macOS after all windows close', () => {
    expect(
      shouldQuitWhenAllWindowsClosed({
        platform: 'darwin',
        isQuitting: true
      })
    ).toBe(true)
  })
})
