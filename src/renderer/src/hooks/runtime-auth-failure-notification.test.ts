import { describe, expect, it, vi } from 'vitest'
import { subscribeToRuntimeAuthFailureNotification } from './runtime-auth-failure-notification'

describe('subscribeToRuntimeAuthFailureNotification', () => {
  it('delivers a retained failure after the renderer subscribes', async () => {
    const onNotification = vi.fn()
    const unsubscribe = subscribeToRuntimeAuthFailureNotification(
      {
        consumeAuthFailure: vi.fn().mockResolvedValue(true),
        onAuthFailure: vi.fn(() => vi.fn())
      },
      onNotification
    )

    await Promise.resolve()

    expect(onNotification).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('keeps live delivery when a preload has no consume API', () => {
    const onNotification = vi.fn()
    const listenerState: { listener?: () => void } = {}
    const unsubscribe = subscribeToRuntimeAuthFailureNotification(
      {
        onAuthFailure: (listener) => {
          listenerState.listener = listener
          return vi.fn()
        }
      },
      onNotification
    )

    listenerState.listener?.()

    expect(onNotification).toHaveBeenCalledOnce()
    unsubscribe()
  })
})
