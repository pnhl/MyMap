# MyMap

MyMap is a privacy-first, local-first Android/iOS life map built with Expo + React Native, Firebase Authentication and Supabase data services.

## v0.6 architecture

MyMap now uses a real multi-screen navigation architecture with a shared responsive glassmorphism design system.

### Main tabs
- **Map** — live map, route history, photo pins, weather, crowd overlay, tracking controls.
- **Timeline** — day/month history from local GPS data and detected visits.
- **Memories** — photo library and place-grouped memories.
- **Friends** — username, phone, share-code and opt-in nearby discovery up to 500 m.
- **Profile** — journey statistics, data/privacy shortcuts and personal overview.

### Stack screens
- **Memory Detail** — full-screen photo viewing, persistent titles/place names/notes, and independent deletion with unsaved-edit protection.
- **MyMap Smart** — check-in, place alerts, crash/fall detection, battery profile, ETA and trip recap entry points.
- **SOS** — emergency workflow, verified calling handoff and trusted contacts.
- **Heatmap** — visualization built from the user's actual local GPS and photo metadata.
- **Settings** — tracking profile, privacy, geofence sync and application settings.
- **Place Detail** — reverse geocoding, map preview, safe check-in and arrival/leave alerts.

## Responsive glass UI

The Map home screen uses a compact branded toolbar with SOS and Settings, a collapsible journey panel, current-location recentering, and route/photo layer controls. Statistics show today's distance and memories and open Timeline or Memories when tapped. The map opens at the latest saved GPS point or memory; recentering requests foreground location only when selected. Recording and camera actions show progress and prevent repeated taps. Action errors remain visible during automatic refresh.

When native maps are unavailable, the home screen prioritizes recording and camera controls above the map setup explanation. Both layouts use safe-area and bottom-tab measurements, scroll when necessary, and support wider devices. Home surfaces use restrained navy fills and cyan accents; existing screen styling is retained elsewhere.

The UI uses `expo-blur` through reusable `GlassSurface`, `GlassButton` and `GlassChip` primitives. Layout is driven by `useWindowDimensions`, not hard-coded device sizes:

- `< 360 dp`: narrow phones
- `360–599 dp`: standard phones
- `600–899 dp`: foldables / compact tablets
- `>= 900 dp`: tablets / large unfolded devices

Content gets wider gutters and multi-column layouts on foldables while retaining maximum content widths so cards do not stretch unnaturally. App orientation is not locked, allowing the layout to recompute when a foldable opens/closes or rotates.

## Implemented platform features

- Personal GPS history stored locally in SQLite.
- Background trip recording with battery profiles.
- Daily route polylines and automatic stay/visit detection.
- Photo memory pins tied to latitude/longitude.
- MapLibre Native + OpenStreetMap làm renderer chính, hỗ trợ địa hình 3D; Leaflet là fallback.
- MapLibre GL JS, OpenLayers và CesiumJS globe 3D là các engine WebView có thể chuyển ngay trong bảng lớp.
- Routing đa provider với OSRM, Valhalla, GraphHopper và Cloudflare gateway tùy chọn.
- Firebase Authentication for account identity; Supabase RLS, private photo storage and timeline/statistics/heatmap data services receive the Firebase ID token.
- Privacy-preserving live crowd overlay.
- SOS workflow and trusted contacts.
- Place Alerts / geofencing and arrival automation.
- Crash/Fall heuristic detection with confirmation before SOS.
- Native Crash/Fall bridge: Kotlin `SensorManager` on Android and Swift `CoreMotion` on iOS, with an `expo-sensors` fallback when the local module is unavailable.
- Friend discovery by username, opt-in phone, code and nearby session.
- Open-Meteo weather through the `mymap-weather` Edge Function.
- Small native ad placements outside Map/SOS-critical interaction surfaces.

## Branding and upgrade compatibility

The visible product name is **MyMap**. Existing database identifiers (`vc_*`), SQLite database filename and native bundle/package identifiers are intentionally retained where changing them could break existing installs or user data.

## Run locally

Create a local environment file first:

```bash
copy .env.example .env
```

Enter service keys only in `.env`. See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for every supported variable, native rebuild requirements, and the open-source provider strategy.

```bash
npm install
npx expo prebuild
npx expo run:android
# or
npx expo run:ios
```

A development/native build is required for background location, geofencing, sensors, notifications and Google Mobile Ads.

## Local memories and history

- Search memories by title, place, note, country code or date (`2026-09`, `2026-09-16`, `16/9/2026`). Vietnamese search accepts accents or plain ASCII.
- Open an individual photo from Memories, Timeline or a map pin to view and edit it. Changes are saved in SQLite; deleting a memory retains GPS history.
- Timeline includes days with photos even without GPS recording and supports browsing individual months.
- Memories, Timeline and Map refresh when reopened. Timeline and Map also refresh every 20 seconds while focused.
- Route queries use the latest 25,000 GPS points in chronological order. Earlier points remain stored in SQLite.

## Validation

Use Node.js 22.13 or newer for the SQLite-backed regression tests:

```bash
npm test
npm run typecheck
npx expo export --platform android --output-dir .expo/validation-android
```

Tests exercise the app's SQL with Node's SQLite engine and replace native Expo APIs with adapters. A successful bundle export does not verify camera, permissions, map rendering or navigation on a device; those require a native build and device testing.

## Native safety module

The app-owned Expo module lives in `modules/my-map-safety`. Expo Autolinking discovers it during prebuild and exposes the same `MyMapSafety` API from Kotlin and Swift to React Native. After changing native code, regenerate/rebuild the native projects:

```bash
npx expo prebuild --clean
npx expo run:android
# Run npx expo run:ios on macOS for the iOS build.
```

The detector emits incident candidates only while Safety is enabled and the React Native app process is active. The existing confirmation countdown remains the authority before opening SOS; this heuristic is not a medical or emergency-services detector.

Keep the root generated projects ignored with `/android/` and `/ios/`. Do not use unanchored `android/` or `ios/` ignore rules, because those would also exclude the Kotlin and Swift sources inside this local module.

## Firebase Test Lab iOS via GitHub Actions

Để GitHub-hosted macOS tự build `MyMap-Firebase-XCTest.zip`, xem `docs/GITHUB_ACTIONS_FIREBASE_XCTEST.md` và chạy workflow **Build Firebase XCTest iOS** trong tab Actions.
