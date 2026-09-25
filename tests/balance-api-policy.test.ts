import assert from "node:assert/strict";
import test from "node:test";
import { isBalanceApiAllowed } from "../src/lib/balance-api-policy";

const production = { development: false, localPreview: false, network: "mainnet-beta" };
const preview = { ...production, localPreview: true };

test("public builds require HTTPS on mainnet and devnet, even for localhost", () => {
  for (const network of ["mainnet-beta", "devnet"]) {
    const options = { ...production, network };
    assert.equal(isBalanceApiAllowed("https://api.getomen.xyz", options), true);
    assert.equal(isBalanceApiAllowed("http://127.0.0.1:8787", options), false);
    assert.equal(isBalanceApiAllowed("http://api.getomen.xyz", options), false);
  }
});

test("bundled local preview permits loopback and private-LAN HTTP on mainnet and devnet", () => {
  for (const network of ["mainnet-beta", "devnet"]) {
    const options = { ...preview, network };
    for (const host of ["127.0.0.1", "10.0.2.2", "localhost", "192.168.1.120", "10.1.2.3", "172.16.0.9"])
      assert.equal(isBalanceApiAllowed(`http://${host}:8787`, options), true);
    for (const url of ["http://localhost.evil.test", "http://8.8.8.8:8787", "http://172.32.0.1:8787", "http://api.getomen.xyz", "http://localhost@evil.test", "https://token@api.getomen.xyz", "file:///etc/file", "invalid"])
      assert.equal(isBalanceApiAllowed(url, options), false);
  }
  assert.equal(isBalanceApiAllowed("http://127.0.0.1:8787", { ...preview, network: "invalid" }), false);
});

test("development allows a LAN API for testing on a physical phone", () => {
  assert.equal(isBalanceApiAllowed("http://192.168.1.2:8787", { ...production, development: true }), true);
});