import type { StateCreator } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  AioAdeProfileAuthStatus,
  AioAdeProfileSummary,
  SwitchAioAdeProfileResult,
  TransferAioAdeProfileProjectArgs,
  TransferAioAdeProfileProjectResult
} from '../../../../shared/aio-ade-profiles'
import type { AppState } from '../types'
import {
  createAioAdeProfilesAuthActions,
  type AioAdeProfilesAuthActions
} from './aio-ade-profiles-auth-actions'

export type AioAdeProfilesSlice = AioAdeProfilesAuthActions & {
  aioAdeProfiles: AioAdeProfileSummary[]
  activeAioAdeProfileId: string | null
  aioAdeProfileAuthStatus: AioAdeProfileAuthStatus | null
  aioAdeProfilesMultiProfileUi: boolean
  aioAdeProfilesLoading: boolean
  aioAdeProfileSwitching: boolean
  aioAdeProfileConnecting: boolean
  fetchAioAdeProfiles: () => Promise<void>
  fetchAioAdeProfileAuthStatus: () => Promise<AioAdeProfileAuthStatus | null>
  createLocalAioAdeProfile: (name?: string) => Promise<AioAdeProfileSummary | null>
  switchAioAdeProfile: (profileId: string) => Promise<SwitchAioAdeProfileResult | null>
  transferAioAdeProfileProject: (
    args: TransferAioAdeProfileProjectArgs
  ) => Promise<TransferAioAdeProfileProjectResult | null>
}

export const createAioAdeProfilesSlice: StateCreator<AppState, [], [], AioAdeProfilesSlice> = (
  set,
  get,
  api
) => ({
  aioAdeProfiles: [],
  activeAioAdeProfileId: null,
  aioAdeProfileAuthStatus: null,
  aioAdeProfilesMultiProfileUi: false,
  aioAdeProfilesLoading: false,
  aioAdeProfileSwitching: false,
  aioAdeProfileConnecting: false,

  fetchAioAdeProfiles: async () => {
    set({ aioAdeProfilesLoading: true })
    try {
      const [state, authStatus] = await Promise.all([
        window.api.aioAdeProfiles.list(),
        window.api.aioAdeProfiles.authStatus()
      ])
      set({
        activeAioAdeProfileId: state.activeProfileId,
        aioAdeProfiles: state.profiles,
        aioAdeProfilesMultiProfileUi: state.multiProfileUi,
        aioAdeProfileAuthStatus: authStatus,
        aioAdeProfilesLoading: false
      })
    } catch (err) {
      console.error('Failed to fetch AIO-ADE profiles:', err)
      set({ aioAdeProfilesLoading: false })
    }
  },

  fetchAioAdeProfileAuthStatus: async () => {
    try {
      const authStatus = await window.api.aioAdeProfiles.authStatus()
      set({ aioAdeProfileAuthStatus: authStatus })
      return authStatus
    } catch (err) {
      console.error('Failed to fetch AIO-ADE profile auth status:', err)
      return null
    }
  },

  createLocalAioAdeProfile: async (name) => {
    try {
      const state = await window.api.aioAdeProfiles.createLocal({ name })
      set({
        activeAioAdeProfileId: state.activeProfileId,
        aioAdeProfiles: state.profiles
      })
      void get().fetchAioAdeProfileAuthStatus()
      return state.profile
    } catch (err) {
      console.error('Failed to create AIO-ADE profile:', err)
      toast.error(
        translate('auto.store.slices.aio-ade.profiles.612f7f6861', 'Failed to create profile'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  ...createAioAdeProfilesAuthActions(set, get, api),

  switchAioAdeProfile: async (profileId) => {
    if (!profileId || profileId === get().activeAioAdeProfileId) {
      return { status: 'already-active' }
    }
    set({ aioAdeProfileSwitching: true })
    try {
      const result = await window.api.aioAdeProfiles.switchProfile({ profileId })
      if (result?.status !== 'relaunching') {
        // Why: only a relaunch may keep the switcher locked; a stale
        // "already-active" answer would otherwise disable it forever.
        set({ aioAdeProfileSwitching: false })
      }
      return result
    } catch (err) {
      console.error('Failed to switch AIO-ADE profile:', err)
      set({ aioAdeProfileSwitching: false })
      toast.error(
        translate('auto.store.slices.aio-ade.profiles.7d4bc516ee', 'Failed to switch profile'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  transferAioAdeProfileProject: async (args) => {
    try {
      const result = await window.api.aioAdeProfiles.transferProject(args)
      if (result.status === 'duplicate-target') {
        toast.error(
          translate(
            'auto.store.slices.aio-ade.profiles.f518e89aa5',
            'Project already exists in that profile'
          )
        )
      }
      if (result.status === 'transferred' && result.willRelaunch) {
        set({ aioAdeProfileSwitching: true })
      }
      return result
    } catch (err) {
      console.error('Failed to transfer AIO-ADE profile project:', err)
      toast.error(
        translate('auto.store.slices.aio-ade.profiles.f03ae7f27b', 'Failed to transfer project'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  }
})
