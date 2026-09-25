// Native builds embed Inter and Space Grotesk through the expo-font config
// plugin, so there is nothing to load at run time. The browser build has no
// such step: `web-fonts.web.ts` lists them for `useFonts`.
export const webFonts: Record<string, number> = {};
