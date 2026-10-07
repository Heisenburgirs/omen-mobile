export const fonts = {
  regular: "SpaceGrotesk_400Regular",
  medium: "SpaceGrotesk_500Medium",
  bold: "SpaceGrotesk_600SemiBold",
  display: "Inter_600SemiBold",
};

// Cash App's manner, in the dark (from its 2023 UI file): a black ground,
// flat grey tiles with no edges or shadows, grey pills for the quiet
// actions and one green for the action that moves money. Nothing is
// outlined, nothing shines; size and weight carry the hierarchy.
export const tradingColors = {
  canvas: "#070A14",
  // No tiles: a card is the ground itself, so content sits on black and
  // space does the grouping.
  card: "#070A14",
  cardLine: "#070A14",
  // Pills, chips and fields that sit on a tile or on the ground.
  surface: "#111627",
  surfaceRaised: "#171D31",
  /** A selected pill, tab or toggle. */
  selected: "#1F2846",
  ice: "#FFFFFF",
  // The file's greys: Gray 4 and Gray 3 for secondary text, Gray 2 for an
  // unselected tab or key.
  mist: "#C3C8D6",
  muted: "#8F95A8",
  faint: "#5E6578",
  line: "#1A2034",
  focus: "#8FA6FF",
  /** The one green: the primary action, and cash. */
  /** The brand's blue (the landing page's), for a selected state or an accent that is not money. */
  accent: "#4A64FF",
  success: "#01D651",
  // Links in the agent's replies: a ticker that opens its page, a handle that opens X.
  link: "#B9C4F0",
  cash: "#01D651",
  error: "#FF4F5E",
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
  edge: 20,
  section: 20,
  xl: 32,
};
export const radius = { small: 12, field: 24, panel: 16, pill: 999 };

/**
 * The agent conversation: Inter, whose plain figures and open shapes keep
 * long replies easy to read next to the trading UI.
 */
export const chatFonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
};
