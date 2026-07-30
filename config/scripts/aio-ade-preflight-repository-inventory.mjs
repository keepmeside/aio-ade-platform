import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import {
  DESTRUCTIVE_SCOPES,
  IGNORED_DIRECTORIES,
  SENSITIVE_FILE_PATTERN,
  TEXT_EXTENSIONS
} from './aio-ade-preflight-contracts.mjs'
import { redactSensitiveText } from './aio-ade-preflight-runtime-probes.mjs'
import { assignEffectiveScopeOwnership } from './aio-ade-preflight-scope-ownership.mjs'
import {
  extractModuleSpecifiers,
  findCouplingTerms,
  globPatternToRegExp,
  loadTsconfigPathAliases,
  resolveModuleCandidates
} from './aio-ade-preflight-scope-matching.mjs'

export function normalizeInputPath(inputPath) {
  const platformPath = String(inputPath).replaceAll(sep === '/' ? '\\' : '/', sep)
  return resolve(platformPath)
}

export function toRepoPath(repoRoot, absolutePath) {
  const repoPath = relative(repoRoot, absolutePath).replaceAll('\\', '/')
  if (repoPath === '' || repoPath === '..' || repoPath.startsWith('../') || isAbsolute(repoPath)) {
    return null
  }
  return repoPath
}

function listRepositoryFiles(repoRoot, excludedPaths) {
  const files = []

  function visit(directory) {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name, 'en')
    )
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue
      }
      const absolutePath = resolve(directory, entry.name)
      const repoPath = toRepoPath(repoRoot, absolutePath)
      if (!repoPath) {
        continue
      }
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          visit(absolutePath)
        }
      } else if (entry.isFile() && !excludedPaths.has(repoPath)) {
        files.push({ absolutePath, repoPath })
      }
    }
  }

  visit(repoRoot)
  return files.sort((a, b) => a.repoPath.localeCompare(b.repoPath, 'en'))
}

function isReadableTextFile(file) {
  if (SENSITIVE_FILE_PATTERN.test(file.repoPath) || statSync(file.absolutePath).size > 1_000_000) {
    return false
  }
  const dot = file.repoPath.lastIndexOf('.')
  return dot >= 0 && TEXT_EXTENSIONS.has(file.repoPath.slice(dot).toLowerCase())
}

function readAllowedPackageMetadata(repoRoot) {
  const packagePath = resolve(repoRoot, 'package.json')
  if (!existsSync(packagePath)) {
    return { name: null, version: null }
  }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(packagePath, 'utf8'))
  } catch {
    throw new Error('package.json is not valid JSON')
  }
  return {
    name: typeof parsed.name === 'string' ? redactSensitiveText(parsed.name) : null,
    version: typeof parsed.version === 'string' ? redactSensitiveText(parsed.version) : null
  }
}

function inventoryScopes(files, aliases) {
  const compiledScopes = DESTRUCTIVE_SCOPES.map((scope) => ({
    ...scope,
    rootMatchers: scope.rootPatterns.map(globPatternToRegExp),
    excludeMatchers: (scope.excludePatterns ?? []).map(globPatternToRegExp),
    matchedPaths: [],
    reverseImportPaths: new Set(),
    couplingReferences: new Map()
  }))

  for (const file of files) {
    for (const scope of compiledScopes) {
      if (
        scope.rootMatchers.some((matcher) => matcher.test(file.repoPath)) &&
        !scope.excludeMatchers.some((matcher) => matcher.test(file.repoPath))
      ) {
        scope.matchedPaths.push(file.repoPath)
      }
    }
  }

  const ownedPathSets = new Map(compiledScopes.map((scope) => [scope, new Set(scope.matchedPaths)]))

  for (const file of files) {
    const owningScopes = compiledScopes.filter((scope) =>
      ownedPathSets.get(scope).has(file.repoPath)
    )
    if (!isReadableTextFile(file)) {
      continue
    }
    const content = readFileSync(file.absolutePath, 'utf8').toLowerCase().replaceAll('\\', '/')
    const moduleSpecifiers = extractModuleSpecifiers(content)
    const resolvedModulePaths = new Set(
      moduleSpecifiers.flatMap((specifier) =>
        resolveModuleCandidates(file.repoPath, specifier, aliases)
      )
    )
    for (const scope of compiledScopes) {
      if (owningScopes.includes(scope)) {
        continue
      }
      const matchedTerms = findCouplingTerms(content, scope.couplingTerms)
      if (matchedTerms.length > 0) {
        scope.couplingReferences.set(file.repoPath, matchedTerms)
      }
      if (
        [...resolvedModulePaths].some((candidate) => ownedPathSets.get(scope).has(candidate)) ||
        moduleSpecifiers.some((specifier) =>
          scope.couplingTerms.some((term) => specifier.toLowerCase().includes(term))
        )
      ) {
        scope.reverseImportPaths.add(file.repoPath)
      }
    }
  }

  const scopes = compiledScopes.map(
    ({
      rootMatchers: _rootMatchers,
      excludeMatchers: _excludeMatchers,
      matchedPaths,
      reverseImportPaths,
      couplingReferences,
      ...scope
    }) => ({
      id: scope.id,
      ownerPhase: scope.ownerPhase,
      action: scope.action,
      rootPatterns: [...scope.rootPatterns].sort((a, b) => a.localeCompare(b, 'en')),
      excludePatterns: [...(scope.excludePatterns ?? [])].sort((a, b) => a.localeCompare(b, 'en')),
      fileCount: matchedPaths.length,
      matchedPaths: [...matchedPaths].sort((a, b) => a.localeCompare(b, 'en')),
      reverseImportPaths: [...reverseImportPaths].sort((a, b) => a.localeCompare(b, 'en')),
      couplingReferences: [...couplingReferences.entries()]
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([path, matchedTerms]) => ({ path, matchedTerms }))
    })
  )
  return { scopes, ownershipOverlaps: assignEffectiveScopeOwnership(scopes) }
}

export function collectRepositoryInventory(repoRoot, excludedPaths = []) {
  const files = listRepositoryFiles(repoRoot, new Set(excludedPaths))
  const inventory = inventoryScopes(files, loadTsconfigPathAliases(repoRoot, files))
  return {
    repository: {
      package: readAllowedPackageMetadata(repoRoot),
      scannedFileCount: files.length,
      skippedSensitiveContentCount: files.filter((file) =>
        SENSITIVE_FILE_PATTERN.test(file.repoPath)
      ).length
    },
    scopes: inventory.scopes,
    ownershipOverlaps: inventory.ownershipOverlaps
  }
}
