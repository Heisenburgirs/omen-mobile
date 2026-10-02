import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { blocks, type Segment } from "../agent/markup";
import type { MessageRefs, TokenRef } from "../agent/refs";
import { assetPrice, pct, usd } from "../domain/market";
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
  const openToken = (t: TokenRef | null) => {
    if (t?.mint) onOpenAsset(t.mint);
    else if (t?.url) onOpenUrl(t.url);
  };
  return (
    <View style={{ gap: 10 }}>
      {parts.map((b, i) =>
        b.kind === "card" ? (
          <TokenCard key={i} token={b.token} onPress={() => openToken(b.token)} />
        ) : (
          <Text key={i} style={s.body}>
            {b.segments.map((seg, j) => (
              <Span key={j} seg={seg} onToken={openToken} onUrl={onOpenUrl} />
            ))}
          </Text>
        ),
      )}
    </View>
  );
}

function Span({ seg, onToken, onUrl }: { seg: Segment; onToken: (t: TokenRef | null) => void; onUrl: (url: string) => void }) {
  switch (seg.kind) {
    case "ticker":
      return seg.token && (seg.token.mint || seg.token.url) ? (
        <Text style={s.link} onPress={() => onToken(seg.token)} accessibilityRole="link">
          {seg.text}
        </Text>
      ) : (
        <Text style={s.strong}>{seg.text}</Text>
      );
    case "handle":
      return (
        <Text style={s.link} onPress={() => onUrl(seg.url)} accessibilityRole="link">
          {seg.text}
        </Text>
      );
    case "url":
      return (
        <Text style={s.link} onPress={() => onUrl(seg.url)} accessibilityRole="link">
          {seg.label}
        </Text>
      );
    case "number":
      return <Text style={[s.figure, { color: seg.direction === "up" ? colors.success : colors.error }]}>{seg.text}</Text>;
    default:
      return <Text>{seg.text}</Text>;
  }
}

const compactAge = (h: number | null | undefined) =>
  h == null ? null : h < 48 ? `${Math.max(1, Math.round(h))}h old` : `${Math.round(h / 24)}d old`;

/** A token's figures at a glance; a tap opens its page. */
function TokenCard({ token, onPress }: { token: TokenRef; onPress: () => void }) {
  const change = token.change24h;
  const peak = token.peak;
  const cells: { label: string; value: string; tone?: "up" | "down" }[] = [
    { label: "Mkt cap", value: token.marketCap != null ? usd(token.marketCap, true) : "—" },
    { label: "Liquidity", value: token.liquidity != null ? usd(token.liquidity, true) : "—" },
    { label: "Vol 24h", value: token.volume24h != null ? usd(token.volume24h, true) : "—" },
    peak
      ? { label: `ATH ${usd(peak.athMarketCap, true)}`, value: pct(peak.fromAthPct), tone: peak.fromAthPct < -5 ? "down" : "up" }
      : { label: "Age", value: compactAge(token.ageHours) ?? "—" },
  ];
  const tappable = Boolean(token.mint || token.url);
  return (
    <Pressable
      accessibilityRole={tappable ? "button" : undefined}
      accessibilityLabel={`${token.symbol}${token.mint ? ", open" : ""}`}
      disabled={!tappable}
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.7 }]}
    >
      <View style={s.cardTop}>
        <View style={{ flexShrink: 1 }}>
          <Text style={s.symbol}>
            {token.symbol}
            {token.chain && token.chain !== "solana" ? <Text style={s.chain}>{`  ${token.chain}`}</Text> : null}
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
            <Text style={[s.cellValue, c.tone && { color: c.tone === "up" ? colors.success : colors.error }]}>{c.value}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  body: { fontFamily: chatFonts.regular, fontSize: 16, lineHeight: 24, color: colors.ice },
  strong: { fontFamily: chatFonts.medium, color: colors.ice },
  link: { fontFamily: chatFonts.medium, color: colors.link },
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
  chain: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  name: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 1 },
  price: { fontFamily: fonts.numericMedium, fontSize: 15, color: colors.ice },
  change: { fontFamily: fonts.numeric, fontSize: 12, marginTop: 1 },
  grid: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cell: { flex: 1, minWidth: 0 },
  cellLabel: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted, letterSpacing: 0.2 },
  cellValue: { fontFamily: fonts.numericMedium, fontSize: 13, color: colors.ice, marginTop: 2 },
});
