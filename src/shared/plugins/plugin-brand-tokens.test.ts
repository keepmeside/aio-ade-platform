import { describe, expect, it } from 'vitest'
import {
  LEGACY_PLUGIN_ENGINE_FIELD,
  LEGACY_PLUGIN_MANIFEST_FILENAME,
  LEGACY_PLUGIN_MARKETPLACE_FILENAME,
  PLUGIN_ENGINE_FIELD,
  PLUGIN_MANIFEST_FILENAMES,
  PLUGIN_MANIFEST_FILENAME,
  PLUGIN_MARKETPLACE_FILENAMES,
  PLUGIN_MARKETPLACE_FILENAME,
  readPluginEngineRange
} from './plugin-brand-tokens'

describe('plugin-facing file names', () => {
  it('writes the current names and still reads the pre-rebrand ones', () => {
    expect(PLUGIN_MANIFEST_FILENAME).toBe('aio-ade-plugin.json')
    expect(PLUGIN_MARKETPLACE_FILENAME).toBe('aio-ade-marketplace.json')
    // Third-party plugins ship these files; a host that only reads the new name treats every
    // already-installed plugin as broken, and the marketplace index this build does not own
    // still serves the old file.
    expect(LEGACY_PLUGIN_MANIFEST_FILENAME).toBe('orca-plugin.json')
    expect(LEGACY_PLUGIN_MARKETPLACE_FILENAME).toBe('orca-marketplace.json')
  })

  it('orders candidates canonical-first', () => {
    expect(PLUGIN_MANIFEST_FILENAMES).toEqual(['aio-ade-plugin.json', 'orca-plugin.json'])
    expect(PLUGIN_MARKETPLACE_FILENAMES).toEqual([
      'aio-ade-marketplace.json',
      'orca-marketplace.json'
    ])
  })
})

describe('readPluginEngineRange', () => {
  it('reads the current engines field', () => {
    expect(readPluginEngineRange({ [PLUGIN_ENGINE_FIELD]: '>=1.4.0' })).toBe('>=1.4.0')
  })

  it('reads an engines field written before the rebrand', () => {
    expect(readPluginEngineRange({ [LEGACY_PLUGIN_ENGINE_FIELD]: '>=1.4.0' })).toBe('>=1.4.0')
  })

  it('prefers the current field when a manifest declares both', () => {
    expect(
      readPluginEngineRange({
        [PLUGIN_ENGINE_FIELD]: '>=2.0.0',
        [LEGACY_PLUGIN_ENGINE_FIELD]: '>=1.0.0'
      })
    ).toBe('>=2.0.0')
  })

  it('returns null for a missing or non-string range', () => {
    expect(readPluginEngineRange({})).toBe(null)
    expect(readPluginEngineRange(undefined)).toBe(null)
    expect(readPluginEngineRange(null)).toBe(null)
    expect(readPluginEngineRange({ [PLUGIN_ENGINE_FIELD]: 7 })).toBe(null)
    expect(readPluginEngineRange('>=1.0.0')).toBe(null)
  })

  it('names the current field so error copy does not teach the old one', () => {
    expect(PLUGIN_ENGINE_FIELD).toBe('aio-ade')
    expect(LEGACY_PLUGIN_ENGINE_FIELD).toBe('orca')
  })
})
