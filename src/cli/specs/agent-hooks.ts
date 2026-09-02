import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const AGENT_HOOK_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['agent', 'hooks', 'status'],
    summary: 'Show whether AIO-ADE-managed agent status hooks are enabled',
    usage: 'aio-ade agent hooks status [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['aio-ade agent hooks status', 'aio-ade agent hooks status --json']
  },
  {
    path: ['agent', 'hooks', 'off'],
    summary: 'Disable AIO-ADE-managed agent status hooks and remove local hook entries',
    usage: 'aio-ade agent hooks off [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['aio-ade agent hooks off']
  },
  {
    path: ['agent', 'hooks', 'on'],
    summary: 'Enable AIO-ADE-managed agent status hooks',
    usage: 'aio-ade agent hooks on [--json]',
    allowedFlags: [...GLOBAL_FLAGS],
    examples: ['aio-ade agent hooks on']
  }
]
