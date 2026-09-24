# MyMap 0.7.0-beta.1

- Android application ID: `com.pnhl.vibecoding`
- Version name: `0.7.0-beta.1`
- Version code: `8`
- Build type: `release`, JavaScript bundled for production with Hermes.
- Signing identity: MyMap release key, alias `mymap-release`.

## Build

Run `powershell -ExecutionPolicy Bypass -File scripts/build-release.ps1` from the project root. Pass `-JavaHome` to select a different JDK 21 installation.

The private signing key and its credentials are in `.signing/`, excluded from source control. Back up this directory securely; subsequent releases must use the same key to update installations of this release.

Output: `dist/releases/MyMap-0.7.0-beta.1-release.apk` and its SHA-256 checksum.

## Build corrections

- Explicitly select C++ driver mode on Windows because CMake can shorten `clang++.exe` to `CLANG_~1.EXE` when the SDK path contains spaces. Without the flag, the linker omits the C++ runtime and fails with undefined symbols.
- Use JDK 21 with a short temporary socket directory to avoid the local Java loopback socket error.
- Previous manually embedded QA assets were moved to `.expo/manual-bundle-backup/`. Gradle now bundles current source assets itself for release.

## Installation compatibility

Earlier debug/QA APKs use the Android debug certificate. Android does not allow an in-place update from that certificate to the new release certificate. Preserve/export existing local data before changing installations; this build process does not uninstall or clear an existing app.

This beta includes the current UI and OpenStreetMap integration. Live OSM connectivity remains dependent on the device network; successful packaging does not establish service availability.
