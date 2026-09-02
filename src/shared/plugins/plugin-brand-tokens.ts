/* Brand tokens that cross into plugin authors' files and installed plugin trees.
 *
 * A plugin's manifest and the marketplace index are written by people who do not track this
 * repository, so every one of these names has to stay readable after the rebrand: a host that
 * only knows the new name reports every already-installed plugin as broken, which looks like
 * plugin corruption rather than a rename. Reads accept both, canonical is what this build
 * writes and what error copy names. */

export const PLUGIN_MANIFEST_FILENAME = 'aio-ade-plugin.json'
export const LEGACY_PLUGIN_MANIFEST_FILENAME = 'orca-plugin.json'
export const PLUGIN_MANIFEST_FILENAMES: readonly string[] = [
  PLUGIN_MANIFEST_FILENAME,
  LEGACY_PLUGIN_MANIFEST_FILENAME
]

export const PLUGIN_MARKETPLACE_FILENAME = 'aio-ade-marketplace.json'
export const LEGACY_PLUGIN_MARKETPLACE_FILENAME = 'orca-marketplace.json'
export const PLUGIN_MARKETPLACE_FILENAMES: readonly string[] = [
  PLUGIN_MARKETPLACE_FILENAME,
  LEGACY_PLUGIN_MARKETPLACE_FILENAME
]

/** Manifest `engines` key naming the minimum host version. */
export const PLUGIN_ENGINE_FIELD = 'aio-ade'
export const LEGACY_PLUGIN_ENGINE_FIELD = 'orca'

/** The declared host-version range from either spelling, or null when absent. */
export function readPluginEngineRange(engines: unknown): string | null {
  if (!engines || typeof engines !== 'object' || Array.isArray(engines)) {
    return null
  }
  const record = engines as Record<string, unknown>
  for (const field of [PLUGIN_ENGINE_FIELD, LEGACY_PLUGIN_ENGINE_FIELD]) {
    const range = record[field]
    if (typeof range === 'string') {
      return range
    }
  }
  return null
}
