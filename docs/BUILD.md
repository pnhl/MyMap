# Build ba cửa hàng từ cùng commit

Nguồn version: `release.json`, hiện 1.0.4/build 38. `node scripts/bump-release.cjs [x.y.z]` cập nhật mirrors và mọi native target qua CNG. Build 38 vượt 36/37 đã cung cấp; chủ dự án phải đối chiếu số cao nhất đã publish trước phát hành.

## Trạng thái

Pipeline và gates đã có code; **chưa có release set năm artifact của commit mới**. Gradle locks/checksums từng store/Wear đã resolve và compile strict trên fixture Windows; hai APK và Google AAB unsigned Release R8/16KB đạt. Production signing/ABI khác cần kiểm tiếp. Podfile.lock còn thiếu, production iOS cố ý dừng. Không dùng credential thật, triển khai backend hay upload store trong lượt này.

## Toolchain và inputs

Node 24.14.0, npm lockfile; JDK 21; Expo 57/RN 0.86.3/Hermes/New Architecture; Gradle wrapper 9.3.1, Kotlin 2.3.20, Android SDK 36. EAS CLI 24.7.0. iOS EAS image `macos-tahoe-26.5-xcode-26.6`, CI runner macos-26 chọn Xcode_26.6, deployment 16.4/static frameworks/Firebase disableSPM. Runner thiếu đúng Xcode phải dừng; không tự chuyển latest. Xem [Expo infrastructure](https://docs.expo.dev/build-reference/infrastructure/).

`npm ci --ignore-scripts`; `npm run prepare:android` hoặc `node scripts/prepare-ios-ai.cjs`. Native patches kiểm phiên bản/marker, không vá mù upstream mới. Theo `config/native-locks/README.md` để resolve, review và commit Pod lock, Gradle lock + verification metadata từng store. iOS dùng `pod install --deployment`. Không tạo lock giả trên Windows.

`APP_STORE_TARGET=ios|play|amazon` chọn native. `MYMAP_STORE` là alias cũ; nếu cả hai có giá trị thì phải khớp. Không đưa store target vào EXPO_PUBLIC/Metro: hai APK phải dùng cùng JS inputs, gồm public env. Fire loại Google Sign-In/GMA/FCM initializer và không có Auto/Nano provider. Ads Fire tắt; không có cờ bật GMA Fire chưa nghiệm thu.

`release-inputs.cjs` ghi commit SHA, SHA npm lock, feature flags, fingerprint public config (không ghi giá trị), fingerprint toàn bộ inputs vào plist/Android asset. Guard so embedded inputs với provenance sidecar và so tất cả artifact. Public config phải giống giữa các job. SHA artifact ký lại có thể khác vì timestamp/chữ ký; không hứa byte-for-byte reproducibility.

## Secrets (chỉ tên)

- CI: MYMAP_PUBLIC_ENV, FIREBASE_ANDROID_BASE64, FIREBASE_IOS_PLIST_BASE64; EXPO_TOKEN; EAS_PROJECT_ID.
- Google: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD.
- Amazon: AMAZON_KEYSTORE_BASE64, AMAZON_KEYSTORE_PASSWORD, AMAZON_KEY_ALIAS, AMAZON_KEY_PASSWORD. Có thể dùng cùng khóa nếu chủ dự án muốn cập nhật thay thế; không tự suy ra.
- Local injection: GOOGLE_SERVICES_JSON, GOOGLE_SERVICES_PLIST, GOOGLE_IOS_REVERSED_CLIENT_ID. Firebase files phải khớp applicationId và cùng project. Không import JSON từ JS, không đổi analytics/ads false thành true.
- Apple: distribution certificate/provisioning app, widget, Watch qua EAS remote credentials; không commit p12/p8/mobileprovision. App group `group.com.pnhl.vibecoding` phải nằm trong profile app/widget.
- Public AdMob IDs nằm ở config/admob.json. EXPO_PUBLIC_ADMOB_IOS_* và EXPO_PUBLIC_ADMOB_* cho Android override theo placement. Release chặn sample ID và known wrong-platform unit. Unit tùy chỉnh phải được chủ tài khoản đối chiếu nền tảng trong AdMob; không suy đoán nền tảng từ một ID số chưa có registry.

Tạo keystore mới bằng keytool ở máy quản trị, password nhập tương tác; kiểm fingerprint certificate và lưu bản sao trong secret manager. Không ghi password trên command line. Local signing nằm `.signing/play/release.properties` hoặc `.signing/amazon/release.properties`; Gradle configure/compile không yêu cầu file, chỉ tác vụ assemble/bundle/sign release mới đọc. Artifact unsigned/debug signer không qua release gate.

EAS Android dùng credentialsSource=local, tách `.signing/play/eas-credentials.json` và `.signing/amazon/eas-credentials.json`. Mỗi JSON theo schema EAS `android.keystore` chứa keystorePath, keystorePassword, keyAlias, keyPassword; đường dẫn trỏ keystore private của đúng store. Các lệnh npm build ở dưới staging file đã chọn thành credentials.json trong lúc gọi EAS rồi xóa trong finally; từ chối ghi đè credentials.json có sẵn. Gọi eas trực tiếp cần tự staging an toàn tương đương. CI bắt buộc secrets đúng store, không ngầm dùng khóa Google khi thiếu khóa Amazon. Không tạo/read credential thật trong lượt này.

Cloudflare Secrets Store đã được cấu hình trước đây; xem [CLOUDFLARE_SECRETS.md](CLOUDFLARE_SECRETS.md). Chưa có bridge tự động từ Secrets Store sang GitHub/EAS. Không tạo API trả plaintext secret cho app. `EXPO_PUBLIC_*` luôn là dữ liệu nhúng client dù nguồn cấp nằm trong secret manager. [PUBLIC_CONFIG.md](PUBLIC_CONFIG.md) kiểm kê mọi tên public và phân loại provider keys.

## Proxy provider qua Cloudflare

Mobile chỉ giữ base URL HTTPS `EXPO_PUBLIC_ROUTING_GATEWAY_URL`. Các khóa Stadia, TomTom, Mapillary, GraphHopper và Cesium không có biến `EXPO_PUBLIC_*` tương ứng nữa. Public style/tile/offline/DEM URLs cũng không được chứa key, signed token hoặc user/password. Build input guard từ chối tên biến provider public cũ và cấu hình URL chứa credentials; sửa `MYMAP_PUBLIC_ENV`/EAS public env theo `.env.example` mới trước khi build. Không khôi phục nguyên khối `MYMAP_MOBILE_BUILD_ENV`: bản lưu này có thể còn khóa của mobile cũ.

Worker ở `cloudflare/geo-gateway/` xác minh Firebase ID token người dùng bằng chữ ký RS256, issuer/audience của project và hạn dùng; token anonymous bị từ chối. Guest dùng các nguồn OSM public. Không cần Firebase Admin private key. Gửi token bằng header Authorization, không đặt vào query URL. `GET /health` là endpoint dữ liệu công khai duy nhất; OPTIONS chỉ phục vụ CORS preflight. Health không đọc secret hoặc gọi provider. Các routes proxy `/route`, `/stadia/...`, `/tomtom/...`, `/mapillary/...`, `/cesium/terrain/...` chỉ chấp nhận method, path và tham số đã cho phép, với upstream host cố định. Cesium chỉ relay terrain asset 1, không nhận asset/upstream URL tùy ý. [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

`scripts/maplibre-privacy-patch.cjs` chặn native MapLibre request debug logs và thay error logs bằng thông báo cố định trên cả Android/iOS; SDK gốc ghi cả giá trị header. Expo config và native preparation áp dụng bản vá có kiểm tra phiên bản trước khi compile. Phải build lại native app để có bản vá này; OTA JavaScript trên binary cũ không sửa được native logging. Worker và app có deadline cho yêu cầu proxy; Cesium relay chuyển các terrain extensions đã cho phép sang upstream và giữ metadata availability.

Durable Object `GEO_QUOTA`/`GeoQuota` áp dụng quota có trọng số theo UID (240 đơn vị/phút, 5.000/ngày) và toàn gateway (3.000/phút, 50.000/ngày); cửa sổ ngày theo UTC. Tile tốn ít hơn route/matrix/image; chi tiết trong README gateway. Hết quota trả HTTP 429 và `Retry-After`; app phải tôn trọng thời gian thử lại. Quota server không thay thế giới hạn ngân sách/hạn mức tại provider.

Tên secret dành riêng cho gateway:

| Secret Store name | Binding Worker | Provider |
|---|---|---|
| `MYMAP_STADIA_MAPS_API_KEY` | `STADIA_KEY` | Stadia raster/static maps |
| `MYMAP_TOMTOM_TRAFFIC_KEY` | `TOMTOM_KEY` | TomTom routing, traffic, places, range, matrix |
| `MYMAP_MAPILLARY_ACCESS_TOKEN` | `MAPILLARY_TOKEN` | Mapillary tiles/metadata/image relay |
| `MYMAP_GRAPHHOPPER_KEY` | `GRAPHHOPPER_KEY` | GraphHopper routing, nếu bật |
| `MYMAP_CESIUM_ION_TOKEN` | `CESIUM_ION_TOKEN` | Cesium terrain asset cố định, nếu bật |

Không đưa signing secrets, Firebase JSON/plist hoặc `MYMAP_MOBILE_BUILD_ENV` vào bindings của gateway. Các secret đã lưu cần binding Secrets Store; chỉ tên/ID được commit, giá trị lấy qua `.get()` phía Worker. [Cloudflare bindings](https://developers.cloudflare.com/secrets-store/integrations/workers/).

Ba binding Stadia/TomTom/Mapillary đã có trong `wrangler.jsonc`. GraphHopper/Cesium tùy chọn: thêm Secrets Store binding như bảng, hoặc nhập ordinary Worker secrets tên `GRAPHHOPPER_KEY`, `CESIUM_ION_TOKEN` bằng `wrangler secret put <NAME>` ở thư mục gateway. Worker hỗ trợ cả hai cách; không thêm secret vào `vars`. `EXPO_PUBLIC_CESIUM_TERRAIN_ENABLED=false` mặc định, chỉ bật sau khi secret server đã được cấp.

Triển khai bằng Wrangler đã khóa phiên bản trong package lock riêng:

```sh
npm ci --prefix cloudflare/geo-gateway
node cloudflare/geo-gateway/node_modules/wrangler/bin/wrangler.js login
npm run check --prefix cloudflare/geo-gateway
npm run deploy --prefix cloudflare/geo-gateway
```

Trước deploy, xác nhận `FIREBASE_PROJECT_ID` trong `cloudflare/geo-gateway/wrangler.jsonc` khớp project ID công khai của Firebase mobile. Kiểm tra secret bindings; giữ `GEO_QUOTA` binding và SQLite migration `geo-quota-v1`. Project ID không phải secret; không đọc Firebase private files để tìm nó trong phiên không được phép dùng credentials. `ALLOWED_ORIGINS` hiện là `https://app.mymap.local,null` cho WebView của app; native request không có Origin cũng được chấp nhận. Origin `null` chỉ đáp ứng CORS của local WebView, không thay thế xác thực token. Nếu dùng browser ở origin khác, thêm chính xác origin vào danh sách phân cách bằng dấu phẩy, không dùng wildcard. `ROUTING_PROVIDERS` mặc định `tomtom,osrm,valhalla,graphhopper`. Giữ observability logs tắt để tránh thu thập header/token hoặc URL chứa provider key. Đặt base URL đã deploy vào public env chung cho cả ba bản.

Xác minh production chỉ qua endpoint không trả khóa:

```sh
curl --fail --silent --show-error https://<GATEWAY_HOST>/health
```

Đáp ứng health chỉ chứng minh Worker đang phục vụ, không chứng minh mọi provider key/quota đã cấu hình đúng. Kiểm tra auth, allowlist, rate limit và redaction bằng tests với token/key giả; không in token, provider URL có key hoặc raw upstream error khi debug.

Sau build, chạy gate cho bundle/Hermes và mọi native release:

```sh
npm run check:provider-secrets -- <BUNDLE_OR_HBC> <GOOGLE_AAB> <GOOGLE_APK> <AMAZON_APK> <SIGNED_IPA> <UNSIGNED_IPA>
```

`npm run check:public-config` chạy trước build để chặn public input sai. `scripts/scan-provider-secrets.py` và artifact verifier quét nội dung release, bao gồm mọi ZIP entry/native binary strings/Hermes, và FAIL khi thấy định dạng khóa provider, credential trong provider URL hoặc biến public provider đã cấm. Gate báo lỗi đã che chi tiết, không in chuỗi khớp. CI xuất và quét Hermes Android/iOS cùng toàn bộ resources; các job release quét native artifacts; verifier áp dụng cùng gate cho cả năm release artifacts. Không đổi đuôi file hoặc bỏ gate để phát hành. Scanner dùng nhận dạng định dạng/ngữ cảnh, không thể phân biệt mọi bare UUID/hash với secret; việc loại hẳn secret inputs và dùng proxy là lớp bảo vệ chính.

Hermes v98 được quét theo từng entry của string table, vì các chuỗi khác nhau có thể nằm liền nhau hoặc dùng chung vùng lưu trữ; không ghép chúng thành URL giả. Gate kiểm checksum file, giới hạn kích thước và phạm vi entry, vẫn quét các bytes ngoài string table và vùng không được tham chiếu. Hermes version chưa hỗ trợ hoặc file hỏng làm gate FAIL; khi nâng compiler phải cập nhật parser/tests theo định dạng chính thức. Native binaries và các resource khác tiếp tục được quét toàn bộ.

`config/public-sdk-credential-shapes.json` giữ SHA-256 của đúng 21 hằng số công khai từng trùng heuristic opaque key trong Google Mobile Ads 25.0.0 và ML Kit vision-internal-vkp 18.2.3, cùng Maven coordinate, checksum AAR đã khóa và class/native library nguồn. Không lưu literal. Ngoại lệ chỉ áp dụng cho heuristic 32 ký tự; URL/label chứa credential, Mapillary token, JWT và tên biến cũ vẫn FAIL kể cả khi literal thuộc SDK công khai. Nâng SDK phải đối chiếu lại artifact gốc và cập nhật tests; không thêm mã băm khóa của ứng dụng vào danh sách này. Các đoạn 32 ký tự bên trong Base64 certificate/checksum dài hơn không được xem là một opaque key hoàn chỉnh; scanner giữ ranh giới bytes và streaming window để tránh tạo token giả.

## Xoay khóa sau bản chuyển proxy

Sau khi Worker và bản mới cho iOS/Google/Amazon đã sẵn sàng, xoay các khóa **đã từng nhúng trong app/config public/URL**: `MYMAP_STADIA_MAPS_API_KEY`, `MYMAP_TOMTOM_TRAFFIC_KEY`, `MYMAP_MAPILLARY_ACCESS_TOKEN`, `MYMAP_GRAPHHOPPER_KEY`, `MYMAP_CESIUM_ION_TOKEN`. Tạo khóa thay thế với quyền tối thiểu, cập nhật binding/secret server, phát hành bản mobile không có khóa, rồi thu hồi khóa cũ theo kế hoạch chuyển phiên bản. Nếu provider không cho hai khóa song song, lên lịch bước chuyển và thông báo việc bản cũ có thể mất tính năng provider.

Quét lại đủ năm artifacts phát hành và bundle đã xuất trước khi bàn giao; xóa các biến provider public cũ khỏi GitHub/EAS/local build env bằng công cụ quản trị, không dán giá trị vào chat hoặc commit. Xử lý bản backup `MYMAP_MOBILE_BUILD_ENV` như cấu hình legacy chứa khóa đã thu hồi; không dùng lại làm input. Thu hồi khóa mới là bước vô hiệu hóa bí mật trong bundle cũ; phát hành bản mới không xóa khóa khỏi những APK/IPA người dùng đã có. Không cần xoay AdMob app/unit IDs, OAuth client IDs hoặc Supabase publishable key chỉ vì chúng là public.

## Lệnh build và bàn giao

APK thử nghiệm cài song song dùng application ID riêng (`com.pnhl.vibecoding.preview`) và khóa ký preview riêng, giữ nguyên khóa đó cho các lần cập nhật preview. Moment FileProvider khai báo `${applicationId}.moments.files` để địa chỉ khớp `app.packageName` trong native module và không trùng bản chính. Khi nghiệm thu APK preview, cài bản chính trước rồi cài preview và mở preview; kiểm tra riêng bước này vì khởi chạy preview trên máy trống không phát hiện xung đột provider. Bản chính vẫn giữ địa chỉ `com.pnhl.vibecoding.moments.files` để tương thích khi cập nhật.

Firebase giả trong native fixture chỉ dùng để compile/QA không đăng nhập; bật Google trên Firebase thật không tự cập nhật APK đã build bằng fixture. Preview cần đăng nhập phải được cho phép kết nối Firebase thật, đăng ký package Preview và SHA-1/SHA-256 của khóa Preview trong cùng project, rồi lấy `google-services.json` mới qua injection riêng ngoài Git. Manifest release tạm trong workspace build phải chọn application ID Preview trước khi Expo lấy OAuth clients; giữ manifest release chính của repo nguyên vẹn. Preflight kiểm đúng package và có cả Android/Web OAuth clients, native resources và Expo `extra.firebaseOAuth` phải cùng project/config. Build lại APK, kiểm nút Google và luồng mở màn hình tài khoản; người dùng tự hoàn tất đăng nhập, không thu thập hay ghi log mật khẩu/token. Không chép cấu hình của package chính sang Preview hoặc coi việc nút đã bật là bằng chứng đăng nhập thành công.

Commit source sạch, native locks đã duyệt, cấu hình CI/EAS đầy đủ rồi mới chạy trong phiên được phép dùng signing:

```text
npm run build:ios        # ios-store + ios-unsigned
npm run build:android    # android-play AAB + android-apk
npm run build:amazon     # android-amazon APK
npm run build:all        # đủ năm artifact, provenance, SHA, release-set.json
```

Unsigned profile dùng custom EAS workflow không cần signing, tạo Release app/extensions/Watch với CODE_SIGNING_ALLOWED=NO. Không chạy unsigned trong cùng profile ký rồi giả đổi tên. Trên Windows signed IPA gate cần proof từ macOS gắn đúng hash; chạy build:all trên macOS hoặc dùng CI cho bộ đầy đủ. [EAS custom build schema](https://docs.expo.dev/custom-builds/schema/).

CI checks dùng Firebase giả, lint/types/Node/Python. Native fixture matrix Google/Fire compile Kotlin, kiểm merged manifest và JVM no-GMS boundary tests không cần ký. Workflow dispatch build_release=true chạy Android matrix, signed EAS IPA và unsigned macOS IPA; parity yêu cầu cả năm. Chưa dispatch production trong lượt này. Gate thực thi DEX class definitions + init methods, ELF64/ZIP16KB, whitelist/rules, Hermes bytecode, versions, JS parity, per-target iOS signatures/profiles/appgroups (macOS), dev-string classification JS/resources/native. Job macOS xuất `.signature-verification.json` gắn SHA IPA/commit/targets; Linux complete gate bắt buộc proof này. [Android page sizes](https://developer.android.com/guide/practices/page-sizes).

## Push và review notes

Áp dụng `supabase/features/push_provider_registry.sql` sau migration push cũ, review trên database test rồi deploy function mymap-push. Registry v2 giữ token/lease private, owner lấy từ Firebase identity đã xác minh; provider expo/adm gắn store. Expo chuyển APNs/FCM, ADM gửi trực tiếp. Server secrets ADM_CLIENT_ID/ADM_CLIENT_SECRET/EXPO_ACCESS_TOKEN không đưa vào mobile. Credentials qua [Edge Function secrets](https://supabase.com/docs/guides/functions/secrets).

ADM bật riêng bằng MYMAP_ENABLE_ADM=true với MYMAP_ADM_SDK_JAR và MYMAP_ADM_SDK_SHA256 đã review, MYMAP_ADM_API_KEY_FILE inject asset khi yêu cầu signing/appstore. Chưa có SDK/key để compile/nhận trên Fire, mặc định off. Hai permission ADM + signature permission chỉ thêm khi bật, lý do ở PARITY_NOTES. [Amazon integration](https://developer.amazon.com/docs/adm/integrate-your-app.html), [ADM send](https://developer.amazon.com/docs/adm/send-message.html).

Thông báo chat/call generic, channel high priority, call TTL 60 giây, chạm mở Call/Chat đúng owner; không hứa notification đồng nghĩa người nhận đã đọc. Full-screen intent, CallKit/PushKit chưa bật; cần quyền/entitlement và triển khai riêng. CarPlay MYMAP_ENABLE_CARPLAY=false mặc định. Wear giữ cuối quy trình, chỉ Google phone và Wear phải cùng signer cho Data Layer.

App Review: location dùng cho recorder opt-in; audio cho nhạc; processing cho sync; remote-notification cho delivery contract. Không có fetch, không dùng các mode này giả dịch vụ CoreMotion liên tục. Kiểm thiết bị theo MANUAL_TEST_CHECKLIST.md trước phát hành.
