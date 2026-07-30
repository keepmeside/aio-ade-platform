import { readFileSync } from 'node:fs'
import {
  dirname as nativeDirname,
  relative as nativeRelative,
  resolve as nativeResolve
} from 'node:path'
import { dirname, join, normalize } from 'node:path/posix'

const REGEXP_META_CHARACTERS = /[.+^${}()|[\]\\]/g
const MODULE_SPECIFIER_PATTERN =
  /\b(?:import|export)\s+(?:[^'"\r\n]*?\s+from\s+)?['"]([^'"\r\n]+)['"]|\b(?:import|require(?:\.resolve)?|mock)\s*\(\s*['"]([^'"\r\n]+)['"]/g

export function globPatternToRegExp(pattern) {
  const normalized = pattern.replaceAll('\\', '/')
  let source = ''

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index]
    if (character !== '*') {
      source += character.replace(REGEXP_META_CHARACTERS, '\\$&')
      continue
    }

    if (normalized[index + 1] === '*') {
      if (normalized[index + 2] === '/') {
        source += '(?:.*/)?'
        index += 2
      } else {
        source += '.*'
        index += 1
      }
    } else {
      source += '[^/]*'
    }
  }

  return new RegExp(`^${source}$`, 'i')
}

export function extractModuleSpecifiers(content) {
  return [...content.matchAll(MODULE_SPECIFIER_PATTERN)].map(
    ([, staticSpecifier, dynamicSpecifier]) => staticSpecifier ?? dynamicSpecifier
  )
}

export function findCouplingTerms(content, terms) {
  return terms.filter((term) => content.includes(term))
}

export function resolveLocalModuleCandidates(importerPath, specifier) {
  return resolveModuleCandidates(importerPath, specifier)
}

function expandModulePathCandidates(basePath) {
  const normalizedBase = normalize(basePath).replace(/^\.\//, '')
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']
  const extensionlessBase = normalizedBase.replace(/\.(?:ts|tsx|js|jsx|mjs|cjs|json)$/i, '')
  return [
    ...new Set([
      normalizedBase,
      extensionlessBase,
      ...extensions.map((extension) => `${extensionlessBase}${extension}`),
      ...extensions.map((extension) => `${extensionlessBase}/index${extension}`)
    ])
  ]
}

export function resolveModuleCandidates(importerPath, specifier, aliases = []) {
  const bases = []
  if (specifier.startsWith('.')) {
    bases.push(join(dirname(importerPath), specifier))
  }
  for (const alias of aliases) {
    if (alias.wildcard && specifier.startsWith(alias.prefix)) {
      bases.push(join(alias.targetRoot, specifier.slice(alias.prefix.length)))
    } else if (!alias.wildcard && specifier === alias.prefix) {
      bases.push(alias.targetRoot)
    }
  }
  return bases.flatMap(expandModulePathCandidates)
}

export function loadTsconfigPathAliases(repoRoot, files) {
  const aliases = []
  for (const file of files.filter(({ repoPath }) =>
    /(?:^|\/)tsconfig(?:\.[^/]+)?\.json$/i.test(repoPath)
  )) {
    let parsed
    try {
      parsed = JSON.parse(readFileSync(file.absolutePath, 'utf8'))
    } catch {
      continue
    }
    const compilerOptions = parsed.compilerOptions
    const paths = compilerOptions?.paths
    if (!paths || typeof paths !== 'object') {
      continue
    }
    const baseUrl = typeof compilerOptions.baseUrl === 'string' ? compilerOptions.baseUrl : '.'
    const baseDirectory = nativeResolve(nativeDirname(file.absolutePath), baseUrl)
    for (const [pattern, targets] of Object.entries(paths)) {
      if (!Array.isArray(targets)) {
        continue
      }
      const wildcard = pattern.endsWith('/*')
      const prefix = wildcard ? pattern.slice(0, -1) : pattern
      for (const target of targets) {
        if (typeof target !== 'string') {
          continue
        }
        const targetBase = target.replace(/\/\*$/, '')
        const absoluteTarget = nativeResolve(baseDirectory, targetBase)
        const targetRoot = nativeRelative(repoRoot, absoluteTarget).replaceAll('\\', '/')
        aliases.push({ prefix, targetRoot, wildcard })
      }
    }
  }
  return aliases
}
