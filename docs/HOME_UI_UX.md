# Home UI/UX update — 2026-09-18

## Design

Preserve MyMap's wordmark, navy theme and cyan accent. Reduce overlapping map controls, prioritize recording, and make daily statistics and recording state easier to understand.

- Compact header with visible SOS and Settings controls.
- A single journey panel with a recording state, daily distance, memory count and camera action.
- Native map panel can expand to show GPS profile, route/photo layers and Smart, Heatmap and Friends shortcuts.
- Today's distance opens Timeline; memory count opens Memories. Map photo pins open Memory Detail.
- Recenter requests foreground permission on user action. The initial map region uses the latest saved GPS point or photo.
- MapLibre Native uses OpenStreetMap by default; a Stadia style is used only when configured. The local street asset remains available offline.
- A native map remains transparent until its tiles finish loading, preventing a white or blank map from covering the UI.
- The map, readability shade, glass content and dock use explicit stacking so map content cannot cover controls.
- Recording, camera and recenter actions prevent repeated taps and show pending state.
- Action errors remain visible while automatic data refresh runs; manual retry or another action clears them.
- Compact brand lettering retains its size at larger accessibility text scales to prevent a split wordmark. Content text continues to scale.

## Validation

UI was checked in the Android API 35 emulator using the current JavaScript bundle and resources with the existing native debug libraries:

- Standard phone: 1080 × 2400 pixels at 420 dpi, default text scale.
- Small phone: 320 × 640 dp with text scale 1.3. Recording and camera controls remain above the bottom tabs.
- Tablet: about 933 × 1200 dp, default text scale. The dashboard uses two columns.
- Header Settings and SOS navigation, and daily-distance navigation to Timeline, were checked through the live UI hierarchy.
- Foreground location denial displays an inline error and makes the record button available again. The error remains after the 20-second automatic refresh interval.
- TypeScript passes; eight existing SQLite/search regression tests pass; Android bundle embedding passes.

## Limits

MapLibre/OpenStreetMap rendering and recentering were verified on the Android emulator without a Google Maps dependency.

A full Gradle native rebuild encountered an existing C++ link failure in `expo-modules-core` with the generated project's NDK 27.1 toolchain (`std::__ndk1` undefined symbols). Visual QA reused the existing native debug libraries. This does not establish release APK readiness.
