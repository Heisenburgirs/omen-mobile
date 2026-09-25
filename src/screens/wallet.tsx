import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePrivy } from "../lib/privy";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { config, configurationError } from "../config";
import { accountLabel } from "../lib/auth";
import {
  BalanceError,
  fetchBalance,
  formatSol,
  shortAddress,
} from "../lib/balance";
import { Button, Eyebrow, Mark, Notice, ui } from "../components/ui";
import { colors, fonts } from "../theme";
import { AccountConnections } from "../components/account-connections";
export function WalletScreen({
  address,
  onSignOut,
  signingOut,
  sessionError,
}: {
  address: string;
  onSignOut: () => Promise<void>;
  signingOut: boolean;
  sessionError?: string;
}) {
  const { user, getAccessToken } = usePrivy();
  const [sheet, setSheet] = useState<"address" | "settings" | null>(null);
  const [copied, setCopied] = useState(false);
  const [connectionsBusy, setConnectionsBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const email = accountLabel(user?.linked_accounts || []);
  const balance = useQuery({
    queryKey: ["balance", user?.id, address, config.network],
    queryFn: async ({ signal }) => {
      const setupError = configurationError();
      if (setupError) throw new BalanceError(setupError, 400);
      const token = await getAccessToken();
      if (!token)
        throw new BalanceError("Your session expired. Sign in again.", 401);
      return fetchBalance(
        config.apiUrl,
        address,
        token,
        config.network,
        signal,
      );
    },
    enabled: !signingOut,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
    retry: (attempt, error) =>
      attempt < 1 &&
      !(
        error instanceof BalanceError && [401, 400, 429].includes(error.status)
      ),
  });
  const devnet = config.network === "devnet";
  const updated = balance.data
    ? new Date(balance.data.observedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(address);
      setCopied(true);
      setActionError("");
    } catch {
      setActionError("Could not copy. You can select the address below.");
    }
  };
  const openExplorer = async () => {
    try {
      await Linking.openURL(
        "https://explorer.solana.com/address/" +
          address +
          (devnet ? "?cluster=devnet" : ""),
      );
    } catch {
      setActionError("Could not open the explorer. Please try again.");
    }
  };
  return (
    <SafeAreaView style={ui.screen}>
      <ScrollView
        contentContainerStyle={ui.page}
        refreshControl={
          <RefreshControl
            refreshing={balance.isRefetching}
            onRefresh={() => void balance.refetch()}
            tintColor={colors.ice}
            colors={[colors.cobalt]}
          />
        }
      >
        <View style={ui.row}>
          <Mark small />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open account settings"
            onPress={() => {
              setSheet("settings");
              setActionError("");
            }}
            style={({ pressed }) => [s.avatar, pressed && { opacity: 0.65 }]}
          >
            <Text style={s.avatarText}>{email[0].toUpperCase()}</Text>
          </Pressable>
        </View>
        <View style={s.balanceSection}>
          <View style={ui.row}>
            <Eyebrow>YOUR BALANCE</Eyebrow>
            <Text style={s.network}>{devnet ? "DEVNET" : "MAINNET"}</Text>
          </View>
          <View style={s.amountRow}>
            <Text
              testID="sol-balance"
              style={s.amount}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {balance.data ? formatSol(balance.data.lamports) : "0"}
            </Text>
            <Text style={s.currency}>SOL</Text>
          </View>
          <View style={{ minHeight: 24 }}>
            {balance.isPending ? (
              <View
                style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
              >
                <ActivityIndicator size="small" color={colors.mist} />
                <Text style={ui.small}>Loading balance…</Text>
              </View>
            ) : (
              <Text style={ui.small}>
                {balance.isError
                  ? "Last known balance"
                  : updated
                    ? "Updated at " + updated
                    : ""}
              </Text>
            )}
          </View>
          <View style={{ marginTop: 30 }}>
            <Button
              title="View wallet address  ↗"
              onPress={() => {
                setSheet("address");
                setCopied(false);
                setActionError("");
              }}
            />
          </View>
        </View>
        {balance.isError ? (
          <View style={s.errorPanel}>
            <Notice>{balance.error.message}</Notice>
            {balance.error instanceof BalanceError &&
            balance.error.status === 401 ? (
              <Button
                title="Sign in again"
                secondary
                busy={signingOut}
                onPress={() => void onSignOut()}
              />
            ) : (
              <Button
                title="Retry balance"
                secondary
                busy={balance.isFetching}
                onPress={() => void balance.refetch()}
              />
            )}
          </View>
        ) : null}
        <View style={s.sectionHeading}>
          <Text style={s.sectionTitle}>Assets</Text>
          <Text style={ui.small}>Solana</Text>
        </View>
        <View style={s.asset}>
          <View style={s.solIcon}>
            <Text
              style={{ fontSize: 27, color: colors.ice, fontWeight: "600" }}
            >
              ≋
            </Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.assetName}>Solana</Text>
            <Text style={ui.small}>SOL</Text>
          </View>
          <Text style={s.assetValue}>
            {balance.data ? formatSol(balance.data.lamports) + " SOL" : "0 SOL"}
          </Text>
        </View>
        <View style={s.note}>
          <View style={s.noteRule} />
          <Text style={ui.small}>
            {devnet
              ? "You’re on devnet. Use test SOL to try your wallet; it has no monetary value."
              : "This first build displays your SOL balance. Sending and trading will arrive in a later version."}
          </Text>
        </View>
        <View style={s.bottom}>
          <Text style={ui.small}>OMEN WALLET</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View wallet address"
            onPress={() => {
              setSheet("address");
              setCopied(false);
            }}
            style={{ paddingVertical: 12 }}
          >
            <Text style={s.address}>{shortAddress(address)} ↗</Text>
          </Pressable>
        </View>
      </ScrollView>
      <Modal
        visible={sheet !== null}
        animationType="slide"
        transparent
        onRequestClose={() => { if (!connectionsBusy) setSheet(null); }}
      >
        <View style={s.modalOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
            style={StyleSheet.absoluteFill}
            disabled={connectionsBusy} onPress={() => setSheet(null)}
          />
          <SafeAreaView edges={["bottom"]} style={s.sheet}>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false}>
            <View style={s.handle} />
            <View style={ui.row}>
              <Text style={s.sectionTitle}>
                {sheet === "address" ? "Your OMEN wallet" : "Your account"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close sheet"
                disabled={connectionsBusy} onPress={() => setSheet(null)}
                style={s.close}
              >
                <Text style={{ color: colors.ice, fontSize: 24 }}>×</Text>
              </Pressable>
            </View>
            {sheet === "address" ? (
              <>
                <Text style={ui.body}>
                  {devnet ? "Solana devnet · test SOL only" : "Solana mainnet"}
                </Text>
                <Text
                  selectable
                  accessibilityLabel="Full wallet address"
                  style={s.fullAddress}
                >
                  {address}
                </Text>
                <Button
                  title={copied ? "Address copied ✓" : "Copy address"}
                  onPress={() => void copy()}
                />
                <Button
                  title="View on Solana Explorer  ↗"
                  secondary
                  onPress={() => void openExplorer()}
                />
                <Text style={ui.small}>
                  {devnet
                    ? "Fund this address from a Solana devnet faucet to test balance updates."
                    : "Only send assets on the Solana network."}
                </Text>
              </>
            ) : (
              <>
                <Text style={[ui.body, { color: colors.ice }]}>{email}</Text>
                <Text style={ui.small}>
                  Signing out keeps your wallet linked to this account. Use your
                  same sign-in method to return.
                </Text>
                <View style={s.settingsRow}>
                  <Text style={ui.body}>Network</Text>
                  <Text style={ui.body}>{devnet ? "Devnet" : "Mainnet"}</Text>
                </View>
                <AccountConnections onBusyChange={setConnectionsBusy} />
                <Button
                  title="OMEN on X  ↗"
                  secondary
                  onPress={() =>
                    void Linking.openURL("https://x.com/getomenxyz").catch(() =>
                      setActionError("Could not open X."),
                    )
                  }
                />
                <Button
                  title="Sign out"
                  busy={signingOut}
                  disabled={connectionsBusy}
                  onPress={() => void onSignOut()}
                />
                <Text style={ui.small}>
                  OMEN 0.1
                </Text>
              </>
            )}
            {actionError || sessionError ? (
              <Notice>{actionError || sessionError}</Notice>
            ) : null}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  avatarText: { fontFamily: fonts.medium, color: colors.ice, fontSize: 16 },
  balanceSection: { paddingTop: 52, paddingBottom: 34 },
  network: {
    fontFamily: fonts.medium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.mist,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginTop: 21,
    marginBottom: 12,
  },
  amount: {
    fontFamily: fonts.display,
    color: colors.ice,
    fontSize: 60,
    letterSpacing: -2.8,
    flexShrink: 1,
  },
  currency: { fontFamily: fonts.regular, color: colors.muted, fontSize: 24 },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 18,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.ice,
    letterSpacing: -0.5,
  },
  asset: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 22,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  solIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  assetName: { fontFamily: fonts.medium, fontSize: 17, color: colors.ice },
  assetValue: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ice,
    maxWidth: "44%",
  },
  note: { flexDirection: "row", gap: 15, paddingTop: 28, paddingRight: 16 },
  noteRule: { width: 2, backgroundColor: colors.cobalt },
  bottom: { marginTop: "auto", paddingTop: 52 },
  address: { fontFamily: fonts.medium, fontSize: 15, color: colors.mist },
  errorPanel: {
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,.65)",
  },
  sheet: {
    maxHeight: "90%",
    backgroundColor: colors.surface,
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 18,
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    alignSelf: "center",
  },
  close: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fullAddress: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 25,
    color: colors.ice,
    padding: 16,
    backgroundColor: colors.canvas,
    borderRadius: 12,
  },
  settingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
});
