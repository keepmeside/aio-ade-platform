#!/usr/bin/env node
// Report locale-catalog keys that no source file references any more, split by whether the
// key text names an agent this build dropped. Read-only: prints the plan, changes nothing.
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { collectLocalizationKeyReferences } from './verify-localization-catalog.mjs'

const ROOT = process.cwd()
const LOCALES_DIR = path.join(ROOT, 'src/renderer/src/i18n/locales')
const SOURCE_ROOTS = ['src']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])
const REMOVED_AGENT_RE =
  /\b(amp|antigravity|agy|aider|ante|autohand|auggie|augment|cline|codebuff|command[\s-]?code|copilot|crush|cursor|devin|droid|factory|gemini|goose|grok|hermes|kilo(?:code)?|kimi|kiro|mimo(?:[\s-]?code)?|mistral|omp|openclaude|openclaw|opencode|pi|qwen(?:[\s-]?code)?|rovo|trae)\b/i

async function* walk(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      yield full
    }
  }
}

function flatten(value, prefix = '', out = new Map()) {
  if (typeof value === 'string') {
    out.set(prefix, value)
    return out
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out)
    }
  }
  return out
}

const referenced = new Set()
for (const root of SOURCE_ROOTS) {
  for await (const filePath of walk(path.join(ROOT, root))) {
    const text = await fs.readFile(filePath, 'utf8')
    if (!text.includes('translate')) {
      continue
    }
    for (const reference of collectLocalizationKeyReferences(filePath, text, ROOT)) {
      referenced.add(reference.key)
    }
  }
}

const englishCatalog = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, 'en.json'), 'utf8'))
const entries = flatten(englishCatalog)

const orphanedRemoved = []
const orphanedOther = []
for (const [key, value] of entries) {
  if (referenced.has(key)) {
    continue
  }
  const names = REMOVED_AGENT_RE.test(key) || REMOVED_AGENT_RE.test(value)
  ;(names ? orphanedRemoved : orphanedOther).push(key)
}

console.log(`referenced keys:        ${referenced.size}`)
console.log(`en.json keys:           ${entries.size}`)
console.log(`orphaned (removed agent): ${orphanedRemoved.length}`)
console.log(`orphaned (other):         ${orphanedOther.length}`)
if (process.argv.includes('--list')) {
  console.log('\n--- orphaned keys naming a removed agent ---')
  for (const key of orphanedRemoved) {
    console.log(`${key} :: ${entries.get(key)?.slice(0, 70)}`)
  }
}
await fs.writeFile(
  '/tmp/orphaned-removed-agent-keys.json',
  JSON.stringify(orphanedRemoved, null, 2)
)
await fs.writeFile('/tmp/orphaned-other-keys.json', JSON.stringify(orphanedOther, null, 2))
