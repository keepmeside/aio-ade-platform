export { encodePowerShellCommand } from '../shared/powershell-command-encoding'

const POWERSHELL_OSC133_BOOTSTRAP = `# AIO-ADE OSC 133 shell integration for PowerShell.
if ((Test-Path variable:global:__AioAdeOsc133State) -and
    $null -ne $Global:__AioAdeOsc133State.OriginalPrompt) {
    return
}

if ($ExecutionContext.SessionState.LanguageMode -ne "FullLanguage") {
    return
}

# Profiles have already loaded normally by the time -EncodedCommand runs.
# Wrap the user's final prompt/readline state; do not source profiles here.

# Preserve Windows CJK output by keeping ConPTY on UTF-8 without bypassing
# profile loading or execution-policy checks.
try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
    $OutputEncoding = [Console]::OutputEncoding
} catch { Write-Error $_ -ErrorAction Continue }

# Profiles can re-export user defaults after AIO-ADE's spawn env is set.
if ($env:AIO_ADE_CODEX_HOME) { $env:CODEX_HOME = $env:AIO_ADE_CODEX_HOME }

$Global:__AioAdeOsc133State = @{
    OriginalPrompt = $function:prompt
    OriginalReadLine = $function:PSConsoleHostReadLine
    HasSeenPrompt = $false
    HasPSReadLine = $null -ne (Get-Module -Name PSReadLine)
    Esc = [char]27
    Bel = [char]7
}

function Global:prompt {
    # Capture FIRST; any other expression can clobber PowerShell's success bit.
    $fakeExitCode = [int](!$global:?)
    Set-StrictMode -Off
    $result = ""

    # Emit D from prompt, not readline state. Some profile setups bypass
    # PSConsoleHostReadLine; the consumer only needs completion.
    if ($Global:__AioAdeOsc133State.HasSeenPrompt) {
        $result += "$($Global:__AioAdeOsc133State.Esc)]133;D;$fakeExitCode$($Global:__AioAdeOsc133State.Bel)"
    }
    $Global:__AioAdeOsc133State.HasSeenPrompt = $true

    $result += "$($Global:__AioAdeOsc133State.Esc)]133;A$($Global:__AioAdeOsc133State.Bel)"
    # Preserve the previous success/failure value for prompts that inspect it.
    if ($fakeExitCode -ne 0) { Write-Error "failure" -ea ignore }
    $result += $Global:__AioAdeOsc133State.OriginalPrompt.Invoke()
    $result += "$($Global:__AioAdeOsc133State.Esc)]133;B$($Global:__AioAdeOsc133State.Bel)"
    $result
}

if ($Global:__AioAdeOsc133State.HasPSReadLine -and
    $null -ne $Global:__AioAdeOsc133State.OriginalReadLine) {
    function Global:PSConsoleHostReadLine {
        $commandLine = $Global:__AioAdeOsc133State.OriginalReadLine.Invoke()
        [Console]::Write("$($Global:__AioAdeOsc133State.Esc)]133;C$($Global:__AioAdeOsc133State.Bel)")
        return $commandLine
    }
}
`

export function getPowerShellOsc133Bootstrap(): string {
  return POWERSHELL_OSC133_BOOTSTRAP
}

export function isPowerShellExecutableName(shellName: string): boolean {
  const normalized = shellName.toLowerCase()
  return (
    normalized === 'pwsh' ||
    normalized === 'pwsh.exe' ||
    normalized === 'powershell' ||
    normalized === 'powershell.exe'
  )
}
