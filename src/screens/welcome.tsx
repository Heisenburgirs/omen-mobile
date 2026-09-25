import React, { useEffect } from "react";
import {
  AccessibilityInfo,
  AppState,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Mark, ui } from "../components/ui";
import { SignInButton } from "../components/sign-in-button";
import { loginProviders, type LoginProvider } from "../lib/auth";
import { showErrorToast } from "../lib/toast";
import { colors, fonts } from "../theme";

function FloatingMark() {
  const offset = useSharedValue(0);
  const reducedMotionAtLaunch = useReducedMotion();

  useEffect(() => {
    let reducedMotion = reducedMotionAtLaunch;
    let active = AppState.currentState === "active";
    const update = () => {
      cancelAnimation(offset);
      offset.value = 0;
      if (active && !reducedMotion) {
        offset.value = withRepeat(
          withTiming(-12, {
            duration: 3200,
            easing: Easing.inOut(Easing.sin),
            reduceMotion: ReduceMotion.System,
          }),
          -1,
          true,
          undefined,
          ReduceMotion.System,
        );
      }
    };
    const appState = AppState.addEventListener("change", (state) => {
      active = state === "active";
      update();
    });
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        reducedMotion = enabled;
        update();
      },
    );
    update();
    return () => {
      appState.remove();
      motion.remove();
      cancelAnimation(offset);
    };
  }, [offset, reducedMotionAtLaunch]);

  const floatingStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <Animated.View style={floatingStyle}>
      <Mark prominent symbolOnly />
    </Animated.View>
  );
}

type Props = {
  onSignIn?: (provider: LoginProvider) => Promise<void>;
  pendingProvider?: LoginProvider | null;
  setupMessage?: string;
  onCancel?: () => void;
  canCancel?: boolean;
  /** Web: open the market without an account first. */
  onBrowse?: () => void;
};

export function WelcomeScreen({
  onSignIn,
  pendingProvider,
  setupMessage,
  onCancel,
  canCancel,
  onBrowse,
}: Props) {
  const disabled = Boolean(pendingProvider);
  const providers = loginProviders(Platform.OS, Platform.OS === "android" ? Platform.constants.Model : undefined);
  const signIn = (provider: LoginProvider) => {
    if (setupMessage) {
      showErrorToast("Sign-in isn’t configured for this build yet.");
      return;
    }
    void onSignIn?.(provider);
  };

  return (
    <View style={ui.screen}>
      <Image
        source={require("../../assets/eclipse.webp")}
        style={s.art}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        colors={["rgba(6,9,40,0)", "rgba(6,9,40,0.3)", colors.canvas]}
        locations={[0, 0.5, 1]}
        style={s.shade}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.content}>
          <FloatingMark />
          <View style={s.intro}>
            <Text accessibilityRole="header" style={s.title}>
              OMEN
            </Text>
            <Text style={s.subtitle}>
              Find signals. Trade assets.{"\n"}Put dividends to work.
            </Text>
          </View>
          <View style={s.actions}>
            {providers.map(provider => <SignInButton key={provider}
              provider={provider} busy={pendingProvider === provider}
              disabled={disabled} onPress={() => signIn(provider)} />)}
            {canCancel && <Pressable onPress={onCancel} accessibilityRole="button" style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.mist, fontFamily: fonts.medium }}>Cancel</Text>
            </Pressable>}
            {/* Stays in the layout while a sign-in starts (hidden and inert),
                so the buttons above it do not jump. */}
            {onBrowse ? (
              <Pressable
                onPress={onBrowse}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityElementsHidden={disabled}
                style={{
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: disabled ? 0 : 1,
                }}
              >
                <Text style={{ color: colors.mist, fontFamily: fonts.medium }}>Look around first</Text>
              </Pressable>
            ) : null}
            <Text style={s.footer}>
              By signing up you agree to our{"\n"}Terms of Service and Privacy
              Policy.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  art: {
    position: "absolute",
    top: 0,
    right: -205,
    width: 720,
    height: 710,
    opacity: 0.9,
  },
  shade: { position: "absolute", top: 0, left: 0, right: 0, height: 710 },
  content: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 36,
    paddingBottom: 20,
  },
  // Takes whatever height is left between the mark and the buttons, so the
  // screen never scrolls; on tall phones the copy sits lower, on short ones
  // closer to the mark.
  intro: { flex: 1, justifyContent: "flex-end", paddingTop: 24, paddingBottom: 28 },
  title: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 54,
    letterSpacing: -2,
    color: colors.ice,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.mist,
    marginTop: 12,
  },
  actions: { gap: 14 },
  footer: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.mist,
    textAlign: "center",
    marginTop: 14,
  },
});
