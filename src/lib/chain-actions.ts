import { useCallback, useRef } from "react";
import { usePrivy, useSigners, useImportWallet } from "./privy";
import { useQueryClient } from "@tanstack/react-query";
import { mobileFetch, MobileError } from "./mobile-api";
import { useSigner } from "./signer";
import { showErrorToast } from "./toast";
import { USDC, type Asset, type Portfolio } from "../domain/models";
export { splitAcrossWallets, walletHolding } from "./wallets";

export type Quote = {
  side: "buy" | "sell";
  mint: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  minOutAmount: string | null;
  priceImpactPct: number | null;
  slippageBps: number;
  feeBps: number;
  feeAmount: string | null;
  tokenDecimals: number;
  raw: Record<string, unknown>;
  /** The wallet the quote is for (a sale from where the token sits); the primary when unset. */
  wallet?: string;
  /** Charged on top of the trade: rent for a token account this first buy creates (paid in USDC, kept as SOL). */
  charges?: { rentUsd: number; accounts: number; note: string };
};
type Status = { status: "pending" | "confirmed" | "failed"; error?: string };
/** Whether OMEN can trade on the user's behalf with fees covered. */
export type SignerStatus = {
  enabled: boolean;
  signerId: string | null;
  policyIds: string[];
  delegated: boolean;
  address: string;
  /** The dividend reinvestor's own signer: a policy that allows swaps and nothing else. */
  drip?: { enabled: boolean; signerId: string | null; policyIds: string[]; attached: boolean };
  /** Every wallet the user holds through Privy, and which signers each carries. */
  wallets?: { address: string; primary: boolean; imported: boolean; delegated: boolean; dripAttached: boolean }[];
};
/** One of the user's wallets as the server lists them (resource "wallets"). */
export type WalletInfo = { address: string; primary: boolean; imported: boolean; delegated: boolean; name: string | null };
/** Asks the user a yes/no question; the screens supply the dialog. */
export type Confirm = (title: string, body: string, yes: string) => Promise<boolean>;

/** Waits for a signature to confirm, polling the backend; rejects on failure or timeout. */
async function waitForConfirmation(
  signature: string,
  token: string | null,
  timeoutMs = 75_000,
): Promise<void> {
  const started = Date.now();
  // Most sends confirm within a second or two; ask early and back off gently.
  let delay = 500;
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, delay));
    const { data } = await mobileFetch<Status>("transaction", { signature }, token);
    if (data.status === "confirmed") return;
    if (data.status === "failed") throw new MobileError(data.error || "The transaction failed.", 400);
    delay = Math.min(delay + 300, 2000);
  }
  throw new MobileError("Still confirming. Check your activity in a minute.", 504);
}

/**
 * The on-chain actions the app performs, two ways:
 *
 * Sponsored (preferred): the user has added OMEN as a session signer, so
 * the backend signs with the user's wallet through Privy and Privy pays the
 * network fee. The app sends the request and waits for confirmation.
 *
 * Self-signed (fallback): the backend returns an unsigned transaction, the
 * embedded wallet signs it in the app, and the backend submits it; the user
 * pays the network fee.
 */
export function useChainActions() {
  const { getAccessToken, user } = usePrivy();
  const { addSigners } = useSigners();
  const { importWallet } = useImportWallet();
  const sign = useSigner();
  const client = useQueryClient();
  // The signer status is fetched once per session and refreshed after consent.
  const status = useRef<SignerStatus | null>(null);

  const signerStatus = useCallback(
    async (fresh = false): Promise<SignerStatus> => {
      if (status.current && !fresh) return status.current;
      const token = await getAccessToken();
      const { data } = await mobileFetch<SignerStatus>("signer", {}, token);
      status.current = data;
      return data;
    },
    [getAccessToken],
  );

  /**
   * Fee-free execution needs OMEN's signer on the wallet. It is attached
   * silently the first time it is needed: the swipe (or the review button) is
   * the user's confirmation, there is no separate consent step. Returns false
   * only when the backend has no sponsorship configured, in which case the
   * app signs for itself; any other failure surfaces so a trade is never
   * quietly downgraded to a fee the wallet cannot pay.
   */
  const ensureSponsorship = useCallback(async (wallet?: string): Promise<boolean> => {
    let current: SignerStatus;
    try {
      current = await signerStatus();
    } catch {
      throw new Error("Fee-free trading is unavailable right now. Please try again.");
    }
    if (!current.enabled || !current.signerId) return false;
    // The wallet the action signs with; each carries its own signers.
    const own = wallet ? current.wallets?.find((w) => w.address === wallet) : undefined;
    const address = own?.address ?? current.address;
    if (own ? own.delegated : current.delegated) return true;
    try {
      await addSigners({
        address,
        signers: [{ signerId: current.signerId, policyIds: current.policyIds }],
      });
    } catch {
      throw new Error("Could not set up fee-free trading for this wallet. Please try again.");
    }
    status.current = {
      ...current,
      delegated: address === current.address ? true : current.delegated,
      wallets: current.wallets?.map((w) => (w.address === address ? { ...w, delegated: true } : w)),
    };
    return true;
  }, [signerStatus, addSigners]);

  /**
   * Reinvesting runs on the server without the user present, so it signs
   * with its own narrower signer. It is attached when a drip is first set
   * up; the trading signer comes along if it is not on the wallet yet.
   */
  const ensureDripSigner = useCallback(async (wallet?: string): Promise<boolean> => {
    let current: SignerStatus;
    try {
      current = await signerStatus(true);
    } catch {
      throw new Error("Reinvesting is unavailable right now. Please try again.");
    }
    const drip = current.drip;
    if (!drip?.enabled || !drip.signerId) return false;
    const own = wallet ? current.wallets?.find((w) => w.address === wallet) : undefined;
    const address = own?.address ?? current.address;
    if (own ? own.dripAttached : drip.attached) return true;
    const signers = [{ signerId: drip.signerId, policyIds: drip.policyIds }];
    if (current.enabled && current.signerId && !(own ? own.delegated : current.delegated))
      signers.unshift({ signerId: current.signerId, policyIds: current.policyIds });
    try {
      await addSigners({ address, signers });
    } catch {
      throw new Error("Could not set up reinvesting for this wallet. Please try again.");
    }
    status.current = {
      ...current,
      delegated: address === current.address ? true : current.delegated,
      drip: address === current.address ? { ...drip, attached: true } : drip,
      wallets: current.wallets?.map((w) => (w.address === address ? { ...w, delegated: true, dripAttached: true } : w)),
    };
    return true;
  }, [signerStatus, addSigners]);
  /**
   * Brings a key the user already holds into OMEN as one more wallet.
   * Privy encrypts it in the app and keeps it in its enclave; OMEN's
   * trading and reinvesting signers go on in the same step, so the wallet
   * works like the sign-up one at once. What was in it stays where it is:
   * that is the point (moving a Stonk token would pay its transfer tax).
   */
  /** The user's own name for one of their wallets (empty clears it). */
  const renameWallet = useCallback(
    async (address: string, name: string): Promise<void> => {
      const token = await getAccessToken();
      await mobileFetch("wallets", {}, token, undefined, "PATCH", { wallet: address, name });
      // The new name shows at once; the refetch confirms it.
      const rename = (old: { data: { wallets?: { address: string; name: string | null }[] } } | undefined) =>
        old?.data?.wallets ? { ...old, data: { ...old.data, wallets: old.data.wallets.map((w) => (w.address === address ? { ...w, name: name || null } : w)) } } : old;
      client.setQueriesData<{ data: WalletInfo[] }>({ queryKey: ["mobile", user?.id, "wallets"] }, (old) =>
        old?.data ? { ...old, data: old.data.map((w) => (w.address === address ? { ...w, name: name || null } : w)) } : old,
      );
      client.setQueriesData<{ data: Portfolio }>({ queryKey: ["mobile", user?.id, "portfolio"] }, rename as any);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["mobile", user?.id, "wallets"] }),
        client.invalidateQueries({ queryKey: ["mobile", user?.id, "portfolio"] }),
      ]);
    },
    [getAccessToken, client, user?.id],
  );
  const importKey = useCallback(
    async (privateKey: string, name = ""): Promise<{ address: string }> => {
      const key = privateKey.trim();
      if (!/^[1-9A-HJ-NP-Za-km-z]{64,120}$/.test(key))
        throw new Error("Paste the wallet's private key in base58 (the form Phantom and Solflare export).");
      let current: SignerStatus | null = null;
      try {
        current = await signerStatus();
      } catch {
        current = null;
      }
      const signers: { signerId: string; policyIds?: string[] }[] = [];
      if (current?.enabled && current.signerId) signers.push({ signerId: current.signerId, policyIds: current.policyIds });
      if (current?.drip?.enabled && current.drip.signerId) signers.push({ signerId: current.drip.signerId, policyIds: current.drip.policyIds });
      const { address } = await importWallet({ privateKey: key, additionalSigners: signers.length ? signers : undefined });
      // The wallet shows in the list at once; Privy lists it a moment
      // later, and the server is asked to wait for it before its cached
      // list is rebuilt, so no refetch can bring back the old list.
      const fresh: WalletInfo = { address, primary: false, imported: true, delegated: signers.length > 0, name: name.trim() || null };
      client.setQueriesData<{ data: WalletInfo[] }>({ queryKey: ["mobile", user?.id, "wallets"] }, (old) =>
        old?.data && !old.data.some((w) => w.address === address) ? { ...old, data: [...old.data, fresh] } : old,
      );
      const token = await getAccessToken();
      await mobileFetch("wallets", { refresh: "1", expect: address }, token).catch(() => undefined);
      if (name.trim()) await mobileFetch("wallets", {}, token, undefined, "PATCH", { wallet: address, name: name.trim() }).catch(() => undefined);
      status.current = null;
      await client.invalidateQueries({ queryKey: ["mobile", user?.id] });
      return { address };
    },
    [signerStatus, importWallet, getAccessToken, client, user?.id],
  );

  // Only what a trade or transfer changes is refetched: the portfolio, the
  // activity list, performance and the SOL balance. Charts and asset pages
  // are left alone so the screen does not flicker.
  const refresh = useCallback(() => {
    for (const resource of ["portfolio", "activity", "performance", "dividends"])
      void client.invalidateQueries({ queryKey: ["mobile", user?.id, resource] });
    void client.invalidateQueries({ queryKey: ["balance"] });
  }, [client, user?.id]);
  const pending = useRef<{ quote: Quote; asset?: Asset; until: number }[]>([]);
  /**
   * Shows the trade before the chain has confirmed it: the cached portfolio
   * is adjusted from the quote (cash down and the token up on a buy, the
   * reverse on a sell; a first-time token gets a row). Trades the server has
   * not reflected yet stay in `pending`: each refetch that still shows the
   * pre-trade balance gets the trade applied on top again, so the figures
   * never flick back to stale values, until the server agrees or 30 s pass.
   * A failed confirmation refetches, which is the revert.
   */
  const patchPortfolio = useCallback(
    (old: { data: Portfolio } | undefined, quote: Quote, asset?: Asset) => {
      if (!old?.data?.holdings) return old;
      const inAmt = Number(quote.inAmount), outAmt = Number(quote.outAmount);
      let sawToken = false;
      const holdings = old.data.holdings.map((h) => {
        const isUsdc = h.asset.mint === USDC, isToken = h.asset.mint === quote.mint;
        if (isToken) sawToken = true;
        if (!isUsdc && !isToken) return h;
        const decimals = isUsdc ? 6 : quote.tokenDecimals;
        const delta = quote.side === "buy" ? (isUsdc ? -inAmt : outAmt) : isUsdc ? outAmt : -inAmt;
        const raw = Math.max(0, Number(h.raw) + delta);
        const quantity = raw / 10 ** decimals;
        const unitUsd = h.valueUsd != null && Number(h.quantity) > 0 ? Number(h.valueUsd) / Number(h.quantity) : isUsdc ? 1 : null;
        return {
          ...h,
          raw: String(Math.round(raw)),
          quantity: String(quantity),
          valueUsd: unitUsd != null ? (quantity * unitUsd).toFixed(2) : h.valueUsd,
        };
      });
      // A token bought for the first time has no row yet: add one from the
      // quote and the page's own asset, worth what was just paid for it.
      if (!sawToken && quote.side === "buy" && asset) {
        holdings.push({
          asset,
          raw: quote.outAmount,
          decimals: quote.tokenDecimals,
          quantity: String(outAmt / 10 ** quote.tokenDecimals),
          valueUsd: (inAmt / 1e6).toFixed(2),
          averageEntry: null,
          unrealizedUsd: null,
          dividendsUsd: null,
        });
      }
      return { ...old, data: { ...old.data, holdings } };
    },
    [],
  );
  /** True when the server's portfolio already reflects the trade. */
  const reflected = (p: Portfolio | undefined, quote: Quote) => {
    const token = p?.holdings.find((h) => h.asset.mint === quote.mint);
    const raw = Number(token?.raw ?? 0);
    return quote.side === "buy" ? raw >= Number(quote.outAmount) * 0.9 : raw <= Number(quote.inAmount) * 0.1 + 1;
  };
  const reapplyPending = useCallback(() => {
    const now = Date.now();
    pending.current = pending.current.filter((t) => t.until > now);
    if (!pending.current.length) return;
    client.setQueriesData<{ data: Portfolio }>({ queryKey: ["mobile", user?.id, "portfolio"] }, (old) => {
      let next = old;
      for (const t of pending.current) if (!reflected(old?.data, t.quote)) next = patchPortfolio(next, t.quote, t.asset);
      return next;
    });
    pending.current = pending.current.filter((t) => {
      const fresh = client.getQueriesData<{ data: Portfolio }>({ queryKey: ["mobile", user?.id, "portfolio"] })[0]?.[1];
      return !reflected(fresh?.data, t.quote);
    });
  }, [client, user?.id, patchPortfolio]);
  const applyOptimistic = useCallback(
    (quote: Quote, asset?: Asset) => {
      pending.current.push({ quote, asset, until: Date.now() + 30000 });
      client.setQueriesData<{ data: Portfolio }>({ queryKey: ["mobile", user?.id, "portfolio"] }, (old) =>
        patchPortfolio(old, quote, asset),
      );
      // Reconcile as the send lands and again after confirmation; each
      // refetch that still shows the old balance gets the trade re-applied.
      const reconcile = () =>
        client
          .invalidateQueries({ queryKey: ["mobile", user?.id, "portfolio"] })
          .then(reapplyPending, reapplyPending);
      setTimeout(reconcile, 1500);
      setTimeout(reconcile, 4000);
      setTimeout(refresh, 8000);
    },
    [client, user?.id, refresh, patchPortfolio, reapplyPending],
  );

  /** Self-signed path: build, sign in the app, submit, confirm. */
  const runSelfSigned = useCallback(
    async (build: (token: string | null) => Promise<string>, wallet?: string) => {
      const token = await getAccessToken();
      const unsigned = await build(token);
      const signed = await sign(unsigned, wallet);
      const { data } = await mobileFetch<{ signature: string }>("submit", {}, token, undefined, "POST", {
        transaction: signed,
      });
      try {
        await waitForConfirmation(data.signature, token);
      } finally {
        refresh();
      }
      return data.signature;
    },
    [getAccessToken, sign, refresh],
  );
  /** Sponsored path: the backend signs and sends; the app only waits. */
  const runSponsored = useCallback(
    async (resource: string, body: Record<string, unknown>) => {
      const token = await getAccessToken();
      const { data } = await mobileFetch<{ signature: string; confirmed?: boolean }>(
        resource,
        {},
        token,
        undefined,
        "POST",
        { ...body, execute: true },
      );
      // The send was simulated and accepted by the network before the backend
      // answered, so the fill is shown now. Confirmation is watched in the
      // background; the rare failure is reported and the balances refetched.
      if (!data.confirmed)
        void waitForConfirmation(data.signature, token)
          .then(refresh)
          .catch((e) => {
            showErrorToast(e instanceof Error && e.message ? e.message : "The transaction did not confirm.");
            refresh();
          });
      else refresh();
      return data.signature;
    },
    [getAccessToken, refresh],
  );

  // `wallet` names which of the user's wallets signs: a sale or a send
  // comes from the wallet holding the token; a buy lands in the primary.
  const quote = useCallback(
    async (input: { side: "buy" | "sell"; mint: string; amount: string; wallet?: string }): Promise<Quote> => {
      const token = await getAccessToken();
      const { wallet, ...rest } = input;
      const { data } = await mobileFetch<Quote>("quote", { ...rest, ...(wallet ? { wallet } : {}) }, token);
      return { ...data, wallet };
    },
    [getAccessToken],
  );
  const swap = useCallback(
    async (quote: Quote, asset?: Asset) => {
      const wallet = quote.wallet;
      if (await ensureSponsorship(wallet)) {
        const signature = await runSponsored("swap", { quote: quote.raw, ...(wallet ? { wallet } : {}) });
        applyOptimistic(quote, asset);
        return signature;
      }
      return runSelfSigned(async (token) => {
        const { data } = await mobileFetch<{ transaction: string }>("swap", {}, token, undefined, "POST", {
          quote: quote.raw,
          ...(wallet ? { wallet } : {}),
        });
        return data.transaction;
      }, wallet);
    },
    [ensureSponsorship, runSponsored, runSelfSigned, applyOptimistic],
  );
  const transfer = useCallback(
    async (input: { mint: string; to: string; amount: string; wallet?: string }) => {
      const body = { mint: input.mint, to: input.to, amount: input.amount, ...(input.wallet ? { wallet: input.wallet } : {}) };
      if (await ensureSponsorship(input.wallet)) return runSponsored("transfer", body);
      return runSelfSigned(async (token) => {
        const { data } = await mobileFetch<{ transaction: string }>("transfer", {}, token, undefined, "POST", body);
        return data.transaction;
      }, input.wallet);
    },
    [ensureSponsorship, runSponsored, runSelfSigned],
  );
  return { quote, swap, transfer, signerStatus, ensureSponsorship, ensureDripSigner, importKey, renameWallet };
}

export const errorMessage = (e: unknown) =>
  e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.";
