import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readMainSource(): string {
  return readFileSync(join(process.cwd(), 'src/main/index.ts'), 'utf8')
}

describe('startup ordering', () => {
  it('passes the startup barrier into PTY handlers before renderer services attach', () => {
    const source = readMainSource()
    const attachStart = source.indexOf('attachMainWindowServices(')
    const attachEnd = source.indexOf('rateLimits.attach(window)', attachStart)
    expect(attachStart).toBeGreaterThanOrEqual(0)
    expect(attachEnd).toBeGreaterThan(attachStart)

    const attachBlock = source.slice(attachStart, attachEnd)
    expect(attachBlock).toContain('awaitLocalPtyStartup: () => localPtyStartupReady')
    expect(attachBlock).toContain(
      'awaitLocalPtyProviderStartup: () => localPtyProviderStartupReady'
    )
    expect(source).toContain('firstWindowStartupServicesReady = startupServices.firstWindowReady')
    expect(source).toContain('localPtyStartupReady = startupServices.localPtyReady')
  })

  it('starts the desktop window and runtime RPC together without a modal startup wait', () => {
    const source = readMainSource()
    const desktopStart = source.indexOf('const [win')
    const desktopEnd = source.indexOf("win.once('show'", desktopStart)
    expect(desktopStart).toBeGreaterThanOrEqual(0)
    expect(desktopEnd).toBeGreaterThan(desktopStart)

    const desktopStartup = source.slice(desktopStart, desktopEnd)
    expect(desktopStartup).toContain('Promise.resolve(openMainWindow())')
    expect(desktopStartup).toContain('runtimeRpc.start()')
    expect(desktopStartup).toContain('recordRuntimeRpcStartFailure(')
    expect(desktopStartup).toMatch(/void showRuntimeRpcStartupFailureDialog\(\s*win,/)
    expect(desktopStartup).not.toContain(
      "console.error('[runtime] Failed to start local RPC transport:'"
    )
  })

  it('attaches renderer services before starting rate limits and the TCC watcher', () => {
    const source = readMainSource()
    const attachIndex = source.indexOf('attachMainWindowServices(')
    const rateLimitAttachIndex = source.indexOf('rateLimits.attach(window)')
    const rateLimitStartIndex = source.indexOf('rateLimits.start({ fetchImmediately: false })')
    const tccNoticeIndex = source.indexOf('initTccPromptNotice(window', attachIndex)

    expect(attachIndex).toBeGreaterThanOrEqual(0)
    expect(rateLimitAttachIndex).toBeGreaterThan(attachIndex)
    expect(rateLimitStartIndex).toBeGreaterThan(rateLimitAttachIndex)
    expect(tccNoticeIndex).toBeGreaterThan(attachIndex)
    expect(source.slice(tccNoticeIndex, tccNoticeIndex + 120)).toContain(
      'deferWatchUntilReadyToShow: true'
    )
  })
})
