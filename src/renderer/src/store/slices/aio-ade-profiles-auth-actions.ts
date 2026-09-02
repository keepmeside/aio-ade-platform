import type { StateCreator } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  ConnectCurrentAioAdeProfileResult,
  CreateCloudLinkedAioAdeProfileResult,
  RefreshCurrentAioAdeProfileAuthResult,
  SelectAioAdeProfileOrgResult,
  SignOutCurrentAioAdeProfileResult
} from '../../../../shared/aio-ade-profiles'
import type { AppState } from '../types'

export type AioAdeProfilesAuthActions = {
  createCloudLinkedAioAdeProfile: (args: {
    orgId?: string
    name?: string
  }) => Promise<CreateCloudLinkedAioAdeProfileResult | null>
  connectCurrentAioAdeProfile: () => Promise<ConnectCurrentAioAdeProfileResult | null>
  refreshCurrentAioAdeProfileAuth: () => Promise<RefreshCurrentAioAdeProfileAuthResult | null>
  signOutCurrentAioAdeProfile: () => Promise<SignOutCurrentAioAdeProfileResult | null>
  selectAioAdeProfileOrg: (orgId: string) => Promise<SelectAioAdeProfileOrgResult | null>
}

// Why a separate module: the cloud-auth actions share the profiles slice's
// state keys but form their own cohesive surface (connect/refresh/sign-out/
// org selection), and the combined slice file exceeded the repo line budget.
export const createAioAdeProfilesAuthActions: StateCreator<
  AppState,
  [],
  [],
  AioAdeProfilesAuthActions
> = (set, get) => ({
  createCloudLinkedAioAdeProfile: async (args) => {
    try {
      const result = await window.api.aioAdeProfiles.createCloudLinked(args)
      set({
        aioAdeProfileAuthStatus: result.auth,
        ...(result.status === 'created'
          ? {
              activeAioAdeProfileId: result.activeProfileId,
              aioAdeProfiles: result.profiles
            }
          : {})
      })
      if (result.status === 'created') {
        toast.success(
          translate('auto.store.slices.aio-ade.profiles.319d7cf39b', 'Cloud profile created')
        )
      } else if (result.status === 'reconnect-required') {
        toast.error(
          translate('auto.store.slices.aio-ade.profiles.d6e764e7db', 'Reconnect this profile')
        )
      } else if (result.status === 'failed') {
        toast.error(
          translate(
            'auto.store.slices.aio-ade.profiles.f0c9e11a6d',
            'Failed to create cloud profile'
          ),
          { description: result.error }
        )
      }
      return result
    } catch (err) {
      console.error('Failed to create AIO-ADE cloud profile:', err)
      toast.error(
        translate(
          'auto.store.slices.aio-ade.profiles.f0c9e11a6d',
          'Failed to create cloud profile'
        ),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  connectCurrentAioAdeProfile: async () => {
    if (get().aioAdeProfileConnecting) {
      return null
    }
    set({ aioAdeProfileConnecting: true })
    try {
      const result = await window.api.aioAdeProfiles.connectCurrent()
      set({
        aioAdeProfileConnecting: false,
        aioAdeProfileAuthStatus: result.auth,
        ...(result.status === 'connected'
          ? {
              activeAioAdeProfileId: result.activeProfileId,
              aioAdeProfiles: result.profiles
            }
          : {})
      })
      if (result.status === 'unconfigured') {
        toast.error(
          translate(
            'auto.store.slices.aio-ade.profiles.8b8fa73174',
            'AIO-ADE Cloud sign-in is not configured'
          ),
          {
            description: result.auth.setupMessage
          }
        )
      } else if (result.status === 'failed') {
        toast.error(
          translate('auto.store.slices.aio-ade.profiles.33290e88ed', 'Failed to connect profile'),
          { description: result.error }
        )
      } else if (result.status === 'connected') {
        toast.success(
          translate('auto.store.slices.aio-ade.profiles.9fcb07a796', 'Profile connected')
        )
      }
      return result
    } catch (err) {
      console.error('Failed to connect AIO-ADE profile:', err)
      set({ aioAdeProfileConnecting: false })
      toast.error(
        translate('auto.store.slices.aio-ade.profiles.33290e88ed', 'Failed to connect profile'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  refreshCurrentAioAdeProfileAuth: async () => {
    try {
      const result = await window.api.aioAdeProfiles.refreshAuth()
      set({
        aioAdeProfileAuthStatus: result.auth,
        ...(result.status === 'refreshed'
          ? {
              activeAioAdeProfileId: result.activeProfileId,
              aioAdeProfiles: result.profiles
            }
          : {})
      })
      if (result.status === 'reconnect-required') {
        toast.error(
          translate('auto.store.slices.aio-ade.profiles.d6e764e7db', 'Reconnect this profile')
        )
      } else if (result.status === 'failed') {
        toast.error(
          translate(
            'auto.store.slices.aio-ade.profiles.2f6c78a039',
            'Failed to refresh profile auth'
          ),
          { description: result.error }
        )
      }
      return result
    } catch (err) {
      console.error('Failed to refresh AIO-ADE profile auth:', err)
      toast.error(
        translate(
          'auto.store.slices.aio-ade.profiles.2f6c78a039',
          'Failed to refresh profile auth'
        ),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  signOutCurrentAioAdeProfile: async () => {
    try {
      const result = await window.api.aioAdeProfiles.signOutCurrent()
      set({
        activeAioAdeProfileId: result.activeProfileId,
        aioAdeProfiles: result.profiles,
        aioAdeProfileAuthStatus: result.auth
      })
      toast.success(
        translate('auto.store.slices.aio-ade.profiles.a37b5e6d37', 'Signed out of profile')
      )
      return result
    } catch (err) {
      console.error('Failed to sign out of AIO-ADE profile:', err)
      toast.error(
        translate('auto.store.slices.aio-ade.profiles.83600521e7', 'Failed to sign out'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  selectAioAdeProfileOrg: async (orgId) => {
    try {
      const result = await window.api.aioAdeProfiles.selectOrg({ orgId })
      set({
        aioAdeProfileAuthStatus: result.auth,
        ...(result.status === 'selected'
          ? {
              activeAioAdeProfileId: result.activeProfileId,
              aioAdeProfiles: result.profiles
            }
          : {})
      })
      if (result.status === 'reconnect-required') {
        toast.error(
          translate('auto.store.slices.aio-ade.profiles.d6e764e7db', 'Reconnect this profile')
        )
      } else if (result.status === 'failed') {
        toast.error(
          translate(
            'auto.store.slices.aio-ade.profiles.76deec8f58',
            'Failed to switch organization'
          ),
          { description: result.error }
        )
      }
      return result
    } catch (err) {
      console.error('Failed to switch AIO-ADE profile org:', err)
      toast.error(
        translate('auto.store.slices.aio-ade.profiles.76deec8f58', 'Failed to switch organization'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  }
})
