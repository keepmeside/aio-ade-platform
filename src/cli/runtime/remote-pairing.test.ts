import { describe, expect, it, vi } from 'vitest'
import { encodePairingOffer, type PairingOffer } from '../../shared/pairing'
import { RuntimeClientError } from './types'
import { resolveRemotePairing } from './remote-pairing'

const environmentMocks = vi.hoisted(() => ({ resolveEnvironmentPairingOffer: vi.fn() }))

vi.mock('./environments', () => ({
  resolveEnvironmentPairingOffer: environmentMocks.resolveEnvironmentPairingOffer
}))

const OFFER: PairingOffer = {
  v: 2,
  endpoint: 'ws://192.168.1.10:6768',
  deviceToken: 'token-abc',
  publicKeyB64: 'pubkey-xyz'
}

const USER_DATA = '/tmp/user-data'

describe('resolveRemotePairing', () => {
  it('means the local runtime when neither a code nor an environment is given', () => {
    expect(resolveRemotePairing(USER_DATA, null, null)).toBeNull()
  })

  it('refuses to guess when both a code and an environment are given', () => {
    expect(() => resolveRemotePairing(USER_DATA, encodePairingOffer(OFFER), 'staging')).toThrow(
      RuntimeClientError
    )
    expect(() => resolveRemotePairing(USER_DATA, encodePairingOffer(OFFER), 'staging')).toThrow(
      /not both/u
    )
    expect(environmentMocks.resolveEnvironmentPairingOffer).not.toHaveBeenCalled()
  })

  it('reads a saved environment through the environment store', () => {
    environmentMocks.resolveEnvironmentPairingOffer.mockReturnValueOnce(OFFER)

    expect(resolveRemotePairing(USER_DATA, null, 'staging')).toEqual(OFFER)
    expect(environmentMocks.resolveEnvironmentPairingOffer).toHaveBeenCalledWith(
      USER_DATA,
      'staging'
    )
  })

  it('parses a pairing code in either the URL or the bare payload form', () => {
    const url = encodePairingOffer(OFFER)
    const bare = new URLSearchParams(url.slice(url.indexOf('?') + 1)).get('code')!

    expect(resolveRemotePairing(USER_DATA, url, null)).toEqual(OFFER)
    expect(resolveRemotePairing(USER_DATA, bare, null)).toEqual(OFFER)
  })

  // An unparseable code is an argument error, not a transport one: failing here keeps the CLI from
  // silently falling back to the local runtime when the user asked for a remote.
  it('rejects an unparseable pairing code instead of falling back to local', () => {
    expect(() => resolveRemotePairing(USER_DATA, 'aio-ade://pair?payload=bad', null)).toThrow(
      /Invalid remote pairing code/u
    )
    expect(() => resolveRemotePairing(USER_DATA, 'not a code', null)).toThrow(RuntimeClientError)
  })
})
