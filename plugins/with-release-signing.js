// Expo config plugin: signs release builds with OMEN's upload key when a
// properties file is present, so `expo prebuild` never leaves the debug key
// on a store build. The key and its passwords live outside the repository
// (E:\OMEN\keys by default; override with OMEN_RELEASE_SIGNING); without the
// file the debug key is used, as before, for emulator previews.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARKER = "// omen-release-signing";
const LOADER = `${MARKER}
def omenSigningFile = file(System.getenv("OMEN_RELEASE_SIGNING") ?: "E:/OMEN/keys/release.properties")
def omenSigning = new Properties()
if (omenSigningFile.exists()) { omenSigningFile.withInputStream { omenSigning.load(it) } }
`;

function withReleaseSigning(config) {
  // Development and emulator previews keep the debug key so an existing
  // install can be updated in place; only store builds use the upload key.
  if (process.env.APP_VARIANT !== "production") return config;
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (!gradle.includes(MARKER)) {
      gradle = gradle.replace(/\nandroid \{/, `\n${LOADER}\nandroid {`);
      gradle = gradle.replace(
        /signingConfigs \{\n(\s*)debug \{/,
        (match, indent) =>
          `signingConfigs {\n${indent}release {\n${indent}    if (omenSigning["storeFile"]) {\n${indent}        storeFile file(omenSigning["storeFile"])\n${indent}        storePassword omenSigning["storePassword"]\n${indent}        keyAlias omenSigning["keyAlias"]\n${indent}        keyPassword omenSigning["keyPassword"]\n${indent}    }\n${indent}}\n${indent}debug {`,
      );
      gradle = gradle.replace(
        /(release \{[^}]*?)signingConfig signingConfigs\.debug/,
        `$1signingConfig omenSigning["storeFile"] ? signingConfigs.release : signingConfigs.debug`,
      );
    }
    mod.modResults.contents = gradle;
    return mod;
  });
}

module.exports = withReleaseSigning;
