# Kiểm kê cấu hình public và khóa provider

Kiểm kê từ tên biến trong `src/`, `app.config.ts`, `.env.example` và `.github/workflows/`; không đọc `.env`, `.dev.vars`, Firebase files hay credentials thật. `EXPO_PUBLIC_*` được Expo nhúng vào JavaScript và phải được coi là công khai. Lưu bản gốc trong secret manager không thay đổi điều này. [Expo environment variables](https://docs.expo.dev/guides/environment-variables/).

## (b) Khóa chỉ được dùng trên Worker

Các tên cũ dưới đây bị loại khỏi mobile source/example và bị build guard từ chối, kể cả khi còn trong CI/EAS public env. Không chuyển chúng thành tên public khác.

| Biến public cũ | Secret phía Cloudflare | Dịch vụ đi qua gateway |
|---|---|---|
| `EXPO_PUBLIC_STADIA_MAPS_API_KEY` | `MYMAP_STADIA_MAPS_API_KEY` | Raster tiles và static map |
| `EXPO_PUBLIC_TOMTOM_TRAFFIC_KEY` | `MYMAP_TOMTOM_TRAFFIC_KEY` | Routing, traffic tiles/flow, places, reachable range, matrix |
| `EXPO_PUBLIC_MAPILLARY_ACCESS_TOKEN` | `MYMAP_MAPILLARY_ACCESS_TOKEN` | Vector tiles, metadata và ảnh đường phố |
| `EXPO_PUBLIC_GRAPHHOPPER_KEY` | `MYMAP_GRAPHHOPPER_KEY` | Routing |
| `EXPO_PUBLIC_CESIUM_ION_TOKEN` | `MYMAP_CESIUM_ION_TOKEN` | Terrain asset cố định phía server |

Token Mapillary/Cesium có thể được provider gọi là client/public token; trong dự án này chúng vẫn thuộc nhóm proxy vì cấp quyền dùng tài nguyên và hạn mức của tài khoản. Không nhúng token, signed image URL, key query hay credentials trong style/tile URL vào cấu hình public. Token đăng nhập Firebase là token người dùng lấy lúc chạy, không phải khóa provider hoặc cấu hình build; chỉ gửi bằng `Authorization: Bearer …` đến gateway, không gắn vào URL.

## (a) Cấu hình thật sự public

| Tên biến | Phân loại / điều kiện |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Địa chỉ API công khai |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable client key; quyền truy cập do auth/RLS quyết định. Không thay bằng secret/service-role key |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | OAuth client identifiers; không phải OAuth client secret |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | OAuth client identifier cho PKCE |
| `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` | OAuth redirect URI công khai |
| `EXPO_PUBLIC_EMAIL_LINK_DOMAIN`, `EXPO_PUBLIC_EMAIL_LINK_CONTINUE_URL` | Domain/URL đăng nhập công khai, không chứa token hay thông tin bí mật |
| `EXPO_PUBLIC_OPENFREEMAP_BASE_URL` | Public/self-hosted map server không cần khóa |
| `EXPO_PUBLIC_OFFLINE_TILE_URL` | Tile server được phép tải offline; URL không chứa khóa |
| `EXPO_PUBLIC_MAPLIBRE_STYLE_URL`, `EXPO_PUBLIC_MAPLIBRE_DEM_URL` | Style/DEM public; cả tài nguyên được tham chiếu cũng không chứa khóa |
| `EXPO_PUBLIC_OSM_TILE_URL`, `EXPO_PUBLIC_OSM_SEARCH_URL`, `EXPO_PUBLIC_OSM_REVERSE_URL`, `EXPO_PUBLIC_OSM_OVERPASS_URL` | Public/self-hosted OSM endpoints không chứa khóa |
| `EXPO_PUBLIC_OSRM_URL`, `EXPO_PUBLIC_VALHALLA_URL` | Public/self-hosted routing endpoints không chứa khóa |
| `EXPO_PUBLIC_ROUTING_GATEWAY_URL` | Base URL HTTPS của Worker; không chứa credentials, query key hoặc login token |
| `EXPO_PUBLIC_ROUTING_PROVIDERS` | Danh sách lựa chọn provider; không chứa credentials |
| `EXPO_PUBLIC_CESIUM_TERRAIN_ENABLED` | Cờ boolean mới để chọn terrain qua gateway; mặc định false, không phải Ion token |
| `EXPO_PUBLIC_VIETFUEL_URL` | Endpoint dữ liệu nhiên liệu công khai, không chứa khóa |
| `EXPO_PUBLIC_ENABLE_TEST_ADS` | Cờ boolean; release phải là false |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | Public AdMob app identifiers |
| `EXPO_PUBLIC_AMAZON_APS_APP_ID` | Public SDK app identifier; quảng cáo Fire vẫn tắt |
| `EXPO_PUBLIC_GRAPHHOPPER_URL` | URL provider cũ là public, nhưng mobile không cần cấu hình này sau khi chuyển GraphHopper sang Worker |

36 biến AdMob placement sau đều thuộc (a). Chúng là định danh hiển thị quảng cáo, không phải khóa tài khoản AdMob:

| Android native | Android banner | iOS native | iOS banner |
|---|---|---|---|
| `EXPO_PUBLIC_ADMOB_NATIVE_SMART_ID` | `EXPO_PUBLIC_ADMOB_BANNER_SMART_ID` | `EXPO_PUBLIC_ADMOB_IOS_NATIVE_SMART_ID` | `EXPO_PUBLIC_ADMOB_IOS_BANNER_SMART_ID` |
| `EXPO_PUBLIC_ADMOB_NATIVE_FRIENDS_ID` | `EXPO_PUBLIC_ADMOB_BANNER_FRIENDS_ID` | `EXPO_PUBLIC_ADMOB_IOS_NATIVE_FRIENDS_ID` | `EXPO_PUBLIC_ADMOB_IOS_BANNER_FRIENDS_ID` |
| `EXPO_PUBLIC_ADMOB_NATIVE_TIMELINE_ID` | `EXPO_PUBLIC_ADMOB_BANNER_TIMELINE_ID` | `EXPO_PUBLIC_ADMOB_IOS_NATIVE_TIMELINE_ID` | `EXPO_PUBLIC_ADMOB_IOS_BANNER_TIMELINE_ID` |
| `EXPO_PUBLIC_ADMOB_NATIVE_STATS_ID` | `EXPO_PUBLIC_ADMOB_BANNER_STATS_ID` | `EXPO_PUBLIC_ADMOB_IOS_NATIVE_STATS_ID` | `EXPO_PUBLIC_ADMOB_IOS_BANNER_STATS_ID` |
| `EXPO_PUBLIC_ADMOB_NATIVE_PROFILE_ID` | `EXPO_PUBLIC_ADMOB_BANNER_PROFILE_ID` | `EXPO_PUBLIC_ADMOB_IOS_NATIVE_PROFILE_ID` | `EXPO_PUBLIC_ADMOB_IOS_BANNER_PROFILE_ID` |
| `EXPO_PUBLIC_ADMOB_NATIVE_MEMORIES_ID` | `EXPO_PUBLIC_ADMOB_BANNER_MEMORIES_ID` | `EXPO_PUBLIC_ADMOB_IOS_NATIVE_MEMORIES_ID` | `EXPO_PUBLIC_ADMOB_IOS_BANNER_MEMORIES_ID` |
| `EXPO_PUBLIC_ADMOB_NATIVE_HEATMAP_ID` | `EXPO_PUBLIC_ADMOB_BANNER_HEATMAP_ID` | `EXPO_PUBLIC_ADMOB_IOS_NATIVE_HEATMAP_ID` | `EXPO_PUBLIC_ADMOB_IOS_BANNER_HEATMAP_ID` |
| `EXPO_PUBLIC_ADMOB_NATIVE_SETTINGS_ID` | `EXPO_PUBLIC_ADMOB_BANNER_SETTINGS_ID` | `EXPO_PUBLIC_ADMOB_IOS_NATIVE_SETTINGS_ID` | `EXPO_PUBLIC_ADMOB_IOS_BANNER_SETTINGS_ID` |
| `EXPO_PUBLIC_ADMOB_NATIVE_PLACE_ID` | `EXPO_PUBLIC_ADMOB_BANNER_PLACE_ID` | `EXPO_PUBLIC_ADMOB_IOS_NATIVE_PLACE_ID` | `EXPO_PUBLIC_ADMOB_IOS_BANNER_PLACE_ID` |

Không có `EXPO_PUBLIC_*` nào được phép chứa khóa quản trị, provider access token, URL có mật khẩu hoặc signed URL lâu dài. Public URL cần quyền provider phải được thay bằng route gateway đã cho phép; gateway không nhận upstream URL từ app. Thêm biến public mới phải cập nhật bảng này và policy build tương ứng.

Kiểm kê trước chuyển proxy có 67 tên cụ thể: năm biến khóa bị cấm, `EXPO_PUBLIC_GRAPHHOPPER_URL` được nghỉ dùng, 61 tên còn lại vẫn public. Thêm cờ terrain mới cho tổng cộng 62 tên public đang dùng. `npm run check:public-config` kiểm tra cấu hình build theo policy; không dùng một `.env` legacy chứa provider keys để chạy kiểm tra hoặc build lại.
