import type { ChannelSessionStore, PersistedChannelSession } from "@ryvo/channel-client";
import { deleteItemAsync, getItemAsync, setItemAsync } from "../../lib/secure-store";
import { kvDelete, kvGet, kvSet } from "../store";

// Where the agent's channel lives on this device. The session (channel id,
// configuration, what has been committed, any payment in flight) is in the
// agent's local database; the delegated voucher key's seed is in the device
// keystore (localStorage in a browser). Losing the seed strands the channel
// until Ryvo's 48-hour force-close returns the deposit, so it is never kept
// only in memory.
export function channelSessionStore(scope: string): ChannelSessionStore {
  const sessionKey = `ryvo.session.${scope}`;
  const secretKey = `ryvo.voucher.${scope}`;
  return {
    async load() {
      const json = await kvGet(sessionKey);
      if (!json) return undefined;
      const session = JSON.parse(json) as PersistedChannelSession;
      const secret = await getItemAsync(secretKey);
      if (secret) session.voucherSigner = { ...session.voucherSigner, secretKey: secret };
      return session;
    },
    async save(session) {
      const { secretKey: secret, ...voucherSigner } = session.voucherSigner;
      if (secret) await setItemAsync(secretKey, secret);
      await kvSet(sessionKey, JSON.stringify({ ...session, voucherSigner }));
    },
    async clear() {
      await kvDelete(sessionKey);
      await deleteItemAsync(secretKey);
    },
  };
}
