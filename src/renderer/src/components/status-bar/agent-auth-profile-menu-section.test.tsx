import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n/i18n'

// Static render cannot host Radix menu context, so the dropdown primitives are
// mocked as pass-through components; the section's own markup stays assertable.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenuItem: function DropdownMenuItem({ children }: { children?: React.ReactNode }) {
    return children ?? null
  },
  DropdownMenuLabel: function DropdownMenuLabel({ children }: { children?: React.ReactNode }) {
    return children ?? null
  },
  DropdownMenuSeparator: function DropdownMenuSeparator() {
    return null
  }
}))

const { isWebClientMock } = vi.hoisted(() => ({
  isWebClientMock: vi.fn((): boolean => false)
}))

vi.mock('@/lib/web-client-location', () => ({
  isWebClientLocation: isWebClientMock
}))

const { AgentAuthProfileMenuSection } = await import('./agent-auth-profile-menu-section')

function renderSection(provider: 'claude' | 'codex'): string {
  return renderToStaticMarkup(React.createElement(AgentAuthProfileMenuSection, { provider }))
}

describe('AgentAuthProfileMenuSection', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
    isWebClientMock.mockReturnValue(false)
  })

  it('renders the quick-switch section with a loading state and the manage deep-link', () => {
    const markup = renderSection('claude')

    expect(markup).toContain('API Profile')
    expect(markup).toContain('Loading API profiles…')
    expect(markup).toContain('Manage API Profiles…')
    // Static render never runs effects, so the IPC list call never fires and
    // the default stays unknown — rows must stay hidden while loading.
    expect(markup).not.toContain('Account / CLI default (no profile)')
  })

  it('stays hidden on web clients where the profile vault IPC does not exist', () => {
    isWebClientMock.mockReturnValue(true)

    const markup = renderSection('codex')

    expect(markup).not.toContain('API Profile')
    expect(markup).not.toContain('Manage API Profiles…')
  })
})
