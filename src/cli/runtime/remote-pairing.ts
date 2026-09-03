import { parsePairingCode, type PairingOffer } from '../../shared/pairing'
import { resolveEnvironmentPairingOffer } from './environments'
import { RuntimeClientError } from './types'

/**
 * Which remote runtime a CLI invocation should talk to, from the two mutually exclusive ways of
 * naming one: a pairing code, or a saved environment. Null means talk to the local runtime.
 *
 * Separate from the RPC client because it is a decision made once before any request, and it fails
 * with argument errors rather than transport ones.
 */
export function resolveRemotePairing(
  userDataPath: string,
  pairingCode: string | null,
  environmentSelector: string | null
): PairingOffer | null {
  if (pairingCode && environmentSelector) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Use either --pairing-code or --environment, not both.'
    )
  }
  if (environmentSelector) {
    return resolveEnvironmentPairingOffer(userDataPath, environmentSelector)
  }
  if (!pairingCode) {
    return null
  }
  const pairing = parsePairingCode(pairingCode)
  if (!pairing) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Invalid remote pairing code. Expected an aio-ade://pair?... URL or bare pairing payload.'
    )
  }
  return pairing
}
