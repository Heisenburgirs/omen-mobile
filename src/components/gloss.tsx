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
      colors={["rgba(255,255,255,0.05)", "rgba(255,255,255,0)", "rgba(0,0,0,0.05)"]}
      locations={[0, 0.5, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** A button's depth: lit along the top edge, shaded along the foot; no outline at the sides. */
export const raised: ViewStyle = {
  overflow: "hidden",
  borderTopWidth: 1,
  borderTopColor: "rgba(255,255,255,0.16)",
  borderBottomWidth: 2.5,
  borderBottomColor: "rgba(0,0,0,0.32)",
};
/** The quiet (grey) button's edge and fill. Goes after `raised`. */
export const raisedQuiet: ViewStyle = {
  backgroundColor: "#1A1F32",
  borderTopWidth: 1,
  borderBottomWidth: 1,
  borderLeftWidth: 1,
  borderRightWidth: 1,
  borderColor: "rgba(255,255,255,0.07)",
  borderTopColor: "rgba(255,255,255,0.12)",
  borderBottomColor: "rgba(255,255,255,0.04)",
};
/** Buttons are rounded rectangles, not pills. */
export const BUTTON_RADIUS = 16;
