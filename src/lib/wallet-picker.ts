export type InstalledWallet = {
  packageName: string;
  name: string;
  icon?: string | null;
  transport: 'mwa' | 'deeplink';
  isSystem: boolean;
};
export type WalletChoice = InstalledWallet & { seeker: boolean };

export const deeplinkAdapters: Record<string, { baseUrl: string; encryptionPublicKeyName: string }> = {
  'app.phantom': { baseUrl: 'https://phantom.app', encryptionPublicKeyName: 'phantom_encryption_public_key' },
  'com.solflare.mobile': { baseUrl: 'https://solflare.com', encryptionPublicKeyName: 'solflare_encryption_public_key' },
  'app.backpack.mobile': { baseUrl: 'https://backpack.app', encryptionPublicKeyName: 'wallet_encryption_public_key' },
};

export function walletChoices(wallets: readonly InstalledWallet[], model?: string): WalletChoice[] {
  const onSeeker = model?.trim().toLowerCase() === 'seeker';
  const unique = new Map<string, WalletChoice>();
  for (const wallet of wallets) {
    if (!wallet.packageName || !wallet.name ||
        (wallet.transport !== 'mwa' && !deeplinkAdapters[wallet.packageName])) continue;
    // Cosmetic ordering only, never authentication or a claim of hardware security.
    // Use the installed system wallet's label instead of assuming its package ID.
    const seeker = Boolean(onSeeker && wallet.isSystem && wallet.transport === 'mwa' &&
      /seed[\s_-]*vault|seeker/i.test(wallet.name));
    const previous = unique.get(wallet.packageName);
    if (!previous || (previous.transport !== 'mwa' && wallet.transport === 'mwa'))
      unique.set(wallet.packageName, { ...wallet, seeker });
  }
  return [...unique.values()].sort((a,b) => Number(b.seeker) - Number(a.seeker) ||
    a.name.localeCompare(b.name) || a.packageName.localeCompare(b.packageName));
}
