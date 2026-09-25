import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { tradingColors as colors, tradingFonts as fonts, space } from "../theme";
import { shortAddress } from "../lib/balance";
import { usd } from "../domain/market";
import { Icon, m } from "./market-ui";
import { walletName } from "./wallets-section";
import { RaisedButton } from "./raised-button";

/** What the app shows: every wallet together, or one of them. */
export type WalletScope = "all" | string;
/** A wallet in the switcher and in Settings: the server's listing plus what the book knows it holds. */
export type WalletEntry = { address: string; primary: boolean; imported: boolean; name: string | null; totalUsd?: string | null; nativeLamports?: string };

/**
 * The wallet switcher: slides in from the left over half the screen when
 * the profile at the top of Home is tapped. "All wallets" is the whole
 * book; a wallet on its own scopes the balance, holdings, activity and
 * rewards to it, and a buy made while it is chosen lands in it.
 */
export function WalletDrawer({
  visible,
  onClose,
  wallets,
  totalUsd,
  scope,
  onScope,
  hidden,
  onImport,
}: {
  visible: boolean;
  onClose: () => void;
  wallets: WalletEntry[];
  /** The whole book's value, when the book is currently all wallets. */
  totalUsd: string | null;
  scope: WalletScope;
  onScope: (scope: WalletScope) => void;
  hidden: boolean;
  onImport: () => void;
}) {
  const { width } = useWindowDimensions();
  const panel = Math.min(Math.max(width * 0.5, 280), 360);
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);
  if (!mounted) return null;
  const rows: { key: WalletScope; title: string; sub: string; value: string | null }[] = [
    { key: "all", title: "All wallets", sub: wallets.length + (wallets.length === 1 ? " wallet" : " wallets"), value: totalUsd },
    ...wallets.map((w, i) => ({ key: w.address, title: walletName(w, i), sub: shortAddress(w.address), value: w.totalUsd ?? null })),
  ];
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }} accessibilityViewIsModal>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.55)", opacity: progress }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close wallets" onPress={onClose} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View
          style={[
            s.panel,
            {
              width: panel,
              transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-panel, 0] }) }],
            },
          ]}
        >
          <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
            <View style={s.head}>
              <Text style={s.title}>Wallets</Text>
            </View>
            {rows.map((r) => {
              const on = r.key === scope;
              return (
                <Pressable
                  key={r.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={"Show " + r.title}
                  onPress={() => {
                    onScope(r.key);
                    onClose();
                  }}
                  style={({ pressed }) => [s.row, on && s.rowOn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[s.name, on && { color: colors.ice }]}>
                      {r.title}
                    </Text>
                    <Text numberOfLines={1} style={[m.muted, { fontSize: 12, fontFamily: fonts.numericMedium }]}>
                      {r.sub}
                    </Text>
                  </View>
                  <Text style={[m.text, { fontFamily: fonts.numericMedium, fontSize: 14 }]}>
                    {hidden ? "••••" : r.value === null ? "—" : usd(r.value)}
                  </Text>
                  {on ? <Icon name="check" size={14} color={colors.ice} /> : null}
                </Pressable>
              );
            })}
            <View style={{ paddingHorizontal: space.edge, paddingTop: 12 }}>
              <RaisedButton
                title="Import a wallet"
                secondary
                onPress={() => {
                  onClose();
                  onImport();
                }}
              />
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.canvas,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
  },
  head: { paddingHorizontal: space.edge, paddingTop: space.md, paddingBottom: space.sm },
  title: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.3, color: colors.ice },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 60,
    paddingHorizontal: space.edge,
    paddingVertical: 10,
  },
  rowOn: { backgroundColor: colors.surface },
  name: { fontFamily: fonts.medium, fontSize: 15, color: colors.mist },
});
