import { strict as assert } from "node:assert";
import { test } from "node:test";
import { splitAcrossWallets, walletHolding } from "../src/lib/wallets";

const holding = (wallets?: { address: string; raw: string }[]) => ({ wallets }) as any;

test("one wallet: the sale comes from it, whole", () => {
  assert.equal(walletHolding(holding(undefined)), undefined);
  assert.equal(walletHolding(holding([{ address: "A", raw: "5" }])), "A");
  assert.deepEqual(splitAcrossWallets(holding([{ address: "A", raw: "5" }]), 3n), [{ wallet: "A", amount: 3n }]);
});
test("two wallets: from the one holding the most, then the rest from the other", () => {
  const h = holding([{ address: "A", raw: "2" }, { address: "B", raw: "5" }]);
  assert.equal(walletHolding(h), "B");
  assert.deepEqual(splitAcrossWallets(h, 4n), [{ wallet: "B", amount: 4n }]);
  assert.deepEqual(splitAcrossWallets(h, 7n), [{ wallet: "B", amount: 5n }, { wallet: "A", amount: 2n }]);
  assert.deepEqual(splitAcrossWallets(h, 6n), [{ wallet: "B", amount: 5n }, { wallet: "A", amount: 1n }]);
});
