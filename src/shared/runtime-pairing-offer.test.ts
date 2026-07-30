import { describe, expect, it } from 'vitest'
import { createPairingOfferSchema, PAIRING_OFFER_VERSION } from './runtime-pairing-offer'

describe('runtime pairing offer contract', () => {
  const schema = createPairingOfferSchema()

  it('accepts a direct runtime offer', () => {
    expect(
      schema.safeParse({
        v: PAIRING_OFFER_VERSION,
        endpoint: 'ws://192.168.1.10:6768',
        deviceToken: 'token',
        publicKeyB64: 'public-key',
        scope: 'runtime'
      }).success
    ).toBe(true)
  })

  it('rejects relay fields because cloud phone relay is removed', () => {
    expect(
      schema.safeParse({
        v: PAIRING_OFFER_VERSION,
        endpoint: 'ws://192.168.1.10:6768',
        deviceToken: 'token',
        publicKeyB64: 'public-key',
        scope: 'runtime',
        relay: { v: 1 }
      }).success
    ).toBe(false)
  })
})
