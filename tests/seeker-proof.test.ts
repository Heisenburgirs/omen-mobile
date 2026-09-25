import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { KitMobileWallet } from "@solana-mobile/mobile-wallet-adapter-protocol-kit";
import { base58, base64 } from "@scure/base";
import { createWalletProof } from "../src/lib/seeker-proof";

const publicKey = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const challenge =
  "getomen.xyz wants you to sign in with your Solana account:\nNonce: test-server-nonce";
const payload = new Uint8Array([
  ...new Uint8Array(64).fill(9),
  ...new TextEncoder().encode(challenge),
]);
type Wallet = Pick<
  KitMobileWallet,
  "authorize" | "signMessages" | "deauthorize"
>;

function fixture(
  options: {
    rejectSigning?: boolean;
    invalidAddress?: boolean;
    failCleanup?: boolean;
  } = {},
) {
  const calls: Array<{ action: string; args: unknown }> = [];
  const wallet = {
    authorize: async (args: unknown) => {
      calls.push({ action: "authorize", args });
      return {
        auth_token: "test-authorization",
        accounts: [
          {
            address: base64.encode(
              options.invalidAddress ? new Uint8Array(5) : publicKey,
            ),
          },
        ],
      };
    },
    signMessages: async (args: unknown) => {
      calls.push({ action: "sign", args });
      if (options.rejectSigning)
        throw Object.assign(new Error("Rejected"), { code: -3 });
      return [payload];
    },
    deauthorize: async (args: unknown) => {
      calls.push({ action: "deauthorize", args });
      if (options.failCleanup) throw new Error("Session closed");
    },
  } as unknown as Wallet;
  return { wallet, calls };
}

test("mainnet sign-in requests the mainnet chain and preserves the exact Privy proof", async () => {
  const { wallet, calls } = fixture();
  const proof = await createWalletProof(
    wallet,
    async (args) => {
      assert.deepEqual(args, {
        wallet: { address: base58.encode(publicKey) },
        from: { domain: "getomen.xyz", uri: "https://getomen.xyz" },
      });
      return { message: challenge };
    },
    "mainnet-beta",
  );
  assert.deepEqual(calls.find(c => c.action === "authorize")?.args, {
    chain: "solana:mainnet",
    identity: { name: "OMEN", uri: "https://getomen.xyz", icon: "favicon.ico" },
  });
  assert.equal(proof.address, base58.encode(publicKey));
  assert.equal(proof.message, challenge);
  assert.deepEqual(base64.decode(proof.signature), payload);
  assert.deepEqual(calls.find((c) => c.action === "sign")?.args, {
    addresses: [base64.encode(publicKey)],
    payloads: [new TextEncoder().encode(challenge)],
  });
  assert.deepEqual(
    calls.map((c) => c.action),
    ["authorize", "sign", "deauthorize"],
  );
  assert.deepEqual(calls.at(-1)?.args, { auth_token: "test-authorization" });
  assert.deepEqual(Object.keys(proof).sort(), [
    "address",
    "message",
    "signature",
  ]);
});

test("a rejected wallet signature fails login and releases the login authorization", async () => {
  const { wallet, calls } = fixture({ rejectSigning: true });
  await assert.rejects(
    createWalletProof(wallet, async () => ({ message: challenge }), "devnet"),
    { code: -3 },
  );
  assert.equal(calls.at(-1)?.action, "deauthorize");
});

test("nonce failure or malformed account cannot be treated as a login success", async () => {
  const rejected = fixture();
  await assert.rejects(
    createWalletProof(
      rejected.wallet,
      async () => {
        throw new Error("Privy unavailable");
      },
      "devnet",
    ),
    /Privy unavailable/,
  );
  assert.deepEqual(
    rejected.calls.map((c) => c.action),
    ["authorize", "deauthorize"],
  );
  const invalid = fixture({ invalidAddress: true });
  await assert.rejects(
    createWalletProof(
      invalid.wallet,
      async () => {
        assert.fail("Must not request challenge for malformed address");
      },
      "devnet",
    ),
    /Invalid wallet address/,
  );
  assert.deepEqual(
    invalid.calls.map((c) => c.action),
    ["authorize", "deauthorize"],
  );
});

test("a disconnected cleanup does not discard an already signed login proof", async () => {
  const { wallet } = fixture({ failCleanup: true });
  const proof = await createWalletProof(
    wallet,
    async () => ({ message: challenge }),
    "mainnet-beta",
  );
  assert.equal(proof.signature, base64.encode(payload));
});

test("cancelling during nonce retrieval never opens a signing prompt", async () => {
  const { wallet, calls } = fixture();
  const controller = new AbortController();
  await assert.rejects(createWalletProof(wallet, async () => {
    controller.abort();
    return { message: challenge };
  }, "mainnet-beta", controller.signal), { code: "ERROR_ASSOCIATION_CANCELLED" });
  assert.deepEqual(calls.map(call => call.action), ["authorize", "deauthorize"]);
});

test("cancelling during wallet signing discards the proof and releases authorization", async () => {
  const { wallet, calls } = fixture();
  const controller = new AbortController();
  const sign = wallet.signMessages;
  wallet.signMessages = async args => { controller.abort(); return sign(args); };
  await assert.rejects(createWalletProof(wallet, async () => ({ message: challenge }), "mainnet-beta", controller.signal), { code: "ERROR_ASSOCIATION_CANCELLED" });
  assert.equal(calls.at(-1)?.action, "deauthorize");
});