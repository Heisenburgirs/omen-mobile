import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon, m } from "./market-ui";
import { usd } from "../domain/market";
import { tradingColors as colors, tradingFonts as fonts } from "../theme";

const PRESETS = [5, 20, 50];

/**
 * Funding the agent, shown in place inside the side menu: an amount (at
 * least the minimum) and one button, and when the agent holds anything, one
 * more that returns all of it to the user's wallet.
 */
export function AgentFundPanel({
  onBack,
  balanceUsd,
  cashUsd,
  maxUsd,
  minUsd,
  busy,
  onFund,
  onWithdraw,
}: {
  onBack: () => void;
  balanceUsd: number;
  cashUsd: number;
  /** The most that can be added now: the wallet's cash, capped by the agent's limit. */
  maxUsd: number;
  minUsd: number;
  busy: "fund" | "withdraw" | null;
  onFund: (usd: number) => void;
  onWithdraw: () => void;
}) {
  const [amount, setAmount] = useState("");
  const value = Number(amount) || 0;
  const over = value > maxUsd + 1e-6;
  const under = value > 0 && value < minUsd - 1e-6;
  const title = busy === "fund"
    ? "Funding…"
    : over
      ? cashUsd < maxUsd + 1e-6 ? "Not enough USDC" : `Up to ${usd(maxUsd)}`
      : under
        ? `At least ${usd(minUsd)}`
        : value
          ? `Fund ${usd(value)}`
          : "Fund agent";
  return (
    <View style={{ flex: 1 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to conversations"
        disabled={Boolean(busy)}
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [s.back, { opacity: busy ? 0.4 : pressed ? 0.6 : 1 }]}
      >
        <Icon name="back" size={18} color={colors.ice} />
        <Text style={s.backText}>Fund agent</Text>
      </Pressable>

      <Text style={[m.label, { marginTop: 18 }]}>Agent balance</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={s.balance}>
        {usd(balanceUsd)}
      </Text>

      <View style={s.amountRow}>
        <Text style={s.sign}>$</Text>
        <TextInput
          accessibilityLabel="Amount in dollars"
          autoComplete="off"
          importantForAutofill="no"
          placeholder={String(minUsd)}
          placeholderTextColor={colors.muted}
          selectionColor={colors.focus}
          cursorColor={colors.focus}
          keyboardType="decimal-pad"
          editable={!busy}
          value={amount}
          onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, "").slice(0, 10))}
          style={s.input}
        />
      </View>
      <View style={s.presets}>
        {PRESETS.map((preset) => (
          <Pressable
            key={preset}
            accessibilityRole="button"
            disabled={Boolean(busy)}
            onPress={() => setAmount(String(preset))}
            style={({ pressed }) => [s.preset, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={s.presetText}>${preset}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use everything available"
          disabled={Boolean(busy)}
          onPress={() => setAmount(maxUsd > 0 ? String(Math.floor(maxUsd * 100) / 100) : "")}
          style={({ pressed }) => [s.preset, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={s.presetText}>Max</Text>
        </Pressable>
      </View>
      <Text style={s.hint}>
        {usd(cashUsd)} USDC available
      </Text>

      <Pressable
        accessibilityRole="button"
        disabled={Boolean(busy) || !value || over || under}
        onPress={() => {
          onFund(value);
          setAmount("");
        }}
        style={({ pressed }) => [
          s.fund,
          (Boolean(busy) || !value || over || under) && { opacity: 0.4 },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={s.fundText}>{title}</Text>
      </Pressable>
      {balanceUsd > 0.005 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Withdraw ${usd(balanceUsd)} to your wallet`}
          disabled={Boolean(busy)}
          onPress={onWithdraw}
          hitSlop={8}
          style={({ pressed }) => [s.withdraw, { opacity: busy && busy !== "withdraw" ? 0.4 : pressed ? 0.6 : 1 }]}
        >
          {busy === "withdraw" ? <ActivityIndicator size="small" color={colors.muted} /> : null}
          <Text style={s.withdrawText}>{busy === "withdraw" ? "Withdrawing…" : "Withdraw balance"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36, alignSelf: "flex-start" },
  backText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ice },
  balance: {
    fontFamily: fonts.numericBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ice,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 52,
    marginTop: 18,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sign: { fontFamily: fonts.numericBold, fontSize: 20, color: colors.muted },
  input: { flex: 1, minHeight: 50, paddingVertical: 0, fontFamily: fonts.numericBold, fontSize: 20, color: colors.ice },
  presets: { flexDirection: "row", gap: 8, marginTop: 10 },
  preset: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  presetText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ice },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 10 },
  fund: {
    height: 40,
    marginTop: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ice,
  },
  fundText: { fontFamily: fonts.medium, fontSize: 14, color: colors.canvas },
  withdraw: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, marginTop: 6, alignSelf: "flex-start" },
  withdrawText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ice },
});
