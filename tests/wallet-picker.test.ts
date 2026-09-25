import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { walletChoices, type InstalledWallet } from '../src/lib/wallet-picker';
const wallet = (packageName: string, name: string, extra: Partial<InstalledWallet> = {}): InstalledWallet =>
  ({ packageName, name, transport: 'mwa', isSystem: false, ...extra });
const seed = wallet('example.system.wallet', 'Seed Vault Wallet', { isSystem: true });
const phantom = wallet('app.phantom', 'Phantom');
const backpack = wallet('app.backpack.mobile', 'Backpack', { transport: 'deeplink' });
test('Seeker system wallet comes first only on a Seeker phone; all alternatives remain', () => {
  assert.deepEqual(walletChoices([backpack, phantom, seed], ' Seeker ').map(w => w.packageName),
    [seed.packageName, backpack.packageName, phantom.packageName]);
  assert.equal(walletChoices([seed, backpack], 'Pixel 7')[0].packageName, backpack.packageName);
  assert.equal(walletChoices([seed], 'Seeker emulator')[0].seeker, false);
  assert.equal(walletChoices([{ ...seed, isSystem: false }], 'Seeker')[0].seeker, false);
});
test('discover future MWA wallets, deduplicate activities, prefer MWA over deep links', () => {
  const future = wallet('example.future', 'Future wallet');
  const result = walletChoices([phantom, { ...phantom, transport: 'deeplink' }, future, future]);
  assert.equal(result.length, 2);
  assert.equal(result.find(w => w.packageName === phantom.packageName)?.transport, 'mwa');
  assert.ok(result.some(w => w.packageName === future.packageName));
});
test('never invent installed wallets or advertise unknown deep-link protocols', () => {
  assert.deepEqual(walletChoices([], 'Seeker'), []);
  assert.deepEqual(walletChoices([wallet('example.unknown', 'Unknown', { transport: 'deeplink' })]), []);
  assert.equal(walletChoices([backpack])[0].transport, 'deeplink');
});
