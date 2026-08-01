import { useEffect, useState } from 'react'
import { BROWSER_USE_ENABLED_STORAGE_KEY } from '@/lib/browser-use-setup-state'
import { useAppStore } from '../../store'
import { BROWSER_FAMILY_LABELS } from '../../../../shared/constants'
import { matchesSettingsSearch } from './settings-search'
import { getBrowserUsePaneSearchEntries } from './browser-use-search'
import { BrowserUseExamples } from './BrowserUseExamples'
import { BrowserUseComputerUseNotice } from './BrowserUseComputerUseNotice'
import { BrowserUseEnableSwitch } from './BrowserUseEnableSwitch'
import { BrowserUseCookieImportStep } from './BrowserUseCookieImportStep'
import { translate } from '@/i18n/i18n'

type BrowserUseSetupProps = {
  onConfigureMoreBrowsers?: () => void
  onOpenComputerUse?: () => void
}

export function BrowserUseSetup({
  onConfigureMoreBrowsers,
  onOpenComputerUse
}: BrowserUseSetupProps = {}): React.JSX.Element {
  const searchQuery = useAppStore((s) => s.settingsSearchQuery)
  const browserSessionProfiles = useAppStore((s) => s.browserSessionProfiles)
  const fetchBrowserSessionProfiles = useAppStore((s) => s.fetchBrowserSessionProfiles)
  const browserSessionImportState = useAppStore((s) => s.browserSessionImportState)

  const [browserUseEnabled, setBrowserUseEnabled] = useState<boolean>(() => {
    return localStorage.getItem(BROWSER_USE_ENABLED_STORAGE_KEY) === '1'
  })

  const toggleBrowserUse = (value: boolean): void => {
    setBrowserUseEnabled(value)
    localStorage.setItem(BROWSER_USE_ENABLED_STORAGE_KEY, value ? '1' : '0')
    if (value) {
      useAppStore.getState().recordFeatureInteraction('agent-browser-setup')
    }
  }

  useEffect(() => {
    if (!browserUseEnabled) {
      return
    }
    void fetchBrowserSessionProfiles()
  }, [browserUseEnabled, fetchBrowserSessionProfiles])

  const defaultProfile = browserSessionProfiles.find((p) => p.id === 'default')
  const cookiesImported = !!defaultProfile?.source

  const isImportingDefault =
    browserSessionImportState?.profileId === 'default' &&
    browserSessionImportState.status === 'importing'

  const showCookieImport = matchesSettingsSearch(searchQuery, getBrowserUsePaneSearchEntries())

  const sourceLabel = defaultProfile?.source
    ? `${BROWSER_FAMILY_LABELS[defaultProfile.source.browserFamily] ?? defaultProfile.source.browserFamily}${defaultProfile.source.profileName ? ` (${defaultProfile.source.profileName})` : ''}`
    : null

  if (!browserUseEnabled) {
    return (
      <div className="flex items-center justify-between gap-4 py-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {translate('auto.components.settings.BrowserUsePane.b8a1f2d84d', 'Agent Browser Use')}
          </p>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.BrowserUsePane.96b91c6349',
              'Let coding agents drive this browser with your logins.'
            )}
          </p>
        </div>
        <BrowserUseEnableSwitch
          enabled={browserUseEnabled}
          onToggle={() => toggleBrowserUse(!browserUseEnabled)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">
            {translate('auto.components.settings.BrowserUsePane.b8a1f2d84d', 'Agent Browser Use')}
          </p>
          <p className="text-xs text-muted-foreground">
            {translate(
              'auto.components.settings.BrowserUsePane.browserControlDescription',
              'Let coding agents drive this browser with your logins.'
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BrowserUseEnableSwitch
            enabled={browserUseEnabled}
            onToggle={() => toggleBrowserUse(!browserUseEnabled)}
          />
        </div>
      </div>

      {onOpenComputerUse ? (
        <BrowserUseComputerUseNotice onOpenComputerUse={onOpenComputerUse} />
      ) : null}

      {showCookieImport ? (
        <BrowserUseCookieImportStep
          cookiesImported={cookiesImported}
          isImportingDefault={isImportingDefault}
          sourceLabel={sourceLabel}
          onConfigureMoreBrowsers={onConfigureMoreBrowsers}
        />
      ) : null}

      <BrowserUseExamples />
    </div>
  )
}
