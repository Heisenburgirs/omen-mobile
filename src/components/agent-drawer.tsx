import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, m } from "./market-ui";
import { RaisedButton as Button } from "./raised-button";
import { usd } from "../domain/market";
import { tradingColors as colors, tradingFonts as fonts, chatFonts, space } from "../theme";
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
 * The agent's side menu, sliding in from the left: its balance and Fund at
 * the top, then a new conversation and the past ones, newest first.
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
}) {
  const insets = useSafeAreaInsets();
  const width = Math.min(340, Dimensions.get("window").width * 0.84);
  const x = useRef(new Animated.Value(-width)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    } else {
      Animated.timing(x, { toValue: -width, duration: 180, useNativeDriver: true }).start(() => setMounted(false));
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
            { width, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, transform: [{ translateX: x }] },
          ]}
        >
          <View style={s.balance}>
            <Text style={m.label}>Agent balance</Text>
            <Text numberOfLines={1} style={s.amount}>
              {hidden ? "••••" : usd(balanceUsd)}
            </Text>
            <Button title="Fund" onPress={onFund} />
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onNew}
            style={({ pressed }) => [s.row, s.newRow, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name="compose" size={18} color={colors.ice} />
            <Text style={s.newText}>New conversation</Text>
          </Pressable>

          <Text style={[m.label, { marginTop: 18, marginBottom: 6, paddingHorizontal: 4 }]}>Conversations</Text>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {conversations.length ? (
              conversations.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: c.id === currentId }}
                  onPress={() => onSelect(c.id)}
                  style={({ pressed }) => [s.row, c.id === currentId && s.current, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text numberOfLines={1} style={s.title}>
                    {c.title}
                  </Text>
                  <Text style={s.when}>{when(c.updatedAt)}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={[m.muted, { paddingHorizontal: 4 }]}>Your conversations will show up here.</Text>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.55)" },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.canvas,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    paddingHorizontal: space.edge,
  },
  balance: {
    gap: 8,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  amount: {
    fontFamily: fonts.numericBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: colors.ice,
    fontVariant: ["tabular-nums"],
    marginBottom: 4,
  },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  newRow: { marginTop: 14, backgroundColor: colors.surface },
  newText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ice },
  current: { backgroundColor: colors.surfaceRaised },
  title: { flex: 1, fontFamily: chatFonts.regular, fontSize: 15, color: colors.ice },
  when: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});
