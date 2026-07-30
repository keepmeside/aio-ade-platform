import { spawnSync } from 'node:child_process'

export function redactSensitiveText(value) {
  return String(value)
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(
      /\b(api[_-]?key|authorization|password|passwd|refresh[_-]?token|secret|token)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
      '$1$2[REDACTED]'
    )
}

export function extractVersion(commandOutput) {
  const firstLine = redactSensitiveText(commandOutput).split(/\r?\n/, 1)[0]?.trim() ?? ''
  return firstLine.match(/\bv?(\d+\.\d+(?:\.\d+)?(?:[.+-][0-9A-Za-z.-]+)*)\b/)?.[1] ?? null
}

export function resolveVersionCommand(
  command,
  args,
  platform = process.platform,
  commandShell = process.env.ComSpec ?? 'cmd.exe'
) {
  if (platform === 'win32' && command === 'pnpm') {
    return { executable: commandShell, args: ['/d', '/s', '/c', `pnpm.cmd ${args.join(' ')}`] }
  }
  return { executable: command, args }
}

export function defaultCommandRunner(command, args, repoRoot) {
  const resolved = resolveVersionCommand(command, args)
  const result = spawnSync(resolved.executable, resolved.args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 10_000
  })
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${command} exited with status ${result.status}`)
  }
  return result.stdout
}

export function probeVersion(command, repoRoot, commandRunner) {
  try {
    const version = extractVersion(commandRunner(command, ['--version'], repoRoot))
    return version ? { status: 'available', version } : { status: 'unknown', version: null }
  } catch {
    return { status: 'missing', version: null }
  }
}

export function isGitVersionCompatible(version) {
  if (!version) {
    return null
  }
  const match = /(?:^|\s)v?(\d+)\.(\d+)/.exec(String(version))
  if (!match) {
    return null
  }
  const [major, minor] = match.slice(1).map(Number)
  return major > 2 || (major === 2 && minor >= 25)
}
