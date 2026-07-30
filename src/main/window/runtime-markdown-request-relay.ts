import { randomUUID } from 'node:crypto'

import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import type {
  RuntimeMarkdownReadTabResult,
  RuntimeMarkdownSaveTabResult,
  RuntimeMobileMarkdownRequest,
  RuntimeMobileMarkdownResponse
} from '../../shared/runtime-markdown-document'

const RUNTIME_MARKDOWN_RENDERER_TIMEOUT_MS = 20_000

type RendererRuntimeMarkdownRequest = RuntimeMobileMarkdownRequest extends infer Request
  ? Request extends { id: string }
    ? Omit<Request, 'id'>
    : never
  : never

export async function requestRuntimeMarkdownFromRenderer(
  mainWindow: BrowserWindow,
  request: RendererRuntimeMarkdownRequest
): Promise<RuntimeMarkdownReadTabResult | RuntimeMarkdownSaveTabResult> {
  if (mainWindow.isDestroyed()) {
    throw new Error('renderer_unavailable')
  }
  const id = randomUUID()
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ipcMain.removeListener('ui:runtimeMarkdownResponse', onResponse)
      reject(new Error('renderer_timeout'))
    }, RUNTIME_MARKDOWN_RENDERER_TIMEOUT_MS)
    const onResponse = (
      event: Electron.IpcMainEvent,
      response: RuntimeMobileMarkdownResponse
    ): void => {
      if (event.sender !== mainWindow.webContents) {
        return
      }
      if (response.id !== id) {
        return
      }
      clearTimeout(timeout)
      ipcMain.removeListener('ui:runtimeMarkdownResponse', onResponse)
      if (response.ok) {
        resolve(response.result)
      } else {
        reject(new Error(response.error))
      }
    }
    ipcMain.on('ui:runtimeMarkdownResponse', onResponse)
    mainWindow.webContents.send('ui:runtimeMarkdownRequest', { id, ...request })
  })
}
