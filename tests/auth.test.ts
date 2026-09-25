import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  accountLabel,
  authErrorCode,
  loginErrorMessage,
  loginButtonLabel,
  loginProviders,
  connectionErrorMessage,
} from "../src/lib/auth";

test("Android offers Google only; Seeker offers Seeker and Google", () => {
  assert.deepEqual(loginProviders("android", "Pixel 7"), ["google"]);
  assert.deepEqual(loginProviders("android", " Seeker "), ["seeker", "google"]);
  assert.deepEqual(loginProviders("android", "Seeker emulator"), ["google"]);
  assert.equal(loginButtonLabel("seeker"), "Continue with Seeker");
  assert.equal(loginButtonLabel("google"), "Continue with Google");
});

test("ordinary Android wallet errors offer compatible wallets and allow retry", () => {
  assert.match(loginErrorMessage({ code: "ERROR_WALLET_NOT_FOUND" }, "wallet")!, /Choose another wallet/);
  assert.equal(loginErrorMessage({ code: "ERROR_ASSOCIATION_CANCELLED" }, "wallet"), null);
  assert.match(loginErrorMessage({ code: -3 }, "wallet")!, /approval/);
  assert.match(loginErrorMessage({ code: "ERROR_SESSION_TIMEOUT" }, "wallet")!, /Return to OMEN/);
  assert.match(loginErrorMessage({ code: "disallowed_login_method" }, "wallet")!, /sign-in isn’t available/);
});

test("cancelling OAuth or the wallet chooser permits retry without a failure notice", () => {
  assert.equal(
    loginErrorMessage(
      { code: "login_with_oauth_was_cancelled_by_user" },
      "google",
    ),
    null,
  );
  assert.equal(
    loginErrorMessage({ code: "ERROR_ASSOCIATION_CANCELLED" }, "wallet"),
    null,
  );
  assert.match(
    loginErrorMessage(
      { code: "failed_to_complete_login_with_oauth" },
      "google",
    )!,
    /Couldn’t sign in/,
  );
});

test("untrusted errors and callback URLs never reach UI or diagnostic codes", () => {
  const secret = "https://callback.example/?token=private";
  assert.equal(authErrorCode({ code: secret }), undefined);
  assert.equal(
    loginErrorMessage(new Error(secret), "google"),
    "Couldn’t sign in with Google. Please try again.",
  );
  assert.equal(
    loginErrorMessage(null, "wallet"),
    "Couldn’t sign in with your wallet. Please try again.",
  );
  assert.equal(authErrorCode({ code: -3 }), "-3");
});

test("Google identities and wallet-only users have appropriate account labels", () => {
  assert.equal(
    accountLabel([
      { type: "google_oauth", email: "test@example.com", name: "Test" },
    ]),
    "test@example.com",
  );
  assert.equal(
    accountLabel([{ type: "google_oauth", email: null, name: "Test" }]),
    "Test",
  );
  assert.equal(
    accountLabel([{ type: "wallet", address: "wallet-address" }]),
    "Your OMEN account",
  );
});

test("native client configuration errors do not blame the user's credentials", () => {
  for (const code of [
    "invalid_native_app_id",
    "invalid_native_app_url_scheme",
    "invalid_app_client_id",
  ]) {
    assert.equal(
      loginErrorMessage({ code }, "google"),
      "Sign-in isn’t configured for this build yet.",
    );
  }
});

test("missing wallet, rejected approval and closed sessions have actionable recovery", () => {
  assert.match(
    loginErrorMessage({ code: "ERROR_WALLET_NOT_FOUND" }, "wallet")!,
    /Choose another wallet/,
  );
  assert.match(loginErrorMessage({ code: -3 }, "wallet")!, /approval/);
  assert.match(
    loginErrorMessage({ code: "ERROR_SESSION_TIMEOUT" }, "wallet")!,
    /Return to OMEN/,
  );
});

test("Privy rejecting wallet login is reported as provider setup", () => {
  assert.match(
    loginErrorMessage({ code: "disallowed_login_method" }, "wallet")!,
    /isn’t available yet/,
  );
});

test("connection conflicts stay on the current account and errors do not expose details", () => {
  assert.match(connectionErrorMessage({code:"wallet_already_linked_to_another_user"})!, /another account/);
  assert.equal(connectionErrorMessage({code:"ERROR_ASSOCIATION_CANCELLED"}), null);
  assert.match(connectionErrorMessage({code:"omen_wallet_is_not_external"})!, /OMEN wallet/);
  assert.equal(connectionErrorMessage(new Error("private signature")), "Couldn’t connect. Please try again.");
});
