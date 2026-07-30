type RuntimeAuthFailureNotificationApi = {
  consumeAuthFailure?: () => Promise<boolean>
  onAuthFailure?: (callback: () => void) => () => void
}

export function subscribeToRuntimeAuthFailureNotification(
  api: RuntimeAuthFailureNotificationApi | undefined,
  onNotification: () => void
): () => void {
  const consume = (notifyIfUnavailable: boolean): void => {
    if (!api?.consumeAuthFailure) {
      if (notifyIfUnavailable) {
        onNotification()
      }
      return
    }
    void api
      .consumeAuthFailure()
      .then((pending) => {
        if (pending) {
          onNotification()
        }
      })
      .catch(() => {
        if (notifyIfUnavailable) {
          onNotification()
        }
      })
  }

  const unsubscribe = api?.onAuthFailure?.(() => consume(true)) ?? (() => {})
  consume(false)
  return unsubscribe
}
