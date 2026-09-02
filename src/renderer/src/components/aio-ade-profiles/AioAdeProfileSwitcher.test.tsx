// @vitest-environment happy-dom

import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '@/store'
import type {
  AioAdeProfileAuthStatus,
  AioAdeProfileSummary
} from '../../../../shared/aio-ade-profiles'
import { AioAdeProfileSwitcher } from './AioAdeProfileSwitcher'

const mocks = vi.hoisted(() => ({
  state: {} as Partial<AppState>
}))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: Partial<AppState>) => unknown) => selector(mocks.state)
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuSub: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuSubContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuSubTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    'aria-label': ariaLabel
  }: {
    children: ReactNode
    'aria-label'?: string
  }) => <button aria-label={ariaLabel}>{children}</button>
}))

vi.mock('./AioAdeProfileAvatar', () => ({
  AioAdeProfileAvatar: () => <span data-testid="avatar" />
}))

vi.mock('./AioAdeProfileCreateDialog', () => ({
  AioAdeProfileCreateDialog: () => <div data-testid="create-dialog" />
}))

vi.mock('./AioAdeProfileManagementDialog', () => ({
  AioAdeProfileManagementDialog: () => <div data-testid="management-dialog" />
}))

vi.mock('./AioAdeProfileSwitchConfirmDialog', () => ({
  AioAdeProfileSwitchConfirmDialog: () => <div data-testid="switch-confirm-dialog" />
}))

vi.mock('./AioAdeProfileSignOutConfirmDialog', () => ({
  AioAdeProfileSignOutConfirmDialog: () => <div data-testid="signout-confirm-dialog" />
}))

vi.mock('./aio-ade-profile-switch-liveness', () => ({
  getAioAdeProfileSwitchLiveWorkSummary: () => ({ hasLiveWork: false })
}))

const cloudProfile: AioAdeProfileSummary = {
  id: 'local-default',
  name: 'Personal',
  avatar: { kind: 'initials', initials: 'P', color: 'neutral' },
  kind: 'cloud-linked',
  createdAt: 1,
  updatedAt: 1,
  lastOpenedAt: 1,
  cloud: {
    cloudProfileId: 'cloud-1',
    userId: 'user-1',
    email: 'nina@example.com',
    activeOrgId: 'org-1',
    activeOrgName: 'Acme',
    linkedAt: 2
  }
}

const localProfile: AioAdeProfileSummary = {
  id: 'local-default',
  name: 'Personal',
  avatar: { kind: 'initials', initials: 'P', color: 'neutral' },
  kind: 'local',
  createdAt: 1,
  updatedAt: 1,
  lastOpenedAt: 1
}

const connectedAuthStatus: AioAdeProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: true,
  state: 'connected',
  persistence: 'encrypted',
  cloud: cloudProfile.cloud,
  organizations: [
    { orgId: 'org-1', name: 'Acme' },
    { orgId: 'org-2', name: 'Globex' }
  ]
}

const unconfiguredAuthStatus: AioAdeProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: false,
  state: 'unconfigured',
  persistence: 'none'
}

const signedOutAuthStatus: AioAdeProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: true,
  state: 'local',
  persistence: 'none'
}

function baseState(overrides: Partial<AppState>): Partial<AppState> {
  return {
    aioAdeProfiles: [cloudProfile],
    activeAioAdeProfileId: 'local-default',
    aioAdeProfilesLoading: false,
    aioAdeProfileSwitching: false,
    aioAdeProfileConnecting: false,
    aioAdeProfileAuthStatus: connectedAuthStatus,
    aioAdeProfilesMultiProfileUi: false,
    fetchAioAdeProfiles: vi.fn(),
    createLocalAioAdeProfile: vi.fn(),
    createCloudLinkedAioAdeProfile: vi.fn(),
    connectCurrentAioAdeProfile: vi.fn(),
    signOutCurrentAioAdeProfile: vi.fn(),
    selectAioAdeProfileOrg: vi.fn(),
    switchAioAdeProfile: vi.fn(),
    ...overrides
  }
}

describe('AioAdeProfileSwitcher', () => {
  beforeEach(() => {
    mocks.state = baseState({})
  })

  it('renders an account menu without profile management when the flag is off and cloud is configured', () => {
    mocks.state = baseState({ aioAdeProfilesMultiProfileUi: false })
    const html = renderToStaticMarkup(<AioAdeProfileSwitcher />)

    expect(html).toContain('aria-label="Account"')
    expect(html).toContain('nina@example.com')
    expect(html).toContain('Acme')
    // Cloud actions stay reachable in the downscoped account menu.
    expect(html).toContain('Sign out')
    expect(html).not.toContain('Reconnect profile')
    // Profile management surfaces are gone.
    expect(html).not.toContain('Manage profiles')
    expect(html).not.toContain('New local profile')
    expect(html).not.toContain('Create profile for org')
    expect(html).not.toContain('data-testid="create-dialog"')
    expect(html).not.toContain('data-testid="management-dialog"')
    expect(html).not.toContain('data-testid="switch-confirm-dialog"')
    // Sign-out remains mounted.
    expect(html).toContain('data-testid="signout-confirm-dialog"')
  })

  it('presents only the sign-in action before an account identity exists', () => {
    mocks.state = baseState({
      aioAdeProfiles: [localProfile],
      aioAdeProfileAuthStatus: signedOutAuthStatus,
      aioAdeProfilesMultiProfileUi: false
    })
    const html = renderToStaticMarkup(<AioAdeProfileSwitcher />)

    expect(html).toContain('Sign in to AIO-ADE')
    expect(html).not.toContain('AIO-ADE account')
    expect(html).not.toContain('Signed out')
    expect(html).not.toContain('Personal')
    expect(html).not.toContain('>Local<')
  })

  it('gives a reconnect-required account an explicit recovery action', () => {
    mocks.state = baseState({
      aioAdeProfileAuthStatus: {
        ...connectedAuthStatus,
        state: 'reconnect-required'
      },
      aioAdeProfilesMultiProfileUi: false
    })
    const html = renderToStaticMarkup(<AioAdeProfileSwitcher />)

    expect(html).toContain('nina@example.com')
    expect(html).toContain('Sign-in required')
    expect(html).toContain('Sign in again')
  })

  it('names the pending browser authentication step', () => {
    mocks.state = baseState({
      aioAdeProfiles: [localProfile],
      aioAdeProfileAuthStatus: signedOutAuthStatus,
      aioAdeProfileConnecting: true,
      aioAdeProfilesMultiProfileUi: false
    })
    const html = renderToStaticMarkup(<AioAdeProfileSwitcher />)

    expect(html).toContain('Waiting for sign-in…')
  })

  it('renders nothing when the flag is off and cloud is unconfigured', () => {
    mocks.state = baseState({
      aioAdeProfilesMultiProfileUi: false,
      aioAdeProfileAuthStatus: unconfiguredAuthStatus
    })
    const html = renderToStaticMarkup(<AioAdeProfileSwitcher />)

    expect(html).toBe('')
  })

  it('renders the full multi-profile menu when the flag is on', () => {
    mocks.state = baseState({ aioAdeProfilesMultiProfileUi: true })
    const html = renderToStaticMarkup(<AioAdeProfileSwitcher />)

    expect(html).toContain('aria-label="Switch profile"')
    expect(html).toContain('Manage profiles')
    expect(html).toContain('New local profile')
    expect(html).toContain('Create profile for org')
    expect(html).toContain('data-testid="create-dialog"')
    expect(html).toContain('data-testid="management-dialog"')
    expect(html).toContain('data-testid="switch-confirm-dialog"')
  })
})
