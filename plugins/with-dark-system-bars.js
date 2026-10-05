// Expo config plugin: the app draws edge to edge on a blue ground, so the
// system navigation bar must stay transparent with light buttons. Without
// this, Android lays a light-grey contrast scrim behind three-button
// navigation, which reads as a white strip under the app.
const { withAndroidStyles } = require("expo/config-plugins");

const ITEMS = {
  "android:enforceNavigationBarContrast": "false",
  "android:windowLightNavigationBar": "false",
};

module.exports = (config) =>
  withAndroidStyles(config, (c) => {
    const theme = (c.modResults.resources.style ?? []).find((s) => s.$.name === "AppTheme");
    if (!theme) return c;
    theme.item = (theme.item ?? []).filter((i) => !(i.$.name in ITEMS));
    for (const [name, value] of Object.entries(ITEMS))
      theme.item.push({ $: { name, "tools:targetApi": "q" }, _: value });
    return c;
  });
