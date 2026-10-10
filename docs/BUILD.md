# Build ba cửa hàng từ cùng commit

Nguồn version: `release.json`, hiện 1.0.4/build 38. `node scripts/bump-release.cjs [x.y.z]` cập nhật mirrors và mọi native target qua CNG. Build 38 vượt 36/37 đã cung cấp; chủ dự án phải đối chiếu số cao nhất đã publish trước phát hành.

## Trạng thái

Pipeline và gates đã có code; **chưa có release set năm artifact của commit mới**. Gradle locks/checksums từng store/Wear đã resolve và compile strict trên fixture Windows; Fire unsigned Release R8/16KB đạt. Google full release/host Linux cần kiểm tiếp. Podfile.lock còn thiếu, production iOS cố ý dừng. Không dùng credential thật, triển khai backend hay upload store trong lượt này.

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

Cloudflare Secrets Store đã được cấu hình trước đây; xem CLOUDFLARE_SECRETS.md. Chưa có bridge tự động từ Secrets Store sang GitHub/EAS. Không tạo API trả plaintext secret cho app. EXPO_PUBLIC vẫn là dữ liệu nhúng client dù nguồn cấp nằm trong secret manager.

## Lệnh build và bàn giao

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
