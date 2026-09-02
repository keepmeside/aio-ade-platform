import { describe, expect, it } from 'vitest'
import {
  isAgentForegroundWrapperProcess,
  isExpectedAgentProcess,
  isRecognizedAgentType,
  recognizeAgentProcess,
  recognizeAgentProcessFromCommandLine
} from './agent-process-recognition'

describe('agent process recognition', () => {
  it('recognizes packaged Codex foreground process names', () => {
    expect(recognizeAgentProcess('codex-aarch64-ap')).toEqual({
      agent: 'codex',
      processName: 'codex-aarch64-ap'
    })
    expect(isRecognizedAgentType('codex-aarch64-ap')).toBe(true)
  })

  it('matches expected agents from platform-specific foreground process paths', () => {
    expect(recognizeAgentProcess('claude')).toEqual({
      agent: 'claude',
      processName: 'claude'
    })
    expect(
      isExpectedAgentProcess(String.raw`C:\Users\dev\AppData\Roaming\npm\claude.exe`, 'claude')
    ).toBe(true)
    expect(isExpectedAgentProcess('/usr/local/bin/claude', 'claude')).toBe(true)
    expect(isExpectedAgentProcess('powershell.exe', 'claude')).toBe(false)
    // Why: a CLI whose name merely contains an agent name is a different binary.
    expect(isExpectedAgentProcess('/usr/local/bin/openclaude', 'claude')).toBe(false)
    // Why: shells are never agents, whatever their name looks like.
    expect(recognizeAgentProcess('cmd.exe')).toBeNull()
    expect(isRecognizedAgentType('cmd.exe')).toBe(false)
  })

  it('does not recognize Claude print-mode hook subprocesses as interactive agents', () => {
    expect(
      recognizeAgentProcessFromCommandLine(
        'claude --print --model haiku "Analyze this conversation and determine: Does the assistant have more autonomous work to do RIGHT NOW?"'
      )
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`/home/dev/.local/bin/claude -p "Context: This summary will be shown in a list"`
      )
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`C:\Users\dev\AppData\Roaming\npm\claude.exe --output-format=json "hook prompt"`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('claude --resume abc123')).toEqual({
      agent: 'claude',
      processName: 'claude'
    })
    // Why: past `--` nothing is a flag, so this is the interactive pane AIO-ADE itself launches.
    expect(recognizeAgentProcessFromCommandLine('claude -- "--print the release notes"')).toEqual({
      agent: 'claude',
      processName: 'claude'
    })
  })

  it('does not recognize wrapped print-mode commands as interactive agents', () => {
    expect(
      recognizeAgentProcessFromCommandLine('node /home/dev/.local/bin/claude --print "review"')
    ).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\Users\dev\AppData\Roaming\npm\claude.cmd -p review`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('node /home/dev/.local/bin/claude')).toEqual({
      agent: 'claude',
      processName: 'claude'
    })
  })

  it('recognizes agent CLIs launched through interpreter wrappers', () => {
    expect(
      recognizeAgentProcessFromCommandLine('node /Users/dev/.nvm/versions/node/bin/codex')
    ).toEqual({ agent: 'codex', processName: 'codex' })
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\Users\dev\AppData\Roaming\npm\codex.cmd`
      )
    ).toEqual({ agent: 'codex', processName: 'codex' })
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\Users\dev\AppData\Roaming\npm\node_modules\@openai\codex\bin\codex.js`
      )
    ).toEqual({ agent: 'codex', processName: 'codex' })
  })

  it('recognizes only the agent subcommand of the generic AIO-ADE CLI', () => {
    expect(recognizeAgentProcessFromCommandLine('aio-ade claude-teams')).toEqual({
      agent: 'claude-agent-teams',
      processName: 'aio-ade'
    })
    expect(recognizeAgentProcessFromCommandLine('aio-ade status')).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('aio-ade-dev terminal list')).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine('node /usr/local/bin/aio-ade claude-teams')
    ).toEqual({
      agent: 'claude-agent-teams',
      processName: 'aio-ade'
    })
    expect(recognizeAgentProcessFromCommandLine('node /usr/local/bin/aio-ade status')).toBeNull()
  })

  it('does not classify prompt text as a wrapped agent command', () => {
    expect(
      recognizeAgentProcessFromCommandLine(
        'node /tmp/not-an-agent.js "compare opencode vs aio-ade in Gemini CLI"'
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`node C:\tmp\not-an-agent.js`)).toBeNull()
    expect(
      recognizeAgentProcessFromCommandLine(
        String.raw`node C:\repo\server.js --plugin C:\tmp\codex.js`
      )
    ).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`node C:\repo\codex.js`)).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`node C:\repo\gemini.mjs`)).toBeNull()
    expect(recognizeAgentProcessFromCommandLine(String.raw`python C:\repo\aider.py`)).toBeNull()
    expect(recognizeAgentProcessFromCommandLine('python -m not_aider')).toBeNull()
  })

  it('identifies only foreground processes that can wrap agent entrypoints', () => {
    expect(isAgentForegroundWrapperProcess('node.exe')).toBe(true)
    expect(isAgentForegroundWrapperProcess('/usr/bin/python3')).toBe(true)
    expect(isAgentForegroundWrapperProcess('python3.12.exe')).toBe(true)
    expect(isAgentForegroundWrapperProcess('bash')).toBe(false)
    expect(isAgentForegroundWrapperProcess('vim.exe')).toBe(false)
  })
})
