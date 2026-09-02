/**
 * Benchmark-style regression test for hook-payload floods.
 *
 * Drives the REAL agent-hook HTTP pipeline (loopback socket, body read,
 * JSON.parse, normalization, listener fanout) with two client behaviors:
 *
 * - "unbounded": one POST per streamed update, each carrying the FULL
 *   accumulated text — O(n²) bytes per turn.
 * - "throttled": leading + trailing-edge coalesced posts at 250ms cadence
 *   with text capped at 4000 chars.
 *
 * Every post must still be accepted (204) and fan out to the listener, so a
 * pipeline that starts dropping or erroring under volume fails here. The
 * byte/post-count assertions are deterministic; wall-clock timings are logged
 * as benchmark evidence (see notes/windows-perf-progress.md) but not asserted,
 * to keep CI stable.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makePaneKey } from '../../shared/stable-pane-id'

const { getCohortAtEmitMock, trackMock } = vi.hoisted(() => ({
  getCohortAtEmitMock: vi.fn(),
  trackMock: vi.fn()
}))

vi.mock('../telemetry/client', () => ({
  track: trackMock
}))

vi.mock('../telemetry/cohort-classifier', () => ({
  getCohortAtEmit: getCohortAtEmitMock
}))

import { AgentHookServer } from './server'

const PANE = makePaneKey('tab-bench', '99999999-9999-4999-8999-999999999999')

// A realistic long streaming reply: ~120 KB final text arriving in 400
// updates (each update republishes the whole accumulated text).
const FINAL_REPLY_CHARS = 120_000
const UNBOUNDED_UPDATES = 400
// A throttled client posts at most once per 250ms. A ~30s turn yields ~120
// posts; we use that worst-case count with the 4000-char cap.
const THROTTLED_POSTS = 120
const THROTTLED_TEXT_CAP = 4_000

describe('agent hook payload flood benchmark', () => {
  let server: AgentHookServer
  let tempDir: string
  let listenerEvents: number

  beforeEach(async () => {
    getCohortAtEmitMock.mockReturnValue({ nth_repo_added: 2 })
    tempDir = mkdtempSync(join(tmpdir(), 'aio-ade-hook-bench-'))
    server = new AgentHookServer()
    listenerEvents = 0
    server.setListener(() => {
      listenerEvents++
    })
    await server.start({ env: 'production', userDataPath: tempDir })
  })

  afterEach(() => {
    server.stop()
    rmSync(tempDir, { recursive: true, force: true })
  })

  async function postPrompt(env: Record<string, string>, text: string): Promise<void> {
    const response = await fetch(`http://127.0.0.1:${env.AIO_ADE_AGENT_HOOK_PORT}/hook/claude`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AIO-ADE-Agent-Hook-Token': env.AIO_ADE_AGENT_HOOK_TOKEN
      },
      body: JSON.stringify({
        paneKey: PANE,
        tabId: 'tab-bench',
        worktreeId: 'wt-bench',
        env: 'production',
        payload: {
          hook_event_name: 'UserPromptSubmit',
          prompt: text,
          session_id: 'session-bench'
        }
      })
    })
    expect(response.status).toBe(204)
  }

  it('throttled client behavior cuts per-turn hook-pipeline bytes by >40x', async () => {
    const env = server.buildPtyEnv()
    expect(env.AIO_ADE_AGENT_HOOK_PORT).toBeTruthy()

    // Unbounded: full accumulated text per update.
    let unboundedBytes = 0
    const unboundedStart = performance.now()
    for (let i = 1; i <= UNBOUNDED_UPDATES; i++) {
      const text = 'x'.repeat(Math.floor((FINAL_REPLY_CHARS * i) / UNBOUNDED_UPDATES))
      unboundedBytes += text.length
      await postPrompt(env, text)
    }
    const unboundedMs = performance.now() - unboundedStart
    const unboundedEvents = listenerEvents

    listenerEvents = 0

    // Throttled: bounded post count, bounded text.
    let throttledBytes = 0
    const throttledStart = performance.now()
    for (let i = 1; i <= THROTTLED_POSTS; i++) {
      const text = 'x'.repeat(THROTTLED_TEXT_CAP)
      throttledBytes += text.length
      await postPrompt(env, text)
    }
    const throttledMs = performance.now() - throttledStart
    const throttledEvents = listenerEvents

    // eslint-disable-next-line no-console
    console.log(
      `[bench] unbounded: ${UNBOUNDED_UPDATES} posts, ${(unboundedBytes / 1024 / 1024).toFixed(1)} MB, ` +
        `${unboundedMs.toFixed(0)} ms, ${unboundedEvents} listener fanouts | ` +
        `throttled: ${THROTTLED_POSTS} posts, ${(throttledBytes / 1024).toFixed(0)} KB, ` +
        `${throttledMs.toFixed(0)} ms, ${throttledEvents} listener fanouts`
    )

    // Every accepted post must reach the listener: a pipeline that drops events
    // under volume would silently lose pane status updates.
    expect(unboundedEvents).toBe(UNBOUNDED_UPDATES)
    expect(throttledEvents).toBe(THROTTLED_POSTS)

    // Deterministic: the turn's total text volume through the main process
    // drops from O(n²) (~23 MB here) to O(posts × cap) (~470 KB here, >40x
    // less). Real turns stream far more than 400 updates, so the real-world
    // ratio is larger still.
    expect(throttledBytes).toBeLessThan(unboundedBytes / 40)
    expect(THROTTLED_POSTS).toBeLessThan(UNBOUNDED_UPDATES / 3 + 1)
  }, 120_000)
})
