import type { MobileE2EEV2Hello, MobileE2EEV2Ready } from './mobile-e2ee-v2-contract'

function repeatedByteBase64(byte: number): string {
  return btoa(String.fromCharCode(...new Uint8Array(32).fill(byte)))
}

export function createMobileE2EEV2Fixture(): {
  hello: MobileE2EEV2Hello
  ready: MobileE2EEV2Ready
  sharedSecret: Uint8Array
} {
  const context = {
    protocol: 'aio-ade-mobile-e2ee' as const,
    initiator: 'mobile' as const,
    responder: 'desktop' as const,
    transport: 'relay' as const,
    relayHostId: 'AbCdEf0123_-xyZ9'
  }
  return {
    hello: {
      type: 'e2ee_hello',
      v: 2,
      clientPublicKeyB64: repeatedByteBase64(1),
      clientNonceB64: repeatedByteBase64(2),
      capabilities: { framing: [2], payloadKinds: ['text', 'binary'] },
      context
    },
    ready: {
      type: 'e2ee_ready',
      v: 2,
      desktopPublicKeyB64: repeatedByteBase64(3),
      clientNonceB64: repeatedByteBase64(2),
      desktopNonceB64: repeatedByteBase64(4),
      selection: { framing: 2, payloadKinds: ['text', 'binary'] },
      context
    },
    sharedSecret: new Uint8Array(32).fill(5)
  }
}

/* Golden vector for the v2 handshake: transcript bytes and the 96-byte HKDF expansion derived from
 * the fixture above. Its purpose is to make an accidental change to the wire format loud — every
 * value here moves if the framing, the label strings, or the field order change.
 *
 * These numbers were recomputed when the protocol label changed from the pre-rebrand
 * `orca-mobile-e2ee` to `aio-ade-mobile-e2ee`. That label is length-prefixed into the transcript and
 * appears in the HKDF salt and info labels, so the transcript got 9 bytes longer (1347 → 1356) and
 * every derived key changed. Recomputing is correct here and would NOT be correct if a peer already
 * spoke the old label: no shipped client does, since the protocol string is defined in this repo,
 * the only implementation of the mobile side is `simulated-mobile-e2ee-v2-peer.ts`, and both ends
 * ship together in one build.
 *
 * If an external mobile client is ever published, this label becomes a compatibility contract and a
 * change to it needs a version bump, not a recomputed vector. */
export const MOBILE_E2EE_V2_VECTOR = {
  transcriptLength: 1356,
  transcriptHashHex: '0f25768649d85e5bdbd975145b4198f1d65a6f9e9257ca77493a1eb56380c0f3',
  mobileToDesktopKeyHex: '3f38988e5eed41bdf9ad803ab5caf8bedfe790426f786b572c7f9918dd40b2fe',
  desktopToMobileKeyHex: '741a749dff0024e0b5a54bec5e8cfe8e299213b4aa5f3154ff94d71787587248',
  sessionIdHex: 'b78249bd6c39bc2dce212ceb61d13dab910ad72820b939ecba6cb84ba8e21155'
} as const
