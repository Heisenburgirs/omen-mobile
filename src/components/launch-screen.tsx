import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useReducedMotion } from "react-native-reanimated";
import { colors } from "../theme";

// Match the native splash so startup stays visually continuous while JS loads.
export function LaunchScreen({ onReady }: { onReady?: () => void }) {
  return (
    <View style={s.splash} testID="launch-screen">
      <Image
        source={require("../../assets/omen-mark.png")}
        style={s.logo}
        resizeMode="contain"
        accessibilityLabel="OMEN"
        accessibilityIgnoresInvertColors
        onLoadEnd={onReady}
      />
    </View>
  );
}

// Reveal a resolved destination only after it has laid out and the logo is ready.
export function LaunchReady({ children }: { children: React.ReactNode }) {
  const [laidOut, setLaidOut] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const [covered, setCovered] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!laidOut || !logoReady) return;
    SplashScreen.hide();
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: true,
    });
    fade.start(({ finished }) => {
      if (finished) setCovered(false);
    });
    return () => fade.stop();
  }, [laidOut, logoReady, opacity, reduceMotion]);

  return (
    <View style={s.container} onLayout={() => setLaidOut(true)}>
      {children}
      {covered ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, { opacity }]}
        >
          <LaunchScreen onReady={() => setLogoReady(true)} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  splash: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 240, height: 240 },
});
