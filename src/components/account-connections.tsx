import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLinkWithOAuth, useUnlinkOAuth, usePrivy } from "../lib/privy";
import { useQueryClient } from "@tanstack/react-query";
import {
  authErrorCode,
  connectionErrorMessage,
  loginErrorMessage,
} from "../lib/auth";
import { tradingColors as colors, tradingFonts as fonts } from "../theme";
import { showErrorToast, showToast } from "../lib/toast";
import { m } from "./market-ui";

type Provider = "google" | "twitter";
// Only social sign-ins can be linked here. Wallets are login identities
// handled on the welcome screen and are never connected from Settings.
const providers: { id: Provider; name: string; account: string }[] = [
  { id: "google", name: "Google", account: "google_oauth" },
  { id: "twitter", name: "X", account: "twitter_oauth" },
];

export function AccountConnections({
  onBusyChange,
}: {
  onBusyChange: (busy: boolean) => void;
}) {
  const { user, refreshUser } = usePrivy();
  const { link } = useLinkWithOAuth();
  const { unlinkOAuth } = useUnlinkOAuth();
  // The profile follows the X link (handle, name, picture), so the app's
  // own queries reload once a link changes.
  const client = useQueryClient();
  const [pending, setPending] = useState<Provider | null>(null);
  const working = useRef(false);
  const attempt = useRef(0);
  const alive = useRef(true);
  const userId = useRef(user?.id);
  userId.current = user?.id;
  const accounts = user?.linked_accounts || [];

  useEffect(() => {
    onBusyChange(Boolean(pending));
  }, [pending, onBusyChange]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      attempt.current++;
      onBusyChange(false);
    };
  }, [onBusyChange]);

  const current = (id: number, owner: string) =>
    alive.current && attempt.current === id && userId.current === owner;
  // Privy's user refresh has been seen to never settle after the browser
  // hands back; the linked list already updates through the provider, so
  // the refresh gets a few seconds and the row moves on without it.
  const refresh = () =>
    Promise.race([
      refreshUser().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 4000)),
    ]);

  const connect = async (provider: Provider, name: string) => {
    if (working.current || !user) return;
    working.current = true;
    const owner = user.id;
    const id = ++attempt.current;
    setPending(provider);
    try {
      // Linking attaches the identity to the current account. Never call a
      // login hook here: connecting must not switch the user's account.
      // The provider's sign-in is not always reachable (X is off for the
      // app until its keys are set in the Privy dashboard); the flow ends
      // itself after a minute instead of spinning without end.
      const linked = await Promise.race([
        link({ provider, redirectUri: "/" }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject({ code: "link_timeout" }), 60000),
        ),
      ]);
      if (!linked || !current(id, owner)) return;
      if (linked.id !== owner) throw { code: "account_changed" };
      await refresh();
      void client.invalidateQueries({ queryKey: ["mobile"] });
      if (current(id, owner))
        showToast(name + " connected");
    } catch (cause) {
      if (current(id, owner)) {
        const code = authErrorCode(cause) || "";
        if (code === "link_timeout") {
          // A late answer from the browser must not act on this attempt.
          attempt.current++;
          showErrorToast(name + " sign-in did not finish. Please try again.");
          working.current = false;
          setPending(null);
          return;
        }
        const message =
          provider === "google" &&
          !/already|linked|associated|account_exists/.test(code)
            ? loginErrorMessage(cause, "google")
            : connectionErrorMessage(cause);
        if (message) showErrorToast(message);
      }
    } finally {
      // The row always comes back, whatever happened to the attempt.
      working.current = false;
      if (alive.current) setPending(null);
    }
  };

  // Unlinking X hands the name, handle and picture back to the user; Privy
  // refuses when X is the only way left to sign in.
  const disconnect = async (subject: string) => {
    if (working.current || !user) return;
    working.current = true;
    const owner = user.id;
    const id = ++attempt.current;
    setPending("twitter");
    try {
      await unlinkOAuth({ provider: "twitter", subject });
      await refresh();
      void client.invalidateQueries({ queryKey: ["mobile"] });
      if (current(id, owner)) showToast("X unlinked");
    } catch (cause) {
      if (current(id, owner))
        showErrorToast(connectionErrorMessage(cause) || "Could not unlink X. Keep another sign-in first.");
    } finally {
      working.current = false;
      if (alive.current) setPending(null);
    }
  };

  return (
    <View style={s.section}>
      <Text style={s.title}>Sign-in methods</Text>
      <Text style={m.muted}>Link another sign-in to this account.</Text>
      {providers.map(({ id, name, account }) => {
        const entry = accounts.find((e) => e.type === account) as any;
        const linked = Boolean(entry);
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={linked ? name + " connected" : "Connect " + name}
            accessibilityState={{ disabled: linked || Boolean(pending) }}
            disabled={linked || Boolean(pending)}
            onPress={() => void connect(id, name)}
            style={s.row}
          >
            <Text style={s.name}>{name}</Text>
            {pending === id ? (
              <ActivityIndicator color={colors.mist} />
            ) : linked && id === "twitter" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Unlink X"
                disabled={Boolean(pending)}
                onPress={() => void disconnect(String(entry?.subject || ""))}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <Text style={m.muted}>Unlink</Text>
              </Pressable>
            ) : (
              <Text style={m.muted}>{linked ? "Connected" : "Connect  +"}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  section: { gap: 6 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.ice },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 52,
    paddingVertical: 8,
  },
  name: { fontFamily: fonts.medium, fontSize: 15, color: colors.ice },
});
