import { strict as assert } from "node:assert";
import { test } from "node:test";
import { runWalletRequest } from "../src/lib/wallet-request";

test("cancelling a wallet request aborts work and ignores a late result", async () => {
  const controller = new AbortController();
  let workSignal: AbortSignal | undefined;
  let finish: (value: string) => void = () => {};
  const request = runWalletRequest(signal => {
    workSignal = signal;
    return new Promise<string>(resolve => { finish = resolve; });
  }, controller.signal);
  await Promise.resolve();
  controller.abort();
  await assert.rejects(request, { code: "ERROR_ASSOCIATION_CANCELLED" });
  assert.equal(workSignal?.aborted, true);
  finish("late proof");
});
test("an already-cancelled request never opens a wallet", async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(runWalletRequest(async () => { assert.fail("Must not open wallet"); }, controller.signal), { code: "ERROR_ASSOCIATION_CANCELLED" });
});
test("a silent wallet times out and aborts the proof flow", async () => {
  let signal: AbortSignal | undefined;
  const request = runWalletRequest(active => { signal = active; return new Promise(() => {}); }, undefined, 10);
  await assert.rejects(request, { code: "ERROR_SESSION_TIMEOUT" });
  assert.equal(signal?.aborted, true);
});
test("successful wallet results are returned without holding the timeout open", async () => {
  assert.equal(await runWalletRequest(async () => "proof"), "proof");
});
test("even a malformed empty rejection remains a failure", async () => {
  await assert.rejects(runWalletRequest(() => Promise.reject(undefined)));
});