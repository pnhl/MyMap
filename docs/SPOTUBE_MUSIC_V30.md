# MyMap 1.0.0 — music update, build 30

Updated: 2026-10-05 (Asia/Saigon).

The music screen now uses Spotube as a separately installed companion for discovery and provider accounts, with an independent local-control client in MyMap. Radio and user-selected local audio remain playable inside MyMap. The Spotify OAuth/search screen has been replaced.

## Spotube setup

1. Install the official [Spotube release](https://github.com/team-spotube/spotube/releases/tag/v5.1.2). The protocol implementation was checked against v5.1.2; future releases can change it.
2. In Spotube, open Settings → Playback → Enable Connect, then tap the Edit port pencil (Vietnamese: Cài đặt → Phát → Kích hoạt kết nối → Chỉnh sửa cổng). Configure the fixed port **8765** instead of a randomly assigned port. 8765 is MyMap's suggested default, not a claim about Spotube's default.
3. In MyMap → Music → Spotube → Control Spotube on the map, enter that same port and connect. MyMap accepts explicit ports from 5000 to 65535 and connects only to `ws://127.0.0.1:<port>/ws` on the same device. It does not scan ports, discover LAN devices or silently reconnect.
4. Open Spotube and accept its connection request. Commands remain disabled until acceptance. Return to MyMap for the map and music controls; choose songs and connect provider accounts inside Spotube.

The independent protocol client reads current-track metadata, position, duration, queue, shuffle and repeat state. It sends accepted play/pause, next/previous, seek, shuffle and repeat commands. Refusal, approval timeout, interruption and disconnection show actionable feedback. Android package visibility and launcher intents support Spotube stable, nightly and dev installations.

MyMap includes no Flutter runtime or embedded Spotube SDK. It has no Spotube login or catalog API and does not retrieve account passwords, provider login tokens, extracted audio URLs or download protected tracks. It is not an official Spotube product. No Spotube source code was copied into MyMap; this client was implemented independently from the public protocol.

## MyMap player and library

- A single lazily created Expo audio player supplies the music screen, map widget and navigation controls. UI playback state comes from native status events, eliminating independent players and stale per-screen states.
- Radio Browser search, station favorites and recent listening; radio requires Internet and station availability.
- System-file-picker import of supported MP3/M4A/AAC/WAV/OGG/FLAC/OPUS files. MyMap copies selected files into its private `document/music` directory; originals remain untouched. Imported audio works offline, subject to device decoder support.
- Queue, add/remove, previous/next, seek for finite tracks, shuffle and repeat off/all/one. Libraries and queues are bounded at 100 items; recent history retains 30 items. Imports allow at most 100 MB per file and 500 MB total.
- Volume controls and temporary volume reduction while MyMap plays a navigation speed warning. Changing the desired volume during an alert is retained afterwards.
- Android background playback and lockscreen play/pause metadata for MyMap audio. Local-file lockscreen seek controls are enabled; radio is marked live. Lock-screen next-track support is not claimed.
- Explicit pause clears MyMap media controls and releases audio focus. Switching to Spotube pauses MyMap and clears its local sleep timer; switching to MyMap pauses an accepted Spotube connection before playing local audio.
- The library restores paused. Neither app launch nor loading a saved queue starts playback automatically.

Sleep timers persist an absolute deadline and reconcile on native playback updates and when MyMap returns to the foreground. They rely on JavaScript execution, so the OS can delay stopping audio while the app is suspended. They are a convenience feature, not a hard native background alarm. The sleep control applies to MyMap audio only.

## Privacy and localization

Now-playing sharing is **off by default**. Only enabling the switch makes song title/artist eligible for MyMap's existing friend-presence sharing; provider credentials and audio files are not shared. Local playback and Spotube metadata have explicit ownership, so one source cannot overwrite the other's now-playing status. Semantic metadata changes drive writes, not every position tick.

Terms, Privacy and About were revised on 2026-10-05 to describe app-private audio copies, independent Spotube accounts, loopback control, optional now-playing sharing and timer limitations. They remain available in Settings and the existing authentication legal flow. New music text has English fallback entries for the existing 21-language system; existing localized content remains intact.

## Verification

- 18 focused audio/library tests passed: paused restoration, shared native state, focus release, source-preserving resume, queue completion/repeat/shuffle, opt-in sharing and ownership, sleep reconciliation, volume ducking, file-copy/rollback and deletion confinement, native errors, and Android SAF document names/MIME fallbacks.
- 11 Spotube Connect tests passed, covering protocol acceptance/refusal, commands, bounds, timeouts, stale sockets and error handling.
- 3 native integration/config checks passed for package visibility, audio foreground service and loopback-only cleartext configuration.
- 5 music coordinator tests passed for serialized source handoff, late connection approval and metadata ownership.
- TypeScript typecheck and the complete 151-test suite passed after the final SAF import fix.

### Official Spotube exercise

The official v5.1.2 Android APK was installed on the private MyMap Release QA emulator. Its SHA-256 matched the official release checksum. No personal provider account was used; playback used a seven-minute WAV generated for QA.

Spotube was configured with port 8765 while its LAN Connect switch remained off. MyMap connected over loopback, Spotube displayed its real connection request, and acceptance enabled controls. MyMap displayed the actual track title, duration and progressing playback position. Pause, resume, seek to 97 seconds, shuffle and repeat-all were exercised against the real app; Android MediaSession state confirmed pause/resume and the seek position. Screenshots are stored under `.local/music-v30-qa/`, including `21-spotube-consent.png`, `24-current.png`, `25-spotube-track.png` and `26-spotube-paused.png`.

### Signed APK checks and local import

Both final production APKs built successfully in 5 minutes 1 second. Their package is `com.pnhl.vibecoding`, version name `1.0.0`, version code `30`. Android apksigner verification passed; both use the prior release certificate (SHA-256 `f33d4f0a947f39d269fec02b6095152cbb3e486593d270c5ed44c0b96cc5a3ab`). Both packaged manifests contain the production AdMob application ID. The release build does not enable test ads.

| APK | Bytes | SHA-256 |
| --- | ---: | --- |
| Android | 44,901,518 | `3b16ec1bd9546774bee3af5bae094e47f84da8fb915fafc7e56064f96e189ecd` |
| Amazon | 44,894,451 | `fc028b370fd62e6afbf3d88935cdb02ed6561c4f1ca763698fa86f3de0f2dfc6` |

Final files and machine-readable signature/hash results are in `dist/releases/spotube-music-v30/`.

The final Android APK installed as an update on the private emulator. The Android system picker imported `MyMap-QA.wav` successfully after the SAF display-name fix; MyMap showed the correct title and seven-minute duration. Native MediaSession reported PLAYING with progressing position, and the same player continued while navigating from Music back to Map. Evidence: `.local/music-v30-qa/28-local-import-final.png`, `29-local-playing-final.png`, `30-map-music-final.png`, `local-first-media.txt` and `local-first-services.txt`.

The Android app stayed in the background for **209 seconds**. Native MediaSession remained PLAYING and advanced from 44,975 ms to 252,237 ms. `AudioControlsService` remained a foreground mediaPlayback service. On returning to the Map widget, pause cleared the active MyMap MediaSession and foreground status, and Android's Audio Focus stack was empty with a matching `abandonAudioFocus()` event. The QA log had no AndroidRuntime errors. Evidence: `background-start-media.txt`, `background-final-media.txt`, `background-final-services.txt`, `paused-final-media.txt`, `paused-final-audio-focus.txt`, `31-background-resume-final.png` and `32-map-paused-final.png`.

The final Amazon APK installed as an update over the Android APK with app data retained. Startup and restored local library passed, with playback initially paused. Playing the retained private audio file produced a native PLAYING session, seven-minute duration and advancing position; UI pause worked. The Amazon smoke log also had no AndroidRuntime errors. Evidence: `33-amazon-startup.png`, `34-amazon-library.png`, `35-amazon-playing-final.png`, `36-amazon-paused-final.png` and `amazon-progress-media.txt`.

These device exercises used an Android emulator. Physical Vivo Y22s/Fire OS hardware, provider account login and catalog playback have not been verified. Unit tests and emulator results do not establish those results. The Vietnamese setup guide is included beside the APKs as `HUONG-DAN-SPOTUBE.md`.

## Primary references

- [Spotube official source and license](https://github.com/team-spotube/spotube), [v5.1.2 release](https://github.com/team-spotube/spotube/releases/tag/v5.1.2).
- [v5.1.2 Connect route and user approval](https://github.com/team-spotube/spotube/blob/v5.1.2/lib/provider/server/routes/connect.dart), [event model](https://github.com/team-spotube/spotube/blob/v5.1.2/lib/models/connect/ws_event.dart), [port settings](https://github.com/team-spotube/spotube/blob/v5.1.2/lib/modules/settings/playback/edit_connect_port_dialog.dart).
- [Spotube privacy policy](https://github.com/team-spotube/spotube/blob/master/PRIVACY_POLICY.md).
- [Radio Browser API information](https://api.radio-browser.info/) and [API reference](https://docs.radio-browser.info/). No unverified Radio Browser privacy-policy URL was added.
- Installed Expo Audio 57 source: `node_modules/expo-audio/src/AudioModule.types.ts`, `src/Audio.types.ts`, `plugin/src/withAudio.ts`; installed Expo FileSystem 57 source: `node_modules/expo-file-system/src/File.ts` and `src/internal/NativeFileSystem.types.ts`.
