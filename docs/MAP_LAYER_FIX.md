# Map layer and glass UI

Updated 2026-09-18.

## Rendering order

The home screen now uses an explicit layer order:

1. Local street artwork as the offline base.
2. OpenStreetMap raster tiles for the visible viewport.
3. The MapLibre Native interactive map after `onMapLoaded` fires.
4. The navy readability gradient.
5. Scrollable glass UI and the navigation dock.

The native map stays transparent until it has loaded. A network or tile-provider failure therefore cannot replace the usable background with a blank map. The Timeline, Memories, Friends, Profile, Smart, SOS, Heatmap and Settings screens also place their UI above the shared street background. Heatmap and place previews retain a real Natural Earth fallback until their native map loads.

## Data integrity

- The background contains geographic map data, not simulated journeys.
- Routes, pins, heat cells, photos and statistics still come only from local GPS/photo records or existing service responses.
- If location permission was already granted, the home map may center on the device's real last-known position. It does not request location permission merely to draw the screen.
- With no saved or permitted location, the static map is a generic world view and is not presented as the user's location.

## Native configuration

The checked-in native projects use MapLibre Native and OpenStreetMap on Android, Fire OS and iOS. No Google Maps native SDK or API key is required. An optional Stadia key can supply an alternate tile style, while OpenStreetMap remains the default fallback.

OpenStreetMap tile, Nominatim search/reverse and Overpass detail endpoints are configurable through environment variables. Attribution remains visible in the map overlay.

## Validation

- TypeScript compile passed.
- Eleven local database, search, QR and persistence tests passed.
- Android manifest and resources processed successfully.
- Production Android JavaScript bundle embedded successfully.
- The configured OpenStreetMap endpoints are bundled through the environment configuration.
- Android emulator rendering showed the map below the glass UI, with the toolbar, cards, actions and bottom dock remaining above it.

The OpenStreetMap tile path is the default renderer and does not depend on Google Play Services.

References: [MapLibre React Native](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/), [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/), [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API).
