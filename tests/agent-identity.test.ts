import { test } from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { deriveKey, openWith, sealWith, unlockMessage } from "../src/agent/identity";

if (!globalThis.crypto) (globalThis as { crypto?: Crypto }).crypto = webcrypto as unknown as Crypto;

const address = "7Q4Xb1uY9yQz2n8Tm3sV5wR6pL1kJ9hG4fD2cB8aE6nM";
const signature = new Uint8Array(64).map((_v, i) => (i * 37 + 11) % 256);

test("the same signature always derives the same key, and another wallet a different one", () => {
  const a = deriveKey(signature, address);
  const b = deriveKey(signature, address);
  const c = deriveKey(signature, "9Q4Xb1uY9yQz2n8Tm3sV5wR6pL1kJ9hG4fD2cB8aE6nM");
  assert.equal(a.length, 32);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.throws(() => deriveKey(new Uint8Array(10), address));
});

test("sealed text opens with the key and not with another", () => {
  const key = deriveKey(signature, address);
  const other = deriveKey(signature.map((b) => b ^ 1), address);
  const sealed = sealWith(key, "preference: show yields in USD");
  assert.ok(sealed.startsWith("v1:"));
  assert.notEqual(sealWith(key, "preference: show yields in USD"), sealed, "a fresh nonce each time");
  assert.equal(openWith(key, sealed), "preference: show yields in USD");
  assert.throws(() => openWith(other, sealed));
});

test("plain rows written before sealing still open", () => {
  const key = deriveKey(signature, address);
  assert.equal(openWith(key, "old plain value"), "old plain value");
});

test("the unlock message names the wallet in a readable way", () => {
  assert.equal(new TextDecoder().decode(unlockMessage(address)), `OMEN agent identity v1\n${address}`);
});
