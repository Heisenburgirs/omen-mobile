import { strict as assert } from "node:assert";
import { test } from "node:test";
import { loginProviders, loginButtonLabel, loginErrorMessage } from "../src/lib/auth";

test("the browser offers Google and one wallet button; X is gone", () => {
  assert.deepEqual(loginProviders("web"), ["google", "wallet"]);
  assert.deepEqual(loginProviders("android"), ["google"]);
  assert.equal(loginButtonLabel("wallet"), "Log in with wallet");
});
test("closing Privy's wallet modal is not an error to show", () => {
  assert.equal(loginErrorMessage({ code: "exited_auth_flow" }, "wallet"), null);
  assert.match(loginErrorMessage({ code: "wallet_unavailable" }, "wallet")!, /web app/);
});
