import React from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { tradingColors as colors } from "../theme";

/**
 * The sheen on a raised control: lit along the top, shaded at the foot, so
 * a pill reads as a soft, pressable bubble. Goes first inside a control
 * that has `raised` (or its own `overflow: "hidden"`) in its style.
 * `light` is for the white primary button, which gets a cool blue foot.
 */
export function Gloss({ light = false }: { light?: boolean }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={
        light
          ? ["rgba(255,255,255,0)", "rgba(255,255,255,0)", "rgba(84,124,255,0.34)"]
          : ["rgba(255,255,255,0.14)", "rgba(255,255,255,0.03)", "rgba(0,0,0,0.14)"]
      }
      locations={[0, 0.5, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}

/** The edge of a raised control: a hairline that catches light along the top. */
export const raised: ViewStyle = {
  overflow: "hidden",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  borderTopColor: "rgba(255,255,255,0.22)",
};

const GLOW_HEIGHT = 460;
/**
 * The blue glow every screen opens under: brightest at the top centre,
 * gone by mid-screen. `shift` is how far below the top of the display the
 * parent starts (a screen inside the safe area), so the glow lines up with
 * the one behind the status bar.
 */
export function Backdrop({ shift = 0 }: { shift?: number }) {
  return (
    <Svg
      pointerEvents="none"
      accessible={false}
      width="100%"
      height={GLOW_HEIGHT}
      style={{ position: "absolute", top: 0, left: 0, right: 0 }}
    >
      <Defs>
        <RadialGradient
          id="glow"
          gradientUnits="userSpaceOnUse"
          cx="50%"
          cy={-60 - shift}
          r={GLOW_HEIGHT + 40}
        >
          <Stop offset="0" stopColor={colors.glow} stopOpacity={0.62} />
          <Stop offset="0.45" stopColor={colors.glow} stopOpacity={0.26} />
          <Stop offset="1" stopColor={colors.glow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width="100%" height={GLOW_HEIGHT} fill="url(#glow)" />
    </Svg>
  );
}
