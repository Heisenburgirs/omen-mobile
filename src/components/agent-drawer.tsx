import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, m } from "./market-ui";
import { usd } from "../domain/market";
import { tradingColors as colors, tradingFonts as fonts, chatFonts } from "../theme";
import type { Conversation } from "../agent/store";

const MENU_WIDTH = 168;

/**
 * The agent's side menu, seven tenths of the screen wide: the agent's
 * balance, a new chat, and the past ones, pinned first and then newest.
 * Each chat's ⋯ opens a small menu beside it to pin or delete it.
 */
export function AgentDrawer({
  visible,
  onClose,
  balanceUsd,
  hidden,
  conversations,
  currentId,
  onSelect,
  onNew,
  onPin,
  onDelete,
  creditsUsd = 0,
  invite,
}: {
  visible: boolean;
  onClose: () => void;
  balanceUsd: number;
  hidden: boolean;
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onPin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
  /** Free credits inside the balance, shown so the user knows what is theirs to withdraw. */
  creditsUsd?: number;
  /** The user's own code and what sharing it earns. */
  invite?: { code: string; friends: number; youUsd: number; theyUsd: number; onShare: () => void };
}) {
  const insets = useSafeAreaInsets();
  const window = Dimensions.get("window");
  const width = Math.round(window.width * 0.7);
  const x = useRef(new Animated.Value(-width)).current;
  const [mounted, setMounted] = useState(visible);
  // The chat whose ⋯ menu is open, where it opens, and whether Delete was tapped once.
  const [menu, setMenu] = useState<{ chat: Conversation; top: number; left: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const dots = useRef(new Map<string, View | null>());
  useEffect(() => {
    if (!visible) setMenu(null);
  }, [visible]);
  useEffect(() => setConfirming(false), [menu?.chat.id]);
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

  const openMenu = (chat: Conversation) => {
    if (menu?.chat.id === chat.id) return setMenu(null);
    dots.current.get(chat.id)?.measureInWindow((left, top, w, h) => {
      // Below the ⋯, its right edge on the ⋯'s; above it near the bottom of the screen.
      const below = top + h + 4;
      const openUp = below + 110 > window.height - insets.bottom;
      setMenu({
        chat,
        top: openUp ? top - 104 : below,
        left: Math.max(8, left + w - MENU_WIDTH),
      });
    });
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={menu ? () => setMenu(null) : onClose} statusBarTranslucent>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={s.amount}>
                {hidden ? "••••" : usd(balanceUsd)}
              </Text>
              {creditsUsd > 0.0005 && !hidden ? <Text style={s.credit}>{`${usd(creditsUsd)} free credits`}</Text> : null}
            </View>
            {invite ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Invite friends with code ${invite.code}`}
                hitSlop={10}
                onPress={invite.onShare}
                style={({ pressed }) => ({ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}
              >
                <Icon name="invite" size={22} color={colors.ice} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onNew}
            style={({ pressed }) => [s.row, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name="compose" size={18} color={colors.ice} />
            <Text numberOfLines={1} style={s.newText}>
              New chat
            </Text>
          </Pressable>

          <ScrollView style={{ flex: 1, marginTop: 6 }} showsVerticalScrollIndicator={false} onScrollBeginDrag={() => setMenu(null)}>
            {conversations.map((c) => (
              <View key={c.id} style={[s.item, c.id === currentId && s.current]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: c.id === currentId }}
                  onPress={() => onSelect(c.id)}
                  style={({ pressed }) => [s.itemMain, { opacity: pressed ? 0.6 : 1 }]}
                >
                  {c.pinned ? <Icon name="pin" size={13} color={colors.muted} /> : null}
                  <Text numberOfLines={1} style={s.title}>
                    {c.title}
                  </Text>
                </Pressable>
                <View ref={(node) => void dots.current.set(c.id, node)} collapsable={false}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Options for ${c.title}`}
                    hitSlop={6}
                    onPress={() => openMenu(c)}
                    style={({ pressed }) => [s.more, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <Icon name="more" size={18} color={menu?.chat.id === c.id ? colors.ice : colors.muted} />
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        {menu ? (
          <>
            {/* A tap anywhere else closes the menu, not the drawer. */}
            <Pressable accessibilityLabel="Close chat options" style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} />
            <View style={[s.menu, { top: menu.top, left: menu.left }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onPin(menu.chat.id, !menu.chat.pinned);
                  setMenu(null);
                }}
                style={({ pressed }) => [s.menuItem, pressed && s.menuPressed]}
              >
                <Icon name="pin" size={16} color={colors.ice} />
                <Text style={s.menuText}>{menu.chat.pinned ? "Unpin" : "Pin"}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (!confirming) {
                    setConfirming(true);
                    return;
                  }
                  onDelete(menu.chat.id);
                  setMenu(null);
                }}
                style={({ pressed }) => [s.menuItem, pressed && s.menuPressed]}
              >
                <Icon name="trash" size={16} color={colors.error} />
                <Text style={[s.menuText, { color: colors.error }]}>{confirming ? "Tap to confirm" : "Delete"}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
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
  credit: { fontFamily: fonts.medium, fontSize: 13, color: colors.success, marginTop: 2 },
  invite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  inviteTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ice },
  inviteBody: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted, marginTop: 1 },
  amount: {
    fontFamily: fonts.numericBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ice,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, marginTop: 18 },
  newText: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ice },
  item: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingLeft: 8, borderRadius: 10 },
  itemMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  more: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  current: { backgroundColor: colors.surface },
  title: { flexShrink: 1, fontFamily: chatFonts.regular, fontSize: 14, color: colors.ice },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingHorizontal: 14 },
  menuPressed: { backgroundColor: colors.selected },
  menuText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ice },
});
