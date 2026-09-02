import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  PLUGIN_MANIFEST_FILENAME,
  PLUGIN_MANIFEST_FILENAMES
} from '../../shared/plugins/plugin-brand-tokens'

/** A manifest is startup metadata, not an artifact payload. Bounding it keeps
 * discovery and install preview from allocating an attacker-sized JSON file. */
export const PLUGIN_MANIFEST_MAX_BYTES = 1024 * 1024

/**
 * The manifest this plugin actually ships, preferring the current file name.
 * Returns the canonical path when neither exists so callers report the name to add.
 */
export function resolvePluginManifestPath(rootDir: string): string {
  const candidates = PLUGIN_MANIFEST_FILENAMES.map((fileName) => join(rootDir, fileName))
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!
}

export function hasPluginManifest(rootDir: string): boolean {
  return PLUGIN_MANIFEST_FILENAMES.some((fileName) => existsSync(join(rootDir, fileName)))
}

export async function readPluginManifestText(rootDir: string): Promise<string> {
  const chunks: Buffer[] = []
  let totalBytes = 0
  const manifestPath = resolvePluginManifestPath(rootDir)
  const stream = createReadStream(manifestPath)
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += bytes.byteLength
    if (totalBytes > PLUGIN_MANIFEST_MAX_BYTES) {
      throw new Error(`${PLUGIN_MANIFEST_FILENAME} exceeds ${PLUGIN_MANIFEST_MAX_BYTES} bytes`)
    }
    chunks.push(bytes)
  }
  return Buffer.concat(chunks, totalBytes).toString('utf8')
}
