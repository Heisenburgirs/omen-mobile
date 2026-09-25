import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { tradingColors as colors, tradingFonts as fonts } from "../theme";
import { Icon, type IconName } from "./market-ui";
export function RaisedButton({
  title,
  onPress,
  busy = false,
  disabled = false,
  secondary = false,
  icon,
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        style,
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.72 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.ice : colors.canvas} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} /> : null}
          <Text style={[s.label, secondary && { color: colors.ice }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
const s = StyleSheet.create({
  // The primary action is white with ink text, as on the onboarding pages.
  button: {
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.ice,
  },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  label: {
    fontFamily: fonts.bold,
    color: colors.canvas,
    fontSize: 16,
    flexShrink: 1,
    textAlign: "center",
  },
});
