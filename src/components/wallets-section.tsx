import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tradingColors as colors, tradingFonts as fonts } from "../theme";
import { showToast } from "../lib/toast";
import { shortAddress } from "../lib/balance";
import { usd } from "../domain/market";
import { errorMessage } from "../lib/chain-actions";
import type { WalletEntry } from "./wallet-drawer";
import { Field, m } from "./market-ui";
import { OmenSheet } from "./omen-sheet";
import { RaisedButton } from "./raised-button";

type WalletRow = { address: string; primary: boolean; imported: boolean; name?: string | null };
export type { WalletEntry };
/** The wallet's name in a list: the user's own, else "Main" for the sign-up one and the rest numbered. */
export const walletName = (w: WalletRow, index: number) =>
  w.name || (w.primary ? "Main" : "Imported wallet" + (index > 1 ? " " + index : ""));

/**
 * Settings' wallets: the sign-up wallet and any the user imported, each
 * with its name and what it holds; a tap renames one, and a key can be
 * imported. A key is imported so that what is already in it stays put;
 * moving a Stonk token into OMEN would pay the token's transfer tax, so
 * the wallet comes to OMEN instead.
 */
export function WalletsSection({
  wallets,
  hidden,
  onImport,
  onRename,
  onBusyChange,
  openImport = false,
  onOpenedImport,
}: {
  wallets: WalletEntry[];
  hidden: boolean;
  /** Opens the import sheet on arrival (the wallet switcher's "Import a wallet"). */
  openImport?: boolean;
  onOpenedImport?: () => void;
  onImport: (privateKey: string, name: string) => Promise<{ address: string }>;
  onRename: (address: string, name: string) => Promise<unknown>;
  onBusyChange: (busy: boolean) => void;
}) {
  // One sheet for both: importing (key + name) and renaming (name alone).
  const [sheet, setSheet] = useState<{ kind: "import" } | { kind: "rename"; address: string } | null>(null);
  useEffect(() => {
    if (openImport) {
      setKey("");
      setName("");
      setSheet({ kind: "import" });
      onOpenedImport?.();
    }
  }, [openImport, onOpenedImport]);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const open = (next: NonNullable<typeof sheet>) => {
    setKey("");
    setName(next.kind === "rename" ? (wallets.find((w) => w.address === next.address)?.name ?? "") : "");
    setSheet(next);
  };
  const close = () => {
    if (busy) return;
    setSheet(null);
    setKey("");
    setName("");
  };
  const submit = async () => {
    if (busy || !sheet) return;
    if (sheet.kind === "import" && !key.trim()) return;
    setBusy(true);
    onBusyChange(true);
    try {
      if (sheet.kind === "import") {
        const { address } = await onImport(key, name.trim());
        showToast((name.trim() || "Wallet " + shortAddress(address)) + " added");
      } else {
        await onRename(sheet.address, name.trim());
        showToast(name.trim() ? "Renamed to " + name.trim() : "Name cleared");
      }
      // The key is not kept anywhere in the app once Privy has it.
      setKey("");
      setName("");
      setSheet(null);
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };
  const importing = sheet?.kind === "import";
  return (
    <View style={s.section}>
      <Text style={s.title}>Wallets</Text>
      <Text style={m.muted}>
        Your balance is everything in these wallets together. Sales and sends come from the wallet holding the token.
      </Text>
      {wallets.map((w, i) => (
        <Pressable
          key={w.address}
          accessibilityRole="button"
          accessibilityLabel={"Rename " + walletName(w, i)}
          onPress={() => open({ kind: "rename", address: w.address })}
          style={({ pressed }) => [s.row, { opacity: pressed ? 0.5 : 1 }]}
        >
          <View style={{ flexShrink: 1 }}>
            <Text style={s.name} numberOfLines={1}>
              {walletName(w, i)}
            </Text>
            <Text style={[m.muted, { fontFamily: fonts.numericMedium }]}>{shortAddress(w.address)}</Text>
          </View>
          <Text style={[m.text, { fontFamily: fonts.numericMedium, fontSize: 15 }]}>
            {hidden ? "••••" : w.totalUsd == null ? "—" : usd(w.totalUsd)}
          </Text>
        </Pressable>
      ))}
      <View style={{ paddingTop: 6 }}>
        <RaisedButton title="Import a wallet" onPress={() => open({ kind: "import" })} secondary />
      </View>
      <OmenSheet visible={sheet !== null} onClose={close} title={importing ? "Import a wallet" : "Name this wallet"}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 14 }}>
          {importing ? (
            <>
              <Text style={m.muted}>Enter your private key. It stays encrypted; OMEN never sees it.</Text>
              <Field
                accessibilityLabel="Private key"
                placeholder="Private key"
                value={key}
                onChangeText={setKey}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                editable={!busy}
              />
            </>
          ) : null}
          <Field
            accessibilityLabel="Wallet name"
            placeholder={importing ? "Name (optional)" : "Name"}
            value={name}
            onChangeText={(v) => setName(v.slice(0, 24))}
            maxLength={24}
            autoCorrect={false}
            autoComplete="off"
            editable={!busy}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
          />
          <RaisedButton
            title={busy ? (importing ? "Importing…" : "Saving…") : importing ? "Import" : "Save"}
            disabled={busy || (importing && !key.trim())}
            onPress={() => void submit()}
          />
        </View>
      </OmenSheet>
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 6 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.ice },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 52,
    paddingVertical: 8,
  },
  name: { fontFamily: fonts.medium, fontSize: 15, color: colors.ice },
});
