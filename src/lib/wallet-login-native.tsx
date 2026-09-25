// The phone app signs in with Google or the Seeker's Seed Vault; the
// browser-wallet sign-in (Privy's modal with Phantom, Backpack and
// Solflare) is a web feature (privy.web.tsx). The hook exists here so
// the screens are one code.
export function useWalletLogin() {
  return {
    loginWith: async (): Promise<void> => {
      throw Object.assign(new Error("Wallet sign-in is a web feature"), { code: "wallet_unavailable" });
    },
  };
}
