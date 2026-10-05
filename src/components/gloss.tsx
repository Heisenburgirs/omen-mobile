import React from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * The body of a button: a little light at the top, a little shade at the
 * foot. Goes first inside a control whose style includes `raised`.
 */
export function Gloss(_: { light?: boolean }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(255,255,255,0.07)", "rgba(255,255,255,0)", "rgba(0,0,0,0.07)"]}
      locations={[0, 0.5, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** A button's rim: a hairline lighter than its fill, whatever the fill is. */
export const raised: ViewStyle = {
  overflow: "hidden",
  borderWidth: 1.5,
  borderColor: "rgba(255,255,255,0.18)",
};
/** Buttons are rounded rectangles, not pills. */
export const BUTTON_RADIUS = 16;
