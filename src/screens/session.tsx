import React, { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEmbeddedSolanaWallet, useLoginWithOAuth, useLoginWithSiws, usePrivy, useWalletLogin } from "../lib/privy";
import { useQueryClient } from "@tanstack/react-query";
import { WelcomeScreen } from "./welcome";
import { LaunchScreen } from "../components/launch-screen";
import { MarketShell } from "./market-shell";
import { Mark, Notice, ui } from "../components/ui";
import { AccountSetupScreen, AccountSetupTransition } from "../components/account-setup";
import { config, configurationError } from "../config";
import { authErrorCode, loginErrorMessage, loginProviders, type LoginProvider } from "../lib/auth";
import { selectSigningAuthority, shouldCreateEmbeddedWallet } from "../lib/authority";
import { requestWalletProof } from "../lib/seeker";
import { assertWalletRequestActive } from "../lib/wallet-request";
import { getInstalledWallets } from "../../modules/omen-wallets";
import { walletChoices } from "../lib/wallet-picker";
import { showErrorToast } from "../lib/toast";

export function SessionScreen() {
  const { isReady, user, error: initializationError, logout, refreshUser } = usePrivy();
  const { login: loginWithOAuth } = useLoginWithOAuth();
  const { generateMessage, login: loginWithWallet } = useLoginWithSiws();
  const { loginWith: loginWithBrowserWallet } = useWalletLogin();
  const wallet = useEmbeddedSolanaWallet();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<LoginProvider | null>(null);
  const [committingLogin, setCommittingLogin] = useState(false);
  const loginPending = useRef(false);
  const loginController = useRef<AbortController | null>(null);
  const attempt = useRef(0);
  const [error, setError] = useState("");
  // Web: a visitor can open the market before making an account.
  const [browsing, setBrowsing] = useState(false);
  const previousUser = useRef<string | undefined>(undefined);
  const walletCreationAttempt = useRef<string | null>(null);
  const creatingWallet = useRef(false);
  const accounts = user?.linked_accounts || [];
  const authority = selectSigningAuthority(accounts);
  const needsEmbeddedWallet = Boolean(user && shouldCreateEmbeddedWallet(accounts));
  const model = Platform.OS === "android" ? Platform.constants.Model : undefined;

  const setupError = user && !authority && !busy && wallet.status !== "creating"
    ? error || (wallet.status === "error" ? "Your account couldn’t be prepared. Please try again." : "") : "";
  useEffect(() => { if (setupError) showErrorToast(setupError); }, [setupError]);
  useEffect(() => () => { attempt.current++; loginController.current?.abort(); }, []);
  useEffect(() => {
    const previousId = previousUser.current;
    if (previousId && previousId !== user?.id) {
      queryClient.removeQueries({ predicate: query => query.queryKey[0] === "balance" && query.queryKey[1] === previousId });
      walletCreationAttempt.current = null;
    }
    previousUser.current = user?.id;
  }, [user?.id, queryClient]);

  // One creation path for every login method. Existing embedded wallets are
  // selected above; createAdditional:false prevents additional wallet creation.
  useEffect(() => {
    if (!user || !needsEmbeddedWallet || creatingWallet.current || !wallet.create ||
        wallet.status !== "not-created" || walletCreationAttempt.current === user.id) return;
    walletCreationAttempt.current = user.id;
    creatingWallet.current = true;
    setBusy(true);
    void wallet.create({ recoveryMethod: "privy", createAdditional: false })
      .then(() => refreshUser())
      .catch(() => setError("Your wallet couldn’t be prepared. Please retry."))
      .finally(() => { creatingWallet.current = false; setBusy(false); });
  }, [user?.id, needsEmbeddedWallet, wallet.status, wallet.create, refreshUser]);

  const signOut = async () => {
    if (creatingWallet.current) return;
    setBusy(true);
    setError("");
    try { await logout(); queryClient.clear(); walletCreationAttempt.current = null; }
    catch { setError("Could not sign out. Please try again."); }
    finally { setBusy(false); }
  };
  const resetLogin = () => {
    loginPending.current = false;
    loginController.current = null;
    setPendingProvider(null);
    setCommittingLogin(false);
  };
  const cancelLogin = () => {
    if (committingLogin || pendingProvider !== "seeker") return;
    attempt.current++;
    loginController.current?.abort();
    resetLogin();
  };
  const signIn = async (provider: LoginProvider) => {
    if (loginPending.current || user || !loginProviders(Platform.OS, model).includes(provider)) return;
    loginPending.current = true;
    setPendingProvider(provider);
    setError("");
    const id = ++attempt.current;
    const controller = new AbortController();
    loginController.current = controller;
    try {
      if (provider === "seeker") {
        const installed = await getInstalledWallets();
        assertWalletRequestActive(controller.signal);
        const seeker = walletChoices(installed, model).find(choice => choice.seeker);
        if (!seeker) throw { code: "ERROR_SEEKER_UNAVAILABLE" };
        const proof = await requestWalletProof(generateMessage, config.network, seeker.packageName, controller.signal);
        assertWalletRequestActive(controller.signal);
        if (id !== attempt.current) return;
        setCommittingLogin(true);
        await loginWithWallet({ message: proof.message, signature: proof.signature,
          wallet: { walletClientType: "seed_vault", connectorType: "solana-mobile-wallet-adapter" } });
      } else if (provider === "wallet") {
        // Privy's modal: Phantom, Backpack or Solflare.
        await loginWithBrowserWallet();
      } else {
        await loginWithOAuth({ provider, redirectUri: "/" });
      }
    } catch (cause) {
      if (id === attempt.current) {
        const message = loginErrorMessage(cause, provider);
        if (message) showErrorToast(message);
        if (__DEV__) console.info("[OMEN auth]", provider, authErrorCode(cause) || "unknown_error");
      }
    } finally { if (id === attempt.current) resetLogin(); }
  };
  const retryWallet = async () => {
    if (busy || creatingWallet.current) return;
    setBusy(true);
    setError("");
    try {
      const freshUser = await refreshUser();
      const freshAccounts = freshUser?.user?.linked_accounts || user?.linked_accounts || [];
      if (shouldCreateEmbeddedWallet(freshAccounts) && wallet.create &&
          (wallet.status === "not-created" || wallet.status === "error")) {
        creatingWallet.current = true;
        await wallet.create({ recoveryMethod: "privy", createAdditional: false });
        await refreshUser();
      }
    } catch { setError("Your wallet couldn’t be prepared. Please retry."); }
    finally { creatingWallet.current = false; setBusy(false); }
  };

  if (initializationError) return (
    <SafeAreaView style={ui.screen}><View style={[ui.page, { justifyContent: "center", gap: 24 }]}>
      <Mark /><Text style={ui.heading}>Couldn’t connect</Text>
      <Notice>We couldn’t restore your session. Check your connection, then restart OMEN.</Notice>
    </View></SafeAreaView>
  );
  if (!isReady) return <LaunchScreen />;
  if (user) return (
    <AccountSetupTransition key={user.id} ready={Boolean(authority)} setup={
      <AccountSetupScreen failed={Boolean(setupError)} onRetry={() => void retryWallet()} onSignOut={() => void signOut()} />
    }>
      {authority && <MarketShell address={authority.address} onSignOut={signOut}
        signingOut={busy} sessionError={error} />}
    </AccountSetupTransition>
  );
  if (browsing) return (
    <MarketShell address="" onSignOut={async () => undefined} signingOut={false}
      onRequestSignIn={() => setBrowsing(false)} />
  );
  return <WelcomeScreen onSignIn={signIn}
    onBrowse={Platform.OS === "web" ? () => setBrowsing(true) : undefined} pendingProvider={pendingProvider}
    setupMessage={configurationError() || undefined} onCancel={cancelLogin}
    canCancel={pendingProvider === "seeker" && !committingLogin} />;
}