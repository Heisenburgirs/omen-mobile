import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { m } from "./market-ui";
import { OmenSheet } from "./omen-sheet";
import { RaisedButton as Button } from "./raised-button";
import { usd } from "../domain/market";
import { tradingColors as colors, tradingFonts as fonts } from "../theme";

/**
 * Funding the agent: an amount and one button. When the agent has money,
 * one more button returns all of it to the wallet.
 */
export function AgentFundSheet({
  visible,
  onClose,
  balanceUsd,
  cashUsd,
  maxUsd,
  minUsd,
  busy,
  onFund,
  onWithdraw,
}: {
  visible: boolean;
  onClose: () => void;
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
  const under = value > 0 && value < minUsd && balanceUsd <= 0;
  const title = busy === "fund"
    ? "Funding…"
    : over
      ? cashUsd < maxUsd + 1e-6 ? "Not enough USDC" : `Up to ${usd(maxUsd)}`
      : under
        ? `At least ${usd(minUsd)}`
        : "Fund agent";
  return (
    <OmenSheet visible={visible} onClose={() => !busy && onClose()} title="Fund agent">
      <View style={{ gap: 14, paddingTop: 4, paddingHorizontal: 24, paddingBottom: 8 }}>
        <Text style={m.muted}>USDC funds your agent.</Text>
        <View style={s.amountRow}>
          <Text style={s.sign}>$</Text>
          <TextInput
            accessibilityLabel="Amount in dollars"
            autoComplete="off"
            importantForAutofill="no"
            placeholder="0"
            placeholderTextColor={colors.muted}
            selectionColor={colors.focus}
            cursorColor={colors.focus}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, "").slice(0, 10))}
            style={s.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Use everything available"
            hitSlop={8}
            onPress={() => setAmount(maxUsd > 0 ? String(Math.floor(maxUsd * 100) / 100) : "")}
          >
            <Text style={[m.link, { color: colors.ice }]}>Max</Text>
          </Pressable>
        </View>
        <Button
          title={title}
          busy={busy === "fund"}
          disabled={Boolean(busy) || !value || over || under}
          onPress={() => {
            onFund(value);
            setAmount("");
          }}
        />
        {balanceUsd > 0.005 ? (
          <Button
            secondary
            title={busy === "withdraw" ? "Withdrawing…" : "Withdraw funds"}
            busy={busy === "withdraw"}
            disabled={Boolean(busy)}
            onPress={onWithdraw}
          />
        ) : null}
      </View>
    </OmenSheet>
  );
}

const s = StyleSheet.create({
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  sign: { fontFamily: fonts.numericBold, fontSize: 22, color: colors.muted },
  input: { flex: 1, minHeight: 54, paddingVertical: 0, fontFamily: fonts.numericBold, fontSize: 22, color: colors.ice },
});
