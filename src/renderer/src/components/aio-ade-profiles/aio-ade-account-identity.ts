import { translate } from '@/i18n/i18n'
import type {
  AioAdeProfileAuthStatus,
  AioAdeProfileSummary
} from '../../../../shared/aio-ade-profiles'

export function getAioAdeAccountIdentity(
  profile: AioAdeProfileSummary,
  authStatus: AioAdeProfileAuthStatus | null
): { title: string; subtitle: string } {
  // Why: the account-only menu must not present a local execution profile as
  // an authenticated AIO-ADE identity.
  const cloud = authStatus?.cloud ?? profile.cloud
  if (authStatus?.state === 'connected') {
    return {
      title:
        cloud?.displayName?.trim() ||
        cloud?.email ||
        translate('auto.components.aio-ade.profiles.switcher.accountTitle', 'AIO-ADE account'),
      subtitle:
        cloud?.activeOrgName ||
        (cloud?.displayName && cloud.email
          ? cloud.email
          : translate('auto.components.aio-ade.profiles.switcher.accountSignedIn', 'Signed in'))
    }
  }
  if (authStatus?.state === 'reconnect-required') {
    return {
      title:
        cloud?.displayName?.trim() ||
        cloud?.email ||
        translate('auto.components.aio-ade.profiles.switcher.accountTitle', 'AIO-ADE account'),
      subtitle: translate(
        'auto.components.aio-ade.profiles.switcher.accountSignInRequired',
        'Sign-in required'
      )
    }
  }
  return {
    title: translate('auto.components.aio-ade.profiles.switcher.accountTitle', 'AIO-ADE account'),
    subtitle: translate('auto.components.aio-ade.profiles.switcher.accountSignedOut', 'Signed out')
  }
}
