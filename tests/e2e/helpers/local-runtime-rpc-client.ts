import { randomUUID } from 'node:crypto'
import { createConnection } from 'node:net'
import { readFileSync } from 'node:fs'
import {
  findTransport,
  getRuntimeMetadataPath,
  parseRuntimeMetadataJson,
  type RuntimeMetadata
} from '../../../src/shared/runtime-bootstrap'
import {
  isKeepaliveFrame,
  RuntimeRpcEnvelopeSchema,
  type RuntimeRpcResponse,
  type RuntimeRpcSuccess
} from '../../../src/shared/runtime-rpc-envelope'

/** Minimal local runtime client for E2E assertions. */
export class LocalRuntimeRpcClient {
  constructor(
    private readonly userDataPath: string,
    private readonly requestTimeoutMs = 30_000
  ) {}

  async call<TResult>(method: string, params?: unknown): Promise<RuntimeRpcSuccess<TResult>> {
    const metadata = this.readMetadata()
    const transport = findTransport(metadata, 'unix', 'named-pipe')
    if (!transport || !metadata.authToken) {
      throw new Error('Orca runtime metadata does not contain a local authenticated transport')
    }

    const id = randomUUID()
    const response = await new Promise<RuntimeRpcResponse<TResult>>((resolve, reject) => {
      const socket = createConnection(transport.endpoint)
      let buffer = ''
      let settled = false
      const timeout = setTimeout(() => {
        finish({
          error: new Error(`Timed out waiting for runtime method ${method}`)
        })
        socket.destroy()
      }, this.requestTimeoutMs)

      const finish = (result: { response?: RuntimeRpcResponse<TResult>; error?: Error }): void => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timeout)
        socket.end()
        if (result.error) {
          reject(result.error)
        } else if (result.response) {
          resolve(result.response)
        }
      }

      socket.setEncoding('utf8')
      socket.once('error', () =>
        finish({ error: new Error('Could not connect to the running Orca runtime') })
      )
      socket.once('close', () => {
        finish({ error: new Error('Runtime closed the connection before responding') })
      })
      socket.on('data', (chunk: string) => {
        buffer += chunk
        let newlineIndex = buffer.indexOf('\n')
        while (newlineIndex !== -1 && !settled) {
          const line = buffer.slice(0, newlineIndex)
          buffer = buffer.slice(newlineIndex + 1)
          newlineIndex = buffer.indexOf('\n')
          if (!line.trim()) {
            continue
          }

          let raw: unknown
          try {
            raw = JSON.parse(line)
          } catch {
            finish({ error: new Error('Runtime returned an invalid response frame') })
            return
          }
          if (isKeepaliveFrame(raw)) {
            timeout.refresh()
            continue
          }

          const parsed = RuntimeRpcEnvelopeSchema.safeParse(raw)
          if (!parsed.success || isKeepaliveFrame(parsed.data)) {
            finish({ error: new Error('Runtime returned an invalid response envelope') })
            return
          }
          const frame = parsed.data as RuntimeRpcResponse<TResult>
          if (frame.id !== id) {
            finish({ error: new Error('Runtime returned a mismatched response id') })
            return
          }
          finish({ response: frame })
          return
        }
      })
      socket.once('connect', () => {
        socket.write(`${JSON.stringify({ id, authToken: metadata.authToken, method, params })}\n`)
      })
    })

    if (!response.ok) {
      throw new Error(`${response.error.code}: ${response.error.message}`)
    }
    return response
  }

  private readMetadata(): RuntimeMetadata {
    return parseRuntimeMetadataJson(readFileSync(getRuntimeMetadataPath(this.userDataPath), 'utf8'))
  }
}
