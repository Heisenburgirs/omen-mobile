import { strict as assert } from "node:assert";
import { test } from "node:test";
import { selectSigningAuthority, shouldCreateEmbeddedWallet, connectedExternalWallets, canDisconnectWallet, privyWallets } from "../src/lib/authority";
const google = { type: "google_oauth" };
const seeker = { type: "wallet", chain_type: "solana", address: "seeker-address", wallet_client_type: "seed_vault" };
const phantom = { ...seeker, address: "phantom-address", wallet_client_type: "phantom" };
const embedded = { ...seeker, address: "embedded-address", wallet_client_type: "privy", wallet_index: 0 };

test("Google and Seeker accounts get an embedded wallet when none exists", () => {
  for (const accounts of [[google], [seeker], [phantom], [google, seeker]]) {
    assert.equal(shouldCreateEmbeddedWallet(accounts), true);
    assert.equal(selectSigningAuthority(accounts), null);
  }
});
test("every login method reuses the same Privy signer and never an external wallet", () => {
  for (const accounts of [[google, embedded], [seeker, embedded], [phantom, google, embedded], [embedded, seeker, phantom]]) {
    assert.equal(shouldCreateEmbeddedWallet(accounts), false);
    assert.deepEqual(selectSigningAuthority(accounts), { address: "embedded-address", kind: "privy" });
  }
});
test("connecting or disconnecting an external wallet cannot change the OMEN signer", () => {
  const before = selectSigningAuthority([google, embedded]);
  assert.deepEqual(selectSigningAuthority([phantom, embedded, google]), before);
  assert.deepEqual(selectSigningAuthority([embedded, google]), before);
});
test("an Ethereum wallet cannot satisfy the Solana requirement; empty identities do not start creation", () => {
  assert.equal(selectSigningAuthority([google, { ...embedded, chain_type: "ethereum" }]), null);
  assert.equal(shouldCreateEmbeddedWallet([google, { ...embedded, chain_type: "ethereum" }]), true);
  assert.equal(shouldCreateEmbeddedWallet([]), false);
});
test("legacy additional embedded wallets cannot displace the primary wallet", () => {
  const additional = { ...embedded, address: "additional-address", wallet_index: 1 };
  assert.deepEqual(selectSigningAuthority([additional, embedded]), selectSigningAuthority([embedded, additional]));
  assert.equal(selectSigningAuthority([additional, embedded])?.address, embedded.address);
});
test("connected list excludes embedded wallets and prevents removing the last login identity", () => {
  assert.deepEqual(connectedExternalWallets([google, embedded, phantom, phantom]), [phantom]);
  assert.equal(canDisconnectWallet([seeker, embedded], seeker.address), false);
  assert.equal(canDisconnectWallet([google, seeker, embedded], seeker.address), true);
  assert.equal(canDisconnectWallet([google, embedded], embedded.address), false);
  assert.equal(canDisconnectWallet([google, embedded], "not-linked"), false);
});
test("another external wallet cannot replace a supported login method for recovery", () => {
  assert.equal(canDisconnectWallet([seeker, phantom, embedded], seeker.address), false);
  assert.equal(canDisconnectWallet([seeker, phantom, embedded], phantom.address), true);
});test("an imported key is the user's wallet but never displaces the sign-up wallet", () => {
  const imported = { ...embedded, address: "aaa-imported", wallet_index: null, imported: true };
  // Sorted by address alone the imported one would come first.
  assert.equal(selectSigningAuthority([imported, embedded])?.address, embedded.address);
  assert.equal(selectSigningAuthority([imported]), null);
  assert.deepEqual(privyWallets([phantom, imported, google, embedded, imported]), [
    { address: "embedded-address", imported: false, primary: true },
    { address: "aaa-imported", imported: true, primary: false },
  ]);
  assert.deepEqual(connectedExternalWallets([imported, phantom]), [phantom]);
});
