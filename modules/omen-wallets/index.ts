import { requireOptionalNativeModule } from 'expo-modules-core';
import type { InstalledWallet } from '../../src/lib/wallet-picker';

const native = requireOptionalNativeModule<{
  getInstalledWallets(): Promise<InstalledWallet[]>;
}>('OmenWallets');

export async function getInstalledWallets(): Promise<InstalledWallet[]> {
  if (!native) throw Object.assign(new Error('Wallet discovery requires an Android build'), {
    code: 'wallet_requires_android',
  });
  return native.getInstalledWallets();
}
