import { requireOptionalNativeModule } from 'expo-modules-core';
import type { InstalledWallet } from '../../src/lib/wallet-picker';

const native = requireOptionalNativeModule<{
  getInstalledWallets(): Promise<InstalledWallet[]>;
  startWork(title: string, text: string): void;
  stopWork(): void;
}>('OmenWallets');

/**
 * Keeps the app working while it is off screen: an ongoing notification
 * backed by a foreground service, from `keepWorking` until `doneWorking`.
 * Without it Android freezes the app's JavaScript seconds after the user
 * leaves, and an agent turn in flight never finishes. No-op off Android.
 */
export function keepWorking(title: string, text: string): void {
  try {
    native?.startWork(title, text);
  } catch {
    // The service could not start (an old OS, a denied permission): the turn still runs on screen.
  }
}
export function doneWorking(): void {
  try {
    native?.stopWork();
  } catch {
    // Nothing to stop.
  }
}

export async function getInstalledWallets(): Promise<InstalledWallet[]> {
  if (!native) throw Object.assign(new Error('Wallet discovery requires an Android build'), {
    code: 'wallet_requires_android',
  });
  return native.getInstalledWallets();
}
