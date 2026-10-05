import type { ViewStyle } from "react-native";

// The app is flat (Cash App's manner): controls carry no sheen and no lit
// edge. These remain as no-ops for the controls that used to have them.
export function Gloss(_: { light?: boolean }) {
  return null;
}
export const raised: ViewStyle = { overflow: "hidden" };
