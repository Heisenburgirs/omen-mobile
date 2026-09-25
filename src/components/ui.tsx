import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors, fonts } from "../theme";
export function Mark({
  small = false,
  large = false,
  prominent = false,
  symbolOnly = false,
}: {
  small?: boolean;
  large?: boolean;
  prominent?: boolean;
  symbolOnly?: boolean;
}) {
  return (
    <View style={s.brand}>
      <Image
        source={require("../../assets/omen-mark.png")}
        style={{
          width: prominent ? 240 : large ? 64 : small ? 32 : 42,
          height: prominent ? 240 : large ? 64 : small ? 32 : 42,
        }}
        accessibilityLabel={symbolOnly ? "OMEN" : undefined}
        accessibilityIgnoresInvertColors
      />
      {!symbolOnly ? (
        <Text
          style={[
            s.wordmark,
            small && { fontSize: 19 },
            large && { fontSize: 30, letterSpacing: 4 },
            prominent && { fontSize: 40, letterSpacing: 4 },
          ]}
        >
          OMEN
        </Text>
      ) : null}
    </View>
  );
}
export function Button({
  title,
  onPress,
  busy = false,
  disabled = false,
  secondary = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (disabled || busy) && { opacity: 0.55 },
        pressed && { opacity: 0.8 },
        focused && s.focus,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.ice : colors.canvas} />
      ) : (
        <Text style={[s.buttonText, secondary && { color: colors.ice }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={s.notice}
    >
      {children}
    </Text>
  );
}
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={s.eyebrow}>{children}</Text>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  page: { padding: 24, flexGrow: 1 },
  heading: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 39,
    color: colors.ice,
    letterSpacing: -1,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.mist,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ice,
    marginBottom: 10,
  },
  input: {
    height: 58,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.ice,
    fontFamily: fonts.regular,
    fontSize: 17,
    paddingHorizontal: 16,
  },
  focused: { borderColor: colors.focus },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
const s = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  wordmark: {
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: 4,
    color: colors.ice,
  },
  button: {
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.ice,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  secondary: { backgroundColor: colors.surface, borderColor: colors.line },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, color: colors.canvas },
  focus: { borderColor: colors.focus },
  notice: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.error,
    paddingVertical: 12,
  },
  eyebrow: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.muted,
  },
});
