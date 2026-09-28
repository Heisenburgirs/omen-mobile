import nacl from "tweetnacl";
import { getBase58Decoder, getBase58Encoder } from "@solana/kit";
import type { RyvoChannelClientOptions } from "@ryvo/channel-client";

// The delegated key that signs the channel's vouchers, on tweetnacl rather
// than WebCrypto. Hermes has no native Ed25519, and the pure-JS polyfill the
// Solana kit falls back to runs on BigInt arithmetic, which Hermes executes
// slowly enough to take seconds per signature. tweetnacl does the same curve
// on plain numbers and signs in milliseconds. The seed is the same 32 bytes
// the channel client would have generated, so a channel opened before this
// change keeps working with its stored key.
export type VoucherSigner = NonNullable<RyvoChannelClientOptions["voucherSigner"]>;
type SignableMessage = { content: Uint8Array };

export function randomSeed(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}
export const encodeSeed = (seed: Uint8Array) => getBase58Decoder().decode(seed);
export const decodeSeed = (stored: string) => new Uint8Array(getBase58Encoder().encode(stored));

export function voucherAddress(seed: Uint8Array): string {
  return getBase58Decoder().decode(nacl.sign.keyPair.fromSeed(seed).publicKey);
}

export function naclVoucherSigner(seed: Uint8Array): VoucherSigner {
  if (seed.length !== 32) throw new Error("The voucher key must be a 32-byte seed.");
  const pair = nacl.sign.keyPair.fromSeed(seed);
  const address = getBase58Decoder().decode(pair.publicKey);
  const signer = {
    address,
    async signMessages(messages: readonly SignableMessage[]) {
      return messages.map((m) => ({ [address]: nacl.sign.detached(m.content, pair.secretKey) }));
    },
  };
  return signer as unknown as VoucherSigner;
}

/** True when `signature` is `publicKey`'s signature over `message`. */
export function verifyEd25519(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
  try {
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}
