import React, { useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mark } from "./ui";
import { colors, fonts } from "../theme";

function LoadingDots() {
  const reduceMotion = useReducedMotion();
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    const update = (active: boolean) => {
      animation?.stop();
      dots.forEach(dot => dot.setValue(0));
      if (!active || reduceMotion) return;
      animation = Animated.loop(Animated.stagger(100, dots.map(dot =>
        Animated.sequence([
          Animated.timing(dot, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }),
          Animated.timing(dot, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }),
          Animated.delay(180),
        ]),
      )));
      animation.start();
    };
    update(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", state => update(state === "active"));
    return () => { animation?.stop(); subscription.remove(); };
  }, [dots, reduceMotion]);

  return (
    <View style={s.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {dots.map((dot, index) => <Animated.View key={index} style={[s.dot, {
        opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
        transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
      }]} />)}
    </View>
  );
}

export function AccountSetupScreen({ failed = false, onRetry, onSignOut }: {
  failed?: boolean;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <SafeAreaView style={s.setup} testID="account-setup-screen">
      <View style={s.center}>
        <Mark prominent symbolOnly />
        <Text style={s.label} accessibilityRole="header" accessibilityLiveRegion="polite">
          {failed ? "Let’s try again" : "Setting up account"}
        </Text>
        {failed ? (
          <View style={s.recovery}>
            <Pressable onPress={onRetry} accessibilityRole="button" style={s.action}>
              <Text style={s.retry}>Try again</Text>
            </Pressable>
            <Pressable onPress={onSignOut} accessibilityRole="button" style={s.action}>
              <Text style={s.signOut}>Sign out</Text>
            </Pressable>
          </View>
        ) : (
          <View accessibilityRole="progressbar" accessibilityLabel="Setting up account" accessibilityState={{ busy: true }}>
            <LoadingDots />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// Mount and lay out the home screen underneath setup before revealing it.
// Account readiness drives the transition; no extra loading delay is added.
export function AccountSetupTransition({ ready, setup, children }: {
  ready: boolean;
  setup: React.ReactNode;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [covered, setCovered] = useState(!ready);
  const [laidOut, setLaidOut] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!ready) {
      progress.setValue(0);
      setCovered(true);
      setLaidOut(false);
      setRevealed(false);
      return;
    }
    if (!laidOut) return;
    const transition = Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    transition.start(({ finished }) => {
      if (finished) { setCovered(false); setRevealed(true); }
    });
    return () => transition.stop();
  }, [ready, laidOut, reduceMotion, progress]);

  return (
    <View style={s.container}>
      {ready && <Animated.View style={[s.container, {
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }]} onLayout={() => setLaidOut(true)} pointerEvents={revealed ? "auto" : "none"}
        accessibilityElementsHidden={!revealed} importantForAccessibility={revealed ? "auto" : "no-hide-descendants"}>
        {children}
      </Animated.View>}
      {(!ready || covered) && <Animated.View style={[StyleSheet.absoluteFill, {
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
      }]} pointerEvents={ready ? "none" : "auto"}
        accessibilityElementsHidden={ready} importantForAccessibility={ready ? "no-hide-descendants" : "auto"}>
        {setup}
      </Animated.View>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  setup: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center", padding: 24 },
  center: { alignItems: "center" },
  label: { fontFamily: fonts.medium, fontSize: 18, lineHeight: 26, color: colors.ice, marginTop: 20, textAlign: "center" },
  dots: { flexDirection: "row", gap: 8, height: 24, marginTop: 18, alignItems: "center" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.mist },
  recovery: { flexDirection: "row", gap: 12, marginTop: 16 },
  action: { minHeight: 44, minWidth: 80, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  retry: { fontFamily: fonts.medium, fontSize: 14, color: colors.ice },
  signOut: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
});