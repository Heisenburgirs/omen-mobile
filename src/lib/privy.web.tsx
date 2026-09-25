// The web SDK (@privy-io/react-auth) under the names and shapes of the Expo
// SDK, so the screens are the same code on a phone and in a browser.
//
// What differs underneath:
//  - OAuth is a full-page redirect: `login` and `link` start it and the page
//    leaves; Privy finishes the flow when the app loads again.
//  - The user's accounts are camelCase here and snake_case in the Expo SDK;
//    `linked_accounts` is rebuilt in the Expo shape.
//  - Signing goes through `useSignTransaction` with the embedded wallet; the
//    provider the app asks for wraps it.
//  - There is no Seed Vault or wallet deeplink in a browser.
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  PrivyProvider as WebPrivyProvider,
  Captcha,
  usePrivy as useWebPrivy,
  useUser,
  useSigners as useWebSigners,
  useLoginWithOAuth as useWebLoginWithOAuth,
  useLinkWithOAuth as useWebLinkWithOAuth,
  useUnlinkOAuth as useWebUnlinkOAuth,
  useLogin as useWebLogin,
} from "@privy-io/react-auth";
import {
  useWallets as useSolanaWallets,
  useCreateWallet as useCreateSolanaWallet,
  useImportWallet as useImportSolanaWallet,
  useSignTransaction,
  useSignMessage,
  toSolanaWalletConnectors,
} from "@privy-io/react-auth/solana";
import { VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { privyWallets, type LinkedAccount } from "./authority";

type AnyAccount = Record<string, unknown> & { type: string };
const snake = (account: AnyAccount) => ({
  ...account,
  chain_type: account.chainType,
  wallet_client_type: account.walletClientType,
  wallet_index: account.walletIndex,
  connector_type: account.connectorType,
  imported: account.imported === true,
});

export function PrivyProvider({
  appId,
  children,
}: {
  appId: string;
  /** The Expo app client belongs to the native builds; a browser is allowed by origin. */
  clientId?: string;
  config?: unknown;
  children: React.ReactNode;
}) {
  return (
    <WebPrivyProvider
      appId={appId}
      config={{
        // Google, and a Solana wallet (Phantom, Backpack, Solflare) through
        // the app's own buttons; X sign-in was switched off 2026-09-23.
        loginMethods: ["google", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#1119B8",
          logo: "https://www.getomen.xyz/app/icon-192.png",
          walletChainType: "solana-only",
          walletList: ["phantom", "backpack", "solflare"],
        },
        externalWallets: { solana: { connectors: toSolanaWalletConnectors() } },
        // One wallet, made by the session screen for every login method.
        embeddedWallets: {
          solana: { createOnLogin: "off" },
          ethereum: { createOnLogin: "off" },
          showWalletUIs: false,
        },
      }}
    >
      {children}
      {/* Privy's bot check (invisible Turnstile). The Privy modal would run
          it; the app signs in without that modal, so it has to be mounted
          here. It starts at once, so the token is there before anyone can
          reach a sign-in button. */}
      <Captcha />
    </WebPrivyProvider>
  );
}
/** The Expo SDK mounts its sheets here; the web SDK mounts its own. */
export const PrivyElements = () => null;

export function usePrivy() {
  const privy = useWebPrivy();
  const { refreshUser: refresh } = useUser();
  const user = useMemo(
    () =>
      privy.user
        ? {
            ...privy.user,
            linked_accounts: (privy.user.linkedAccounts as unknown as AnyAccount[]).map(snake),
          }
        : null,
    [privy.user],
  );
  const refreshUser = useCallback(async () => {
    const fresh = await refresh();
    return {
      user: fresh
        ? { ...fresh, linked_accounts: (fresh.linkedAccounts as unknown as AnyAccount[]).map(snake) }
        : null,
    };
  }, [refresh]);
  return {
    isReady: privy.ready,
    user: privy.ready && privy.authenticated ? user : null,
    error: undefined as Error | undefined,
    logout: privy.logout,
    getAccessToken: privy.getAccessToken,
    refreshUser,
  };
}

export const useSigners = useWebSigners;
export const useUnlinkOAuth = useWebUnlinkOAuth;

/**
 * On Android, X's authorize page is an app link: Chrome hands it to the X
 * app, the user approves there, and X opens OMEN's return address in its own
 * in-app browser, so the session ends up inside X instead of in Chrome where
 * the user started. An `intent:` address naming Chrome as the package keeps
 * the whole round trip in Chrome.
 *
 * Privy fetches the authorize address and navigates to it itself, so the
 * only seam is that one response: for the next X sign-in started from
 * Chrome on Android, its `url` is rewritten to the intent form (with the
 * plain address as the fallback). Everything else passes through untouched.
 */
function keepXSignInInChrome() {
  const ua = navigator.userAgent;
  const chromeOnAndroid =
    /Android/i.test(ua) && /Chrome\//.test(ua) && !/SamsungBrowser|Firefox|EdgA|OPR\/|; wv\)/.test(ua);
  if (!chromeOnAndroid) return;
  const original = window.fetch;
  const restore = () => {
    if (window.fetch === patched) window.fetch = original;
  };
  const patched: typeof fetch = async (input, init) => {
    const response = await original(input, init);
    const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!/\/api\/v1\/oauth\/init$/.test(address.split("?")[0])) return response;
    restore();
    try {
      const body = (await response.clone().json()) as { url?: string };
      const target = body.url ? new URL(body.url) : null;
      if (!target || target.protocol !== "https:" || !/(^|\.)(twitter|x)\.com$/.test(target.hostname))
        return response;
      const intent =
        "intent://" + target.host + target.pathname + target.search +
        "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" +
        encodeURIComponent(body.url!) + ";end";
      return new Response(JSON.stringify({ ...body, url: intent }), {
        status: response.status,
        headers: { "content-type": "application/json" },
      });
    } catch {
      return response;
    }
  };
  window.fetch = patched;
  // Never left in place: a sign-in that did not start gives fetch back.
  setTimeout(restore, 15000);
}

export function useLoginWithOAuth() {
  const { initOAuth } = useWebLoginWithOAuth();
  // `initOAuth` is rebuilt when the bot check's state changes: a retry has
  // to call the current one, not the one captured when the tap happened.
  const initOAuthRef = useRef(initOAuth);
  initOAuthRef.current = initOAuth;
  return {
    login: async ({ provider }: { provider: "google" | "twitter"; redirectUri?: string }) => {
      // The bot check may still be running on a fast tap or a slow
      // connection; Privy refuses the sign-in until it has passed. That is
      // not a failure to show anyone: wait for it, a few seconds at most.
      for (let attempt = 0; ; attempt++) {
        try {
          if (provider === "twitter") keepXSignInInChrome();
          return await initOAuthRef.current({ provider });
        } catch (cause) {
          const code = (cause as { privyErrorCode?: string } | null)?.privyErrorCode;
          if (code !== "captcha_failure" || attempt >= 5) throw cause;
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }
    },
  };
}
export function useLinkWithOAuth() {
  const { initOAuth } = useWebLinkWithOAuth();
  return {
    // Resolves as the redirect begins; the linked account shows up on return.
    link: async ({ provider }: { provider: "google" | "twitter"; redirectUri?: string }) => {
      await initOAuth({ provider });
      return null as { id: string } | null;
    },
  };
}
export function useLoginWithSiws() {
  const unavailable = async (): Promise<never> => {
    throw Object.assign(new Error("Wallet sign-in requires the Android app"), {
      code: "wallet_requires_android",
    });
  };
  return { generateMessage: unavailable, login: unavailable };
}

/**
 * Sign in with a Solana wallet through Privy's own modal, set up for
 * Phantom, Backpack and Solflare: it finds the extension on a computer and
 * deep-links into the wallet's app on a phone. `login` opens the modal and
 * returns at once; the callbacks say how it ended, so this waits for them.
 */
export function useWalletLogin() {
  const outcome = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);
  const { login } = useWebLogin({
    onComplete: () => {
      outcome.current?.resolve();
      outcome.current = null;
    },
    onError: (code) => {
      outcome.current?.reject(Object.assign(new Error("Wallet sign-in failed"), { code }));
      outcome.current = null;
    },
  });
  const loginWith = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        outcome.current = { resolve, reject };
        login({ loginMethods: ["wallet"], walletChainType: "solana-only" });
      }),
    [login],
  );
  return { loginWith };
}

type ProviderRequest =
  | { method: "signTransaction"; params: { transaction: VersionedTransaction } }
  | { method: "signMessage"; params: { message: string } };
type ProviderRequestFn = {
  (args: { method: "signTransaction"; params: { transaction: VersionedTransaction } }): Promise<{
    signedTransaction: VersionedTransaction;
  }>;
  (args: { method: "signMessage"; params: { message: string } }): Promise<{ signature: string }>;
};

export function useEmbeddedSolanaWallet() {
  const { user } = useWebPrivy();
  const { ready, wallets } = useSolanaWallets();
  const { createWallet } = useCreateSolanaWallet();
  const { signTransaction } = useSignTransaction();
  const { signMessage } = useSignMessage();
  const [phase, setPhase] = useState<"idle" | "creating" | "error">("idle");
  const creating = useRef(false);

  // Every Privy wallet the user holds, the sign-up one first: the app signs
  // with whichever holds the token, and an imported key is never the primary.
  const owned = privyWallets(((user?.linkedAccounts ?? []) as unknown as AnyAccount[]).map(snake) as LinkedAccount[]);
  const connected = wallets.find((w) => w.address === owned[0]?.address);

  const create = useCallback(
    async (_options?: { recoveryMethod?: string; createAdditional?: boolean }) => {
      if (creating.current) return;
      creating.current = true;
      setPhase("creating");
      try {
        await createWallet();
        setPhase("idle");
      } catch (cause) {
        setPhase("error");
        throw cause;
      } finally {
        creating.current = false;
      }
    },
    [createWallet],
  );

  // One signing account per owned wallet, the primary first.
  const accounts = useMemo(
    () =>
      owned
        .map((o) => wallets.find((w) => w.address === o.address))
        .filter((w): w is NonNullable<typeof w> => Boolean(w))
        .map((w) => ({
          address: w.address,
          // The same two requests the Expo SDK's provider answers, in the
          // same shapes: a transaction to sign, or a message given as base64
          // of its bytes, signed as those bytes with the signature base64.
          getProvider: async () => ({
            request: (async (args: ProviderRequest) => {
              if (args.method === "signMessage") {
                const { signature } = await signMessage({
                  message: new Uint8Array(Buffer.from(args.params.message, "base64")),
                  wallet: w,
                });
                return { signature: Buffer.from(signature).toString("base64") };
              }
              const { signedTransaction } = await signTransaction({
                transaction: args.params.transaction.serialize(),
                wallet: w,
              });
              return { signedTransaction: VersionedTransaction.deserialize(signedTransaction) };
            }) as ProviderRequestFn,
          }),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owned.map((o) => o.address).join(","), wallets, signTransaction, signMessage],
  );

  const status =
    phase === "creating"
      ? ("creating" as const)
      : phase === "error"
        ? ("error" as const)
        : !ready
          ? ("connecting" as const)
          : owned[0]
            ? ("connected" as const)
            : ("not-created" as const);
  return { status, create, wallets: connected ? accounts : [] };
}

/**
 * Brings a key the user already has into Privy as one more embedded wallet.
 * The key is encrypted in the browser and only ever decrypted inside Privy's
 * enclave; OMEN's signers can be attached in the same step, so the wallet
 * trades and reinvests like the sign-up one from the first minute.
 */
export function useImportWallet() {
  const { importWallet } = useImportSolanaWallet();
  const { refreshUser } = useUser();
  const run = useCallback(
    async (input: { privateKey: string; additionalSigners?: { signerId: string; policyIds?: string[] }[] }) => {
      const wallet = await importWallet({ privateKey: input.privateKey, additionalSigners: input.additionalSigners });
      await refreshUser().catch(() => undefined);
      return { address: wallet.address };
    },
    [importWallet, refreshUser],
  );
  return { importWallet: run };
}
