import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { i18n } from '../../i18n/i18n'
import { useAppStore } from '../../store'
import { AgentAuthProfilesPane } from './AgentAuthProfilesPane'

function renderPane(): string {
  return renderToStaticMarkup(React.createElement(AgentAuthProfilesPane))
}

// renderToStaticMarkup makes useSyncExternalStore read the zustand server
// snapshot (getInitialState), so setState is invisible — patch the initial
// state object itself and restore it afterward (same trick as AgentsPane).
function withSearchQuery<T>(query: string, run: () => T): T {
  const initialState = useAppStore.getInitialState() as unknown as {
    settingsSearchQuery: string
  }
  const priorQuery = initialState.settingsSearchQuery
  initialState.settingsSearchQuery = query
  try {
    return run()
  } finally {
    initialState.settingsSearchQuery = priorQuery
  }
}

describe('AgentAuthProfilesPane', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    useAppStore.setState({ settingsSearchQuery: '' })
  })

  it('renders both provider sections in the loading state before the list resolves', () => {
    const markup = renderPane()

    expect(markup).toContain('agent-auth-profiles-claude')
    expect(markup).toContain('agent-auth-profiles-codex')
    expect(markup).toContain('Loading API profiles…')
    expect(markup).toContain('Add Profile')
    // Static render never runs effects, so the IPC list call never fires and
    // the default state stays unknown — rows must stay hidden while loading.
    expect(markup).not.toContain('Account / CLI default (no profile)')
  })

  it('hides sections whose search entries do not match the settings search query', () => {
    const markup = withSearchQuery('does-not-match-anything', renderPane)

    expect(markup).not.toContain('agent-auth-profiles-claude')
    expect(markup).not.toContain('agent-auth-profiles-codex')
    expect(markup).not.toContain('Add Profile')
  })

  it('keeps only the codex section when the search query matches codex', () => {
    const markup = withSearchQuery('codex', renderPane)

    expect(markup).toContain('agent-auth-profiles-codex')
    expect(markup).toContain('Add Profile')
    expect(markup).not.toContain('agent-auth-profiles-claude')
  })
})
