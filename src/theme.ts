export const fonts = {
  regular: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  bold: "SpaceGrotesk_600SemiBold",
  display: "Inter_600SemiBold",
};

// Neutral surfaces and cobalt controls adapted from the supplied trading kit.
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
  cobalt: "#1119B8",
  ice: "#F5F5F5",
  mist: "#C3C4C8",
  muted: "#96989F",
  line: "#262626",
  focus: "#8187FF",
  success: "#46D987",
  // Cash: Cash App's green, brighter than the P&L green.
  cash: "#00D632",
  error: "#FF6A72",
  buttonTop: "#646CDA",
  buttonSide: "#3038C7",
  buttonBottom: "#080D68",
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
