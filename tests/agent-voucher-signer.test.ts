import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import nacl from "tweetnacl";
import { decodeSeed, encodeSeed, naclVoucherSigner, verifyEd25519, voucherAddress } from "../src/agent/ryvo/voucher-signer";

if (!globalThis.crypto) (globalThis as { crypto?: Crypto }).crypto = webcrypto as unknown as Crypto;

test("the voucher signer signs with the seed's key and its address is the public key", async () => {
  const seed = new Uint8Array(32).map((_v, i) => (i * 7 + 3) % 256);
  const signer = naclVoucherSigner(seed) as unknown as {
    address: string;
    signMessages(messages: { content: Uint8Array }[]): Promise<Record<string, Uint8Array>[]>;
  };
  assert.equal(signer.address, voucherAddress(seed));
  const content = new TextEncoder().encode("voucher bytes");
  const [dictionary] = await signer.signMessages([{ content }]);
  const signature = dictionary[signer.address];
  assert.equal(signature.length, 64);
  const publicKey = nacl.sign.keyPair.fromSeed(seed).publicKey;
  assert.ok(verifyEd25519(content, signature, publicKey));
  assert.ok(!verifyEd25519(new TextEncoder().encode("other bytes"), signature, publicKey));
});

test("a stored seed round-trips through base58 like the channel client's own format", () => {
  const seed = new Uint8Array(32).map((_v, i) => (255 - i) % 256);
  assert.deepEqual(decodeSeed(encodeSeed(seed)), seed);
  assert.throws(() => naclVoucherSigner(new Uint8Array(16)));
});
