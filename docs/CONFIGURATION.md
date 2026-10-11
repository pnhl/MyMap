# Cấu hình MyMap

## Cấu hình client và gateway

1. Sao chép `.env.example` thành `.env` tại thư mục gốc.
2. `.env` chỉ chứa cấu hình public trong [PUBLIC_CONFIG.md](PUBLIC_CONFIG.md): URL không có credentials, publishable key, OAuth client IDs, AdMob IDs và các cờ. Git ignore không bảo vệ giá trị đã được Expo nhúng vào bundle.
3. Khóa Stadia, TomTom, Mapillary, GraphHopper và Cesium chỉ cấp cho Cloudflare Worker theo [BUILD.md](BUILD.md) và [CLOUDFLARE_SECRETS.md](CLOUDFLARE_SECRETS.md). Mobile dùng `EXPO_PUBLIC_ROUTING_GATEWAY_URL`, không có đường dev trực tiếp bằng provider key.
4. Rebuild native app sau khi thay MapLibre, APS hoặc AdMob app ID:

```bash
npx expo prebuild
npx expo run:android
```

Các nhóm cấu hình thường dùng dưới đây đều public; [PUBLIC_CONFIG.md](PUBLIC_CONFIG.md) liệt kê đầy đủ từng tên biến, gồm các placement iOS/Android:

| Biến | Mục đích | Có thể để trống |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL Supabase hoặc bản Supabase tự host | Có, các tính năng cloud sẽ không hoạt động |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key của Supabase | Có |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | OAuth client iOS của Google cho bundle `com.pnhl.vibecoding` | Có, nút Google bị vô hiệu trên iOS |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | OAuth client Web dùng cho bản web/fallback | Có |
| `EXPO_PUBLIC_OPENFREEMAP_BASE_URL` | Map server public/self-hosted không cần khóa | Có, dùng mặc định OpenFreeMap |
| `EXPO_PUBLIC_OFFLINE_TILE_URL` | Tile URL không có khóa, được phép bulk/offline theo điều khoản server | Có |
| `EXPO_PUBLIC_MAPLIBRE_STYLE_URL` | Style JSON cho MapLibre Native; bỏ trống để dùng OSM raster + địa hình 3D | Có |
| `EXPO_PUBLIC_MAPLIBRE_DEM_URL` | TileJSON raster DEM cho địa hình MapLibre 3D | Có, có mặc định Mapterhorn |
| `EXPO_PUBLIC_CESIUM_TERRAIN_ENABLED` | Bật terrain asset cố định qua gateway; Ion token chỉ ở Worker | Có, mặc định false/ellipsoid |
| `EXPO_PUBLIC_ROUTING_GATEWAY_URL` | Base URL HTTPS Cloudflare Geo Gateway cho toàn bộ provider có khóa | Có, nguồn OSM public vẫn dùng được |
| `EXPO_PUBLIC_ROUTING_PROVIDERS` | Thứ tự fallback `osrm,valhalla,graphhopper` | Có |
| `EXPO_PUBLIC_OSRM_URL` | OSRM server tự host/provider | Có, dùng demo server mặc định |
| `EXPO_PUBLIC_VALHALLA_URL` | Valhalla server tự host/provider | Có, dùng public server mặc định |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | AdMob app ID cho Android | Có |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | AdMob app ID cho iOS | Có |
| `EXPO_PUBLIC_ADMOB_NATIVE_*_ID` | Native ad unit theo từng vị trí | Có, card quảng cáo không render |
| `EXPO_PUBLIC_ADMOB_BANNER_*_ID` | Banner dự phòng khi native ad không fill | Có, chỉ bỏ qua banner fallback |
| `EXPO_PUBLIC_AMAZON_APS_APP_ID` | Amazon Publisher Services app id cho Fire OS | Có, APS ở trạng thái dormant |
| `EXPO_PUBLIC_ENABLE_TEST_ADS` | Chủ động cho phép quảng cáo test trong dev | Có, mặc định `false` |

## Firebase Authentication (hệ tài khoản chính)

Ứng dụng dùng Firebase Authentication native qua React Native Firebase, tự lưu phiên bằng SDK native và chuyển Firebase ID token cho Supabase. Email/mật khẩu, số điện thoại và tài khoản khách chạy trực tiếp qua Firebase; Google dùng OAuth trong trình duyệt hệ thống nên không phụ thuộc ứng dụng Google Play Services trên Fire OS.

Thiết lập bắt buộc cho project `mymap-a3ae4`:

1. Firebase Console → Authentication → Get started.
2. Bật **Email/Password**, **Phone**, **Google**, **Apple**, **Game Center** và **Anonymous** trong Sign-in method.
3. Với Google Android, thêm SHA-1 và SHA-256 của certificate cho package `com.pnhl.vibecoding`, tải lại `google-services.json`, kiểm tra file mới có mục `oauth_client`, sau đó prebuild/rebuild. Fingerprint debug hiện tại là SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` và SHA-256 `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`. Bản release/Amazon phải thêm fingerprint của release keystore riêng.
4. Với Phone, cấu hình SMS region và test phone numbers trong Firebase. Android thật cần SHA fingerprint hợp lệ; iOS cần APNs để xác minh im lặng hoặc reCAPTCHA fallback.
5. Với iOS, đăng ký app cùng bundle ID `com.pnhl.vibecoding`, tải `GoogleService-Info.plist` từ đúng project vào thư mục gốc, điền `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, bật Sign in with Apple và Game Center cho App ID trong Apple Developer/App Store Connect. Apple provider còn cần Service ID, Team ID, Key ID và private key ở Firebase Console; không đặt private key trong ứng dụng.
6. Supabase Dashboard → Authentication → Third-party Auth → thêm Firebase project `mymap-a3ae4`. Firebase token dùng với Supabase phải có custom claim `role: authenticated`; phần này phải được gắn bằng Firebase Admin SDK ở backend tin cậy.

Firebase JSON/plist được inject từ cấu hình private của môi trường build, không commit vào mã nguồn hoặc import từ JavaScript. File phải khớp application/bundle ID và cùng Firebase project. Bản release/Amazon cần đăng ký SHA đúng certificate; iOS cần cấu hình plist tương ứng. Không suy ra trạng thái credentials hiện tại từ tài liệu này; xem cách cấp file và signing theo từng store trong [BUILD.md](BUILD.md).

Sau khi thay file cấu hình native, chạy:

```bash
npx expo prebuild --clean
npx expo run:android
# Trên macOS: npx expo run:ios
```

Các provider native không chạy trong Expo Go; cần development build hoặc bản cài đặt thật.

### Ký bản phát hành Android/Amazon

Release APK dùng keystore hiện hữu tại `.signing/mymap-release.p12` và thông tin cục bộ tại `.signing/release.properties`; cả thư mục đã được gitignore. Chạy `scripts/ensure-release-signing.ps1` chỉ khi hai file chưa tồn tại, sau đó sao lưu an toàn cả hai file. Không thay hoặc tạo lại keystore sau khi đã phát hành vì các bản cập nhật phải giữ cùng signing identity.

Trước khi build Amazon release, thêm SHA-1 và SHA-256 của release key vào Firebase Android app, tải lại `google-services.json`, rồi chạy prebuild và assemble release với ABI `armeabi-v7a,arm64-v8a`.

Nếu Firebase trả về `CONFIGURATION_NOT_FOUND`, Authentication chưa được khởi tạo cho project. Nếu Google/Apple chưa đủ cấu hình, ứng dụng không giả vờ đăng nhập thành công mà hiển thị lỗi cấu hình cụ thể.

`google-services.json` và Firebase web config chỉ chứa định danh/key công khai dành cho client. Không đưa Firebase Admin service account, Apple private key, Supabase service-role key hoặc bất kỳ secret backend nào vào bundle.

## URL dịch vụ OpenStreetMap

```env
EXPO_PUBLIC_OSM_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
EXPO_PUBLIC_OSM_SEARCH_URL=https://nominatim.openstreetmap.org/search
EXPO_PUBLIC_OSM_REVERSE_URL=https://nominatim.openstreetmap.org/reverse
EXPO_PUBLIC_OSM_OVERPASS_URL=https://overpass-api.de/api/interpreter
```

- Tile chỉ tải vùng đang hiển thị và luôn có dòng `© OpenStreetMap contributors`. Ứng dụng không tải trước hoặc tải hàng loạt.
- Photon phục vụ gợi ý tìm kiếm khi gõ; Nominatim chỉ chạy khi người dùng gửi tìm kiếm. Kết quả được cache 30 ngày và mỗi phiên ứng dụng giãn yêu cầu Nominatim ít nhất 1,1 giây.
- Overpass lấy tag của đối tượng người dùng đã chọn và tối đa 12 đoạn đường trong bán kính 35 m khi đang chỉ đường để ước tính giới hạn tốc độ. Tra cứu đoạn đường được cache theo ô khoảng 100 m trong 5 phút; không quét hàng loạt POI.
- Các dịch vụ công cộng không có SLA. Trước khi phục vụ lượng người dùng lớn, hãy trỏ các biến trên tới provider hoặc proxy phù hợp.

Chính sách: [OSMF tile usage](https://operations.osmfoundation.org/policies/tiles/), [Nominatim usage](https://operations.osmfoundation.org/policies/nominatim/), [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API).

## Luồng cấu hình trong code

- `.env`: cấu hình public của máy/build, không có khóa provider server.
- `app.config.ts`: đưa cấu hình MapLibre và Mobile Ads app ID vào project Android/iOS khi prebuild.
- `src/config/env.ts`: một điểm đọc cấu hình cho React Native.
- `src/config/maps.ts`: bật MapLibre Native trong development/production build.
- `src/components/NativeAdCard.tsx`: không tải quảng cáo khi chưa có ad-unit ID.
- Quảng cáo native thử lại tối đa 2 lần; sau đó chuyển sang banner tương ứng nếu đã cấu hình `EXPO_PUBLIC_ADMOB_BANNER_*_ID`.
- Android tích hợp `com.amazon.android:aps-sdk:12.0.1` và `aps-admob-adapter:6.0.0`. Sau khi được APS duyệt, cấu hình app id ở `EXPO_PUBLIC_AMAZON_APS_APP_ID`, slot/banner trong APS + AdMob mediation, rồi điền các banner ad-unit ở trên.
- Không còn nút đóng quảng cáo trong card; attribution và AdChoices do SDK quản lý vẫn được giữ nguyên.

## Amazon Appstore / Fire OS

- Bản đồ dùng MapLibre Native + nguồn mở và hạ về OSM khi gateway không sẵn sàng hoặc người dùng chưa đăng nhập; không cần Google Maps SDK trên Fire OS. Stadia có khóa chỉ đi qua gateway đã xác thực.
- Ghi hành trình lưu ngay điểm đầu tiên. Trên thiết bị Amazon/Fire, ứng dụng dùng lớp dự phòng Android `LocationManager` không phụ thuộc Google Play Services; nếu không có quyền nền, ứng dụng chuyển sang foreground watcher thay vì báo khởi động thành công nhưng không có dữ liệu.
- Ads Fire đang tắt theo store boundary; không bật Google Mobile Ads trên Fire bằng một biến môi trường. Android Google và iOS dùng cấu hình quảng cáo riêng như BUILD.md.
- `src/screens/SettingsScreen.tsx`: chỉ hiển thị trạng thái có/chưa cấu hình, không hiển thị key.

## Ưu tiên mã nguồn mở

- Dữ liệu hành trình: `expo-sqlite`, lưu local-first.
- Tài khoản: Firebase Authentication. Backend dữ liệu tùy chọn: Supabase; có thể self-host và xác minh Firebase ID token qua Third-party Auth.
- Thời tiết: Open-Meteo qua Edge Function, không yêu cầu key phía ứng dụng.
- UI/native: React Native, Expo modules, Expo Blur, Expo Linear Gradient và Expo Vector Icons.
- Renderer chính: MapLibre Native + OpenStreetMap, có pitch và raster DEM cho địa hình 3D. Cần development/native build; Expo Go không chứa module này.
- Renderer dự phòng và kiểm tra chéo: Leaflet, MapLibre GL JS, OpenLayers và CesiumJS trong WebView. Cesium có globe 3D; bật `EXPO_PUBLIC_CESIUM_TERRAIN_ENABLED` chỉ khi gateway đã có Ion secret, asset terrain được cố định phía server.
- Routing: OSRM/Valhalla public không cần khóa; TomTom/GraphHopper chỉ qua `cloudflare/geo-gateway`. Gateway yêu cầu Firebase ID token đã đăng nhập, guest dùng OSM public. Xem auth, quota, CORS và triển khai trong BUILD.md.

Sau khi thêm MapLibre Native, chạy lại `npx expo prebuild` và native build. Không cần migration dữ liệu vì mọi engine dùng chung tọa độ WGS84.

Không đưa service-role key, private signing key hoặc secret backend vào biến `EXPO_PUBLIC_*`; các biến này có mặt trong bundle ứng dụng.
