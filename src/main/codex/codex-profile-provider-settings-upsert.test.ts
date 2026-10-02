import { describe, expect, it } from 'vitest'
import {
  removeCodexProfileProviderSettings,
  upsertCodexProfileProviderSettings
} from './codex-profile-provider-settings-upsert'

const SETTINGS = {
  providerId: 'profile-work-glm',
  baseUrl: 'https://open.bigmodel.cn/api/codex',
  envKey: 'OPENAI_API_KEY',
  model: 'glm-4.6'
}

describe('upsertCodexProfileProviderSettings', () => {
  it('appends the provider table and pins into a config that has neither', () => {
    const content = [
      'model = "gpt-5.2"',
      'approval_policy = "never"',
      '',
      '[projects."/home/user/work"]',
      'trust_level = "trusted"',
      ''
    ].join('\n')
    const result = upsertCodexProfileProviderSettings(content, SETTINGS)
    expect(result).toBe(
      [
        'model = "glm-4.6"',
        'approval_policy = "never"',
        'model_provider = "profile-work-glm"',
        '',
        '[projects."/home/user/work"]',
        'trust_level = "trusted"',
        '',
        '[model_providers."profile-work-glm"]',
        'name = "profile-work-glm"',
        `base_url = "${SETTINGS.baseUrl}"`,
        'env_key = "OPENAI_API_KEY"',
        ''
      ].join('\n')
    )
    // Idempotent: a second materialization is byte-identical.
    expect(upsertCodexProfileProviderSettings(result, SETTINGS)).toBe(result)
  })

  it('replaces existing table keys in place, keeping comments and sibling keys', () => {
    const content = [
      '# managed by AIO-ADE',
      '[model_providers."profile-work-glm"]',
      '# tuned by hand once',
      'name = "old-name"',
      'base_url = "https://old.example.test"',
      'env_key = "OLD_KEY"',
      'custom_extra = "keep-me"',
      ''
    ].join('\n')
    const result = upsertCodexProfileProviderSettings(content, SETTINGS)
    expect(result).toBe(
      [
        '# managed by AIO-ADE',
        'model = "glm-4.6"',
        'model_provider = "profile-work-glm"',
        '',
        '[model_providers."profile-work-glm"]',
        '# tuned by hand once',
        'name = "profile-work-glm"',
        `base_url = "${SETTINGS.baseUrl}"`,
        'env_key = "OPENAI_API_KEY"',
        'custom_extra = "keep-me"',
        ''
      ].join('\n')
    )
  })

  it('inserts absent keys into the existing table body before a subtable header', () => {
    const content = [
      '[model_providers."profile-work-glm"]',
      'name = "profile-work-glm"',
      '[model_providers."profile-work-glm".extra]',
      'foo = "bar"',
      ''
    ].join('\n')
    const result = upsertCodexProfileProviderSettings(content, SETTINGS)
    expect(result).toBe(
      [
        'model = "glm-4.6"',
        'model_provider = "profile-work-glm"',
        '',
        '[model_providers."profile-work-glm"]',
        'name = "profile-work-glm"',
        `base_url = "${SETTINGS.baseUrl}"`,
        'env_key = "OPENAI_API_KEY"',
        '[model_providers."profile-work-glm".extra]',
        'foo = "bar"',
        ''
      ].join('\n')
    )
  })

  it('overwrites a user model_provider pin — the profile is the explicit source', () => {
    const content = ['model_provider = "openai"', 'model = "gpt-5.2"', ''].join('\n')
    const result = upsertCodexProfileProviderSettings(content, SETTINGS)
    expect(result).toContain('model_provider = "profile-work-glm"')
    expect(result).toContain('model = "glm-4.6"')
    expect(result).not.toContain('"openai"')
  })

  it('leaves the model key untouched when the profile pins no model', () => {
    const content = ['model = "gpt-5.2"', ''].join('\n')
    const result = upsertCodexProfileProviderSettings(content, { ...SETTINGS, model: null })
    expect(result).toBe(
      [
        'model = "gpt-5.2"',
        'model_provider = "profile-work-glm"',
        '',
        '[model_providers."profile-work-glm"]',
        'name = "profile-work-glm"',
        `base_url = "${SETTINGS.baseUrl}"`,
        'env_key = "OPENAI_API_KEY"',
        ''
      ].join('\n')
    )
  })

  it('preserves CRLF endings across replaced and inserted lines', () => {
    const content = [
      'model = "gpt-5.2"\r',
      '[model_providers."profile-work-glm"]\r',
      'base_url = "https://old.example.test"\r',
      ''
    ].join('\n')
    const result = upsertCodexProfileProviderSettings(content, SETTINGS)
    expect(result).toBe(
      [
        'model = "glm-4.6"\r',
        'model_provider = "profile-work-glm"\r',
        '\r',
        '[model_providers."profile-work-glm"]\r',
        `base_url = "${SETTINGS.baseUrl}"\r`,
        'name = "profile-work-glm"\r',
        'env_key = "OPENAI_API_KEY"\r',
        ''
      ].join('\n')
    )
  })

  it('updates dotted preamble keys in place and inserts absent ones beside them', () => {
    const content = [
      'model = "gpt-5.2"',
      'model_providers."profile-work-glm".base_url = "https://old.example.test"',
      ''
    ].join('\n')
    const result = upsertCodexProfileProviderSettings(content, SETTINGS)
    expect(result).toBe(
      [
        'model = "glm-4.6"',
        `model_providers."profile-work-glm".base_url = "${SETTINGS.baseUrl}"`,
        'model_providers."profile-work-glm".name = "profile-work-glm"',
        'model_providers."profile-work-glm".env_key = "OPENAI_API_KEY"',
        'model_provider = "profile-work-glm"',
        ''
      ].join('\n')
    )
  })

  it('updates in-table dotted keys inside a bare [model_providers] parent', () => {
    const content = [
      '[model_providers]',
      'profile-work-glm.base_url = "https://old.example.test"',
      'other.base_url = "https://untouched.example.test"',
      ''
    ].join('\n')
    const result = upsertCodexProfileProviderSettings(content, SETTINGS)
    expect(result).toBe(
      [
        'model = "glm-4.6"',
        'model_provider = "profile-work-glm"',
        '',
        '[model_providers]',
        `profile-work-glm.base_url = "${SETTINGS.baseUrl}"`,
        'profile-work-glm.name = "profile-work-glm"',
        'profile-work-glm.env_key = "OPENAI_API_KEY"',
        'other.base_url = "https://untouched.example.test"',
        ''
      ].join('\n')
    )
  })

  it('never appends a table beside an array-of-tables definition — that would be invalid TOML', () => {
    const content = ['[[model_providers."profile-work-glm"]]', 'name = "old"', ''].join('\n')
    const result = upsertCodexProfileProviderSettings(content, SETTINGS)
    expect(result).toBe(
      [
        'model = "glm-4.6"',
        'model_provider = "profile-work-glm"',
        '',
        '[[model_providers."profile-work-glm"]]',
        'name = "old"',
        ''
      ].join('\n')
    )
  })

  it('quotes provider ids with dots so they stay one table segment', () => {
    const result = upsertCodexProfileProviderSettings('', {
      ...SETTINGS,
      providerId: 'a.profile.v1'
    })
    expect(result).toContain('[model_providers."a.profile.v1"]')
    expect(result).toContain('model_provider = "a.profile.v1"')
  })
})

describe('removeCodexProfileProviderSettings', () => {
  it('drops the table and its own pin, keeping the model and other sections', () => {
    const content = [
      'model = "glm-4.6"',
      'model_provider = "profile-work-glm"',
      '',
      '[model_providers."profile-work-glm"]',
      'name = "profile-work-glm"',
      'base_url = "https://x.example.test"',
      '',
      '[projects."/home/user/work"]',
      'trust_level = "trusted"',
      ''
    ].join('\n')
    const result = removeCodexProfileProviderSettings(content, 'profile-work-glm')
    expect(result).toBe(
      ['model = "glm-4.6"', '', '[projects."/home/user/work"]', 'trust_level = "trusted"', ''].join(
        '\n'
      )
    )
  })

  it('keeps a user model_provider pin that names another provider', () => {
    const content = [
      'model_provider = "openai"',
      '',
      '[model_providers."profile-work-glm"]',
      'base_url = "https://x.example.test"',
      ''
    ].join('\n')
    const result = removeCodexProfileProviderSettings(content, 'profile-work-glm')
    expect(result).toBe(['model_provider = "openai"', ''].join('\n'))
  })

  it('removes dotted preamble keys for the provider', () => {
    const content = [
      'model = "gpt-5.2"',
      'model_providers."profile-work-glm".base_url = "https://x.example.test"',
      'model_providers."other".base_url = "https://y.example.test"',
      ''
    ].join('\n')
    const result = removeCodexProfileProviderSettings(content, 'profile-work-glm')
    expect(result).toBe(
      ['model = "gpt-5.2"', 'model_providers."other".base_url = "https://y.example.test"', ''].join(
        '\n'
      )
    )
  })

  it('is a no-op when nothing belongs to the provider', () => {
    const content = [
      'model = "gpt-5.2"',
      '',
      '[projects."/home/user/work"]',
      'trust_level = "trusted"',
      ''
    ].join('\n')
    expect(removeCodexProfileProviderSettings(content, 'profile-absent')).toBe(content)
  })
})
