import { useCallback, useEffect, useRef, useState } from "react";
import { RyvoChannelClient, type ChannelStatus } from "@ryvo/channel-client";
import { config } from "../../config";
import { useEmbeddedSolanaWallet, usePrivy } from "../../lib/privy";
import type { ChatMessage } from "../harness";
import { RYVO, fromMicro, toMicro } from "./config";
import { channelSessionStore } from "./session-store";
import { walletSigner, type WalletProvider } from "./wallet-signer";

// The agent's balance: a USDC payment channel between the user's Privy
// wallet and Ryvo, kept on this device. Funding opens the channel (or tops
// it up), withdrawing closes it and returns what is unspent, and every reply
// the agent writes is prepaid from it. The channel client serialises its own
// calls, and the gateway allows one request per channel at a time, so the
// app never fires two turns at once.
export type ChannelView = {
  state: "none" | ChannelStatus["state"];
  /** What is left to spend. */
  availableUsdc: number;
  depositUsdc: number;
  spentUsdc: number;
  /** Set once a close is requested: when the deposit can be reclaimed. */
  closeDeadline: Date | null;
};
export type DepositLimits = { minUsdc: number; suggestedUsdc: number; maxUsdc: number };
const DEFAULT_LIMITS: DepositLimits = { minUsdc: 1, suggestedUsdc: 20, maxUsdc: 200 };
const NONE: ChannelView = { state: "none", availableUsdc: 0, depositUsdc: 0, spentUsdc: 0, closeDeadline: null };

const toView = (s: ChannelStatus): ChannelView => ({
  state: s.state,
  availableUsdc: fromMicro(s.available),
  depositUsdc: fromMicro(s.deposit),
  spentUsdc: fromMicro(s.accruedSpend),
  closeDeadline: s.closeDeadline,
});

export function useRyvoChannel() {
  const { user, getAccessToken } = usePrivy();
  const wallet = useEmbeddedSolanaWallet();
  const account = wallet.wallets?.[0];
  const address = account?.address ?? null;
  const built = useRef<{ address: string; client: RyvoChannelClient; store: ReturnType<typeof channelSessionStore> } | null>(null);
  const [view, setView] = useState<ChannelView | null>(null);
  const [limits, setLimits] = useState<DepositLimits>(DEFAULT_LIMITS);
  const [busy, setBusy] = useState(false);

  const handles = useCallback(() => {
    if (!account || !address) throw new Error("Your wallet is still being prepared. Try again in a moment.");
    if (built.current?.address === address) return built.current;
    // The channel's few RPC calls go through the site, which holds the RPC
    // key and wants the user's token; Ryvo's own endpoints get plain fetch.
    const authedFetch: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.startsWith(`${config.apiUrl}/`)) return fetch(input, init);
      const token = user ? await getAccessToken() : null;
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      if (token) headers.set("authorization", `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    };
    const store = channelSessionStore(`${config.network}.${address}`);
    const client = new RyvoChannelClient({
      gatewayUrl: RYVO.gatewayUrl,
      facilitatorUrl: RYVO.facilitatorUrl,
      rpcUrl: `${config.apiUrl}/api/mobile?resource=rpc`,
      wallet: walletSigner(address, () => account.getProvider() as unknown as Promise<WalletProvider>),
      store,
      fetch: authedFetch,
    });
    built.current = { address, client, store };
    return built.current;
  }, [account, address, user, getAccessToken]);

  /** The channel as Ryvo sees it now; "none" when this device has no channel for the wallet. */
  const refresh = useCallback(async (): Promise<ChannelView> => {
    if (!address) {
      setView(null);
      return NONE;
    }
    const { client, store } = handles();
    const persisted = await store.load();
    if (!persisted) {
      setView(NONE);
      return NONE;
    }
    const next = toView(await client.status());
    setView(next);
    return next;
  }, [address, handles]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    refresh().catch(() => {
      if (!cancelled) setView((v) => v ?? NONE);
    });
    return () => {
      cancelled = true;
    };
  }, [address, refresh]);

  /** Ryvo's deposit bounds, read once the fund sheet opens. */
  const loadLimits = useCallback(async () => {
    try {
      const profile = await handles().client.profile();
      const next = {
        minUsdc: fromMicro(profile.minimumDeposit),
        suggestedUsdc: fromMicro(profile.suggestedDeposit),
        maxUsdc: fromMicro(profile.maximumDeposit),
      };
      setLimits(next);
      return next;
    } catch {
      return limits;
    }
  }, [handles, limits]);

  const run = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await task();
    } finally {
      setBusy(false);
    }
  }, []);

  /** Opens the channel with `usdc`, or adds `usdc` to the open one. */
  const fund = useCallback(
    (usdc: number) =>
      run(async () => {
        const { client, store } = handles();
        const current = await refresh();
        // A closed channel is finished from this side; a new one starts fresh.
        if (current.state === "distributed" || current.state === "reclaimed") await store.clear();
        const status =
          current.state === "open" ? await client.topUp(toMicro(usdc)) : await client.open({ deposit: toMicro(usdc) });
        const next = toView(status);
        setView(next);
        return next;
      }),
    [handles, refresh, run],
  );

  /** Closes the channel: unspent USDC returns to the wallet, spent USDC settles to Ryvo. */
  const withdraw = useCallback(
    () =>
      run(async () => {
        const { client } = handles();
        const next = toView(await client.close());
        setView(next);
        return next;
      }),
    [handles, run],
  );

  /** One reply, prepaid from the channel. */
  const write = useCallback(
    async (messages: ChatMessage[]): Promise<{ content: string; costMicro: number | null }> => {
      const { client } = handles();
      const { response, receipt } = await client.paidFetch("/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: RYVO.chatModel,
          messages,
          max_tokens: RYVO.maxOutputTokens,
          temperature: 0.4,
          stream: false,
        }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Ryvo replied ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`);
      }
      const data = (await response.json()) as {
        choices?: { message?: { content?: string | { text?: string }[] } }[];
      };
      const raw = data.choices?.[0]?.message?.content;
      const content = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((p) => p.text ?? "").join("") : "";
      const costMicro = receipt ? Number(receipt.chargedAmount) : null;
      refresh().catch(() => undefined);
      return { content, costMicro };
    },
    [handles, refresh],
  );

  return { address, ready: Boolean(account), view, limits, busy, refresh, loadLimits, fund, withdraw, write };
}
