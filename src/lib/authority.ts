export type LinkedAccount = {
  type: string;
  chain_type?: string;
  wallet_client_type?: string;
  address?: string;
  wallet_index?: number | null;
  imported?: boolean;
};
export type SigningAuthority = { address: string; kind: "privy" };

/** A Solana wallet Privy holds the key for: made at sign-up or imported. */
export function isPrivyWallet(account: LinkedAccount): boolean {
  return account.type === "wallet" && account.chain_type === "solana" &&
    (account.wallet_client_type === "privy" || account.wallet_client_type === "privy-v2") && Boolean(account.address);
}
/** The user's Privy wallets, the sign-up one first, then the imported ones. */
export function privyWallets(accounts: readonly LinkedAccount[]): { address: string; imported: boolean; primary: boolean }[] {
  const primary = selectSigningAuthority(accounts)?.address;
  const seen = new Set<string>();
  return accounts.filter(isPrivyWallet).filter(a => !seen.has(a.address!) && seen.add(a.address!))
    .map(a => ({ address: a.address!, imported: a.imported === true, primary: a.address === primary }))
    .sort((a, b) => Number(b.primary) - Number(a.primary));
}

// The primary is the wallet OMEN made at sign-up. An imported key is the
// user's too, but never the primary: it has no wallet index, and the
// profile, the referral and the buys are all pinned to the first one.
export function selectSigningAuthority(accounts: readonly LinkedAccount[]): SigningAuthority | null {
  const embedded = accounts.filter(account => isPrivyWallet(account) && account.imported !== true).sort((a, b) => (a.wallet_index ?? 0) - (b.wallet_index ?? 0) || a.address!.localeCompare(b.address!))[0];
  return embedded?.address ? { address: embedded.address, kind: "privy" } : null;
}

// Call only for an authenticated user. External wallets are login identities,
// not the account's OMEN signing wallet. Existing embedded wallets are reused.
export function shouldCreateEmbeddedWallet(accounts: readonly LinkedAccount[]): boolean {
  return accounts.length > 0 && !selectSigningAuthority(accounts);
}

export function connectedExternalWallets(accounts: readonly LinkedAccount[]): LinkedAccount[] {
  return accounts.filter((account, index) => account.type === "wallet" &&
    account.chain_type === "solana" && account.wallet_client_type !== "privy" && account.address &&
    accounts.findIndex(other => other.type === "wallet" && other.address === account.address) === index);
}

export function canDisconnectWallet(accounts: readonly LinkedAccount[], address: string): boolean {
  if (!connectedExternalWallets(accounts).some(account => account.address === address)) return false;
  // Count only login methods this Android build actually exposes. An arbitrary
  // connected wallet is not enough to regain access from the welcome screen.
  return accounts.some(account => account.type === "google_oauth" ||
    (account.type === "wallet" && account.chain_type === "solana" &&
      account.wallet_client_type === "seed_vault" && Boolean(account.address) && account.address !== address));
}
