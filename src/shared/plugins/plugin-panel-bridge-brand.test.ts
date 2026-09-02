import { describe, expect, it } from 'vitest'
import {
  LEGACY_PANEL_ACTION_REQUEST_TYPE,
  LEGACY_PANEL_ACTION_RESULT_TYPE,
  PANEL_ACTION_REQUEST_TYPE,
  PANEL_ACTION_RESULT_TYPE,
  PANEL_PING_TYPE,
  PANEL_PONG_TYPE,
  panelActionRequestSchema,
  PLUGIN_PANEL_FRAME_NAME_PREFIX,
  resolvePanelActionResultType
} from './plugin-panel-bridge'

describe('panel action request', () => {
  const request = {
    requestId: 'r1',
    action: 'terminal.sendText',
    params: { terminalId: 'term-1', text: 'hello', enter: true }
  }

  it('accepts the current message type', () => {
    expect(PANEL_ACTION_REQUEST_TYPE).toBe('aio-ade-panel-action')
    expect(
      panelActionRequestSchema.safeParse({ ...request, type: PANEL_ACTION_REQUEST_TYPE }).success
    ).toBe(true)
  })

  it('accepts the pre-rebrand message type', () => {
    // Plugin panel code sends this literal, and installed panels were written against the old
    // spelling. Rejecting it makes every existing panel silently stop working.
    expect(LEGACY_PANEL_ACTION_REQUEST_TYPE).toBe('orca-panel-action')
    expect(
      panelActionRequestSchema.safeParse({ ...request, type: LEGACY_PANEL_ACTION_REQUEST_TYPE })
        .success
    ).toBe(true)
  })

  it('still rejects an unrelated message type', () => {
    expect(panelActionRequestSchema.safeParse({ ...request, type: 'something-else' }).success).toBe(
      false
    )
  })
})

describe('resolvePanelActionResultType', () => {
  it('answers a legacy request in the dialect it used', () => {
    // The panel filters replies by type, so a reply in the new spelling never reaches a panel
    // written against the old one.
    expect(resolvePanelActionResultType(LEGACY_PANEL_ACTION_REQUEST_TYPE)).toBe(
      LEGACY_PANEL_ACTION_RESULT_TYPE
    )
  })

  it('answers a current request with the current result type', () => {
    expect(resolvePanelActionResultType(PANEL_ACTION_REQUEST_TYPE)).toBe(PANEL_ACTION_RESULT_TYPE)
  })

  it('defaults to the current result type for an unrecognized request type', () => {
    expect(resolvePanelActionResultType(undefined)).toBe(PANEL_ACTION_RESULT_TYPE)
    expect(resolvePanelActionResultType('nonsense')).toBe(PANEL_ACTION_RESULT_TYPE)
  })
})

describe('host-internal panel tokens', () => {
  it('renames the tokens no plugin can observe', () => {
    // The ping responder is written by the host into the shell it generates, and the frame name
    // is set by the renderer and read by the main-process navigation guard. Both ends ship
    // together, so these carry no compatibility debt.
    expect(PANEL_PING_TYPE).toBe('aio-ade-panel-ping')
    expect(PANEL_PONG_TYPE).toBe('aio-ade-panel-pong')
    expect(PLUGIN_PANEL_FRAME_NAME_PREFIX).toBe('aio-ade-plugin-panel:')
  })
})
