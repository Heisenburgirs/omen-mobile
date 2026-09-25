# OMEN mobile — Android development build

Sign in with Google or an existing Solana wallet, then view its SOL balance.
React Native + Expo SDK 57 + Privy + Solana Mobile Wallet Adapter.
Android is the current target; iOS and store publishing are deferred.

## Test on this Windows machine

Open **start-android.cmd**, or run:

```powershell
cd D:\trading\omen-mobile
npm run android
```

The launcher opens Omen_PlayStore, starts the local balance API and Expo bundler,
installs OMEN Dev, and opens it. No Expo account, EAS build or store upload is needed.

- **Continue with Google:** the only onboarding button on ordinary Android phones.
- **Continue with Seeker:** appears first on a Seeker, followed by Google. Seed Vault
  proves identity with a message signature; it is not the OMEN transaction signer.
- Every authenticated account creates or reuses one Privy embedded Solana wallet.
  External-wallet login identities do not suppress creation or replace that signer.
- **Settings → Connect external wallet:** discovers installed wallets, verifies a
  fresh ownership signature with Privy's link API, and persists the connection on
  the same account. No private-key import and no asset transfer are performed.
- Seeker users can link Google in Settings to access the same account on other
  Android devices. Linking an identity already owned by another account is rejected.
- Disconnecting an external wallet never changes the embedded wallet. The last
  remaining login identity cannot be disconnected. Apple and iOS are deferred.

The app and balance API use **Solana mainnet**. Existing wallet addresses stay
the same; the displayed SOL balance comes from mainnet. Copy the address from
the address sheet and pull down to refresh after funding it. Sign out and return using the same
method to confirm the same wallet is restored. Failed balance requests show an
error or the last known balance; they do not silently become zero.

After changing native dependencies or app.config.ts:

```powershell
npm run android -- -Rebuild
```

To run on a phone instead of the emulator, plug it in over USB with Developer
options > USB debugging enabled, accept the prompt on the phone, then:

```powershell
npm run android -- -Phone
```

The first phone run rebuilds the APK with arm64 as well as x86_64 (the emulator
build is x86_64 only); later runs reuse it. Metro and the website reach the
phone through `adb reverse`, so the phone needs no Wi-Fi access to this PC.
Wireless debugging works too: pair once (`adb pair ip:port code`), then
`adb connect ip:port`; the launcher takes the Wi-Fi device like a USB one. If
the dev client says it cannot find a server, the reverse tunnels dropped with
the connection; rerun the launcher to restore them.

For a self-contained build on the phone (no Metro, no "loading from
127.0.0.1:8081", survives adb disconnects) use a preview build. It bakes the
JavaScript into the APK, so rerun it after every code change; each run rebuilds:

```powershell
npm run android -- -Phone -Preview
```

A phone preview targets the website on this PC's LAN address
(`http://<pc-ip>:3100`, detected automatically; override with
`-ApiUrl http://<pc-ip>:3100` or `-ApiUrl https://www.getomen.xyz`), so the
website dev server must be running and the phone on the same Wi-Fi. Rebuild if
the PC's address changes.

For a bundled local preview without Expo's development launcher or Metro:

```powershell
npm run android -- -Preview
```

This builds a local `.dev` APK with `APP_VARIANT=local-preview`, preserves app
data, and starts the balance API. HTTP is allowed only for emulator loopback
addresses in this preview, including mainnet; the server calls Helius over HTTPS.
Public builds require HTTPS for the balance API as well. Run the preview
command again after code changes. Normal development uses Fast Refresh.

Fonts are embedded in the native app, so a native rebuild is required for this
update. The logo stays visible until Privy resolves the session; there is no
separate asynchronous font-loading gate. The launcher reuses an unchanged APK
instead of reinstalling it each time. It allows Quick Boot, uses 4 GB of emulator
RAM and disables Vulkan. These emulator settings do not fix storage I/O failures;
stop using the emulator if Windows reports drive errors.

To stop the API and bundler:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop.ps1
```

Close the emulator separately. Local logs and SDK files are in the Git-ignored .local folder.

### Google Play emulator

The default **Omen_PlayStore** emulator uses Google's Android 36 Google Play
x86_64 image and the Pixel 7 profile. It includes the Play Store, so sign into Google
there and install Phantom normally. The earlier **Omen_Pixel** device is preserved
with its existing data; accounts and Chrome sessions do not carry into the new device.
Physical keyboard input and Quick Boot are enabled.

On another machine, install SDK package
`system-images;android-36;google_apis_playstore;x86_64` and create the AVD named
`Omen_PlayStore` using that image. A Google APIs image alone does not include Play Store.
Use `npm run android -- -Avd Omen_Pixel` to open the preserved older emulator.
Only one emulator uses the OMEN port at a time.

### Seeker testing in the emulator

The emulator has no Seed Vault hardware. Install a real Solana wallet from the
Play Store, sign in with Google, and use **Settings → Connect external wallet**. The mock wallet is not part of this
mainnet setup. Complete physical Seeker testing before release.

The wallet picker uses standard MWA and can open a compatible installed wallet. A successful signature proves control of the address; it does not prove
Seeker ownership or an SGT entitlement.

## Configuration

The supplied public Privy App ID and **mobile** App Client ID are in the ignored
.env file. The web client is unused. For another checkout, copy .env.example.

| Variable                    | Purpose                                         |
| --------------------------- | ----------------------------------------------- |
| EXPO_PUBLIC_PRIVY_APP_ID    | Public Privy App ID                             |
| EXPO_PUBLIC_PRIVY_CLIENT_ID | Public native app client ID                     |
| EXPO_PUBLIC_API_URL         | The OMEN website API (dev: 127.0.0.1:3100 via adb reverse; prod: https://www.getomen.xyz) |
| EXPO_PUBLIC_SOLANA_NETWORK  | mainnet-beta by default                         |

### Privy dashboard

1. Enable **Google**, Solana wallet sign-in, and Solana embedded wallets.
2. Keep two mobile app clients. Development: **Allowed app identifiers**
   xyz.getomen.app.dev, **Allowed URL schemes** omen-dev; its client id is
   EXPO_PUBLIC_PRIVY_CLIENT_ID in .env. Production: xyz.getomen.app and omen;
   its client id goes to scripts/release.ps1 (-PrivyClientId or
   OMEN_PRIVY_PRODUCTION_CLIENT_ID). Neither client lists the other's
   identifier.
3. Session duration is set per app client (Privy default 30 days).

Google OAuth now reaches the real Google sign-in page in the Android system browser. Account completion and the return callback still need your interactive sign-in. The earlier invalid_native_app_id rejection no longer occurs after restarting the rebuilt app.

In the emulator, MWA connection approval and cancellation work. Privy then rejects
Solana login challenge creation with **disallowed_login_method**. Enable Solana
external-wallet login under the app's Login methods; wallet signup being enabled
alone is insufficient. Signed-message completion remains pending that setting.

The app uses Privy's OAuth browser flow and SIWS challenge verification. Cancelling
OAuth or wallet association returns to the login screen. The app never collects
Google credentials or wallet keys.

Production identifiers remain reserved as **xyz.getomen.app / omen**. After changing
.env, stop the local services and restart the launcher. Never put secrets or a Helius
key in an EXPO_PUBLIC variable. Legal links and public release remain deferred.

References:
[Privy app clients](https://docs.privy.io/basics/get-started/dashboard/app-clients),
[MWA sessions](https://docs.solanamobile.com/get-started/react-native/invoke-mwa-sessions-directly),
[Solana Mobile's Privy SIWS integration](https://github.com/solana-mobile/solana-mobile-skills/blob/main/skills/integration-privy/references/siws.md).

## Architecture

- Privy authenticates Google OAuth and signed Solana login messages, then persists the session.
- SDK automatic wallet creation is disabled so one explicit creation path can guard
  retries. Every authenticated account without a Privy Solana wallet enters it,
  regardless of Google or Seeker identity. createAdditional:false prevents extra wallets.
- MWA requests a Privy-issued challenge, obtains a wallet signature and sends the complete
  base64 signed payload to Privy for verification. A wallet connection alone is not login.
- The login authorization is revoked after use; no MWA auth token is retained.
  Later trading will require a separate authorization flow.
- The displayed wallet and signing authority are always the Privy Solana wallet. Squads, SPL multisigs and routing
  policies are not deployed in this milestone; either sign-in method will control the same
  future account structure.
- GET /api/balance verifies the Privy JWT, rate-limits the authenticated user, and calls
  Solana getBalance. Public address lookups are not treated as proof of ownership.
- SOL amounts remain integer lamports until display formatting. User-specific caches clear
  on sign-out or account changes. Balance refreshes every 20 seconds while active.
- No custom identity database or Supabase is needed for this slice.

The API can later run as api/balance.ts on Vercel; nothing is deployed.
Use shared rate limiting and HTTPS before public deployment.

## Prerequisites on another machine

Node 22.13+, npm, Java 17, and Android SDK platform 36 / build-tools 36.0.0.
Run npm ci. The launcher expects the SDK at .local/android-sdk and the Omen_PlayStore AVD
at .local/avd (ANDROID_USER_HOME=.local/android-user). Enable virtualization.
Gradle installs its pinned NDK and CMake versions during the first build.

Privy's SDK and MWA require a native development build. Expo Go and browser previews
do not exercise these integrations. The Apple authentication package remains installed
as a Privy peer dependency; Apple sign-in is not offered in the UI.

## Checks

```sh
npm run typecheck
npm test
npm run check:expo
npm run export:android
```

Tests cover signer selection, reuse of the single embedded signer across login methods and external connections,
SIWS encoding and failed approvals, address validation, exact SOL formatting,
RPC failures, authentication rejection, network mismatch and rate limiting.
Google account completion, wallet creation/restoration, and physical Seeker approval
require interactive testing.

## Outside this milestone

Transfers, swaps, funding, asset prices, rewards, multisig deployment, routing,
account deletion and public distribution. Store publication waits until the
product is finished.

### Installed-wallet picker (Android)

Wallet discovery now lives in Settings. Onboarding offers Google and, only on a
Seeker, Seeker login. The picker queries installed MWA handlers and known Phantom,
Solflare and Backpack packages without broad installed-app access. MWA is preferred;
documented Privy deep links cover compatible wallets without MWA.

Connections call useLinkWithSiws, never useLoginWithSiws. They cannot switch the
signed-in account or the embedded signer. Google linking uses useLinkWithOAuth.
Native handoffs can be cancelled and time out after 60 seconds. Aborted or stale
proofs cannot continue to authentication/linking. RPC and wallet errors use toasts.

Native discovery lives in modules/omen-wallets. The pinned patch for
mobile-wallet-adapter-protocol 2.3.0 directs MWA to the selected Android package.
Rebuild after native-module or patch changes; Expo Go cannot run these flows.
Physical Seeker and completed real-wallet linking still require device testing.

## Portfolio and social UI
See [mobile data setup](docs/MOBILE-DATA-SETUP.md) for the isolated Supabase migration, server credentials, indexer and provider coverage gates. No trading or routing is enabled.

The local Android SDK and existing Google Play emulator have moved to E: on this machine. See [Android runtime location](docs/ANDROID-RUNTIME.md).
