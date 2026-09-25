const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// The SDK/emulator/Gradle cache is local tooling, never application source.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : []),
  /[/\\]\.local[/\\].*/,
  /[/\\]\.cxx[/\\].*/,
  /[/\\]android[/\\](build|\.gradle|app[/\\]build)[/\\].*/,
];
config.maxWorkers = 2;
// Privy's documented compatibility overrides; keep normal exports for other packages.
config.resolver.resolveRequest = (context, name, platform) => {
  // Ryvo's payment-channel package imports Node's "crypto" for randomUUID.
  // The phone has no Node modules, so it gets a small shim over expo-crypto
  // and the WebCrypto object the agent polyfills.
  if ((name === "crypto" || name === "node:crypto") && platform !== "web") {
    return { type: "sourceFile", filePath: require.resolve("./src/agent/shims/node-crypto.js") };
  }
  // Its PostgreSQL ledger is server-side code the app never runs.
  if ((name === "pg" || name.startsWith("pg-") || name === "pg/lib") && platform !== "web") {
    return { type: "sourceFile", filePath: require.resolve("./src/agent/shims/empty.js") };
  }
  if (name === "isows" || name.startsWith("zustand")) {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      name,
      platform,
    );
  }
  if (name === "jose") {
    return context.resolveRequest(
      { ...context, unstable_conditionNames: ["browser"] },
      name,
      platform,
    );
  }
  return context.resolveRequest(context, name, platform);
};
module.exports = config;
