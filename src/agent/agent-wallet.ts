import { useCallback, useRef } from "react";
import { mobileFetch, useMobile, useMobileAction } from "../lib/mobile-api";
import { useEmbeddedSolanaWallet, usePrivy } from "../lib/privy";
import { USDC } from "../domain/models";
import type { WalletProvider } from "./ryvo/wallet-signer";

// The agent's own wallet: a second Privy embedded wallet, made for the user
// the first time the agent needs one, and named as the agent's on the
// backend so it stays out of their portfolio. It is the payer of the agent's
// Ryvo channel and, once OMEN's session signer is on it, can act without
// the user present. Funding the agent is moving USDC into this wallet and
// on into the channel; withdrawing is the reverse.
export type AgentWalletInfo = { address: string | null; delegated: boolean };
type WalletRow = { address: string; primary: boolean; imported: boolean };

export function useAgentWallet() {
  const { user, getAccessToken } = usePrivy();
  const wallet = useEmbeddedSolanaWallet();
  const info = useMobile<AgentWalletInfo>("agent-wallet", {}, Boolean(user), 60000);
  const act = useMobileAction();
  // The signing accounts as of the latest render, for calls made later.
  const accounts = useRef(wallet.wallets ?? []);
  accounts.current = wallet.wallets ?? [];
  const creating = useRef<Promise<string> | null>(null);
  const address = info.data?.data.address ?? null;

  const getProvider = useCallback(async (): Promise<WalletProvider> => {
    if (!address) throw new Error("Your agent's wallet is still being prepared.");
    // Privy lists a new wallet a moment after creating it.
    for (let i = 0; i < 20; i++) {
      const account = accounts.current.find((a) => a.address === address);
      if (account) return (await account.getProvider()) as unknown as WalletProvider;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("Your agent's wallet is not on this device yet. Try again in a moment.");
  }, [address]);

  /** The agent's wallet address, creating the wallet the first time. */
  const ensure = useCallback(async (): Promise<string> => {
    if (address) return address;
    if (creating.current) return creating.current;
    creating.current = (async () => {
      const token = user ? await getAccessToken() : null;
      const list = async () => (await mobileFetch<WalletRow[]>("wallets", { refresh: "1" }, token)).data;
      const before = new Set((await list()).map((w) => w.address));
      if (!wallet.create) throw new Error("Your wallet is still being prepared. Try again in a moment.");
      await wallet.create({ recoveryMethod: "privy", createAdditional: true });
      let fresh: string | undefined;
      for (let i = 0; i < 10 && !fresh; i++) {
        fresh = (await list()).find((w) => !w.primary && !w.imported && !before.has(w.address))?.address;
        if (!fresh) await new Promise((r) => setTimeout(r, 1000));
      }
      if (!fresh) throw new Error("The agent's wallet was created but is not listed yet. Try again in a moment.");
      const { data } = await act<AgentWalletInfo>("agent-wallet", { address: fresh });
      if (!data.address) throw new Error("The agent's wallet could not be set up.");
      return data.address;
    })().finally(() => {
      creating.current = null;
    });
    return creating.current;
  }, [address, user, getAccessToken, wallet, act]);

  /** USDC sitting in the agent's wallet outside the channel, read from the chain. */
  const idleUsdc = useCallback(async (): Promise<number> => {
    if (!address) return 0;
    const token = user ? await getAccessToken() : null;
    const body = await mobileFetch<unknown>("rpc", {}, token, undefined, "POST", {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [address, { mint: USDC }, { encoding: "jsonParsed", commitment: "confirmed" }],
    });
    const result = (body as unknown as {
      result?: { value?: { account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } } } } }[] };
    }).result;
    return (result?.value ?? []).reduce((sum, a) => sum + Number(a.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0);
  }, [address, user, getAccessToken]);

  return {
    address,
    delegated: info.data?.data.delegated ?? false,
    loading: info.isLoading,
    ensure,
    getProvider,
    idleUsdc,
    refetch: info.refetch,
  };
}
