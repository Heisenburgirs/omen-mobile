import React from "react";
import type { StyleProp, ViewStyle } from "react-native";

// react-native-webview has no web build. In a browser the same page is an
// iframe; only the props the app passes are honoured, the native-only ones
// (window and navigation guards) are accepted and ignored.
export function WebView({
  source,
  onLoadEnd,
  onError,
}: {
  source: { uri: string };
  style?: StyleProp<ViewStyle>;
  onLoadEnd?: () => void;
  onError?: () => void;
  [native: string]: unknown;
}) {
  return (
    <iframe
      src={source.uri}
      title="Page"
      onLoad={() => onLoadEnd?.()}
      onError={() => onError?.()}
      style={{ flex: 1, width: "100%", height: "100%", border: 0 }}
    />
  );
}
