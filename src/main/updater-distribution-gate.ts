import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

/* Whether this build may talk to an update channel at all.
 *
 * Auto-update is off in this release, and the reason is the signing state rather than a preference:
 * the artifacts are neither code-signed nor notarized, so an update channel could not be
 * authenticated by the OS or by electron-updater. Shipping a self-replacing binary over an
 * unauthenticated channel is worse than shipping no updater, so every entry point checks here.
 *
 * This is deliberately one predicate rather than deletions across the updater. When a certificate
 * exists, signing and notarization get turned on, this returns true for a signed packaged build,
 * and the surrounding machinery — feed pinning, nudges, mac install handoff — is still here and
 * still covered by its tests. */

/** Set once signing + notarization are live and a release has been verified on all three OSes. */
const UPDATE_CHANNEL_AUTHENTICATED = false

/* Test-only override, mirroring `_enableTransportForTests` in the telemetry client.
 *
 * The updater's own suites exercise feed pinning, nudge handling, check-failure copy and the macOS
 * install handoff — all of which live behind this gate. Without an opt-in they would assert against
 * a permanently-inert updater and stop covering the machinery that has to work the day signing
 * lands. Production has no path to set this. */
let channelAuthenticatedForTests = false

export function _setUpdateChannelAuthenticatedForTests(authenticated: boolean): void {
  channelAuthenticatedForTests = authenticated
}

export type UpdaterDisabledReason = 'unpackaged-build' | 'unsigned-artifacts'

/** Non-null when the updater must stay inert, naming which condition stopped it. */
export function getUpdaterDisabledReason(): UpdaterDisabledReason | null {
  if (!app.isPackaged || is.dev) {
    return 'unpackaged-build'
  }
  if (!UPDATE_CHANNEL_AUTHENTICATED && !channelAuthenticatedForTests) {
    return 'unsigned-artifacts'
  }
  return null
}

export function isUpdaterDisabled(): boolean {
  return getUpdaterDisabledReason() !== null
}
