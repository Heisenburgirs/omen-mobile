import { gcm } from "@noble/ciphers/aes";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { Buffer } from "buffer";

// The agent's identity, sealed under the user's key. Everything the agent
// is on this device (its memory of the user, the conversation, its channel
// with Ryvo) is encrypted at rest with a key derived from one signature by
// the user's wallet over a fixed message. Ed25519 signatures are
// deterministic, so the same wallet always derives the same key, on the
// phone and in the browser, and nothing about the agent is readable without
// the wallet: not by another app, not by someone with the storage, not by
// OMEN. The key lives in memory for the session only.
//
// The signer is whatever holds the user's key. Today that is the Privy
// embedded wallet, which signs silently; the same derivation works with a
// Seed Vault signature through Mobile Wallet Adapter, which would put the
// user's fingerprint on the unlock.
export type IdentitySigner = (message: Uint8Array) => Promise<Uint8Array>;

const DOMAIN = "OMEN agent identity v1";
const SALT = new TextEncoder().encode("omen-agent-identity-v1");
const PREFIX = "v1:";

/** The message the wallet signs to unlock the agent; readable, so a wallet can show it. */
export const unlockMessage = (address: string) => new TextEncoder().encode(`${DOMAIN}\n${address}`);

/** A 256-bit AES key from the wallet's signature over the unlock message. */
export function deriveKey(signature: Uint8Array, address: string): Uint8Array {
  if (signature.length !== 64) throw new Error("The wallet's signature is malformed.");
  return hkdf(sha256, signature, SALT, new TextEncoder().encode(address), 32);
}

type Unlocked = { address: string; key: Uint8Array };
let unlocked: Unlocked | null = null;
let waiting: { promise: Promise<Unlocked>; resolve: (u: Unlocked) => void; reject: (e: unknown) => void } | null = null;

function deferred() {
  let resolve!: (u: Unlocked) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<Unlocked>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Whether the agent is open for this session. */
export const isUnlocked = (address?: string) => Boolean(unlocked && (!address || unlocked.address === address));

/**
 * Opens the agent with the wallet's signature. Repeated calls for the same
 * wallet are free; a different wallet replaces the key. A failure rejects
 * whoever is waiting on the store and leaves the agent locked.
 */
export async function unlockIdentity(address: string, sign: IdentitySigner): Promise<void> {
  if (unlocked?.address === address) return;
  const pending = waiting ?? (waiting = deferred());
  try {
    const signature = await sign(unlockMessage(address));
    unlocked = { address, key: deriveKey(signature, address) };
    pending.resolve(unlocked);
  } catch (e) {
    waiting = null;
    pending.reject(e);
    throw e;
  }
}

/** Forgets the key; the next unlock asks the wallet again. */
export function lockIdentity(): void {
  unlocked = null;
  waiting = null;
}

/** The store waits here for the key rather than failing while the wallet is still signing. */
async function keyFor(): Promise<Uint8Array> {
  if (unlocked) return unlocked.key;
  const pending = waiting ?? (waiting = deferred());
  return (await pending.promise).key;
}

/** Ciphertext for the store: "v1:" + base64(nonce || AES-GCM(plaintext)). */
export function sealWith(key: Uint8Array, plaintext: string): string {
  const nonce = new Uint8Array(12);
  globalThis.crypto.getRandomValues(nonce);
  const box = gcm(key, nonce).encrypt(new TextEncoder().encode(plaintext));
  const out = new Uint8Array(nonce.length + box.length);
  out.set(nonce);
  out.set(box, nonce.length);
  return PREFIX + Buffer.from(out).toString("base64");
}
export function openWith(key: Uint8Array, stored: string): string {
  // Rows written before sealing existed are plain; they are re-sealed on their next write.
  if (!stored.startsWith(PREFIX)) return stored;
  const bytes = new Uint8Array(Buffer.from(stored.slice(PREFIX.length), "base64"));
  if (bytes.length < 13) throw new Error("The agent's memory is damaged.");
  const plain = gcm(key, bytes.subarray(0, 12)).decrypt(bytes.subarray(12));
  return new TextDecoder().decode(plain);
}
export async function seal(plaintext: string): Promise<string> {
  return sealWith(await keyFor(), plaintext);
}
export async function open(stored: string): Promise<string> {
  return openWith(await keyFor(), stored);
}
