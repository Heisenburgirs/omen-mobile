export const fonts = {
  regular: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  bold: "SpaceGrotesk_600SemiBold",
  display: "Inter_600SemiBold",
};

// Neutral surfaces and neutral controls: the app has no accent hue. A
// selected control is a lighter grey, focus is off-white, and colour is
// kept for meaning (gains, losses, cash).
export const tradingColors = {
  // Pure neutrals: no blue bias anywhere in the surfaces, so cards read as
  // a slightly lighter black rather than navy on a calibrated screen.
  canvas: "#070707",
  // Cards: about one percent above the canvas, defined by a hairline
  // border rather than a grey fill.
  card: "#0C0C0C",
  cardLine: "#1A1A1A",
  surface: "#121212",
  surfaceRaised: "#1C1C1C",
  /** A selected pill, tab or toggle. */
  selected: "#2A2A2A",
  ice: "#F5F5F5",
  mist: "#C3C4C8",
  muted: "#96989F",
  line: "#262626",
  focus: "#E6E6E6",
  success: "#46D987",
  // Links in the agent's replies: a ticker that opens its page, a handle that opens X.
  link: "#5B9DFF",
  // Cash: Cash App's green, brighter than the P&L green.
  cash: "#00D632",
  error: "#FF6A72",
};
// The original navy palette is retired: every screen (welcome, sign-in,
// wallet, account setup, launch) shares the neutral trading palette, so the
// app never shows two designs. Kept as an alias so older imports keep working.
export const colors = tradingColors;
export const tradingFonts = {
  regular: "OmenUI_400Regular",
  medium: "OmenUI_500Medium",
  bold: "OmenUI_600SemiBold",
  display: "OmenUI_600SemiBold",
  // Inter for figures: its plain zero reads better than the UI face's.
  numeric: "Inter_400Regular",
  numericMedium: "Inter_500Medium",
  numericBold: "Inter_600SemiBold",
};
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  edge: 24,
  section: 24,
  xl: 32,
};
export const radius = { small: 8, field: 24, panel: 14, pill: 999 };

/**
 * The agent conversation: Inter, whose plain figures and open shapes keep
 * long replies easy to read next to the trading UI.
 */
export const chatFonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
};
