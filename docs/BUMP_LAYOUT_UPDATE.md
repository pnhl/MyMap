# MyMap social map layout

Updated 2026-10-04. Layout reference: [Bump by amo](https://help.bumpmaps.com/en/articles/11420926-how-bump-works). MyMap retains its own navigation, features and assets.

- Opens directly to a full-screen map, with a floating place search, profile button, weather shortcut, location/layers/tools/SOS controls, and friend avatar tray.
- Centers once when the first usable position arrives; subsequent GPS updates do not interrupt manual panning.
- Shows actual friends as avatar pins with name/battery; no sample people are inserted. Signed-out/empty accounts show an invitation instead.
- Keeps five tabs: Friends, Journey, Map in the center, Memories, Profile. The dock adapts to portrait and landscape.
- Keeps recording, saved route history, photo memories, navigation, scratch map, friend interactions, map chat, live trip sharing, SOS, radio, badges, weekly story, time capsules and replay.
- Moves the old home dashboard into **Hôm nay của bạn**, and secondary map controls into bottom sheets.
- Friends lists existing connections first; username/phone/QR/nearby search and account code remain in **Thêm bạn**. Profile uses a centered avatar and identity card. Privacy/export/language/devices remain under Settings.
- Keeps the top-left logo removed. Updates the default Atlas theme to navy, blue and white surfaces; other themes remain selectable.
- Adds OpenFreeMap Liberty, Dark and Positron to both Map and Settings. See [map licensing and configuration](MAP_PROVIDER_LICENSES.md).

## Validation

- `npm run typecheck`: passed.
- `npm test`: 84 passed, including the journey recording regression suite, provider URL/self-host configuration, offline source policy/file counts, and web road route coordinate ordering.
- Release APK built and installed on an isolated Android emulator without altering the user's existing emulator data. Screenshots are in `bump-layout-validation/`.
- Android checks: five tabs, Friends/add-friend sheet, Profile/Settings, retained saved journey (8 GPS points, approximately 0.6 km in the existing QA fixture), Memories, Today/tool/layer sheets, attribution dialog, normal and enlarged text, 320 dp screen, landscape dock, native vector style and MapLibre GL JS vector display.
- Public Liberty/Dark/Positron style endpoints returned HTTP 200 with valid version-8 style JSON. The GL JS legacy script URL returned 404; replaced with the verified 5.24.0 distribution. Raster/offline failures no longer report download success.

## Device checks still needed

MapLibre Native's OpenGL renderer in this emulator does not show vector place/road text. This matches the [upstream emulator report](https://github.com/maplibre/maplibre-native/issues/3648), which describes correct rendering on a physical Pixel. MyMap's native attribution dialog and map geometry work here, and the GL JS alternative renders labels. Verify labels on a physical Android phone before publishing; no claim of physical-device validation is made.

Friend avatar pins and signed-in realtime actions require real connected accounts for end-to-end verification. This QA fixture was signed out. The recording implementation remains the previously tested fix documented in [JOURNEY_RECORDING_FIX.md](JOURNEY_RECORDING_FIX.md); this layout change does not reconstruct GPS samples that were never recorded.
