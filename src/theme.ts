export const fonts = {
  regular: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  bold: "SpaceGrotesk_600SemiBold",
  display: "Inter_600SemiBold",
};

// OMEN's blues, as on the landing page (getomen.xyz): a royal-blue ground
// (#030AB2 there, deepened here so figures stay readable for hours), navy
// surfaces (#13176A), periwinkle edges (#757ACD, #8187FF) and ice text and
// buttons (#F2F3FF, #D9E1FF). Green and red stay for gains and losses.
export const tradingColors = {
  canvas: "#0B0F66",
  // Cards: a step above the ground, edged in a soft periwinkle line.
  card: "#11167E",
  cardLine: "#2A30A8",
  surface: "#151B8C",
  surfaceRaised: "#1D24A6",
  /** A selected pill, tab or toggle: the brand's royal blue, lit. */
  selected: "#2A33C9",
  ice: "#F2F3FF",
  mist: "#D0D3F4",
  muted: "#A3A8E6",
  line: "#2C32A6",
  focus: "#D9E1FF",
  /** The brand's periwinkle, for an accent that is not a link. */
  accent: "#8187FF",
  success: "#4BE29A",
  // Links in the agent's replies: a ticker that opens its page, a handle that opens X.
  link: "#B4BBFF",
  // Cash: Cash App's green, brighter than the P&L green.
  cash: "#00D632",
  error: "#FF8A90",
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
