# Local Android runtime

The active development copy is `E:/OMEN/build/omen-mobile`. Its source, installed dependencies, native build output and `.local/gradle` cache are all on E:.

The shared Android runtime is `E:/OMEN/android`:

- `sdk`: Android tools and system images.
- `avd/Omen_PlayStore.avd`: the existing virtual phone, installed apps and saved user data.
- `user`: Android preferences and ADB identity.
- `logs`: emulator, API and build diagnostics.

The machine-local `.local/android-runtime.json` selects that runtime. `scripts/android.ps1` resolves project and build-cache paths from its own location. Run it from this E: copy. The original D: directory is retained; it is not the active build directory.

From this project folder:

```powershell
npm run android -- -Preview
```

Add `-Rebuild` after source or native changes. The launcher starts the local API, reuses the existing virtual phone, and updates the application with `adb install -r` to retain its data. Use `scripts/stop.ps1` to stop the owned API and bundler. Close the emulator normally to save its state.

Do not run two copies of this virtual phone. Do not clear app data, uninstall the app, or wipe the emulator to apply a UI update.

The dependency lockfile is retained. The restored MWA patch keeps wallet selection explicit by passing `androidWalletPackage` to the Android association intent. `npm ci` reapplies it through `patch-package`.

The recovery files in `C:/Users/lukam/omen-recovery/2026-09-10/figma-kit-changes` preserve the UI work from before this development copy was restored. `.env` remains local and must not be committed.

## Windows native build paths

The shared SDK's CMake 3.22.1 uses Ninja 1.13.2 locally. The bundled Ninja 1.10.2 failed on incremental React Native builds because a cached header path exceeded 260 characters. Windows long-path support was already enabled.

The replacement comes from the [official Ninja 1.13.2 release](https://github.com/ninja-build/ninja/releases/tag/v1.13.2), and its downloaded ZIP was checked against the release's SHA-256 digest. The original executable is retained at `E:/OMEN/android/backups/ninja-1.10.2.exe`; the verified download is in `E:/OMEN/android/tools/ninja-1.13.2`. Reinstalling that CMake SDK package may restore the older Ninja binary.
