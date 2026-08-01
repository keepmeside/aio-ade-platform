import { describe, expect, it } from 'vitest'
import { mapRuntimeError } from './errors'

class LineageError extends Error {
  code = 'LINEAGE_PARENT_NOT_FOUND'
  data = {
    nextSteps: ['Refresh the worktree list.', 'Retry with `noParent: true`.']
  }
}

describe('mapRuntimeError', () => {
  it.each(['terminal_tab_close_timeout', 'terminal_tab_not_found', 'terminal_tab_pinned'])(
    'preserves the durable terminal tab close failure %s',
    (code) => {
      expect(mapRuntimeError('req_1', { runtimeId: 'runtime-1' }, new Error(code))).toMatchObject({
        ok: false,
        error: { code, message: code }
      })
    }
  )

  it.each([
    'remote_update_manual_required',
    'remote_update_not_available',
    'remote_update_not_downloaded'
  ])('preserves remote updater failure %s', (code) => {
    expect(mapRuntimeError('req_1', { runtimeId: 'runtime-1' }, new Error(code))).toMatchObject({
      ok: false,
      error: { code, message: code }
    })
  })

  it.each(['remote_runtime_unavailable', 'runtime_timeout', 'invalid_runtime_response'])(
    'preserves structured remote transport failure %s',
    (code) => {
      const error = Object.assign(new Error(`Remote transport failed: ${code}`), { code })

      expect(mapRuntimeError('req_1', { runtimeId: 'runtime-1' }, error)).toMatchObject({
        ok: false,
        error: { code, message: `Remote transport failed: ${code}` }
      })
    }
  )

  it('does not expose removed orchestration bridge error codes', () => {
    const error = Object.assign(new Error('The orchestration bridge is unavailable.'), {
      code: 'orchestration_migration_required',
      data: { retry: false }
    })

    expect(mapRuntimeError('req_1', { runtimeId: 'runtime-1' }, error)).toMatchObject({
      ok: false,
      error: {
        code: 'runtime_error',
        message: 'The orchestration bridge is unavailable.'
      }
    })
  })

  it.each([
    ['window_not_focused', 'keyboard input requires focus', 'restoreWindow'],
    ['permission_denied', 'missing DBUS_SESSION_BUS_ADDRESS', 'permissions'],
    ['element_not_found', 'fresh element index required', 'computer.getAppState'],
    ['unsupported_capability', 'hotkey combinations require xdotool', 'capabilities'],
    [
      'action_not_supported',
      'Raise is not a valid secondary action',
      'advertised secondary actions'
    ],
    ['value_not_settable', 'element value is not settable', 'settable text element'],
    ['element_not_clickable', 'element has no actionable frame', 'actionable frame'],
    ['invalid_argument', 'click_count must be a positive integer', 'Do not retry'],
    ['action_timeout', 'computer sidecar click timed out', 'do not repeat'],
    ['screenshot_failed', 'screenshot capture returned no image', 'noScreenshot'],
    ['accessibility_error', 'desktop script provider is not available', 'capabilities']
  ])('adds recovery steps for computer-use %s errors', (code, message, recoveryFragment) => {
    const error = new Error(message)
    Object.assign(error, { code })

    const response = mapRuntimeError('req_1', { runtimeId: 'runtime-1' }, error)

    expect(response.error).toMatchObject({
      code,
      message,
      data: {
        nextSteps: expect.arrayContaining([expect.stringContaining(recoveryFragment)])
      }
    })
  })

  it('adds computer-use startup recovery steps for missing desktop apps', () => {
    const error = new Error('app not found: Gmail')
    Object.assign(error, { code: 'app_not_found' })

    const response = mapRuntimeError('req_1', { runtimeId: 'runtime-1' }, error)

    expect(response.error).toMatchObject({
      code: 'app_not_found',
      message: 'app not found: Gmail',
      data: {
        nextSteps: [
          expect.stringContaining('computer.listApps'),
          expect.stringContaining('desktop browser app/window'),
          expect.stringContaining('`app` value'),
          expect.stringContaining('computer.listWindows')
        ]
      }
    })
  })

  it('adds computer-use recovery steps for missing desktop windows', () => {
    const error = new Error('No top-level window found')
    Object.assign(error, { code: 'window_not_found' })

    const response = mapRuntimeError('req_1', { runtimeId: 'runtime-1' }, error)

    expect(response.error).toMatchObject({
      code: 'window_not_found',
      data: {
        nextSteps: [
          expect.stringContaining('computer.listWindows'),
          expect.stringContaining('restoreWindow: true'),
          expect.stringContaining('does not launch closed desktop apps')
        ]
      }
    })
  })

  it('preserves structured computer-use focus error codes for runtime recovery hints', () => {
    const error = new Error(
      'keyboard input requires the target window to be focused; retry with restoreWindow enabled'
    )
    Object.assign(error, { code: 'window_not_focused' })

    const response = mapRuntimeError('req_1', { runtimeId: 'runtime-1' }, error)

    expect(response).toEqual({
      id: 'req_1',
      ok: false,
      error: {
        code: 'window_not_focused',
        message:
          'keyboard input requires the target window to be focused; retry with restoreWindow enabled',
        data: {
          nextSteps: [
            'Retry once with `restoreWindow: true`.',
            'If restoration was already requested, stop retrying it; bring the app forward manually, check permissions, or prefer `computer.setValue` for editable fields.'
          ]
        }
      },
      _meta: { runtimeId: 'runtime-1' }
    })
  })

  it('preserves structured lineage error codes and data for runtime recovery hints', () => {
    const response = mapRuntimeError(
      'req_1',
      { runtimeId: 'runtime-1' },
      new LineageError('Parent selector was not found.')
    )

    expect(response).toEqual({
      id: 'req_1',
      ok: false,
      error: {
        code: 'LINEAGE_PARENT_NOT_FOUND',
        message: 'Parent selector was not found.',
        data: {
          nextSteps: ['Refresh the worktree list.', 'Retry with `noParent: true`.']
        }
      },
      _meta: { runtimeId: 'runtime-1' }
    })
  })
})
