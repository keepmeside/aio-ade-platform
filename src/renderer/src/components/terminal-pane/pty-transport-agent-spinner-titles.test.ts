// Why: reproduce the issue (codex spinner not reaching the worktree card on macOS)
// entirely in unit-test harness. Codex's titlebar extension emits OSC 0 titles of
// the form `\x1b]0;⠋ Codex\x07` (working frames) and `\x1b]0;Codex\x07`
// (idle). The electron-level verification showed these chunks reach `pty:data`
// but the store's runtimePaneTitlesByTabId never flips to "⠋ Codex". This file
// pins the transport-level contract: `onTitleChange` must fire for working
// frames, in the normalized form the store consumes.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ESC = '\x1b'
const BEL = '\x07'
const workingFrame = (frame: string): string => `${ESC}]0;${frame} Codex${BEL}`
const idleTitle = (): string => `${ESC}]0;Codex${BEL}`

function flushPtySideEffects(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('createIpcPtyTransport — Codex titlebar spinner signal', () => {
  const originalWindow = (globalThis as { window?: typeof window }).window
  let onData: ((payload: { id: string; data: string }) => void) | null = null

  beforeEach(() => {
    vi.resetModules()
    onData = null
    ;(globalThis as { window: typeof window }).window = {
      ...originalWindow,
      api: {
        ...originalWindow?.api,
        pty: {
          ...originalWindow?.api?.pty,
          spawn: vi.fn().mockResolvedValue({ id: 'pty-codex' }),
          write: vi.fn(),
          resize: vi.fn(),
          kill: vi.fn(),
          onData: vi.fn((cb: (payload: { id: string; data: string }) => void) => {
            onData = cb
            return () => {}
          }),
          onReplay: vi.fn(() => () => {}),
          onExit: vi.fn(() => () => {})
        }
      }
    } as unknown as typeof window
  })

  afterEach(() => {
    if (originalWindow) {
      ;(globalThis as { window: typeof window }).window = originalWindow
    } else {
      delete (globalThis as { window?: typeof window }).window
    }
  })

  it('fires onTitleChange with the normalized working label on each spinner frame', async () => {
    const { createIpcPtyTransport } = await import('./pty-transport')
    const onTitleChange = vi.fn()

    const transport = createIpcPtyTransport({ onTitleChange })
    await transport.connect({ url: '', callbacks: {} })

    // Codex boots idle, then agent_start fires and emits working frames, then
    // agent_end flips back to idle. Each frame is its own `pty:data` chunk —
    // matches the node-pty batching behavior I captured from a live session.
    onData?.({ id: 'pty-codex', data: idleTitle() })
    onData?.({ id: 'pty-codex', data: workingFrame('⠋') }) // ⠋
    onData?.({ id: 'pty-codex', data: workingFrame('⠙') }) // ⠙
    onData?.({ id: 'pty-codex', data: workingFrame('⠹') }) // ⠹
    onData?.({ id: 'pty-codex', data: idleTitle() })
    await flushPtySideEffects()

    const normalized = onTitleChange.mock.calls.map((c) => c[0])
    // The store only stores the normalized label, which is what the worktree
    // card feeds back into detectAgentStatusFromTitle. The working→idle cycle
    // must surface at least one "⠋ Codex" so the card can classify the pane as
    // 'working' (detectAgentStatusFromTitle('⠋ Codex') === 'working').
    expect(normalized).toContain('⠋ Codex')
    expect(normalized).toContain('Codex')

    transport.disconnect()
  })

  it('fires onTitleChange for working frames via attach() (reattach path)', async () => {
    const { createIpcPtyTransport } = await import('./pty-transport')
    const onTitleChange = vi.fn()

    const transport = createIpcPtyTransport({ onTitleChange })
    // Why: reattach is the path taken when a worktree is restored or when
    // tab re-mounting happens mid-session. The transport must still wire up
    // the title observer on this path — otherwise Codex emits spinner frames
    // that never propagate to the store.
    transport.attach({ existingPtyId: 'pty-codex', callbacks: {} })

    onTitleChange.mockClear()

    onData?.({ id: 'pty-codex', data: workingFrame('⠋') })
    onData?.({ id: 'pty-codex', data: workingFrame('⠙') })
    await flushPtySideEffects()

    const calls = onTitleChange.mock.calls.map((c) => c[0])
    expect(calls).toContain('⠋ Codex')

    transport.disconnect()
  })

  it('surfaces working even when a single chunk contains multiple spinner frames', async () => {
    // Why: node-pty may coalesce multiple 80ms spinner frames into one
    // `pty:data` event on macOS when the renderer is briefly throttled.
    // extractLastOscTitle returns only the LAST OSC title in the chunk — if
    // a chunk happens to end with the idle title (agent_end fires after the
    // last working frame), the working frames in between must not be the only
    // signal the transport ever saw. The important guarantee is that during
    // an actual working period (before agent_end) at least one chunk's last
    // title is a working frame, and that produces a "⠋ Codex" onTitleChange.
    const { createIpcPtyTransport } = await import('./pty-transport')
    const onTitleChange = vi.fn()

    const transport = createIpcPtyTransport({ onTitleChange })
    await transport.connect({ url: '', callbacks: {} })

    const coalescedWorking = `${workingFrame('⠋')}output\r\n${workingFrame('⠙')}`
    onData?.({ id: 'pty-codex', data: coalescedWorking })
    await flushPtySideEffects()

    const calls = onTitleChange.mock.calls.map((c) => c[0])
    expect(calls).toContain('⠋ Codex')

    transport.disconnect()
  })
})
