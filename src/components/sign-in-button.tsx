import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import Svg, { Path } from "react-native-svg";
import { loginButtonLabel, type LoginProvider } from "../lib/auth";

function ProviderIcon({ provider }: { provider: LoginProvider }) {
  if (provider === "wallet") return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinejoin="round"
        d="M3.5 7.5A2 2 0 0 1 5.5 5.5h11a2 2 0 0 1 2 2v1H5.5a2 2 0 0 0 0 4H20.5v5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10Z"
      />
      <Path fill="none" stroke="#FFFFFF" strokeWidth={1.8} d="M5.5 8.5H20.5v4H5.5a2 2 0 0 1 0-4Z" />
      <Path fill="#FFFFFF" d="M16.5 10.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
    </Svg>
  );
  if (provider === "seeker") return (
    <Text accessibilityElementsHidden style={{ color: "#FFFFFF", fontSize: 25, fontWeight: "500", lineHeight: 28 }}>S</Text>
  );
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48" accessibilityElementsHidden>
      <Path
        fill="#4285F4"
        d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.42h11a9.4 9.4 0 0 1-4.08 6.17v5.13h6.61c3.87-3.56 6.08-8.81 6.08-14.8Z"
      />
      <Path
        fill="#34A853"
        d="M24 44c5.5 0 10.11-1.82 13.48-4.94l-6.61-5.13c-1.83 1.23-4.18 1.97-6.87 1.97-5.31 0-9.83-3.58-11.45-8.41H5.73v5.3A20 20 0 0 0 24 44Z"
      />
      <Path
        fill="#FBBC05"
        d="M12.55 27.49a12 12 0 0 1 0-6.98v-5.3H5.73a20 20 0 0 0 0 17.58l6.82-5.3Z"
      />
      <Path
        fill="#EA4335"
        d="M24 12.1c3 0 5.67 1.03 7.8 3.06l5.84-5.84A19.64 19.64 0 0 0 24 4 20 20 0 0 0 5.73 15.21l6.82 5.3C14.17 15.68 18.69 12.1 24 12.1Z"
      />
    </Svg>
  );
}
export function SignInButton({
  provider,
  onPress,
  busy,
  disabled,
}: {
  provider: LoginProvider;
  onPress: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const label = loginButtonLabel(provider);
  return (
    <Pressable
      testID={provider + "-sign-in"}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        provider !== "google" && s.wallet,
        disabled && s.disabled,
        pressed && s.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator
          color={provider === "google" ? "#1F1F1F" : "#FFFFFF"}
        />
      ) : (
        <>
          <ProviderIcon provider={provider} />
          <Text style={[s.label, provider !== "google" && s.walletLabel]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
const s = StyleSheet.create({
  button: {
    height: 58,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  wallet: { backgroundColor: "rgba(17,25,184,0.22)", borderColor: "#69708E" },
  label: { color: "#1F1F1F", fontSize: 16, fontWeight: "600" },
  walletLabel: { color: "#FFFFFF" },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
});
