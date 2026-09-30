import { spawn } from 'node:child_process'
import type { CommandHandler } from '../dispatch'
import { formatCliStatus, formatStatus, printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import { stripElectronRunAsNode } from '../runtime/launch'

function envRecord(): Record<string, string> {
  // Why: the `aio-ade` launcher runs AIO-ADE's Electron binary as Node, so this CLI
  // process carries ELECTRON_RUN_AS_NODE=1. Strip it before it reaches the
  // spawned `claude` (and any nested Electron it launches), which would
  // otherwise be forced into headless plain-Node mode.
  const env = stripElectronRunAsNode(process.env)
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
}

function withTeammateModeAuto(args: string[]): string[] {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--teammate-mode' || arg.startsWith('--teammate-mode=')) {
      return args
    }
  }
  return ['--teammate-mode', 'auto', ...args]
}

async function runClaudeAgentTeams(env: Record<string, string>, args: string[]): Promise<number> {
  return await new Promise((resolve, reject) => {
    const child = spawn('claude', withTeammateModeAuto(args), {
      stdio: 'inherit',
      env
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (typeof code === 'number') {
        resolve(code)
        return
      }
      resolve(signal ? 1 : 0)
    })
  })
}

export const CORE_HANDLERS: Record<string, CommandHandler> = {
  'claude-teams': async ({ client, rawArgs }) => {
    if (process.platform === 'win32') {
      throw new RuntimeClientError(
        'unsupported_platform',
        'Claude Agent Teams native panes are not supported on Windows.'
      )
    }
    const paneKey = process.env.AIO_ADE_PANE_KEY
    if (!paneKey) {
      throw new RuntimeClientError(
        'invalid_environment',
        'aio-ade claude-teams must be run inside an AIO-ADE terminal.'
      )
    }
    const response = await client.call<{ launch: { env: Record<string, string> } }>(
      'agentTeams.prepareLaunch',
      {
        paneKey,
        env: envRecord()
      }
    )
    process.exitCode = await runClaudeAgentTeams(
      {
        ...envRecord(),
        ...response.result.launch.env
      },
      rawArgs ?? []
    )
  },
  open: async ({ client, json }) => {
    const result = await client.openAioAde()
    printResult(result, json, formatCliStatus)
  },
  status: async ({ client, json }) => {
    const result = await client.getCliStatus()
    if (!json && !result.result.runtime.reachable) {
      process.exitCode = 1
    }
    printResult(result, json, formatStatus)
  }
}
