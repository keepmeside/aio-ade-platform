import { z } from 'zod'
import {
  PAIRING_DEVICE_TOKEN_MAX_CHARACTERS,
  PAIRING_ENDPOINT_MAX_CHARACTERS,
  PAIRING_PUBLIC_KEY_MAX_CHARACTERS
} from './runtime-pairing-protocol-limits'

export const PAIRING_OFFER_VERSION = 2
const PairingScopeSchema = z.enum(['mobile', 'runtime'])
export function createPairingOfferSchema() {
  return z
    .object({
      v: z.literal(PAIRING_OFFER_VERSION),
      endpoint: z.string().min(1).max(PAIRING_ENDPOINT_MAX_CHARACTERS),
      deviceToken: z.string().min(1).max(PAIRING_DEVICE_TOKEN_MAX_CHARACTERS),
      publicKeyB64: z.string().min(1).max(PAIRING_PUBLIC_KEY_MAX_CHARACTERS),
      scope: PairingScopeSchema.optional()
    })
    .strict()
}

export const PairingOfferSchema = createPairingOfferSchema()
export type PairingOffer = z.infer<typeof PairingOfferSchema>
