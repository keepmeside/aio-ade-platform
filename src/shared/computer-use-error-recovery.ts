export type ComputerUseErrorRecoveryData = {
  nextSteps: string[]
}

export function computerUseErrorRecoveryData(
  code: string
): ComputerUseErrorRecoveryData | undefined {
  switch (code) {
    case 'app_not_found':
      return recoverWith(
        'Call `computer.listApps` and retry with the exact app name or bundle ID.',
        'If the target is a website or web app such as Gmail, choose the desktop browser app/window that contains it; Computer Use app selectors refer to desktop apps, not website names.',
        'Do not retry the same Computer Use request with a website name as the `app` value.',
        'If the desired browser is not listed, open or focus it first, then refresh `computer.listApps` and `computer.listWindows` for that browser.'
      )
    case 'app_blocked':
      return recoverWith(
        'Do not continue with this app through computer-use; choose a non-sensitive target or ask the user to handle it manually.'
      )
    case 'window_not_found':
      return recoverWith(
        'Call `computer.listWindows` for the app and target one of the listed windows.',
        'If the app is listed but no usable window is visible, retry observation once with `restoreWindow: true`.',
        'If no window is listed, open or focus the app first; Computer Use does not launch closed desktop apps.'
      )
    case 'window_not_focused':
      return recoverWith(
        'Retry once with `restoreWindow: true`.',
        'If restoration was already requested, stop retrying it; bring the app forward manually, check permissions, or prefer `computer.setValue` for editable fields.'
      )
    case 'window_stale':
      return recoverWith(
        'Call `computer.listWindows` and choose a current window selector.',
        'Then call `computer.getAppState` before acting.'
      )
    case 'provider_incompatible':
      return recoverWith(
        'Call `computer.capabilities` and verify the current provider supports the requested operation.',
        'Update Orca or use a supported platform/provider path before retrying.'
      )
    case 'unsupported_capability':
      return recoverWith(
        'Call `computer.capabilities` and choose a supported action.',
        'Use a semantic alternative such as `computer.setValue` or `computer.click`, or install the missing desktop dependency if the error names one.'
      )
    case 'permission_denied':
      return recoverWith(
        'Call `computer.permissionsStatus`, then use `computer.permissions` with `id: "accessibility"` or `id: "screenshots"` when the message names a missing permission.',
        'For remote or SSH targets, verify Computer Use is running inside an active graphical desktop session.'
      )
    case 'element_not_found':
      return recoverWith(
        'Call `computer.getAppState` again and use an element index from the fresh tree.',
        'Do not infer valid indexes from `elementCount` or reuse indexes after navigation, scrolling, focus changes, or delays.'
      )
    case 'element_not_clickable':
      return recoverWith(
        'Choose a nearby parent or child element that has an actionable frame.',
        'If using coordinates, derive window-local coordinates from the latest screenshot/state for the same target window.'
      )
    case 'action_not_supported':
      return recoverWith(
        'Inspect the element in a fresh `computer.getAppState` result and use one of its advertised secondary actions.',
        'If no suitable action is listed, use `computer.click`, `computer.setValue`, or another semantic action instead.'
      )
    case 'value_not_settable':
      return recoverWith(
        'Choose a settable text element from a fresh `computer.getAppState` result.',
        'If the target cannot accept direct value writes, focus it and use keyboard input only after inspecting the returned state.'
      )
    case 'invalid_argument':
      return recoverWith(
        'Fix the runtime method or params exactly as described by the error message.',
        'Do not retry the same request unchanged.'
      )
    case 'action_timeout':
      return recoverWith(
        'Call `computer.getAppState` before retrying so you know whether the UI changed.',
        'Retry with a simpler semantic action or `noScreenshot: true` if observation is slow; do not repeat the same timed-out action blindly.'
      )
    case 'screenshot_failed':
      return recoverWith(
        'If the accessibility tree is sufficient, retry with `noScreenshot: true` instead of repeating the same screenshot capture.',
        'If the message mentions Screen Recording or screenshots permission, use `computer.permissions` with `id: "screenshots"` and grant access before retrying.',
        'If the message mentions the payload cap, target a smaller/current window or use `noScreenshot: true`.'
      )
    case 'accessibility_error':
      return recoverWith(
        'Call `computer.capabilities` to confirm the provider is available before retrying.',
        'If the message mentions permissions, use `computer.permissions` with `id: "accessibility"` and grant access.',
        'Do not loop on the same action if provider availability or permissions remain unchanged.'
      )
    default:
      return undefined
  }
}

function recoverWith(...nextSteps: string[]): ComputerUseErrorRecoveryData {
  return { nextSteps }
}
