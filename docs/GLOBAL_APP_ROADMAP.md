# MyMap — Global App Roadmap

## Product promise
MyMap is a private life-map: the user owns a searchable visual history of where they went, when they arrived and left, and the photos or notes tied to those places.

## Map strategy
- **iOS, Android và Fire OS:** MapLibre Native + OpenStreetMap by default.
- **Stadia Maps:** optional alternate style provider when an API key is configured.
- **OpenStreetMap:** shared data source for a consistent map experience without Google Play Services.
- The map layer must remain behind an adapter so history, visits and memory pins are provider-agnostic.

## Implemented now
- Background GPS history.
- Day-colored routes.
- Automatic visit detection with arrival/departure time.
- Persistent photo pins: take a photo, bind it to current GPS coordinates and timestamp, render a thumbnail on the map, reopen it later, delete it independently from GPS history.
- Local-first SQLite storage.
- Memory detail with full-screen viewing and SQLite-backed titles, place names and notes.
- Accent-insensitive Vietnamese memory search by title, note, place, country code and date.
- Individual memory deletion while retaining GPS history, with retry after file deletion errors.
- Month navigation and photo-only days in Timeline; focus refresh for Map, Timeline and Memories.
- Latest GPS window selection in chronological order without deleting older history.

## Global-app milestones

### 1. Trust, privacy and reliability
- End-to-end encrypted cloud backup with client-side keys.
- Account-less local mode plus optional Apple/Google/email sign-in.
- Export/import in JSON, CSV, GeoJSON and GPX.
- Granular retention controls and full data deletion.
- Battery-aware tracking modes (Precise / Balanced / Battery Saver).
- Duplicate/noise filtering, impossible-jump detection, tunnel/offline handling.
- Privacy zones that blur or suppress home/work coordinates.

### 2. Memories and places
- Multiple photos, captions, tags and voice notes per place.
- Reverse geocoding and automatic place naming.
- Smart albums by city, country, trip, month and people-defined tags.
- “On this day” memory resurfacing.
- Search by place, date, country, note and trip.
- Trip stories: map + timeline + selected memories.

### 3. Global map experience
- MapLibre/OpenStreetMap on iOS, Android and Fire OS, with provider fallback and future offline packs.
- Offline map packs for selected regions.
- Heatmap of visited cells and a “world coverage” score.
- Country/city visited summaries and personal map layers.
- Time slider to replay a day, trip, month or year.

### 4. Platform polish
- iOS widgets, Live Activities where useful, Shortcuts/App Intents.
- Android widgets, foreground service controls and Quick Settings tile.
- Dynamic color / dark mode / accessibility / large text.
- Vietnamese + English first, then locale-driven translations.

### 5. Safe social features (opt-in only)
- Share a selected trip or memory card, never raw continuous history by default.
- Expiring share links with coordinate precision controls.
- Collaborative trip albums where participants choose what to contribute.

### 6. Backend architecture when cloud sync is enabled
- API gateway + auth service.
- Encrypted user vault for location/media metadata.
- Object storage for encrypted media.
- PostGIS-compatible geospatial index for user-approved server-side features only.
- Regional storage/data residency where required.
- Background sync queue with conflict resolution and idempotent writes.

## Store readiness
- Clear background-location disclosure before permission prompts.
- Platform-specific privacy manifests/permission rationale.
- No advertising SDK in the location pipeline.
- Crash reporting must scrub coordinates and media paths.
- Permission requests should be progressive: foreground location first, background only when the tracking feature is explicitly enabled, camera only when creating a memory.
