import { test, expect } from './helpers/aio-ade-app'
import {
  execInTerminal,
  getTerminalContent,
  waitForActivePanePtyId,
  waitForActiveTerminalManager
} from './helpers/terminal'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

type CodexHomeProbe = {
  codexHome: string | null
  aioAdeCodexHome: string | null
}

function readCodexHomeProbe(pageContent: string, marker: string): CodexHomeProbe | null {
  const match = new RegExp(`${marker}:(\\{[^\\r\\n]+\\})`).exec(pageContent)
  if (!match) {
    return null
  }
  return JSON.parse(match[1] ?? 'null') as CodexHomeProbe | null
}

test.describe('Terminal Codex runtime home', () => {
  test.beforeEach(async ({ aioAdePage }) => {
    await waitForSessionReady(aioAdePage)
    await waitForActiveWorktree(aioAdePage)
    await ensureTerminalVisible(aioAdePage)
  })

  test('terminal process receives the AIO-ADE-managed Codex home', async ({ aioAdePage }) => {
    await waitForActiveTerminalManager(aioAdePage)
    const ptyId = await waitForActivePanePtyId(aioAdePage)
    const marker = `__AIO_ADE_CODEX_HOME_E2E_${Date.now()}__`
    const command = [
      'node -e',
      `"console.log('${marker}:' + JSON.stringify({codexHome: process.env.CODEX_HOME || null, aioAdeCodexHome: process.env.AIO_ADE_CODEX_HOME || null}))"`
    ].join(' ')

    await execInTerminal(aioAdePage, ptyId, command)

    let probe: CodexHomeProbe | null = null
    await expect
      .poll(
        async () => {
          probe = readCodexHomeProbe(await getTerminalContent(aioAdePage), marker)
          return Boolean(
            probe?.codexHome &&
            probe.aioAdeCodexHome &&
            probe.codexHome === probe.aioAdeCodexHome &&
            /[\\/]codex-runtime-home[\\/]home$/.test(probe.codexHome)
          )
        },
        { timeout: 15_000, message: 'Terminal did not expose AIO-ADE-managed Codex home env' }
      )
      .toBe(true)

    expect(probe?.codexHome).toBe(probe?.aioAdeCodexHome)
  })
})
