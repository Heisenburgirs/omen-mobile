import { config } from "../config";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Platform,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  Vibration,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Svg, { Path, Circle, Rect, Line, Polyline } from "react-native-svg";
// The CSS-aware loader: token SVGs often colour their shapes through a
// <style> block (Zcash's gradient), which the plain SvgUri ignores.
import { SvgCssUri } from "react-native-svg/css";
import { useReducedMotion } from "react-native-reanimated";
import {
  tradingColors as colors,
  tradingFonts as fonts,
  space,
  radius,
} from "../theme";
import { usd, assetPrice, pct, assetMarketSummary } from "../domain/market";
import { CASH_MINTS, type Asset, type Holding, type Profile } from "../domain/models";
export const m = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  page: {
    flexGrow: 1,
    paddingHorizontal: space.edge,
    paddingTop: space.sm,
    paddingBottom: space.xl,
    gap: space.section,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 25,
    letterSpacing: -0.4,
    color: colors.ice,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: colors.ice,
  },
  text: { fontFamily: fonts.regular, fontSize: 14, color: colors.ice },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  panel: {
    backgroundColor: colors.card,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.cardLine,
    padding: space.lg,
    gap: space.md,
  },
  input: {
    fontFamily: fonts.regular,
    color: colors.ice,
    fontSize: 15,
    backgroundColor: colors.surface,
    borderRadius: radius.field,
    paddingHorizontal: space.lg,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: space.md,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  // A selected chip: white with ink text, as the app's buttons.
  selected: {
    backgroundColor: colors.ice,
    borderWidth: 1,
    borderColor: colors.ice,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  metric: {
    fontFamily: fonts.numericBold,
    fontSize: 21,
    color: colors.ice,
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
  },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.mist },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  section: { gap: space.sm },
  button: {
    minHeight: 48,
    borderRadius: radius.pill,
    paddingHorizontal: space.edge,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cobalt,
    borderWidth: 1,
    borderColor: colors.cobalt,
  },
  smallButton: {
    minHeight: 40,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
export type IconName =
  | "home"
  | "agent"
  | "search"
  | "profile"
  | "back"
  | "activity"
  | "eye"
  | "eyeOff"
  | "star"
  | "filter"
  | "close"
  | "settings"
  | "arrow"
  | "plus"
  | "deposit"
  | "swap"
  | "depositTray"
  | "withdrawTray"
  | "send"
  | "share"
  | "chevron"
  | "info"
  | "wallet"
  | "chart"
  | "reward"
  | "payout"
  | "trend"
  | "ticket"
  | "copy"
  | "cash"
  | "x"
  | "check";
export function Icon({
  name,
  size = 22,
  color = colors.ice,
  fill,
}: {
  name: IconName;
  size?: number;
  color?: string;
  /** Fills the shape, e.g. a starred watchlist item. */
  fill?: string;
}) {
  const paths: Record<string, string> = {
    home: "M3 10l9-7 9 7v10H15v-7H9v7H3z",
    agent:
      "M12 3v3M8 3h8M7 7h10a3 3 0 013 3v8a3 3 0 01-3 3H7a3 3 0 01-3-3v-8a3 3 0 013-3zM8 12v2m8-2v2m-7 3h6M1 12v4m22-4v4",
    search: "M21 21l-5-5",
    profile: "M4 21v-2c0-4 16-4 16 0v2",
    back: "M20 12H4m7-7-7 7 7 7",
    chevron: "M9 6l6 6-6 6",
    info: "M12 11v6M12 7v.1",
    wallet: "M4 7V5h14M4 7h16v13H4V7zm12 5h4v4h-4z",
    chart: "M4 18V9m5 6V4m6 16v-9m5 5V6",
    reward: "M12 3v18M8 7h6a3 3 0 010 6h-4a3 3 0 000 6h6",
    // A banknote: cash.
    cash: "M3 7a1 1 0 011-1h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7zM12 15a3 3 0 100-6 3 3 0 000 6zM6.5 12h.01M17.5 12h.01",
    // Two squares, one behind the other: copy.
    copy: "M9 9h10a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1V10a1 1 0 011-1zM5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1",
    // A ticket with a notch on each side: a referral code.
    ticket:
      "M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4V8zM9 6v12",
    // A rising line with its arrow: profit and loss.
    trend: "M3 17l6-6 4 4 8-8M14 7h7v7",
    // The X logo, drawn filled.
    x: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
    // Stacked coins: the token pays out in another asset.
    payout:
      "M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5",
    activity: "M12 7v5l3 2M3 6v5h5",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z",
    eyeOff: "M3 3l18 18M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z",
    star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z",
    filter: "M4 6h16M7 12h10M10 18h4",
    close: "M6 6l12 12M18 6L6 18",
    settings:
      "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
    arrow: "M7 17L17 7M7 7h10v10",
    plus: "M12 5v14M5 12h14",
    deposit: "M12 4v16m-6-6 6 6 6-6",
    swap: "M8 5v14m0 0-3-3m3 3 3-3M16 19V5m0 0-3 3m3-3 3 3",
    send: "M12 20V4m-6 6 6-6 6 6",
    // Arrow into / out of a tray, for deposit and withdraw.
    depositTray: "M12 3v11m-4-4 4 4 4-4M4 15v4h16v-4",
    withdrawTray: "M12 14V3m-4 4 4-4 4 4M4 15v4h16v-4",
    check: "M5 12.5l4.5 4.5L19 7",
    share: "M12 16V3m-5 5l5-5 5 5M5 13v8h14v-8",
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name]}
        fill={fill ?? "none"}
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {name === "info" || name === "activity" ? (
        <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.7} />
      ) : name === "search" ? (
        <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={1.7} />
      ) : name === "profile" ? (
        <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth={1.7} />
      ) : name === "eye" ? (
        <Circle cx="12" cy="12" r="2.5" stroke={color} strokeWidth={1.7} />
      ) : null}
    </Svg>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  selected = false,
  disabled = false,
  quiet: quietProp = false,
  size,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  quiet?: boolean;
  size?: number;
}) {
  const quiet = quietProp || name === "eye" || name === "eyeOff";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: quiet
          ? "transparent"
          : selected
            ? colors.cobalt
            : colors.surface,
        borderWidth: quiet ? 0 : 1,
        borderColor: selected ? colors.cobalt : colors.line,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed || disabled ? 0.55 : 1,
      })}
    >
      <Icon
        name={name}
        size={size ?? (quiet ? 17 : 22)}
        color={selected ? colors.ice : colors.mist}
        // A quiet button has no pill to show its state, so the shape fills.
        fill={selected && quiet ? colors.ice : undefined}
      />
    </Pressable>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={({ pressed }) => [
        m.chip,
        selected && m.selected,
        { opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <Text
        style={[
          m.text,
          {
            fontSize: 13,
            fontFamily: fonts.medium,
            color: selected ? colors.canvas : colors.muted,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field(p: TextInputProps & { ref?: React.Ref<TextInput> }) {
  return (
    <TextInput
      selectionColor={colors.focus}
      cursorColor={colors.focus}
      placeholderTextColor={colors.muted}
      // Nothing here is a credential or a card. Left to guess, Android and
      // Chrome offer saved passwords and cards on a strip above the
      // keyboard, which then covers what the field sits on. Callers can
      // still opt in, since their props are spread after these.
      autoComplete="off"
      importantForAutofill="no"
      {...p}
      style={[m.input, p.style]}
    />
  );
}
export function Section({
  title,
  action,
  onPress,
  children,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={m.section}>
      <View style={m.between}>
        <Text style={[m.heading, { flexShrink: 1 }]}>{title}</Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={m.link}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
export function Empty({
  title,
  detail,
  action,
  onPress,
  plain = false,
}: {
  title: string;
  detail?: string;
  action?: string;
  onPress?: () => void;
  /** Centered text on the canvas instead of a card. */
  plain?: boolean;
}) {
  return (
    <View
      style={
        plain
          ? { alignItems: "center", paddingVertical: space.xl, gap: space.sm }
          : [m.panel, { gap: space.sm }]
      }
    >
      <Text style={[m.text, { color: colors.muted }]}>{title}</Text>
      {detail ? <Text style={m.muted}>{detail}</Text> : null}
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => ({
            minHeight: 44,
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={[m.link, { color: colors.ice }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
// One shared pulse so every placeholder on screen breathes together.
const pulse = new Animated.Value(0.45);
let pulsing = false;
function ensurePulse() {
  if (pulsing) return;
  pulsing = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 0.95,
        duration: 750,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0.45,
        duration: 750,
        useNativeDriver: true,
      }),
    ]),
  ).start();
}
/** Grey placeholder sized like the content it stands in for, so nothing shifts. */
export function Skeleton({
  width,
  height,
  radius = 6,
  circle = false,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  useEffect(ensurePulse, []);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          backgroundColor: colors.surfaceRaised,
          opacity: pulse,
          width: circle ? height : width,
          height,
          borderRadius: circle ? height / 2 : radius,
        },
        style,
      ]}
    />
  );
}
/** Placeholder list rows with the exact metrics of AssetRow. */
export function SkeletonRows({
  count = 3,
  plain = false,
}: {
  count?: number;
  plain?: boolean;
}) {
  return (
    <View accessibilityLabel="Loading" accessibilityState={{ busy: true }}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[m.row, { minHeight: plain ? 60 : 64, paddingVertical: 8 }]}
        >
          <Skeleton height={plain ? 38 : 42} circle />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton height={14} width="38%" />
            <Skeleton height={11} width="56%" />
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            <Skeleton height={14} width={68} />
            <Skeleton height={11} width={44} />
          </View>
        </View>
      ))}
    </View>
  );
}
/** Placeholder for the horizontal asset tiles on Home. */
export function SkeletonTiles({
  width,
  count = 2,
}: {
  width: number;
  count?: number;
}) {
  return (
    <View
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
      style={{ flexDirection: "row", gap: 10 }}
    >
      {Array.from({ length: count }, (_, i) => (
        // The tile's own layout: 20 px row, 6 px gap, 24 px row, 76 px in all.
        <View
          key={i}
          style={{
            width,
            height: 76,
            padding: 12,
            gap: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.cardLine,
            backgroundColor: colors.card,
          }}
        >
          <View style={[m.row, { gap: 6, height: 20 }]}>
            <Skeleton height={20} circle />
            <Skeleton height={12} width={52} />
            <View style={{ flex: 1 }} />
            <Skeleton height={11} width={54} />
          </View>
          <View style={[m.between, { height: 24 }]}>
            <Skeleton height={20} width={92} />
            <Skeleton height={11} width={44} />
          </View>
        </View>
      ))}
    </View>
  );
}
export function LoadState({
  query,
  skeleton,
  children,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => unknown;
    data?: unknown;
  };
  empty?: boolean;
  /** Layout-matched placeholder shown while the first load is pending. */
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (query.isPending) return <>{skeleton ?? <SkeletonRows />}</>;
  if (query.isError && !query.data)
    return (
      <Empty
        title="Couldn't load right now."
        action="Try again"
        onPress={() => void query.refetch()}
      />
    );
  return (
    <>
      {query.isError ? (
        <Pressable
          onPress={() => void query.refetch()}
          style={{ minHeight: 32, justifyContent: "center" }}
        >
          <Text style={m.muted}>Offline · Showing last update. Retry</Text>
        </Pressable>
      ) : null}
      {children}
    </>
  );
}
export function TextTabs({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const scrollable = width < 400 && fontScale > 1.15;
  const bar = (
    <View
      style={{
        flexDirection: "row",
        gap: 4,
        padding: 4,
        borderRadius: 24,
        backgroundColor: colors.surface,
      }}
    >
      {items.map((label) => (
        <Pressable
          key={label}
          accessibilityRole="tab"
          accessibilityState={{ selected: label === value }}
          onPress={() => onChange(label)}
          style={({ pressed }) => ({
            minHeight: 44,
            flex: scrollable ? undefined : 1,
            paddingHorizontal: 8,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: label === value ? colors.cobalt : "transparent",
            borderWidth: 1,
            borderColor: label === value ? colors.cobalt : "transparent",
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Text
            numberOfLines={1}
            style={[
              m.text,
              {
                fontFamily: fonts.medium,
                color: label === value ? colors.ice : colors.muted,
                textAlign: "center",
              },
            ]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  return scrollable ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
    >
      {bar}
    </ScrollView>
  ) : (
    bar
  );
}
export function Disclosure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[m.panel, { gap: open ? space.md : 0, paddingVertical: 4 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={[m.between, { minHeight: 48 }]}
      >
        <Text style={[m.text, { fontFamily: fonts.medium }]}>{title}</Text>
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <Icon name="chevron" size={18} color={colors.muted} />
        </View>
      </Pressable>
      {open ? children : null}
    </View>
  );
}
export function AssetIcon({ asset, size = 42 }: { asset: Asset; size?: number }) {
  // Some token images are SVG (Zcash's, for one), which the bitmap Image
  // cannot draw: after it fails the same URL is drawn as SVG, and only when
  // that fails too does the initial take over.
  //
  // The stage belongs to the URL it was reached for. A row reused for another
  // token used to inherit the previous one's failure and go straight to the
  // SVG reader, which would then show the drawing it had already fetched:
  // that is how a token whose own picture was slow ended up wearing Zcash's
  // logo. The reader is keyed by URL too, so it can never paint a picture
  // that was fetched for a different token.
  //
  // The first attempt goes through OMEN's own picture relay (/api/img): token
  // pictures sit on gateways that are slow or unreachable from some networks,
  // and the relay's CDN copy is not. The picture's own address is the second
  // attempt, so a relay hiccup never costs a picture that would have loaded.
  const uri = asset.image || "";
  const first = /^https:\/\//.test(uri) ? "relay" : "bitmap";
  const [stage, setStage] = useState<{
    uri: string;
    mode: "relay" | "bitmap" | "svg" | "none";
  }>({ uri, mode: first });
  const mode = stage.uri === uri ? stage.mode : first;
  const round = { width: size, height: size, borderRadius: size / 2 };
  return uri && mode === "relay" ? (
    <Image
      source={{ uri: config.apiUrl + "/api/img?u=" + encodeURIComponent(uri) }}
      onError={() => setStage({ uri, mode: "bitmap" })}
      style={round}
    />
  ) : uri && mode === "bitmap" ? (
    <Image
      source={{ uri }}
      onError={() => setStage({ uri, mode: "svg" })}
      style={round}
    />
  ) : uri && mode === "svg" ? (
    <View
      style={[round, { overflow: "hidden", backgroundColor: colors.surfaceRaised }]}
    >
      <SvgCssUri
        key={uri}
        uri={uri}
        width={size}
        height={size}
        onError={() => setStage({ uri, mode: "none" })}
      />
    </View>
  ) : (
    <View style={[m.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[m.text, { fontFamily: fonts.bold }]}>
        {asset.symbol.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}
export function AssetRow({
  asset,
  holding,
  onPress,
  hidden,
  plain = false,
  metric,
}: {
  asset: Asset;
  holding?: Holding;
  onPress: () => void;
  hidden?: boolean;
  plain?: boolean;
  /** Figure for the second line; defaults to market cap. */
  metric?: string;
}) {
  const small = plain && { fontSize: 11, lineHeight: 16 };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={asset.name}
      onPress={onPress}
      style={({ pressed }) => [
        m.row,
        // Rows sit directly on the canvas, separated by spacing only.
        {
          minHeight: plain ? 60 : 64,
          paddingHorizontal: 0,
          paddingVertical: 8,
          backgroundColor: "transparent",
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <AssetIcon asset={asset} size={plain ? 38 : 42} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={1} style={[m.text, { fontFamily: fonts.medium }]}>
          {asset.symbol}
        </Text>
        <View style={[m.row, { gap: 10 }]}>
          <Text
            numberOfLines={1}
            style={[m.muted, { fontFamily: fonts.numeric }, small]}
          >
            {holding
              ? hidden
                ? "••••"
                : Number(holding.quantity).toLocaleString("en-US", {
                    maximumSignificantDigits: 6,
                  }) +
                  " " +
                  asset.symbol
              : (metric ?? assetMarketSummary(asset))}
          </Text>
          {asset.stonk?.kind === "reward" ? (
            <View
              accessibilityLabel={"Pays " + (asset.stonk.payoutSymbol || "rewards")}
              style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
            >
              <Icon name="payout" size={11} color={colors.muted} />
              <Text
                numberOfLines={1}
                style={[m.muted, { fontSize: 11, lineHeight: 14 }, small]}
              >
                {asset.stonk.payoutSymbol || "rewards"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end", gap: 5 }}>
        <Text style={[m.text, { fontFamily: fonts.numericMedium }]}>
          {hidden && holding
            ? "••••"
            : (!holding && asset.price !== null && !asset.priceAt ? "≈ " : "") +
              (holding ? usd(holding.valueUsd) : assetPrice(asset.price))}
        </Text>
        <Text
          style={[
            m.muted,
            {
              fontFamily: fonts.numeric,
              color:
                asset.change24h == null
                  ? colors.muted
                  : asset.change24h >= 0
                    ? colors.success
                    : colors.error,
            },
          ]}
        >
          {pct(asset.change24h)}
        </Text>
      </View>
    </Pressable>
  );
}
/**
 * The portfolio's first row: the wallet's USDC, as one cash balance. The
 * second line shows the amount (or names the cash token when empty); the row
 * is the same height as an asset row so the list does not step.
 */
export function CashRow({
  parts,
  totalUsd,
  hidden,
  onPress,
}: {
  parts: { symbol: string; quantity: number }[];
  totalUsd: number;
  hidden?: boolean;
  onPress: () => void;
}) {
  const detail = parts.length
    ? parts
        .map(
          (p) =>
            p.quantity.toLocaleString("en-US", { maximumFractionDigits: 2 }) +
            " " +
            p.symbol,
        )
        .join(" · ")
    : Object.values(CASH_MINTS).join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cash"
      onPress={onPress}
      style={({ pressed }) => [
        m.row,
        {
          minHeight: 64,
          paddingHorizontal: 0,
          paddingVertical: 8,
          backgroundColor: "transparent",
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: colors.cash,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="cash" size={20} color={colors.canvas} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={1} style={[m.text, { fontFamily: fonts.medium }]}>
          Cash
        </Text>
        <Text numberOfLines={1} style={[m.muted, { fontFamily: fonts.numeric }]}>
          {hidden ? "••••" : detail}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 5 }}>
        <Text style={[m.text, { fontFamily: fonts.numericMedium }]}>
          {hidden ? "••••" : usd(totalUsd)}
        </Text>
        <Text style={[m.muted, { fontFamily: fonts.numeric }]}>USD</Text>
      </View>
    </Pressable>
  );
}
/**
 * An initial's disc is the card colour, the same as the selected tab, for
 * every profile: the picked tones went with the picker (2026-09-19). The
 * stored `avatar` field is kept but no longer read.
 */
export const avatarColor = (_avatar?: string | null) => colors.card;
export function PersonRow({
  profile,
  onPress,
  onFollow,
  actionLabel,
}: {
  profile: Profile;
  onPress: () => void;
  onFollow?: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={[m.row, m.panel]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[m.row, { flex: 1 }]}
      >
        <View style={[m.avatar, { backgroundColor: avatarColor(profile.avatar) }]}>
          <Text style={m.text}>
            {profile.displayName.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={1} style={m.text}>
            {profile.displayName}
          </Text>
          <Text style={m.muted}>@{profile.username}</Text>
          <Text style={m.muted}>
            {profile.pnlUsd === null
              ? "History pending"
              : usd(profile.pnlUsd) + " trading P&L"}
          </Text>
        </View>
      </Pressable>
      {onFollow ? (
        <Pressable
          accessibilityRole="button"
          onPress={onFollow}
          style={m.smallButton}
        >
          <Text style={m.link}>
            {actionLabel || (profile.isFollowing ? "Following" : "Follow")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Drag the knob to the far right to confirm; anything short springs back.
export function SlideToConfirm({
  label,
  color,
  onConfirm,
  onTap,
  disabled = false,
  errorSignal,
}: {
  label: string;
  color: string;
  onConfirm: () => void;
  /** Single-tap alternative to the drag (the caller reviews first). */
  onTap?: () => void;
  /** Nothing to confirm yet: the knob stays put and the label explains. */
  disabled?: boolean;
  /**
   * Bump this after a failed attempt: the track shakes, the phone buzzes,
   * the knob is locked for a moment and springs home. The screen does not
   * change shape, so nothing under it moves.
   */
  errorSignal?: number;
}) {
  const knob = 44;
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const [shaking, setShaking] = useState(false);
  // Enabled and disabled cross-fade instead of snapping.
  const dim = useRef(new Animated.Value(disabled ? 0.55 : 1)).current;
  useEffect(() => {
    Animated.timing(dim, {
      toValue: disabled ? 0.55 : 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [disabled, dim]);
  const max = useRef(0);
  const confirm = useRef(onConfirm);
  const locked = useRef(disabled);
  max.current = Math.max(0, width - knob - 8);
  confirm.current = onConfirm;
  locked.current = disabled || shaking;
  const reset = () =>
    Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
  const lastSignal = useRef(errorSignal ?? 0);
  useEffect(() => {
    if (errorSignal === undefined || errorSignal === lastSignal.current) return;
    lastSignal.current = errorSignal;
    setShaking(true);
    Vibration.vibrate(40);
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -4, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start(() => {
      reset();
      setTimeout(() => setShaking(false), 200);
    });
  }, [errorSignal, shake, x]);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !locked.current,
      onMoveShouldSetPanResponder: (_, g) => !locked.current && Math.abs(g.dx) > 4,
      onPanResponderMove: (_, g) =>
        x.setValue(Math.min(max.current, Math.max(0, g.dx))),
      onPanResponderRelease: (_, g) => {
        if (!locked.current && max.current > 0 && g.dx >= max.current - 6)
          confirm.current();
        reset();
      },
      onPanResponderTerminate: reset,
    }),
  ).current;
  return (
    <Animated.View
      accessibilityLabel={label}
      accessibilityHint={disabled ? undefined : "Slide right to confirm"}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        height: 52,
        borderRadius: 12,
        // The track carries the side's colour faintly; the knob carries it fully. No outline.
        backgroundColor: color + "1A",
        justifyContent: "center",
        opacity: dim,
        transform: [{ translateX: shake }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={
          onTap && !disabled ? "Reviews the order before placing it" : undefined
        }
        disabled={!onTap || disabled}
        onPress={onTap}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text
          style={[
            m.text,
            {
              fontFamily: fonts.medium,
              color: colors.ice,
              textAlign: "center",
              paddingLeft: knob,
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
      <Animated.View
        {...pan.panHandlers}
        style={{
          position: "absolute",
          left: 3,
          width: knob,
          height: knob,
          borderRadius: 10,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ translateX: x }],
        }}
      >
        <Icon name="chevron" size={20} color={colors.canvas} />
      </Animated.View>
    </Animated.View>
  );
}

/** Three dots rising and falling in turn: something is in flight. */
export function Dots({
  color = colors.mist,
  size = 5,
}: {
  color?: string;
  size?: number;
}) {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(v, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 220,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(360 - i * 120),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [values]);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: size * 0.8,
        height: size * 3,
      }}
      accessibilityLabel="In progress"
    >
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [
              {
                translateY: v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -size],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

// The knob rests in the middle: drag it to the left edge to sell, to the
// right edge to buy; anything short springs back. The dock follows the
// direction live through onSide so the staged amount can say what it means.
export function SlideToTrade({
  onSide,
  onTrade,
  onTap,
}: {
  onSide: (side: "buy" | "sell" | null) => void;
  onTrade: (side: "buy" | "sell") => void;
  /** Single-tap alternative to the drag: the caller reviews the order first. */
  onTap: (side: "buy" | "sell") => void;
}) {
  const knob = 44;
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const max = useRef(0);
  const side = useRef<"buy" | "sell" | null>(null);
  const handlers = useRef({ onSide, onTrade });
  max.current = Math.max(0, (width - knob) / 2 - 4);
  handlers.current = { onSide, onTrade };
  const setSide = (next: "buy" | "sell" | null) => {
    if (side.current === next) return;
    side.current = next;
    handlers.current.onSide(next);
  };
  const reset = () => {
    Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
    setSide(null);
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
      onPanResponderMove: (_, g) => {
        const dx = Math.min(max.current, Math.max(-max.current, g.dx));
        x.setValue(dx);
        setSide(dx > 12 ? "buy" : dx < -12 ? "sell" : null);
      },
      onPanResponderRelease: (_, g) => {
        if (max.current > 0 && Math.abs(g.dx) >= max.current - 6)
          handlers.current.onTrade(g.dx > 0 ? "buy" : "sell");
        reset();
      },
      onPanResponderTerminate: reset,
    }),
  ).current;
  const reach = Math.max(1, max.current);
  const sellOpacity = x.interpolate({
    inputRange: [-reach, 0, reach],
    outputRange: [1, 0.55, 0.2],
  });
  const buyOpacity = x.interpolate({
    inputRange: [-reach, 0, reach],
    outputRange: [0.2, 0.55, 1],
  });
  return (
    <View
      accessibilityLabel="Trade slider"
      accessibilityHint="Slide left to sell, right to buy"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.card,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 18,
      }}
    >
      {/* The labels are buttons too, so a drag is never the only way to trade. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sell"
        accessibilityHint="Reviews the sell order before placing it"
        hitSlop={8}
        onPress={() => onTap("sell")}
        style={{ minHeight: 44, minWidth: 44, justifyContent: "center" }}
      >
        <Animated.Text
          style={[
            m.text,
            { fontFamily: fonts.medium, color: colors.ice, opacity: sellOpacity },
          ]}
        >
          ‹ Sell
        </Animated.Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Buy"
        accessibilityHint="Reviews the buy order before placing it"
        hitSlop={8}
        onPress={() => onTap("buy")}
        style={{
          minHeight: 44,
          minWidth: 44,
          justifyContent: "center",
          alignItems: "flex-end",
        }}
      >
        <Animated.Text
          style={[
            m.text,
            { fontFamily: fonts.medium, color: colors.ice, opacity: buyOpacity },
          ]}
        >
          Buy ›
        </Animated.Text>
      </Pressable>
      <Animated.View
        {...pan.panHandlers}
        style={{
          position: "absolute",
          left: (width - knob) / 2,
          width: knob,
          height: knob,
          borderRadius: knob / 2,
          backgroundColor: colors.surfaceRaised,
          alignItems: "center",
          justifyContent: "center",
          transform: [{ translateX: x }],
        }}
      >
        <Icon name="chevron" size={20} color={colors.ice} />
      </Animated.View>
    </View>
  );
}

/**
 * A pushed screen slides in from the right and fades up; when `visible`
 * turns false it slides back out and reports when it has gone, so the
 * caller can unmount it after the motion instead of before.
 */
export function ScreenTransition({
  visible,
  onHidden,
  children,
}: {
  visible: boolean;
  onHidden?: () => void;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const hidden = useRef(onHidden);
  hidden.current = onHidden;
  useEffect(() => {
    const motion = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 240 : 190,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    motion.start(({ finished }) => {
      if (finished && !visible) hidden.current?.();
    });
    return () => motion.stop();
  }, [visible, progress]);
  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: progress,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [56, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
/**
 * A tab settles in when it becomes the selected one.
 *
 * The reset to the animation's first value has to happen before the browser
 * paints the frame that flips `display` to `flex`. With a plain effect the
 * tab is painted once at its finished position and only then jumps back to
 * the start, which reads as a flicker and a downward lurch; a layout effect
 * runs before that paint. A hidden tab is also parked at the start value, so
 * its first visible frame is right however it comes back.
 *
 * The web fades without the slide: its animations run on the JS thread, and
 * moving a whole screen vertically is what showed up as the tab jumping.
 */
export function TabFade({
  selected,
  children,
}: {
  selected: boolean;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);
  const reduceMotion = useReducedMotion();
  useLayoutEffect(() => {
    const firstCommit = !mounted.current;
    mounted.current = true;
    // Parked at the start, ready for the next time it is shown.
    if (!selected) {
      progress.setValue(0);
      return;
    }
    // The tab the app opens on, and Reduce Motion, appear in place.
    if (firstCommit || reduceMotion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const motion = Animated.timing(progress, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    motion.start();
    return () => motion.stop();
  }, [selected, progress, reduceMotion]);
  return (
    <Animated.View
      style={{
        flex: 1,
        display: selected ? "flex" : "none",
        opacity: progress,
        ...(Platform.OS === "web"
          ? null
          : {
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            }),
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A menu that drops from its trigger: the chosen option with a caret, and on
 * a tap a small card just under it listing the options, the chosen one
 * marked. A tap anywhere else closes it. For secondary choices such as a
 * timeframe, where the sheet would be too much.
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  label,
  textStyle,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Read out with the current choice. */
  label: string;
  textStyle?: StyleProp<TextStyle>;
}) {
  const anchor = useRef<View>(null);
  const { width: screen } = useWindowDimensions();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const current = options.find((o) => o.value === value) ?? options[0]!;
  const menuWidth = 168;
  const open = () =>
    anchor.current?.measureInWindow((x, y, _w, h) =>
      setAt({
        x: Math.max(16, Math.min(x, screen - menuWidth - 16)),
        y: y + h + 6,
      }),
    );
  return (
    <>
      <Pressable
        ref={anchor}
        accessibilityRole="button"
        accessibilityLabel={label + ", " + current.label}
        onPress={open}
        hitSlop={8}
        style={({ pressed }) => [dd.trigger, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[m.text, dd.triggerText, textStyle]}>{current.label}</Text>
        <View style={{ transform: [{ rotate: "90deg" }] }}>
          <Icon name="chevron" size={12} color={colors.muted} />
        </View>
      </Pressable>
      <Modal
        transparent
        visible={at !== null}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setAt(null)}
      >
        <Pressable
          accessibilityLabel="Close menu"
          style={StyleSheet.absoluteFill}
          onPress={() => setAt(null)}
        />
        {at ? (
          <View style={[dd.menu, { top: at.y, left: at.x, width: menuWidth }]}>
            {options.map((o) => (
              <Pressable
                key={o.value}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: o.value === value }}
                onPress={() => {
                  setAt(null);
                  if (o.value !== value) onChange(o.value);
                }}
                style={({ pressed }) => [
                  dd.item,
                  pressed && { backgroundColor: colors.surfaceRaised },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    m.text,
                    {
                      flexShrink: 1,
                      fontFamily: o.value === value ? fonts.medium : undefined,
                    },
                  ]}
                >
                  {o.label}
                </Text>
                {o.value === value ? <View style={dd.dot} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </Modal>
    </>
  );
}
const dd = StyleSheet.create({
  trigger: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  triggerText: { fontSize: 13, fontFamily: fonts.medium, color: colors.mist },
  menu: {
    position: "absolute",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardLine,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  item: {
    minHeight: 42,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ice },
});
