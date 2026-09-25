import React from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { tradingColors as colors, tradingFonts as fonts } from "../theme";
import { Icon, type IconName } from "./market-ui";

export type OmenTab = "Home" | "Search" | "Dividends" | "Agent" | "Profile";
// Agent is the centre tab (2026-09-21), and since 2026-09-25 it is real on
// both platforms: the agent's memory lives in the browser or on the phone
// and its replies are bought from Ryvo through the user's own channel. Five
// tabs share the bar, so the selected pill is a little narrower.
export const OMEN_TABS: OmenTab[] = ["Home", "Search", "Agent", "Dividends", "Profile"];
const icons: Partial<Record<OmenTab, IconName>> = {
  Home: "home",
  Search: "search",
  Dividends: "payout",
  Agent: "agent",
  Profile: "profile",
};
// What the bar calls a tab when that differs from its name: "Dividends" was
// the longest word in a five-tab bar and crowded its neighbours, so the bar
// says "Rewards" (the page itself is still Dividends).
const labels: Partial<Record<OmenTab, string>> = { Dividends: "Drip" };
// Every glyph sits in the same box, so the labels share one baseline even
// though the OMEN mark is drawn larger than the line icons.
const GLYPH_BOX = 24;

export function OmenNavigation({
  selected,
  onSelect,
}: {
  selected: OmenTab;
  onSelect: (tab: OmenTab) => void;
}) {
  const dimensions = useWindowDimensions();
  const width = Math.min(344, dimensions.width - 48);
  const outline = `M24 8 H${width - 24} Q${width} 8 ${width} 32
    V40 Q${width} 64 ${width - 24} 64
    H24 Q0 64 0 40 V32 Q0 8 24 8 Z`;
  return (
    <View style={[s.bar, { width }]}>
      <Svg
        pointerEvents="none"
        accessible={false}
        width={width}
        height={66}
        style={StyleSheet.absoluteFill}
      >
        <Path
          d={outline}
          fill={colors.surface}
          stroke={colors.line}
          strokeWidth={0.75}
        />
      </Svg>
      {OMEN_TABS.map((tab) => {
        const active = selected === tab;
        const center = false;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={labels[tab] ?? tab}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(tab)}
            style={({ pressed }) => [s.item, { opacity: pressed ? 0.55 : 1 }]}
          >
            {active && !center ? <View style={s.activeFill} /> : null}
            <View style={s.glyph}>
              {center ? (
                <Image
                  source={require("../../assets/omen-mark.png")}
                  accessible={false}
                  accessibilityIgnoresInvertColors
                  // Smaller and dimmer than the mark's own white, so it
                  // sits with the line icons rather than shining over them.
                  style={{
                    width: 26,
                    height: 26,
                    opacity: active ? 0.85 : 0.55,
                  }}
                />
              ) : (
                <Icon
                  name={icons[tab]!}
                  size={20}
                  color={active ? colors.ice : "#858891"}
                />
              )}
            </View>
            {/* Every destination is named: a one-word label under the icon. */}
            <Text
              numberOfLines={1}
              style={[s.label, { color: active ? colors.ice : "#858891" }]}
            >
              {labels[tab] ?? tab}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  bar: {
    height: 66,
    flexDirection: "row",
    alignSelf: "center",
    paddingHorizontal: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  item: {
    flex: 1,
    minWidth: 44,
    height: 66,
    paddingTop: 8,
    gap: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    height: GLYPH_BOX,
    width: GLYPH_BOX + 4,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.2,
  },
  // Selected tab sits on a quiet card-coloured pill; the ice icon carries the state.
  activeFill: {
    position: "absolute",
    top: 11,
    width: Platform.OS === "web" ? 56 : 54,
    height: 50,
    borderRadius: 14,
    backgroundColor: colors.card,
  },
});
