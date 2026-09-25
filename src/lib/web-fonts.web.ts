// The families the native builds embed at build time, loaded at run time in
// a browser. Names match `theme.ts`. The files are copies under assets/fonts:
// required from node_modules, their exported path contains "node_modules",
// which Vercel refuses to deploy, and every number fell back to a serif.
export const webFonts: Record<string, number> = {
  Inter_400Regular: require("../../assets/fonts/Inter_400Regular.ttf"),
  Inter_500Medium: require("../../assets/fonts/Inter_500Medium.ttf"),
  Inter_600SemiBold: require("../../assets/fonts/Inter_600SemiBold.ttf"),
  SpaceGrotesk_400Regular: require("../../assets/fonts/SpaceGrotesk_400Regular.ttf"),
  SpaceGrotesk_500Medium: require("../../assets/fonts/SpaceGrotesk_500Medium.ttf"),
  SpaceGrotesk_600SemiBold: require("../../assets/fonts/SpaceGrotesk_600SemiBold.ttf"),
};
