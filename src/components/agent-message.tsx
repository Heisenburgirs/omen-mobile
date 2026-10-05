import * as Clipboard from "expo-clipboard";
import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { blocks, type Segment } from "../agent/markup";
import { followerTier, type MessageRefs, type PostRef, type TokenRef } from "../agent/refs";
import { assetPrice, pct, usd } from "../domain/market";
import { showToast } from "../lib/toast";
import { Icon } from "./market-ui";
import { chatFonts, tradingColors as colors, tradingFonts as fonts } from "../theme";

// An agent reply drawn as the chat shows it: tickers open their page, X
// handles and posts open X, signed figures read green or red, and a token
// the reply leans on gets its figures as a card under the paragraph.

export function AgentMessage({
  text,
  refs,
  onOpenAsset,
  onOpenUrl,
}: {
  text: string;
  refs: MessageRefs;
  onOpenAsset: (mint: string) => void;
  onOpenUrl: (url: string) => void;
}) {
  const parts = useMemo(() => blocks(text, refs), [text, refs]);
  const accounts = useMemo(() => new Map(refs.posts.map((p) => [p.handle.toLowerCase(), p])), [refs]);
  const openToken = (t: TokenRef | null) => {
    if (t?.mint) onOpenAsset(t.mint);
  };
  return (
    <View style={{ gap: 10 }}>
      {parts.map((b, i) =>
        b.kind === "card" ? (
          <TokenCard key={i} token={b.token} onPress={() => openToken(b.token)} />
        ) : (
          <Text key={i} style={s.body}>
            {b.segments.map((seg, j) => (
              <Span key={j} seg={seg} onToken={openToken} onUrl={onOpenUrl} accounts={accounts} />
            ))}
          </Text>
        ),
      )}
    </View>
  );
}

function Span({
  seg,
  onToken,
  onUrl,
  accounts,
}: {
  seg: Segment;
  onToken: (t: TokenRef | null) => void;
  onUrl: (url: string) => void;
  accounts: Map<string, PostRef>;
}) {
  switch (seg.kind) {
    case "ticker":
      return seg.token?.mint ? (
        <Text style={s.link} onPress={() => onToken(seg.token)} accessibilityRole="link">
          {seg.text}
        </Text>
      ) : (
        <Text style={s.strong}>{seg.text}</Text>
      );
    case "handle": {
      const account = accounts.get(seg.text.slice(1).toLowerCase());
      return (
        <Text style={s.link} onPress={() => onUrl(seg.url)} accessibilityRole="link">
          {seg.text}
          {account?.followers != null ? <Badge followers={account.followers} verified={account.verified} /> : null}
        </Text>
      );
    }
    case "url":
      return (
        <Text style={s.link} onPress={() => onUrl(seg.url)} accessibilityRole="link">
          {seg.label}
        </Text>
      );
    case "number":
      return <Text style={[s.figure, { color: seg.direction === "up" ? colors.success : colors.error }]}>{seg.text}</Text>;
    case "strong":
      return <Text style={s.strong}>{seg.text}</Text>;
    case "address":
      return (
        <Text
          style={s.link}
          accessibilityRole="button"
          accessibilityLabel="Copy contract address"
          onPress={() => void copyAddress(seg.address)}
        >
          {seg.text}
          {" "}
          <View style={s.inlineIcon}>
            <Icon name="copy" size={13} color={colors.link} />
          </View>
        </Text>
      );
    default:
      return <Text>{seg.text}</Text>;
  }
}

/** An account's size, read in a glance: <1K, 1K+, 10K+, 30K+, 50K+, 100K+, with a check when verified. */
function Badge({ followers, verified }: { followers: number; verified?: boolean }) {
  const tier = followerTier(followers);
  const tone = tier.rank === 0 ? colors.muted : tier.rank <= 2 ? colors.mist : colors.ice;
  return (
    <View style={[s.badge, tier.rank >= 3 && s.badgeStrong]}>
      <Text style={[s.badgeText, { color: tone }]}>{`${verified ? "✓ " : ""}${tier.label}`}</Text>
    </View>
  );
}

async function copyAddress(address: string) {
  await Clipboard.setStringAsync(address);
  showToast("Contract address copied");
}

const compactAge = (h: number | null | undefined) =>
  h == null ? null : h < 48 ? `${Math.max(1, Math.round(h))}h old` : `${Math.round(h / 24)}d old`;

/** A token's figures at a glance; a tap opens its page. */
function TokenCard({ token, onPress }: { token: TokenRef; onPress: () => void }) {
  const change = token.change24h;
  const cells: { label: string; value: string }[] = [
    { label: "Mkt cap", value: token.marketCap != null ? usd(token.marketCap, true) : "—" },
    { label: "Liquidity", value: token.liquidity != null ? usd(token.liquidity, true) : "—" },
    { label: "Vol 24h", value: token.volume24h != null ? usd(token.volume24h, true) : "—" },
    { label: "Age", value: compactAge(token.ageHours) ?? "—" },
  ];
  const tappable = Boolean(token.mint);
  const ca = token.mint;
  const copy = async () => {
    if (!ca) return;
    await Clipboard.setStringAsync(ca);
    showToast("Contract address copied");
  };
  return (
    <Pressable
      accessibilityRole={tappable ? "button" : undefined}
      accessibilityLabel={`${token.symbol}${token.mint ? ", open" : ""}`}
      disabled={!tappable}
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }]}
    >
      <View style={s.cardTop}>
        {token.image ? <Image source={{ uri: token.image }} style={s.logo} /> : null}
        <View style={{ flexShrink: 1, flexGrow: 1 }}>
          <Text style={s.symbol}>
            {token.symbol}
            {token.launchpad ? <Text style={s.launchpad}>{`  ${token.launchpad}`}</Text> : null}
          </Text>
          {token.name ? (
            <Text numberOfLines={1} style={s.name}>
              {token.name}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {token.price != null ? <Text style={s.price}>{assetPrice(token.price)}</Text> : null}
          {change != null ? (
            <Text style={[s.change, { color: change >= 0 ? colors.success : colors.error }]}>{pct(change)}</Text>
          ) : null}
        </View>
      </View>
      <View style={s.grid}>
        {cells.map((c) => (
          <View key={c.label} style={s.cell}>
            <Text style={s.cellLabel}>{c.label}</Text>
            <Text style={s.cellValue}>{c.value}</Text>
          </View>
        ))}
      </View>
      {ca ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy contract address"
          hitSlop={8}
          onPress={() => void copy()}
          style={({ pressed }) => [s.copy, pressed && { opacity: 0.6 }]}
        >
          <Text style={s.copyText}>Copy CA</Text>
          <Text numberOfLines={1} style={s.copyAddress}>
            {`${ca.slice(0, 4)}…${ca.slice(-4)}`}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  body: { fontFamily: chatFonts.regular, fontSize: 16, lineHeight: 24, color: colors.ice },
  strong: { fontFamily: chatFonts.medium, color: colors.ice },
  link: { fontFamily: chatFonts.medium, color: colors.link, textDecorationLine: "underline" },
  inlineIcon: { width: 13, height: 13, justifyContent: "flex-end" },
  badge: { marginLeft: 5, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.surfaceRaised, transform: [{ translateY: 2 }] },
  badgeStrong: { backgroundColor: colors.selected },
  badgeText: { fontFamily: fonts.numericMedium, fontSize: 10, letterSpacing: 0.2 },
  logo: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceRaised },
  launchpad: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  figure: { fontFamily: fonts.numericMedium },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  symbol: { fontFamily: fonts.bold, fontSize: 15, color: colors.ice },
  name: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  price: { fontFamily: fonts.numericMedium, fontSize: 15, color: colors.ice },
  change: { fontFamily: fonts.numeric, fontSize: 12, marginTop: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  cell: { width: "50%", minWidth: 0 },
  copy: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingVertical: 4 },
  copyText: { fontFamily: fonts.medium, fontSize: 12, color: colors.link },
  copyAddress: { fontFamily: fonts.numeric, fontSize: 12, color: colors.muted },
  cellLabel: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted, letterSpacing: 0.2 },
  cellValue: { fontFamily: fonts.numericMedium, fontSize: 13, color: colors.ice, marginTop: 2 },
});
