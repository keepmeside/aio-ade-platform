import { Copy, Loader2, Pencil, Plus, Trash2, Zap } from 'lucide-react'
import type { AgentAuthProfileProvider } from '../../../../shared/agent-auth-profile-types'
import type {
  AgentAuthProfileListEntry,
  AgentAuthProfileListSnapshot
} from '../../../../shared/agent-auth-profile-service-results'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { translate } from '@/i18n/i18n'
import { ClaudeIcon, OpenAIIcon } from '../status-bar/icons'
import { SearchableSetting } from './SearchableSetting'
import {
  getAgentAuthProfilesClaudeSearchEntries,
  getAgentAuthProfilesCodexSearchEntries
} from './agent-auth-profiles-search'

export type AgentAuthProfilesPaneAction =
  | 'idle'
  | `delete:${string}`
  | `duplicate:${string}`
  | `test:${string}`
  | `default:${string}`
  | `clear-default:${AgentAuthProfileProvider}`

type AgentAuthProfilesProviderSectionProps = {
  provider: AgentAuthProfileProvider
  snapshot: AgentAuthProfileListSnapshot | null
  loadError: string | null
  action: AgentAuthProfilesPaneAction
  onAdd: (provider: AgentAuthProfileProvider) => void
  onSetDefault: (provider: AgentAuthProfileProvider, profileId: string) => Promise<void>
  onClearDefault: (provider: AgentAuthProfileProvider) => Promise<void>
  onTest: (profile: AgentAuthProfileListEntry) => Promise<void>
  onEdit: (profile: AgentAuthProfileListEntry) => void
  onDuplicate: (profile: AgentAuthProfileListEntry) => Promise<void>
  onDelete: (profile: AgentAuthProfileListEntry) => void
}

// One provider's profile list: default selection rows, live-session gating on
// edit/delete, and per-row test/duplicate actions. The pane owns the snapshot,
// search gating, and every mutation; this section only renders and reports.

export function AgentAuthProfilesProviderSection({
  provider,
  snapshot,
  loadError,
  action,
  onAdd,
  onSetDefault,
  onClearDefault,
  onTest,
  onEdit,
  onDuplicate,
  onDelete
}: AgentAuthProfilesProviderSectionProps): React.JSX.Element {
  const searchEntries =
    provider === 'claude'
      ? getAgentAuthProfilesClaudeSearchEntries()
      : getAgentAuthProfilesCodexSearchEntries()
  const profiles = (snapshot?.profiles ?? []).filter((profile) => profile.provider === provider)
  const defaultProfileId = snapshot?.defaultProfileIdByProvider[provider] ?? null

  return (
    <section id={`agent-auth-profiles-${provider}`} className="space-y-4 scroll-mt-6">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {provider === 'claude' ? <ClaudeIcon size={16} /> : <OpenAIIcon size={16} />}
          {translate(
            provider === 'claude'
              ? 'auto.components.settings.AgentAuthProfilesPane.claudeSectionTitle'
              : 'auto.components.settings.AgentAuthProfilesPane.codexSectionTitle',
            provider === 'claude' ? 'Claude' : 'Codex'
          )}
        </h3>
        <p className="text-xs text-muted-foreground">
          {translate(
            provider === 'claude'
              ? 'auto.components.settings.AgentAuthProfilesPane.claudeSectionDescription'
              : 'auto.components.settings.AgentAuthProfilesPane.codexSectionDescription',
            provider === 'claude'
              ? 'Named credential profiles for Claude agent sessions with optional endpoint, header, and proxy overrides.'
              : 'Named OPENAI_API_KEY profiles for Codex agent sessions with optional endpoint and proxy overrides.'
          )}
        </p>
      </div>
      <SearchableSetting
        title={searchEntries[0].title}
        description={searchEntries[0].description}
        keywords={['api', 'profile', 'key', provider]}
        className="space-y-3 py-2"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label>
              {translate(
                'auto.components.settings.AgentAuthProfilesPane.profilesLabel',
                'Profiles'
              )}
            </Label>
            <p className="text-xs text-muted-foreground">
              {translate(
                'auto.components.settings.AgentAuthProfilesPane.profilesCaption',
                'New agent sessions launch with the default profile. Click a profile to make it the default.'
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="xs"
            className="gap-1.5"
            disabled={action !== 'idle'}
            onClick={() => onAdd(provider)}
          >
            <Plus className="size-3" />
            {translate('auto.components.settings.AgentAuthProfilesPane.addProfile', 'Add Profile')}
          </Button>
        </div>
        {snapshot === null && loadError === null ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            {translate(
              'auto.components.settings.AgentAuthProfilesPane.loading',
              'Loading API profiles…'
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void onClearDefault(provider)}
              disabled={action !== 'idle'}
              className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                defaultProfileId === null
                  ? 'border-foreground/20 bg-accent/15'
                  : 'border-border/70 hover:border-border hover:bg-accent/8'
              } disabled:cursor-default disabled:opacity-100`}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {translate(
                      'auto.components.settings.AgentAuthProfilesPane.accountOnlyTitle',
                      'Account / CLI default (no profile)'
                    )}
                  </span>
                  {defaultProfileId === null ? (
                    <Badge
                      variant="outline"
                      className="h-4 shrink-0 rounded px-1.5 text-[10px] font-medium leading-none text-foreground/80"
                    >
                      {translate(
                        'auto.components.settings.AgentAuthProfilesPane.activeBadge',
                        'Active'
                      )}
                    </Badge>
                  ) : null}
                </div>
                <span className="truncate text-[11px] text-muted-foreground">
                  {translate(
                    'auto.components.settings.AgentAuthProfilesPane.accountOnlyDescription',
                    'Launch with your signed-in account and existing CLI configuration.'
                  )}
                </span>
              </div>
            </button>
            {profiles.length === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
                {translate(
                  'auto.components.settings.AgentAuthProfilesPane.empty',
                  'No API profiles yet. Add one to launch agent sessions with dedicated credentials.'
                )}
              </div>
            ) : (
              profiles.map((profile) => {
                const isDefault = defaultProfileId === profile.id
                const liveBlocked = profile.liveSessionCount > 0
                const liveBlockTitle = liveBlocked
                  ? translate(
                      'auto.components.settings.AgentAuthProfilesPane.liveBlockTitle',
                      'Stop live sessions using this profile first'
                    )
                  : undefined
                const metaParts = [
                  profile.id,
                  profile.model,
                  profile.baseUrl,
                  profile.hasApiKey
                    ? translate(
                        'auto.components.settings.AgentAuthProfilesPane.apiKeyStored',
                        'API key stored'
                      )
                    : translate(
                        'auto.components.settings.AgentAuthProfilesPane.noApiKey',
                        'no API key'
                      )
                ].filter((part) => part !== null && part !== undefined && part !== '')

                return (
                  <div
                    key={profile.id}
                    className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                      isDefault
                        ? 'border-foreground/20 bg-accent/15'
                        : 'border-border/70 hover:border-border hover:bg-accent/8'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-3 max-md:flex-col max-md:items-start">
                      <button
                        type="button"
                        onClick={() => void onSetDefault(provider, profile.id)}
                        disabled={action !== 'idle'}
                        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left disabled:cursor-default"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {profile.label ?? profile.id}
                          </span>
                          {isDefault ? (
                            <Badge
                              variant="outline"
                              className="h-4 shrink-0 rounded px-1.5 text-[10px] font-medium leading-none text-foreground/80"
                            >
                              {translate(
                                'auto.components.settings.AgentAuthProfilesPane.defaultBadge',
                                'Default'
                              )}
                            </Badge>
                          ) : null}
                          {liveBlocked ? (
                            <Badge
                              variant="outline"
                              className="h-4 shrink-0 rounded px-1.5 text-[10px] font-medium leading-none text-foreground/70"
                            >
                              {translate(
                                'auto.components.settings.AgentAuthProfilesPane.liveBadge',
                                '{{count}} live',
                                { count: profile.liveSessionCount }
                              )}
                            </Badge>
                          ) : null}
                        </div>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {metaParts.join(' · ')}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center justify-end gap-1 max-md:w-full max-md:flex-wrap">
                        <Button
                          variant="ghost"
                          size="xs"
                          className="gap-1.5"
                          disabled={action !== 'idle'}
                          onClick={() => void onTest(profile)}
                        >
                          {action === `test:${profile.id}` ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Zap className="size-3" />
                          )}
                          {translate(
                            'auto.components.settings.AgentAuthProfilesPane.testAction',
                            'Test'
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="gap-1.5"
                          disabled={action !== 'idle' || liveBlocked}
                          title={liveBlockTitle}
                          onClick={() => onEdit(profile)}
                        >
                          <Pencil className="size-3" />
                          {translate(
                            'auto.components.settings.AgentAuthProfilesPane.editAction',
                            'Edit'
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="gap-1.5"
                          disabled={action !== 'idle'}
                          onClick={() => void onDuplicate(profile)}
                        >
                          {action === `duplicate:${profile.id}` ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                          {translate(
                            'auto.components.settings.AgentAuthProfilesPane.duplicateAction',
                            'Duplicate'
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="h-6 px-2 text-muted-foreground hover:text-destructive"
                          disabled={action !== 'idle' || liveBlocked}
                          title={liveBlockTitle}
                          onClick={() => onDelete(profile)}
                        >
                          {action === `delete:${profile.id}` ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Trash2 className="size-3" />
                          )}
                          {translate(
                            'auto.components.settings.AgentAuthProfilesPane.deleteAction',
                            'Delete'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </SearchableSetting>
    </section>
  )
}
