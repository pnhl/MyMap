# OpenFreeMap in MyMap

MyMap now defaults to OpenFreeMap Liberty through MapLibre Native. Dark and Positron are also available in **Lớp bản đồ** and **Cài đặt → Bản đồ & ứng dụng**. Preferences survive reopening the app; returning from Settings applies them immediately. The existing raster and satellite providers and display engines remain available. OpenFreeMap vector styles use MapLibre Native or MapLibre GL JS.

No key, subscription or new library is needed. Set `EXPO_PUBLIC_OPENFREEMAP_BASE_URL` to use a self-hosted OpenFreeMap installation instead of `https://tiles.openfreemap.org`. Building and operating a private server can incur infrastructure costs.

## Rights and attribution

Verified against official sources on 2026-10-04:

| Component | License / terms |
| --- | --- |
| OpenFreeMap project and production setup | MIT; allows commercial use. Preserve copyright/license notices if redistributing project code. |
| OpenFreeMap public display service | Free including commercial use, no API key; as-is, without a service guarantee. |
| OpenStreetMap data | ODbL; credit OpenStreetMap contributors. Distribution of modified databases has additional share-alike requirements. |
| OpenMapTiles and map styles | BSD 3-Clause code and CC BY design licenses; preserve attribution. Positron additionally derives from CARTO basemaps credited in the upstream license. |
| Natural Earth, Noto fonts, Maki icons | Public domain, SIL OFL 1.1 and CC0 respectively, as documented upstream. |

Native vector sources provide the standard MapLibre attribution control, placed above the bottom controls. Raster Leaflet maps display their attribution as well. The Settings page links to OpenFreeMap and includes the map credits in **Về MyMap**.

Sources: [OpenFreeMap FAQ](https://openfreemap.org/), [upstream licenses](https://github.com/hyperknot/openfreemap/blob/main/LICENSE.md), [public service terms](https://openfreemap.org/tos/), [OSM copyright](https://www.openstreetmap.org/copyright), [quick start](https://openfreemap.org/quick_start/).

## Offline source

The public OSM raster server prohibits bulk/prefetch/offline downloads. OpenFreeMap's free display service must not be assumed to authorize bulk harvesting either. MyMap therefore requires `EXPO_PUBLIC_OFFLINE_TILE_URL` pointing to a raster service you operate or have permission to download in bulk, using the template `https://your-server.example/{z}/{x}/{y}.png`.

The downloader rejects the public OSM tile host, separates caches by source, counts actual files, and saves pack metadata only after every requested tile succeeds. Without configuration it explains what is needed. Downloading tiles stores a raster pack; this change does not claim to implement a complete offline vector renderer.

Policy: [OSM public tile usage](https://operations.osmfoundation.org/policies/tiles/).

Existing Stadia, CARTO, Esri satellite, terrain, search and routing services have their own terms. Adding OpenFreeMap does not change their licenses or make every external service commercially free.
