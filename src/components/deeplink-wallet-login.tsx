import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { useDeeplinkWalletConnector } from '@privy-io/expo/connectors';
import { base58 } from '@scure/base';
import { deeplinkAdapters, type WalletChoice } from '../lib/wallet-picker';
import { deeplinkProof } from '../lib/deeplink-proof';
import type { createWalletProof, SignInProof } from '../lib/seeker-proof';

type Props = {
  wallet: WalletChoice;
  generateMessage: Parameters<typeof createWalletProof>[1];
  onProof: (proof: SignInProof) => Promise<void>;
  onError: (error: unknown) => void;
};

// Mount only while connecting, so connector setup never delays app startup.
export function DeeplinkWalletLogin(props: Props) {
  const adapter = deeplinkAdapters[props.wallet.packageName];
  const connector = useDeeplinkWalletConnector({
    ...adapter, appUrl: 'https://getomen.xyz', redirectUri: '/', autoReconnect: false,
  });
  const current = useRef({ props, connector });
  current.current = { props, connector };
  const addressWaiter = useRef<((address: string) => void) | null>(null);
  useEffect(() => {
    if (connector.isConnected && connector.address) addressWaiter.current?.(connector.address);
  }, [connector.address, connector.isConnected]);

  useEffect(() => {
    let active = true;
    let failed = false;
    let rejectAddress: (error: unknown) => void = () => {};
    const fail = (error: unknown) => {
      if (!active || failed) return;
      failed = true;
      rejectAddress(error);
      current.current.props.onError(error);
    };
    const timeout = setTimeout(() => fail({ code: 'ERROR_SESSION_TIMEOUT' }), 60_000);
    const links = Linking.addEventListener('url', ({ url }) => {
      try {
        const callback = new URL(url);
        if (callback.searchParams.get('wallet_id') === adapter.encryptionPublicKeyName &&
            callback.searchParams.has('errorCode')) {
          const code = callback.searchParams.get('errorCode');
          fail({ code: code === '4001' ? 'ERROR_ASSOCIATION_CANCELLED' : 'wallet_connection_failed' });
        }
      } catch { /* Ignore unrelated links. */ }
    });
    const run = async () => {
      const address = await new Promise<string>((resolve, reject) => {
        addressWaiter.current = resolve;
        rejectAddress = reject;
        void current.current.connector.connect().catch(reject);
      });
      if (!active || failed) return;
      if (base58.decode(address).length !== 32) throw new Error('Invalid wallet address');
      const { message } = await current.current.props.generateMessage({
        wallet: { address }, from: { domain: 'getomen.xyz', uri: 'https://getomen.xyz' },
      });
      if (!active || failed) return;
      const { signature } = await current.current.connector.signMessage(message);
      if (!active || failed) return;
      clearTimeout(timeout);
      await current.current.props.onProof(deeplinkProof(address, message, signature));
    };
    void run().catch(fail);
    return () => {
      active = false;
      clearTimeout(timeout);
      links.remove();
      addressWaiter.current = null;
      rejectAddress({ code: 'ERROR_ASSOCIATION_CANCELLED' });
    };
  }, [adapter.encryptionPublicKeyName]);
  return null;
}
