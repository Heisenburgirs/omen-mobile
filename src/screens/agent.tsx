import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Icon, m } from "../components/market-ui";
import { OmenSheet } from "../components/omen-sheet";
import { RaisedButton as Button } from "../components/raised-button";
import { usd } from "../domain/market";
import {
  tradingColors as colors,
  tradingFonts as fonts,
  space,
} from "../theme";
import { showToast } from "../lib/toast";
import { mobileFetch } from "../lib/mobile-api";
import { usePrivy } from "../lib/privy";
import { runTurn } from "../agent/harness";
import type { Fetcher } from "../agent/tools";
import { addMessage, listMessages, type StoredMessage } from "../agent/store";
import { useRyvoChannel } from "../agent/ryvo/use-channel";
import { fromMicro } from "../agent/ryvo/config";

const GREETING = "What are we trading today, anon?";
const SUGGESTIONS = [
  "What paid me this week?",
  "Find tokens that pay in ZEC",
  "How is my portfolio doing?",
];
const UNFUNDED =
  "I run on my own balance: USDC you lock with Ryvo, spent a fraction of a cent per reply and returned when you withdraw. Tap Fund to start.";

type Shown = { id: number; from: "agent" | "user"; text: string; costMicro?: number | null };
const shown = (m: StoredMessage): Shown => ({ id: m.id, from: m.role, text: m.text, costMicro: m.costMicro });
const stateLabel: Record<string, string> = {
  none: "Not funded",
  opening: "Opening…",
  open: "",
  closing: "Closing",
  sealed: "Closing",
  distributed: "Withdrawn",
  reclaimed: "Withdrawn",
};

/**
 * The Agent tab: a conversation with the user's own agent, and its balance
 * at the top with Fund beside it. The agent's memory and history stay on
 * this device; its replies are written by a model on Ryvo, each one prepaid
 * from a USDC payment channel the user funds from their wallet and can close
 * at any time. Funding and withdrawing share one sheet.
 */
export function AgentScreen({
  hidden,
  cashUsd,
}: {
  hidden: boolean;
  /** The wallet's cash, which a deposit would draw on. */
  cashUsd: number;
}) {
  const { user, getAccessToken } = usePrivy();
  const channel = useRyvoChannel();
  const owner = channel.address;
  const balance = channel.view?.availableUsdc ?? 0;
  const funded = channel.view?.state === "open";

  const [transfer, setTransfer] = useState(false);
  // Which way the money goes: into the agent, or back out to the wallet.
  const [direction, setDirection] = useState<"fund" | "withdraw">("fund");
  const [amount, setAmount] = useState("");
  const value = Number(amount) || 0;
  const roomUsdc = Math.max(0, channel.limits.maxUsdc - (channel.view?.depositUsdc ?? 0));
  const available = Math.min(cashUsd, roomUsdc);
  const over = value > available + 1e-6;
  const under = value > 0 && value < channel.limits.minUsdc && !funded;
  // The keyboard covers the bottom of the window and nothing resizes for it
  // here, so the screen lifts its own bottom edge by however much of it the
  // keyboard overlaps (the tab bar below the screen is already out of the way).
  const root = useRef<View>(null);
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const shownListener = Keyboard.addListener("keyboardDidShow", (e) => {
      root.current?.measureInWindow((_x, y, _w, h) => {
        setLift(Math.max(0, y + h - e.endCoordinates.screenY));
        requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));
      });
    });
    const gone = Keyboard.addListener("keyboardDidHide", () => setLift(0));
    return () => {
      shownListener.remove();
      gone.remove();
    };
  }, []);

  const [messages, setMessages] = useState<Shown[]>([{ id: 0, from: "agent", text: GREETING }]);
  const history = useRef<StoredMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const list = useRef<ScrollView>(null);
  const localId = useRef(-1);

  // The conversation so far, from the device.
  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    listMessages(owner)
      .then((stored) => {
        if (cancelled) return;
        history.current = stored;
        setMessages(stored.length ? stored.map(shown) : [{ id: 0, from: "agent", text: GREETING }]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [owner]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || typing) return;
      setDraft("");
      if (!owner) {
        showToast("Your wallet is still being prepared. Try again in a moment.");
        return;
      }
      const mine = await addMessage(owner, "user", clean).catch(() => null);
      const userMessage: StoredMessage = mine ?? { id: localId.current--, role: "user", text: clean, costMicro: null, createdAt: Date.now() };
      setMessages((all) => [...all, shown(userMessage)]);
      if (!funded) {
        setMessages((all) => [...all, { id: localId.current--, from: "agent", text: UNFUNDED }]);
        return;
      }
      setTyping(true);
      try {
        const token = user ? await getAccessToken() : null;
        const result = await runTurn({
          owner,
          token,
          text: clean,
          history: history.current,
          fetch: ((resource, params = {}) => mobileFetch(resource, params, token)) as Fetcher,
          write: channel.write,
        });
        const reply = (await addMessage(owner, "agent", result.reply, result.costMicro).catch(() => null)) ?? {
          id: localId.current--,
          role: "agent" as const,
          text: result.reply,
          costMicro: result.costMicro,
          createdAt: Date.now(),
        };
        history.current = [...history.current, userMessage, reply].slice(-60);
        setMessages((all) => [...all, shown(reply)]);
        if (result.remembered) showToast("Noted for next time");
      } catch (e) {
        const why = e instanceof Error ? e.message : "Something went wrong.";
        setMessages((all) => [...all, { id: localId.current--, from: "agent", text: `I couldn't answer that: ${why}` }]);
      } finally {
        setTyping(false);
      }
    },
    [typing, owner, funded, user, getAccessToken, channel.write],
  );
  const fresh = messages.length === 1;

  const openSheet = () => {
    setDirection("fund");
    setAmount("");
    setTransfer(true);
    void channel.loadLimits();
  };
  const submit = async () => {
    try {
      if (direction === "fund") {
        const next = await channel.fund(value);
        setTransfer(false);
        setAmount("");
        showToast(next.state === "open" ? `Agent funded: ${usd(next.availableUsdc)} to spend` : "Funding is on its way");
      } else {
        const next = await channel.withdraw();
        setTransfer(false);
        showToast(
          next.closeDeadline
            ? "Withdrawal requested; the deposit returns after Ryvo's 48-hour window"
            : "Unspent balance returned to your wallet",
        );
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "That didn't go through. Try again.");
    }
  };
  const label = stateLabel[channel.view?.state ?? "none"] ?? "";

  return (
    <View ref={root} collapsable={false} style={{ flex: 1, paddingBottom: lift }}>
      {/* The agent's own balance, and moving money in and out of it. */}
      <View style={[m.between, s.header]}>
        <View style={{ gap: 2 }}>
          <Text style={m.label}>Agent balance</Text>
          <Text numberOfLines={1} style={s.balance}>
            {hidden ? "••••" : channel.view ? usd(balance) : "—"}
          </Text>
          {label ? <Text style={[m.muted, { fontSize: 12 }]}>{label}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fund or withdraw from the agent"
          disabled={!channel.ready}
          onPress={openSheet}
          hitSlop={10}
          style={({ pressed }) => [s.fund, { opacity: !channel.ready ? 0.4 : pressed ? 0.6 : 1 }]}
        >
          <Text style={[m.link, { color: colors.ice, fontSize: 15 }]}>{funded ? "Manage" : "Fund"}</Text>
        </Pressable>
      </View>
      <ScrollView
        ref={list}
        style={{ flex: 1 }}
        contentContainerStyle={s.thread}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[s.bubble, message.from === "user" ? s.mine : s.theirs]}
          >
            <Text style={[m.text, { lineHeight: 21 }]}>{message.text}</Text>
            {message.costMicro != null ? (
              <Text style={[m.muted, { fontSize: 11, marginTop: 4 }]}>
                {`$${fromMicro(message.costMicro).toFixed(4)}`}
              </Text>
            ) : null}
          </View>
        ))}
        {typing ? (
          <View style={[s.bubble, s.theirs]}>
            <Text style={[m.muted, { lineHeight: 21 }]}>…</Text>
          </View>
        ) : null}
        {fresh ? (
          <View style={{ gap: 0, marginTop: 4 }}>
            {SUGGESTIONS.map((text) => (
              <Pressable
                key={text}
                accessibilityRole="button"
                onPress={() => void send(text)}
                style={({ pressed }) => [s.suggestion, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[m.muted, { fontSize: 13, lineHeight: 18 }]}>{text}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={s.composer}>
        <TextInput
          accessibilityLabel="Message the agent"
          // No autofill strip over the composer; see Field in market-ui.
          autoComplete="off"
          importantForAutofill="no"
          placeholder="Message your agent"
          placeholderTextColor={colors.muted}
          selectionColor={colors.focus}
          cursorColor={colors.focus}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => void send(draft)}
          returnKeyType="send"
          maxLength={500}
          style={s.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={!draft.trim() || typing}
          onPress={() => void send(draft)}
          style={({ pressed }) => [
            s.send,
            { opacity: !draft.trim() || typing ? 0.35 : pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="send" size={18} color={colors.canvas} />
        </Pressable>
      </View>
      {/* Money between the wallet and the agent, either way. */}
      <OmenSheet
        visible={transfer}
        onClose={() => !channel.busy && setTransfer(false)}
        title={direction === "fund" ? (funded ? "Add to agent" : "Fund agent") : "Withdraw from agent"}
      >
        <View style={{ gap: 16, paddingTop: 4, paddingHorizontal: 24, paddingBottom: 8 }}>
          <Text style={m.muted}>
            {direction === "fund"
              ? `USDC locked in your agent's payment channel with Ryvo. Each reply costs a fraction of a cent from it; the rest comes back when you withdraw. ${channel.limits.minUsdc} to ${channel.limits.maxUsdc} USDC.`
              : "Closes the channel: what your agent hasn't spent returns to your wallet, what it spent settles to Ryvo."}
          </Text>
          <View style={s.toggle}>
            {(["fund", "withdraw"] as const).map((d) => (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: direction === d }}
                disabled={d === "withdraw" && !funded}
                onPress={() => {
                  setDirection(d);
                  setAmount("");
                }}
                style={[s.toggleItem, direction === d && s.toggleOn, d === "withdraw" && !funded && { opacity: 0.4 }]}
              >
                <Text
                  style={[
                    m.text,
                    {
                      fontSize: 14,
                      fontFamily: fonts.medium,
                      color: direction === d ? colors.ice : colors.muted,
                    },
                  ]}
                >
                  {d === "fund" ? "Fund" : "Withdraw"}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={s.route}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={m.label}>{direction === "fund" ? "From wallet" : "From agent"}</Text>
              <Text style={s.routeFigure}>
                {hidden ? "••••" : usd(direction === "fund" ? cashUsd : balance)}
              </Text>
            </View>
            <Icon name="arrow" size={18} color={colors.muted} />
            <View style={{ flex: 1, gap: 2, alignItems: "flex-end" }}>
              <Text style={m.label}>{direction === "fund" ? "To agent" : "To wallet"}</Text>
              <Text style={s.routeFigure}>
                {hidden ? "••••" : usd(direction === "fund" ? balance : cashUsd)}
              </Text>
            </View>
          </View>
          {direction === "fund" ? (
            <View style={s.amountRow}>
              <Text style={s.amountSign}>$</Text>
              <TextInput
                accessibilityLabel="Amount in dollars"
                autoComplete="off"
                importantForAutofill="no"
                placeholder={String(Math.min(channel.limits.suggestedUsdc, Math.floor(available)) || channel.limits.minUsdc)}
                placeholderTextColor={colors.muted}
                selectionColor={colors.focus}
                cursorColor={colors.focus}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9.]/g, "").slice(0, 10))}
                style={s.amountInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Use everything available"
                onPress={() =>
                  setAmount(available > 0 ? String(Math.floor(available * 100) / 100) : "")
                }
                hitSlop={8}
              >
                <Text style={[m.link, { color: colors.ice }]}>Max</Text>
              </Pressable>
            </View>
          ) : null}
          <Button
            title={
              channel.busy
                ? direction === "fund"
                  ? "Funding…"
                  : "Withdrawing…"
                : direction === "fund"
                  ? over
                    ? roomUsdc < cashUsd
                      ? "Over the channel limit"
                      : "Not enough USDC"
                    : under
                      ? `At least ${channel.limits.minUsdc} USDC`
                      : funded
                        ? "Add"
                        : "Fund"
                  : "Withdraw"
            }
            disabled={channel.busy || (direction === "fund" ? !value || over || under : !funded)}
            onPress={() => void submit()}
          />
        </View>
      </OmenSheet>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: space.edge,
    paddingTop: space.sm,
    paddingBottom: 12,
    alignItems: "center",
  },
  balance: {
    fontFamily: fonts.numericBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: colors.ice,
    fontVariant: ["tabular-nums"],
  },
  // A plain word, no disc behind it.
  fund: { minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center" },
  toggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  toggleItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: colors.surfaceRaised },
  route: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
  },
  routeFigure: {
    fontFamily: fonts.numericMedium,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ice,
    fontVariant: ["tabular-nums"],
  },
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
  amountSign: { fontFamily: fonts.numericBold, fontSize: 22, color: colors.muted },
  amountInput: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 0,
    fontFamily: fonts.numericBold,
    fontSize: 22,
    color: colors.ice,
  },
  thread: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingHorizontal: space.edge,
    paddingVertical: 12,
    gap: 8,
  },
  bubble: {
    maxWidth: "84%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderBottomLeftRadius: 6,
  },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: colors.surfaceRaised,
    borderBottomRightRadius: 6,
  },
  // Quiet prompts: small text, no outline; the tap area stays generous.
  suggestion: {
    alignSelf: "flex-start",
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: space.edge,
    paddingTop: 8,
    paddingBottom: 4,
  },
  input: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 23,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ice,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.ice,
    alignItems: "center",
    justifyContent: "center",
  },
});
