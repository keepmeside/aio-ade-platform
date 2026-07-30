#!/usr/bin/env node

import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { GIT_COMPATIBILITY_FLOOR } from './aio-ade-preflight-contracts.mjs'
import {
  collectRepositoryInventory,
  normalizeInputPath,
  toRepoPath
} from './aio-ade-preflight-repository-inventory.mjs'
import {
  defaultCommandRunner,
  extractVersion,
  isGitVersionCompatible,
  probeVersion,
  redactSensitiveText,
  resolveVersionCommand
} from './aio-ade-preflight-runtime-probes.mjs'

export { isGitVersionCompatible, redactSensitiveText, resolveVersionCommand }

export function collectPreflightBaseline({
  repoRoot = process.cwd(),
  commandRunner = defaultCommandRunner,
  excludedPaths = []
} = {}) {
  const normalizedRoot = normalizeInputPath(repoRoot)
  if (!existsSync(normalizedRoot) || !statSync(normalizedRoot).isDirectory()) {
    throw new Error('Repository root does not exist or is not a directory')
  }
  const inventory = collectRepositoryInventory(
    normalizedRoot,
    excludedPaths.map((path) => path.replaceAll('\\', '/'))
  )
  const git = probeVersion('git', normalizedRoot, commandRunner)
  const compatible = isGitVersionCompatible(git.version)

  return {
    schemaVersion: 'aio-ade-preflight-baseline/v1',
    repository: inventory.repository,
    runtime: {
      node: { status: 'available', version: extractVersion(process.version) },
      pnpm: probeVersion('pnpm', normalizedRoot, commandRunner),
      git,
      rustc: probeVersion('rustc', normalizedRoot, commandRunner),
      cargo: probeVersion('cargo', normalizedRoot, commandRunner)
    },
    gitCompatibility: {
      minimum: GIT_COMPATIBILITY_FLOOR,
      status: compatible === null ? 'unknown' : compatible ? 'compatible' : 'incompatible'
    },
    scopes: inventory.scopes,
    ownershipOverlaps: inventory.ownershipOverlaps
  }
}

function parseArguments(args) {
  const parsed = { repoRoot: process.cwd(), outputPath: null }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (
      argument === '--repo' ||
      argument === '--repo-root' ||
      argument === '--root' ||
      argument === '--output'
    ) {
      const value = args[index + 1]
      if (!value) {
        throw new Error(`${argument} requires a value`)
      }
      parsed[argument === '--output' ? 'outputPath' : 'repoRoot'] = value
      index += 1
    } else {
      throw new Error('Unknown argument')
    }
  }
  return parsed
}

function main() {
  const { repoRoot, outputPath } = parseArguments(process.argv.slice(2))
  const normalizedRoot = normalizeInputPath(repoRoot)
  const normalizedOutput = outputPath ? normalizeInputPath(outputPath) : null
  const excludedOutput = normalizedOutput ? toRepoPath(normalizedRoot, normalizedOutput) : null
  const baseline = collectPreflightBaseline({
    repoRoot: normalizedRoot,
    excludedPaths: excludedOutput ? [excludedOutput] : []
  })
  const serialized = `${JSON.stringify(baseline, null, 2)}\n`

  if (normalizedOutput) {
    mkdirSync(dirname(normalizedOutput), { recursive: true })
    writeFileSync(normalizedOutput, serialized, 'utf8')
  } else {
    process.stdout.write(serialized)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(redactSensitiveText(error instanceof Error ? error.message : String(error)))
    process.exitCode = 1
  }
}
