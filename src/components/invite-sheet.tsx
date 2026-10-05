import React from "react";
import { Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { tradingColors as colors, tradingFonts as fonts } from "../theme";
import { inviteMessage, type AgentCredits } from "../agent/credits";
import { useMobile } from "../lib/mobile-api";
import { showToast } from "../lib/toast";
import { m, SkeletonRows } from "./market-ui";
import { OmenSheet } from "./omen-sheet";
import { RaisedButton as Button } from "./raised-button";

/** Inviting a friend: the code, what each side gets, and the ways to pass it on. */
export function InviteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const credits = useMobile<AgentCredits>("agent-credits", {}, visible, 60000);
  const referral = credits.data?.data.referral ?? null;
  const rewards = credits.data?.data.rewards ?? null;
  const dollars = (micro: number) => "$" + (micro / 1e6).toFixed(0);
  const point = (title: string, body: string) => (
    <View key={title} style={{ gap: 2 }}>
      <Text style={[m.text, { fontFamily: fonts.medium, fontSize: 16 }]}>{title}</Text>
      <Text style={[m.muted, { fontSize: 14, lineHeight: 20 }]}>{body}</Text>
    </View>
  );
  return (
    <OmenSheet visible={visible} onClose={onClose} title="Invite friends">
      <View style={{ gap: 18, paddingHorizontal: 24, paddingBottom: 12 }}>
        {!referral || !rewards ? (
          credits.isError ? (
            <Text style={m.muted}>Your invite code could not be loaded. Please try again.</Text>
          ) : (
            <SkeletonRows count={3} plain />
          )
        ) : (
          <>
            <View style={{ alignItems: "center", gap: 4, paddingVertical: 6 }}>
              <Text style={m.label}>Your code</Text>
              <Text style={[m.metric, { fontSize: 40, lineHeight: 48, letterSpacing: 4, color: colors.ice }]}>{referral.code}</Text>
              {referral.uses > 0 ? (
                <Text style={m.muted}>
                  {referral.uses + (referral.uses === 1 ? " friend has" : " friends have") + " joined"}
                </Text>
              ) : null}
            </View>
            {point(
              "Your friend gets " + dollars(rewards.refereeMicro) + " and cheaper trades",
              dollars(rewards.refereeMicro) +
                " of free agent credits, and " +
                Math.round(rewards.feeDiscountBps / 100) +
                "% off trading fees for a month, when they sign up with your code.",
            )}
            {point(
              "You get " + dollars(rewards.referrerMicro) + " for each friend",
              dollars(rewards.referrerMicro) + " of agent credits each time someone joins with your code. The agent spends credits before your own money.",
            )}
            <View style={{ gap: 10 }}>
              <Button
                title="Share invite"
                onPress={() => void Share.share({ message: inviteMessage(referral.code, rewards) }).catch(() => undefined)}
              />
              <Button
                secondary
                title="Copy code"
                onPress={() => void Clipboard.setStringAsync(referral.code).then(() => showToast("Code copied"))}
              />
            </View>
          </>
        )}
      </View>
    </OmenSheet>
  );
}
