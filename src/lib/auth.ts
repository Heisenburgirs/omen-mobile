export type LoginProvider = "google" | "seeker" | "wallet";
export type AuthProvider = LoginProvider | "twitter";

export function loginProviders(platform: string, model?: string): readonly LoginProvider[] {
  if (platform === "android" && model?.trim().toLowerCase() === "seeker") return ["seeker", "google"];
  // The browser: Google, or a Solana wallet the user already has (Privy's
  // modal: Phantom, Backpack, Solflare). X sign-in was switched off 2026-09-23.
  if (platform === "web") return ["google", "wallet"];
  return ["google"];
}

export function loginButtonLabel(provider: LoginProvider): string {
  return provider === "wallet" ? "Log in with wallet" : "Continue with " + providerName(provider);
}
export function providerName(provider: AuthProvider): string {
  if (provider === "google") return "Google";
  if (provider === "twitter") return "X";
  if (provider === "seeker") return "Seeker";
  return "your wallet";
}
export function authErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return;
  const code = error.code;
  if (typeof code === "number" && Number.isSafeInteger(code))
    return String(code);
  return typeof code === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(code)
    ? code
    : undefined;
}
export function loginErrorMessage(
  error: unknown,
  provider: AuthProvider,
): string | null {
  const code = authErrorCode(error) || "";
  if (
    [
      "login_with_oauth_was_cancelled_by_user",
      "ERROR_ASSOCIATION_CANCELLED",
      "ERR_REQUEST_CANCELED",
    ].includes(code)
  )
    return null;
  if (
    [
      "invalid_native_app_id",
      "invalid_native_app_url_scheme",
      "invalid_app_client_id",
      // Web: this site is not on the Privy app's allowed origins yet.
      "invalid_origin",
    ].includes(code)
  )
    return "Sign-in isn’t configured for this build yet.";
  if (code === "ERROR_SEEKER_UNAVAILABLE")
    return "Seed Vault Wallet is unavailable. Continue with Google instead.";
  if (code === "wallet_requires_android")
    return "Wallet sign-in requires Android. Use Google on this device.";
  if (code === "wallet_unavailable")
    return "Wallet sign-in is available in the web app at getomen.xyz/app.";
  // The Privy modal was closed without signing in.
  if (code === "exited_auth_flow" || code === "exited_link_flow") return null;
  if (code === "ERROR_WALLET_NOT_FOUND")
    return "This wallet is no longer available. Choose another wallet or use Google.";
  if ((provider === "seeker" || provider === "wallet") && ["-1", "-3"].includes(code))
    return "Wallet approval cancelled. Try again.";
  if (code === "ERROR_SESSION_CLOSED" || code === "ERROR_SESSION_TIMEOUT")
    return "Wallet disconnected. Return to OMEN and retry.";
  const name = providerName(provider);
  if (
    /not_enabled|not_allowed|disallowed_login_method|disabled|unsupported_oauth_provider|configuration_error/.test(
      code,
    )
  )
    return name + " sign-in isn’t available yet.";
  if (/timeout|network|fetch/i.test(code))
    return "Connection failed. Check your internet.";
  return "Couldn’t sign in with " + name + ". Please try again." + (code ? " (" + code + ")" : "");
}
type Account = {
  type: string;
  address?: string;
  email?: string | null;
  name?: string | null;
};
export function accountLabel(accounts: readonly Account[]): string {
  const email = accounts.find((account) => account.type === "email")?.address;
  if (email) return email;
  const social = accounts.find((account) => account.type === "google_oauth" || account.type === "apple_oauth");
  return social?.email || social?.name || "Your OMEN account";
}

export function connectionErrorMessage(error: unknown): string | null {
  const code = authErrorCode(error) || "";
  if (["ERROR_ASSOCIATION_CANCELLED", "ERR_REQUEST_CANCELED", "login_with_oauth_was_cancelled_by_user", "-1", "-3"].includes(code)) return null;
  if (code === "wallet_already_connected") return "This wallet is already connected.";
  if (code === "omen_wallet_is_not_external") return "This is already your OMEN wallet.";
  if (/already.*(linked|associated)|linked.*(another|different)|account_exists/i.test(code))
    return "That identity is linked to another account. Sign in to that account instead.";
  if (code === "ERROR_SESSION_TIMEOUT") return "The wallet didn’t respond. Please try again.";
  if (code === "ERROR_WALLET_NOT_FOUND") return "That wallet is no longer installed.";
  if (/not_enabled|disallowed|configuration|unsupported_oauth/.test(code)) return "This connection method isn’t configured yet.";
  return "Couldn’t connect. Please try again.";
}
