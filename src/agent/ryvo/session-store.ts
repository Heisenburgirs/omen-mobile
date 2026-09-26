import { Platform } from "react-native";
import type { ChannelSessionStore, PersistedChannelSession } from "@ryvo/channel-client";
import { deleteItemAsync, getItemAsync, setItemAsync } from "../../lib/secure-store";
import { kvDelete, kvGet, kvSet } from "../store";

// Where the agent's channel lives on this device. The session (channel id,
// configuration, what has been committed, any payment in flight) is in the
// agent's store, sealed under the user's key like the rest of its identity.
// The delegated voucher key's seed goes to the device keystore on the
// phone; in a browser, which has no keystore, it is sealed into the same
// store. Losing the seed strands the channel until Ryvo's 48-hour force
// close returns the deposit, so it is never kept only in memory.
const keystore = Platform.OS !== "web";
export function channelSessionStore(scope: string): ChannelSessionStore {
  const sessionKey = `ryvo.session.${scope}`;
  const secretKey = `ryvo.voucher.${scope}`;
  const readSecret = () => (keystore ? getItemAsync(secretKey) : kvGet(secretKey));
  const writeSecret = (secret: string) => (keystore ? setItemAsync(secretKey, secret) : kvSet(secretKey, secret));
  const dropSecret = () => (keystore ? deleteItemAsync(secretKey) : kvDelete(secretKey));
  return {
    async load() {
      const json = await kvGet(sessionKey);
      if (!json) return undefined;
      const session = JSON.parse(json) as PersistedChannelSession;
      const secret = await readSecret();
      if (secret) session.voucherSigner = { ...session.voucherSigner, secretKey: secret };
      return session;
    },
    async save(session) {
      const { secretKey: secret, ...voucherSigner } = session.voucherSigner;
      if (secret) await writeSecret(secret);
      await kvSet(sessionKey, JSON.stringify({ ...session, voucherSigner }));
    },
    async clear() {
      await kvDelete(sessionKey);
      await dropSecret();
    },
  };
}
