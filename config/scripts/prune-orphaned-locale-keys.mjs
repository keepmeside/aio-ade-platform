#!/usr/bin/env node
// Delete locale-catalog keys that no source file references and whose text names an agent this
// build no longer ships. Reads the key list produced by report-orphaned-locale-keys.mjs.
import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LOCALES_DIR = path.join(ROOT, 'src/renderer/src/i18n/locales')
const KEY_LIST = process.argv[2] ?? '/tmp/orphaned-removed-agent-keys.json'
const DRY_RUN = process.argv.includes('--dry-run')

function deleteKey(catalog, key) {
  const parts = key.split('.')
  const parents = []
  let node = catalog
  for (const part of parts.slice(0, -1)) {
    if (!node || typeof node !== 'object') {
      return false
    }
    parents.push([node, part])
    node = node[part]
  }
  const leaf = parts.at(-1)
  if (!node || typeof node !== 'object' || !(leaf in node)) {
    return false
  }
  delete node[leaf]
  // Drop containers the removal emptied so the catalogs keep no hollow branches.
  for (const [parent, part] of parents.toReversed()) {
    if (
      parent[part] &&
      typeof parent[part] === 'object' &&
      Object.keys(parent[part]).length === 0
    ) {
      delete parent[part]
    }
  }
  return true
}

const keys = JSON.parse(await fs.readFile(KEY_LIST, 'utf8'))
const localeFiles = (await fs.readdir(LOCALES_DIR)).filter((name) => name.endsWith('.json')).sort()

for (const fileName of localeFiles) {
  const filePath = path.join(LOCALES_DIR, fileName)
  const catalog = JSON.parse(await fs.readFile(filePath, 'utf8'))
  let removed = 0
  for (const key of keys) {
    if (deleteKey(catalog, key)) {
      removed += 1
    }
  }
  if (removed > 0 && !DRY_RUN) {
    await fs.writeFile(filePath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  }
  console.log(`${fileName}: ${removed} orphaned key(s) ${DRY_RUN ? 'would be removed' : 'removed'}`)
}
