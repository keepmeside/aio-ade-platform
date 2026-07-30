import { EventEmitter } from 'node:events'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const ipcEmitter = new EventEmitter()
const ipcMainMock = {
  on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
    ipcEmitter.on(channel, listener)
  }),
  removeListener: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
    ipcEmitter.removeListener(channel, listener)
  })
}

vi.mock('electron', () => ({
  ipcMain: ipcMainMock
}))

describe('requestRuntimeMarkdownFromRenderer', () => {
  beforeEach(() => {
    ipcEmitter.removeAllListeners()
    ipcMainMock.on.mockClear()
    ipcMainMock.removeListener.mockClear()
  })

  it('ignores markdown responses from other renderer processes', async () => {
    const { requestRuntimeMarkdownFromRenderer } = await import('./runtime-markdown-request-relay')
    const mainWebContents = {
      send: vi.fn()
    }
    const otherWebContents = {}
    const mainWindow = {
      isDestroyed: () => false,
      webContents: mainWebContents
    }

    const pending = requestRuntimeMarkdownFromRenderer(mainWindow as never, {
      operation: 'read',
      worktreeId: 'wt-1',
      tabId: 'tab-md'
    })
    expect(mainWebContents.send).toHaveBeenCalledWith(
      'ui:runtimeMarkdownRequest',
      expect.objectContaining({ operation: 'read', worktreeId: 'wt-1', tabId: 'tab-md' })
    )
    const sentRequest = mainWebContents.send.mock.calls[0]?.[1] as { id: string }

    ipcEmitter.emit(
      'ui:runtimeMarkdownResponse',
      { sender: otherWebContents },
      { id: sentRequest.id, ok: false, error: 'wrong_renderer' }
    )
    ipcEmitter.emit(
      'ui:runtimeMarkdownResponse',
      { sender: mainWebContents },
      {
        id: sentRequest.id,
        ok: true,
        result: {
          tabId: 'tab-md',
          filePath: '/repo/README.md',
          relativePath: 'README.md',
          content: '# ok',
          isDirty: false,
          version: 'v1',
          source: 'file',
          editable: true
        }
      }
    )

    await expect(pending).resolves.toMatchObject({ content: '# ok' })
  })
})
