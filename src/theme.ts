export const fonts = {
  regular: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  bold: "SpaceGrotesk_600SemiBold",
  display: "Inter_600SemiBold",
};

// A night-navy ground under a blue glow (the brand's blue, as light rather
// than as paint), glassy navy cards with a hairline edge, white figures and
// soft, raised pills for the controls. Green and red stay for gains and
// losses.
export const tradingColors = {
  canvas: "#060A14",
  /** The light at the top of every screen. */
  glow: "#1F5BFF",
  // Cards: a step above the ground, edged in a faint cool line.
  card: "#0D1423",
  cardLine: "#1B2538",
  surface: "#111A2C",
  surfaceRaised: "#18233A",
  /** A selected pill, tab or toggle. */
  selected: "#22335A",
  ice: "#F5F8FF",
  mist: "#C6CFE4",
  muted: "#7E8AA8",
  line: "#1C2740",
  focus: "#9DB8FF",
  /** The brand's blue, for an accent that is not a link. */
  accent: "#3D7BFF",
  success: "#3DDC97",
  // Links in the agent's replies: a ticker that opens its page, a handle that opens X.
  link: "#7FA8FF",
  // Cash: Cash App's green, brighter than the P&L green.
  cash: "#00D632",
  error: "#FF6B78",
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
export const radius = { small: 12, field: 26, panel: 20, pill: 999 };

/**
 * The agent conversation: Inter, whose plain figures and open shapes keep
 * long replies easy to read next to the trading UI.
 */
export const chatFonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
};
