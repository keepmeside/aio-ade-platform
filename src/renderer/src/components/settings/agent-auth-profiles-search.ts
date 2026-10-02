import type { SettingsSearchEntry } from './settings-search'
import { translate } from '@/i18n/i18n'
import { translateSearchKeyword } from './settings-search-keywords'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export const getAgentAuthProfilesClaudeSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate(
      'auto.components.settings.agent-auth-profiles.search.claudeTitle',
      'Claude API Profiles'
    ),
    description: translate(
      'auto.components.settings.agent-auth-profiles.search.claudeDescription',
      'Named credential profiles for Claude agent sessions with optional endpoint, header, and proxy overrides.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwClaude',
        'claude'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwApiProfile',
        'api profile'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwApiKey',
        'api key'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwAuthToken',
        'auth token'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwSwitch',
        'switch'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwProxy',
        'proxy'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwHeader',
        'custom headers'
      )
    ]
  }
])

export const getAgentAuthProfilesCodexSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate(
      'auto.components.settings.agent-auth-profiles.search.codexTitle',
      'Codex API Profiles'
    ),
    description: translate(
      'auto.components.settings.agent-auth-profiles.search.codexDescription',
      'Named OPENAI_API_KEY profiles for Codex agent sessions with optional endpoint and proxy overrides.'
    ),
    keywords: [
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwCodex',
        'codex'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwApiProfile',
        'api profile'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwApiKey',
        'api key'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwOpenAi',
        'openai'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwSwitch',
        'switch'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwProxy',
        'proxy'
      ),
      ...translateSearchKeyword(
        'auto.components.settings.agent-auth-profiles.search.kwConnectionTest',
        'connection test'
      )
    ]
  }
])

export const getAgentAuthProfilesPaneSearchEntries = createLocalizedCatalog(
  (): SettingsSearchEntry[] => [
    ...getAgentAuthProfilesClaudeSearchEntries(),
    ...getAgentAuthProfilesCodexSearchEntries()
  ]
)
