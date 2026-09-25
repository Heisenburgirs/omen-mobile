import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tradingColors as colors, tradingFonts as fonts } from "../theme";
import { Icon, m } from "./market-ui";

export type SheetAction = {
  text: string;
  style?: "cancel" | "destructive" | "default";
  onPress?: () => void;
  selected?: boolean;
};
export type SheetContent = {
  title: string;
  body?: string;
  actions?: SheetAction[];
};
export function OmenSheet({
  visible,
  onClose,
  title,
  children,
  tall = false,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  tall?: boolean;
}) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useRef(false);
  const insets = useSafeAreaInsets();
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduced.current = v;
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => {
        reduced.current = v;
      },
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduced.current ? 0 : visible ? 200 : 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, progress]);
  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }} accessibilityViewIsModal>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: "#000000",
              opacity: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.72],
              }),
            },
          ]}
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior="padding"
          pointerEvents="box-none"
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <Animated.View
            style={[
              s.sheet,
              {
                maxHeight: "92%",
                paddingBottom: Math.max(insets.bottom, 16),
                ...(tall ? { height: "88%" } : {}),
                opacity: progress,
                transform: [
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [180, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={s.handle} />
            <View style={s.header}>
              <Text
                accessibilityRole="header"
                style={[m.heading, { fontSize: 18, flex: 1 }]}
              >
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={({ pressed }) => [s.close, { opacity: pressed ? 0.5 : 1 }]}
              >
                <Icon name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
export function OmenDialog({
  content,
  visible,
  onClose,
}: {
  content: SheetContent | null;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <OmenSheet title={content?.title || ""} visible={visible} onClose={onClose}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 12,
          gap: 12,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {content?.body ? (
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 14,
              lineHeight: 21,
              color: colors.mist,
              marginBottom: 8,
            }}
          >
            {content.body}
          </Text>
        ) : null}
        {(content?.actions || [{ text: "Got it" }]).map((action, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityState={{ selected: action.selected }}
            onPress={() => {
              onClose();
              action.onPress?.();
            }}
            style={({ pressed }) => [s.action, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text
              style={[
                m.text,
                {
                  fontFamily: fonts.medium,
                  color:
                    action.style === "destructive"
                      ? colors.error
                      : action.style === "cancel"
                        ? colors.muted
                        : colors.ice,
                },
              ]}
            >
              {action.text}
            </Text>
            {action.selected ? (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.ice,
                }}
              />
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </OmenSheet>
  );
}
const s = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.cardLine,
    overflow: "hidden",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.muted,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    opacity: 0.55,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 8,
  },
  close: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  // Actions are plain rows; colour carries the meaning.
  action: {
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
