import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, m } from "./market-ui";
import { usd } from "../domain/market";
import { tradingColors as colors, tradingFonts as fonts, chatFonts } from "../theme";
import type { Conversation } from "../agent/store";

const DAY = 86_400_000;
function when(ms: number): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (ms >= today.getTime()) return "Today";
  if (ms >= today.getTime() - DAY) return "Yesterday";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * The agent's side menu, seven tenths of the screen wide: the balance with Fund beside
 * it, a new conversation, and the past ones, newest first. Fund swaps the
 * menu for `panel` in place rather than opening anything over it.
 */
export function AgentDrawer({
  visible,
  onClose,
  balanceUsd,
  hidden,
  onFund,
  conversations,
  currentId,
  onSelect,
  onNew,
  panel,
}: {
  visible: boolean;
  onClose: () => void;
  balanceUsd: number;
  hidden: boolean;
  onFund: () => void;
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** Shown in place of the menu while set (the fund view). */
  panel?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const width = Math.round(Dimensions.get("window").width * 0.7);
  const x = useRef(new Animated.Value(-width)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(x, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(x, { toValue: -width, duration: 170, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [visible, width, x]);
  if (!mounted) return null;
  const dim = x.interpolate({ inputRange: [-width, 0], outputRange: [0, 1] });

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: dim }]}>
          <Pressable accessibilityLabel="Close menu" style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={[
            s.panel,
            { width, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 12, transform: [{ translateX: x }] },
          ]}
        >
          {panel ? panel : (
          <>
          <Text style={m.label}>Agent balance</Text>
          <View style={s.balanceRow}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={s.amount}>
              {hidden ? "••••" : usd(balanceUsd)}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={onFund}
              hitSlop={8}
              style={({ pressed }) => [s.fund, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={s.fundText}>Fund</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onNew}
            style={({ pressed }) => [s.row, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name="compose" size={16} color={colors.ice} />
            <Text numberOfLines={1} style={s.newText}>
              New conversation
            </Text>
          </Pressable>

          <ScrollView style={{ flex: 1, marginTop: 6 }} showsVerticalScrollIndicator={false}>
            {conversations.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityState={{ selected: c.id === currentId }}
                onPress={() => onSelect(c.id)}
                style={({ pressed }) => [s.item, c.id === currentId && s.current, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text numberOfLines={1} style={s.title}>
                  {c.title}
                </Text>
                <Text style={s.when}>{when(c.updatedAt)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.5)" },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.canvas,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    paddingHorizontal: 14,
  },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  amount: {
    flex: 1,
    fontFamily: fonts.numericBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ice,
    fontVariant: ["tabular-nums"],
  },
  fund: { height: 28, justifyContent: "center" },
  fundText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ice },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, marginTop: 18 },
  newText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ice },
  item: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8, borderRadius: 10 },
  current: { backgroundColor: colors.surface },
  title: { fontFamily: chatFonts.regular, fontSize: 14, color: colors.ice },
  when: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 1 },
});
