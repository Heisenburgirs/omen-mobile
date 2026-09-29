import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon, IconButton, m } from "../components/market-ui";
import { OmenSheet } from "../components/omen-sheet";
import { AgentDrawer } from "../components/agent-drawer";
import { AgentComposer } from "../components/agent-composer";
import { AgentFundPanel } from "../components/agent-fund-panel";
import { usd } from "../domain/market";
import { USDC } from "../domain/models";
import { tradingColors as colors, tradingFonts as fonts, chatFonts, space } from "../theme";
import { showToast } from "../lib/toast";
import { mobileFetch, useMobile } from "../lib/mobile-api";
import { useEmbeddedSolanaWallet, usePrivy } from "../lib/privy";
import { useChainActions } from "../lib/chain-actions";
import { runTurn } from "../agent/harness";
import type { Fetcher } from "../agent/tools";
import {
  addMessage,
  createConversation,
  listConversations,
  listMessages,
  touchConversation,
  type Attachment,
  type Conversation,
  type StoredMessage,
} from "../agent/store";
import { pickFile, pickImage, storedAttachment, type PendingAttachment } from "../agent/attachments";
import { useVoiceInput } from "../agent/voice";
import { isUnlocked, lockIdentity, unlockIdentity } from "../agent/identity";
import { useLatest } from "../agent/use-latest";
import { messageSigner, type WalletProvider } from "../agent/ryvo/wallet-signer";
import { useAgentWallet } from "../agent/agent-wallet";
import { useRyvoChannel } from "../agent/ryvo/use-channel";

const GREETING = "What are we trading today, anon?";
const SUGGESTIONS = ["What paid me this week?", "How is my portfolio doing?", "Should I buy more ZEC?"];
/** The least a single deposit into the agent can be, in dollars. */
const MIN_DEPOSIT = 5;
const UNFUNDED = "Fund me with USDC to get started: open the menu and tap Fund.";

type Shown = { id: number; from: "agent" | "user"; text: string; attachments?: Attachment[] };
const shown = (m: StoredMessage): Shown => ({
  id: m.id,
  from: m.role,
  text: m.text,
  ...(m.attachments ? { attachments: m.attachments } : {}),
});

/** A USDC amount as the transfer API takes it: up to six decimals, no trailing zeros. */
const usdcAmount = (n: number) => n.toFixed(6).replace(/\.?0+$/, "");
/** Waits for a send to confirm; a transfer into the agent's wallet must land before the channel can draw on it. */
async function waitConfirmed(signature: string, token: string | null, ms = 60000): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const { data } = await mobileFetch<{ status: "pending" | "confirmed" | "failed"; error?: string }>(
      "transaction",
      { signature },
      token,
    );
    if (data.status === "confirmed") return;
    if (data.status === "failed") throw new Error(data.error || "The transfer failed.");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("The transfer is taking longer than usual. Try again in a moment.");
}

/**
 * The Agent tab: one conversation on screen, the rest in the side menu with
 * the agent's balance and Fund. Opening the app starts a new conversation.
 * The agent's memory and every conversation stay on this device, sealed
 * under the user's wallet key; its replies are bought from Ryvo, prepaid
 * from the USDC the user funds it with.
 */
export function AgentScreen({
  hidden,
  cashUsd,
}: {
  hidden: boolean;
  /** The wallet's cash, which funding draws on. */
  cashUsd: number;
}) {
  const { user, getAccessToken } = usePrivy();
  const agent = useAgentWallet();
  const channel = useRyvoChannel(agent);
  const actions = useChainActions();
  const wallets = useMobile<{ address: string; primary: boolean }[]>("wallets", {}, Boolean(user), 60000);
  const primary = wallets.data?.data.find((w) => w.primary)?.address ?? wallets.data?.data[0]?.address ?? null;
  const owner = primary;
  const funded = channel.view?.state === "open";

  // USDC in the agent's wallet but not in the channel: a funding that
  // stopped halfway, or a refund on its way back. It counts as the agent's.
  const [idle, setIdle] = useState(0);
  const idleRef = useLatest(agent.idleUsdc);
  const refreshIdle = useCallback(() => idleRef.current().then(setIdle).catch(() => undefined), [idleRef]);
  useEffect(() => {
    void refreshIdle();
  }, [agent.address, refreshIdle]);
  const balance = (funded ? channel.view?.availableUsdc ?? 0 : 0) + idle;

  // The keyboard covers the bottom of the window and nothing resizes for it
  // here, so the screen lifts its own bottom edge by however much it overlaps.
  const root = useRef<View>(null);
  const list = useRef<ScrollView>(null);
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

  // The agent's identity opens with one signature from the user's wallet.
  const embedded = useEmbeddedSolanaWallet();
  const signerAccount = primary ? (embedded.wallets ?? []).find((w) => w.address === primary) : undefined;
  const signerRef = useLatest(signerAccount);
  const signerAddress = signerAccount?.address ?? null;
  const [identity, setIdentity] = useState<"locked" | "unlocking" | "open" | "failed">("locked");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!owner || !signerAddress) {
      lockIdentity();
      setIdentity("locked");
      return;
    }
    if (isUnlocked(owner)) {
      setIdentity("open");
      return;
    }
    let cancelled = false;
    setIdentity("unlocking");
    const sign = messageSigner(owner, async () => {
      const account = signerRef.current;
      if (!account) throw new Error("Your wallet is still being prepared.");
      return (await account.getProvider()) as unknown as WalletProvider;
    });
    unlockIdentity(owner, sign)
      .then(() => !cancelled && setIdentity("open"))
      .catch(() => !cancelled && setIdentity("failed"));
    return () => {
      cancelled = true;
    };
  }, [owner, signerAddress, attempt, signerRef]);

  // Conversations. `conversationId` is null for the new one on screen until
  // its first message saves it.
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Shown[]>([]);
  const history = useRef<StoredMessage[]>([]);
  const localId = useRef(-1);
  const reloadConversations = useCallback(async () => {
    if (!owner || identity !== "open") return;
    setConversations(await listConversations(owner).catch(() => []));
  }, [owner, identity]);
  useEffect(() => {
    void reloadConversations();
  }, [reloadConversations]);

  const [drawer, setDrawer] = useState(false);
  // The side menu shows either the conversations or, after Fund, the fund view.
  const [fundView, setFundView] = useState(false);
  const [attachSheet, setAttachSheet] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState<"fund" | "withdraw" | null>(null);

  const closeDrawer = () => {
    setDrawer(false);
    setFundView(false);
  };
  const openConversation = async (id: string) => {
    setDrawer(false);
    if (!owner) return;
    const stored = await listMessages(owner, id).catch(() => []);
    history.current = stored;
    setMessages(stored.map(shown));
    setConversationId(id);
  };
  const startNew = () => {
    setDrawer(false);
    setConversationId(null);
    history.current = [];
    setMessages([]);
    setDraft("");
    setPending([]);
  };

  // Speaking fills the draft: what was typed stays, what is said follows it.
  const voiceBase = useRef("");
  const voice = useVoiceInput((text) => setDraft(voiceBase.current + text));
  const toggleVoice = () => {
    if (!voice.listening) voiceBase.current = draft.trim() ? `${draft.trim()} ` : "";
    void voice.toggle();
  };

  const agentSays = (text: string) => setMessages((all) => [...all, { id: localId.current--, from: "agent", text }]);

  const send = async (text: string) => {
    const clean = text.trim();
    const attachments = pending;
    if ((!clean && !attachments.length) || typing) return;
    if (!owner) {
      showToast("Your wallet is still being prepared. Try again in a moment.");
      return;
    }
    if (identity !== "open") {
      showToast(identity === "failed" ? "Tap to unlock your agent first." : "Unlocking your agent…");
      return;
    }
    setDraft("");
    setPending([]);
    let id = conversationId;
    try {
      if (!id) {
        const created = await createConversation(owner, clean || attachments[0]?.name || "New conversation");
        id = created.id;
        setConversationId(id);
      }
    } catch {
      showToast("Couldn't start the conversation. Try again.");
      return;
    }
    const mine = await addMessage(owner, id, "user", clean, null, attachments.map(storedAttachment));
    setMessages((all) => [...all, shown(mine)]);
    void touchConversation(id).then(reloadConversations);
    if (!funded) {
      agentSays(UNFUNDED);
      return;
    }
    setTyping(true);
    try {
      const token = user ? await getAccessToken() : null;
      const result = await runTurn({
        owner,
        token,
        text: clean || "(the user sent an attachment)",
        attachments,
        history: history.current,
        // A lookup that has not answered in 8 s is left out of the reply
        // rather than holding it up.
        fetch: (async (resource: string, params: Record<string, string> = {}) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          try {
            return await mobileFetch(resource, params, token, controller.signal);
          } finally {
            clearTimeout(timer);
          }
        }) as Fetcher,
        write: channel.write,
        onRemembered: () => showToast("Noted for next time"),
      });
      const reply = await addMessage(owner, id, "agent", result.reply, result.costMicro);
      history.current = [...history.current, mine, reply].slice(-80);
      setMessages((all) => [...all, shown(reply)]);
      void touchConversation(id).then(reloadConversations);
    } catch (e) {
      agentSays(`I couldn't answer that: ${e instanceof Error ? e.message : "something went wrong."}`);
    } finally {
      setTyping(false);
    }
  };

  const attach = async (pick: () => Promise<PendingAttachment | null>) => {
    setAttachSheet(false);
    try {
      const picked = await pick();
      if (picked) setPending((all) => [...all, picked].slice(0, 4));
    } catch {
      showToast("Couldn't attach that. Try again.");
    }
  };

  /** Moves the agent wallet's idle USDC back to the user's wallet, waiting for at least `expect` to be there first. */
  const sweep = useCallback(
    async (expect: number) => {
      if (!agent.address || !primary) throw new Error("Your wallet is still being prepared.");
      let have = 0;
      const until = Date.now() + 45000;
      do {
        have = await idleRef.current().catch(() => 0);
        if (have + 0.01 >= expect && have > 0) break;
        await new Promise((r) => setTimeout(r, 2000));
      } while (Date.now() < until);
      if (have <= 0) return 0;
      if (have + 0.01 < expect) throw new Error("The refund hasn't landed yet. Try Withdraw again in a moment.");
      await actions.transfer({ mint: USDC, to: primary, amount: usdcAmount(have), wallet: agent.address });
      return have;
    },
    [agent.address, primary, idleRef, actions],
  );

  const fund = async (value: number) => {
    setBusy("fund");
    try {
      // The agent's wallet first (made now if it is the first time), then
      // USDC from the user's wallet into it, then into the channel. USDC
      // already in the agent's wallet is used before any leaves the user's.
      const address = await agent.ensure();
      const have = await idleRef.current().catch(() => 0);
      const need = value - have;
      if (need > 0.000001) {
        const token = user ? await getAccessToken() : null;
        const signature = await actions.transfer({ mint: USDC, to: address, amount: usdcAmount(need) });
        await waitConfirmed(signature, token);
      }
      const next = await channel.fund(value);
      setFundView(false);
      showToast(`Agent funded: ${usd(next.availableUsdc)} available`);
    } catch (e) {
      closeDrawer();
      agentSays(`Funding stopped: ${e instanceof Error ? e.message : "something went wrong."}`);
    } finally {
      await refreshIdle();
      setBusy(null);
    }
  };

  const withdraw = async () => {
    setBusy("withdraw");
    try {
      // Closing returns the unspent deposit to the agent's wallet; from
      // there it goes back to the user's, with anything else idle there.
      const refund = funded ? channel.view?.availableUsdc ?? 0 : 0;
      if (funded) {
        const next = await channel.withdraw();
        if (next.closeDeadline) {
          setFundView(false);
          showToast("Withdrawal started. Funds return within 48 hours.");
          return;
        }
      }
      const moved = await sweep(refund);
      setFundView(false);
      showToast(moved > 0 ? `${usd(moved)} returned to your wallet` : "Nothing to withdraw");
    } catch (e) {
      closeDrawer();
      agentSays(`Withdrawal stopped: ${e instanceof Error ? e.message : "something went wrong."}`);
    } finally {
      await refreshIdle();
      await channel.refresh().catch(() => undefined);
      setBusy(null);
    }
  };

  const title = conversationId ? conversations.find((c) => c.id === conversationId)?.title : undefined;

  return (
    <View ref={root} collapsable={false} style={{ flex: 1, paddingBottom: lift }}>
      <View style={s.header}>
        <IconButton name="menu" label="Conversations and agent balance" quiet onPress={() => setDrawer(true)} />
        <Text numberOfLines={1} style={s.headerTitle}>
          {identity === "unlocking" ? "Unlocking…" : title ?? ""}
        </Text>
        {/* Balances the menu button so the title stays centred. */}
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        ref={list}
        style={{ flex: 1 }}
        contentContainerStyle={s.thread}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={{ gap: 10 }}>
            <View style={[s.bubble, s.theirs]}>
              <Text style={s.body}>{GREETING}</Text>
            </View>
            {SUGGESTIONS.map((text) => (
              <Pressable
                key={text}
                accessibilityRole="button"
                onPress={() => void send(text)}
                style={({ pressed }) => [s.suggestion, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={s.suggestionText}>{text}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {messages.map((message) => (
          <View key={message.id} style={[s.bubble, message.from === "user" ? s.mine : s.theirs]}>
            {message.attachments?.map((a, i) =>
              a.kind === "image" && a.uri ? (
                <Image key={i} source={{ uri: a.uri }} style={s.image} resizeMode="cover" />
              ) : (
                <View key={i} style={s.fileRow}>
                  <Icon name="file" size={16} color={colors.muted} />
                  <Text numberOfLines={1} style={s.fileName}>
                    {a.name}
                  </Text>
                </View>
              ),
            )}
            {message.text ? <Text style={s.body}>{message.text}</Text> : null}
          </View>
        ))}
        {identity === "failed" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setAttempt((n) => n + 1)}
            style={({ pressed }) => [s.bubble, s.theirs, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={s.body}>Tap to unlock your agent.</Text>
          </Pressable>
        ) : null}
        {typing ? (
          <View style={[s.bubble, s.theirs]}>
            <Text style={[s.body, { color: colors.muted }]}>…</Text>
          </View>
        ) : null}
      </ScrollView>

      <AgentComposer
        draft={draft}
        onChangeDraft={setDraft}
        onSend={() => void send(draft)}
        busy={typing}
        attachments={pending}
        onRemoveAttachment={(i) => setPending((all) => all.filter((_a, j) => j !== i))}
        onAttach={() => setAttachSheet(true)}
        listening={voice.listening}
        onToggleVoice={toggleVoice}
      />

      <AgentDrawer
        visible={drawer}
        onClose={() => !busy && closeDrawer()}
        balanceUsd={balance}
        hidden={hidden}
        onFund={() => {
          setFundView(true);
          void channel.loadLimits();
          void refreshIdle();
        }}
        conversations={conversations}
        currentId={conversationId}
        onSelect={(id) => void openConversation(id)}
        onNew={startNew}
        panel={
          fundView ? (
            <AgentFundPanel
              onBack={() => setFundView(false)}
              balanceUsd={balance}
              cashUsd={cashUsd}
              maxUsd={Math.max(0, Math.min(cashUsd + idle, channel.limits.maxUsdc - (funded ? channel.view?.depositUsdc ?? 0 : 0)))}
              minUsd={Math.max(MIN_DEPOSIT, channel.limits.minUsdc)}
              busy={busy}
              onFund={(v) => void fund(v)}
              onWithdraw={() => void withdraw()}
            />
          ) : null
        }
      />

      <OmenSheet visible={attachSheet} onClose={() => setAttachSheet(false)} title="Attach">
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {(
            [
              { label: "Photo", icon: "image", pick: pickImage },
              { label: "File", icon: "file", pick: pickFile },
            ] as const
          ).map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              onPress={() => void attach(option.pick)}
              style={({ pressed }) => [s.attachRow, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Icon name={option.icon} size={20} color={colors.ice} />
              <Text style={s.attachText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </OmenSheet>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: space.edge - 8,
    paddingTop: space.sm,
    paddingBottom: 4,
  },
  headerTitle: { flex: 1, textAlign: "center", fontFamily: chatFonts.medium, fontSize: 15, color: colors.muted },
  thread: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingHorizontal: space.edge,
    paddingVertical: 12,
    gap: 10,
  },
  bubble: { maxWidth: "86%", paddingHorizontal: 15, paddingVertical: 11, borderRadius: 20, gap: 8 },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardLine,
    borderBottomLeftRadius: 6,
  },
  mine: { alignSelf: "flex-end", backgroundColor: colors.surfaceRaised, borderBottomRightRadius: 6 },
  body: { fontFamily: chatFonts.regular, fontSize: 16, lineHeight: 24, color: colors.ice },
  image: { width: 200, height: 150, borderRadius: 12 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 220 },
  fileName: { flexShrink: 1, fontFamily: chatFonts.regular, fontSize: 14, color: colors.ice },
  suggestion: { alignSelf: "flex-start", minHeight: 36, justifyContent: "center", paddingHorizontal: 4 },
  suggestionText: { fontFamily: chatFonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  attachRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 8 },
  attachText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ice },
});
