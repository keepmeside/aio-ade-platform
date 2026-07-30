import { expect, vi } from 'vitest'
import type { RuntimeMarkdownRequest } from '../../../shared/runtime-markdown-document'
import { useAppStore } from '../store'

type WindowStub = {
  addEventListener: Window['addEventListener']
  removeEventListener: Window['removeEventListener']
  dispatchEvent: Window['dispatchEvent']
  setTimeout: Window['setTimeout']
  clearTimeout: Window['clearTimeout']
  api: {
    ui: {
      onRuntimeMarkdownRequest: (
        callback: (request: RuntimeMarkdownRequest) => void
      ) => () => void
      respondRuntimeMarkdownRequest: ReturnType<typeof vi.fn>
    }
    fs: {
      readFile: ReturnType<typeof vi.fn>
      writeFile: ReturnType<typeof vi.fn>
    }
  }
}

let runtimeMarkdownHandler: ((request: RuntimeMarkdownRequest) => void) | null = null

export function setupWindow({
  readFile,
  writeFile = vi.fn().mockResolvedValue(undefined)
}: {
  readFile: ReturnType<typeof vi.fn>
  writeFile?: ReturnType<typeof vi.fn>
}): { responses: unknown[] } {
  const eventTarget = new EventTarget()
  const responses: unknown[] = []
  runtimeMarkdownHandler = null
  vi.stubGlobal('window', {
    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    api: {
      ui: {
        onRuntimeMarkdownRequest: (callback) => {
          runtimeMarkdownHandler = callback
          return () => {
            runtimeMarkdownHandler = null
          }
        },
        respondRuntimeMarkdownRequest: vi.fn((response) => responses.push(response))
      },
      fs: { readFile, writeFile }
    }
  } satisfies WindowStub)
  return { responses }
}

export function resetEditorState(): void {
  useAppStore.setState({
    openFiles: [],
    editorDrafts: {},
    worktreesByRepo: {
      repo: [{ id: 'wt-1', repoId: 'repo', path: '/repo', branch: 'main', hostId: 'local' }]
    },
    repos: [
      {
        id: 'repo',
        path: '/repo',
        displayName: 'repo',
        kind: 'git',
        executionHostId: 'local'
      }
    ]
  } as never)
}

export function openMarkdownFile(): void {
  useAppStore.getState().openFile({
    filePath: '/repo/README.md',
    relativePath: 'README.md',
    worktreeId: 'wt-1',
    language: 'markdown',
    mode: 'edit'
  })
}

export async function sendRequest(request: RuntimeMarkdownRequest): Promise<unknown> {
  expect(runtimeMarkdownHandler).not.toBeNull()
  runtimeMarkdownHandler?.(request)
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    const response = (
      window.api.ui.respondRuntimeMarkdownRequest as ReturnType<typeof vi.fn>
    ).mock.calls
      .map((call) => call[0])
      .find((candidate) => candidate?.id === request.id)
    if (response) {
      return response
    }
  }
  throw new Error(`No response for ${request.id}`)
}

export function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

export function cleanupRuntimeMarkdownBridgeHarness(): void {
  vi.unstubAllGlobals()
  runtimeMarkdownHandler = null
}

