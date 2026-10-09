# MyMap — Báo cáo Giai đoạn 0: nguồn build và đồng bộ tính năng

Ngày khảo sát: **10/10/2026, Asia/Saigon**. Trạng thái: **chỉ khảo sát; chờ chủ dự án duyệt trước Giai đoạn 1**.

## 1. Kết luận và phạm vi bằng chứng

Hiện chưa có pipeline tái tạo cả ba kênh từ một commit. Nguồn Android/Amazon và nguồn iOS đang tách thành hai thư mục có khác biệt thực chất ở cả JS, native, dependencies và CI. Chỉ đưa cấu hình iOS trong `mymap/app.json` vào EAS sẽ không giữ được tính năng của checkout iOS riêng.

Quy ước đường dẫn trong báo cáo:

- **A/** = [mymap](<C:/Users/ThinkBook 16 G8/Documents/mymap>), thư mục làm việc được yêu cầu.
- **I/** = [MyMap-IOS](<C:/Users/ThinkBook 16 G8/Documents/MyMap-IOS>), checkout iOS được phát hiện qua các script lịch sử `A/.local/adapt-ios.cjs`, `connect-ios-widget.cjs`, `audit-ios-publish.cjs`; chỉ đọc để đối chiếu.

Không sửa code, config, quyền hay signing; không cài dependencies, prebuild, build, commit hoặc tải lên cửa hàng. Chỉ tạo báo cáo Markdown này. Không đọc nội dung keystore/properties ký, không đưa giá trị API key hoặc token vào báo cáo. Không chạy lại các script `.local`.

Fingerprint của 375 tệp trong nhóm source/config/scripts/tests đã đối chiếu trước và sau khi viết báo cáo không đổi: `70fc3a446475443bb244fd6604ee9ab04f2a33666d5945d819ca45494322c4e2`. Phạm vi gồm src, plugins, modules (loại build/cache), scripts, tests, .github, ios-tests và tám tệp cấu hình/entrypoint gốc; đây không phải commit SHA hoặc kiểm toàn bộ filesystem.

| Bằng chứng | Kết quả | Giới hạn |
| --- | --- | --- |
| Git tại A | `git rev-parse` và `git status` báo không phải repository; không có `.git` trong A hoặc thư mục cha | Không thể gán SHA commit, kiểm tra tracked secrets hay tạo các commit nhỏ tại A |
| Git tại I | HEAD `acc970593ef07b107087db9fdf94924a3fddb4bc`; `git status --short` rỗng lúc đọc | Không chứng minh IPA được mô tả đã build từ HEAD này |
| A: cấu hình | `app.json`, `app.config.ts`, `package.json`, plugins, modules, Android native, scripts và CI đã đọc | Không có `A/eas.json`, không có `A/ios/` |
| I: cấu hình | Có `eas.json`, plugin companion, Widget, Swift modules và CI riêng | Không có `I/ios/` tại thời điểm khảo sát; chưa thấy IPA local trong hai cây nguồn |
| Artifact thực tế | Hai APK ở `A/dist/releases/build-36/`, kiểm trực tiếp bằng AAPT, ZIP và kiểm DEX | Không chạy trên iPhone, Android hoặc Fire tablet trong khảo sát này |
| iOS build 37, debug dylib, background `fetch` | Ghi nhận do chủ dự án cung cấp; buildNumber 37 khớp source I | Chưa kiểm lại nội dung IPA; không coi các finding trong IPA là đã được sửa |
| Tài liệu kiểm thử cũ | Có báo cáo sửa startup build 36 và nhiều báo cáo tính năng trong A/docs | Không thay thế kết quả kiểm thiết bị thật lần này |

### 1.1. Hai APK đã kiểm

| Thuộc tính | Android Google | Amazon |
| --- | --- | --- |
| File | `A/dist/releases/build-36/MyMap-1.0.4-android-release.apk` | `A/dist/releases/build-36/MyMap-1.0.4-amazon-release.apk` |
| Package / version / code | `com.pnhl.vibecoding` / `1.0.4` / `36` | Giống Android Google |
| minSdk / targetSdk / compileSdk | `24` / `36` / `36` | Giống Android Google |
| ABI | `armeabi-v7a`, `arm64-v8a` | Giống Android Google |
| `debuggable` | Không có thuộc tính bật; AAPT không báo application-debuggable | Giống Android Google |
| `allowBackup` | `true` | `true` |
| AdMob App ID | Có ID không thuộc dải test Google | Giống Android Google; vẫn có MobileAdsInitProvider |
| Embedded Expo config | `version=1.0.4`, `android.versionCode=36`, `ios.buildNumber=23` | Giống Android Google |
| JS bundle | `assets/index.android.bundle`, 8.573.980 byte | Cùng kích thước và SHA-256 |
| Kiểm DEX startup | Có definition/phương thức `LiveKit JniInit.init` và constructor `RNHeadlessAppLoader` | Đạt cùng kiểm tra |

SHA-256 JS chung: `c67a5e02e9f6a44d5ea3603e2e81d2c35c9e920c86a43529f7c00b3207ae1c9c`.

SHA-256 APK Google: `af1129d4993f5903f404dfcdf7e7da412315d2eb2241b16b1ae03344979dab79`.

SHA-256 APK Amazon: `72bbb4f23bed140e3d6d73b1b329bf54ddebad7c4a47e7ab2f6bce2d3d0fd8c8`.

Hash JS giống nhau xác nhận nội dung bundle của **hai APK này**, không chứng minh commit nguồn hoặc feature parity native. Chưa kiểm chữ ký lại trong lần khảo sát này.

## 2. Ma trận tính năng

Mỗi ô chỉ dùng bốn trạng thái yêu cầu. **Có** nghĩa là tìm thấy triển khai và đường gọi trong source, không có nghĩa đã đạt QA thiết bị/release. **Khác cách làm** có triển khai một phần hoặc bị giới hạn capability, ghi rõ ngay trong ô. **Thiếu** chưa thấy luồng thực hiện đầy đủ. **Không áp dụng được** chỉ dùng cho công nghệ đặc thù hệ điều hành; không tự động miễn yêu cầu trải nghiệm tương đương.

Cột iOS đối chiếu I để phản ánh nguồn iOS hiện có; cột cuối ghi rõ tính năng chỉ ở I và chưa nằm trong A. Các đường dẫn cùng tên ở I và A phải hợp nhất có kiểm tra, không copy đè.

| Tính năng | iOS | Android | Amazon | Bằng chứng / giới hạn |
| --- | --- | --- | --- | --- |
| Bản đồ MapLibre, tìm địa điểm, dẫn đường | Có | Có | Có | `A/src/components/MapLibreNativeMap.tsx`, `A/src/services/roadRouting.ts`; bản tương ứng I; Fire phụ thuộc GPU/network/provider |
| Bản đồ và tuyến offline | Có | Có | Có | `A/src/services/offlineMap.ts`, `offlineRoutes.ts`, `A/src/screens/OfflineMapsScreen.tsx`; bản I tương ứng; cần dữ liệu đã tải |
| GPS khi mở app | Khác cách làm — CoreLocation | Có | Khác cách làm — system LocationManager | `A/src/services/platformLocation.ts`, `A/plugins/native/PlatformLocationModule.kt`; adapter I dùng Expo |
| Ghi hành trình khi khóa màn hình | Khác cách làm — Expo/CoreLocation | Có | Khác cách làm — PlatformTrackingService | `A/src/services/locationTracking.ts`, `backgroundLocationTask.ts`, `A/plugins/native/PlatformTrackingService.kt`; `I/src/services/locationTracking.ts`; phải thử thực địa |
| Khôi phục sau reboot/update | Khác cách làm — theo lifecycle iOS | Khác cách làm — receiver có nhưng chưa nối recorder chung | Khác cách làm — cùng receiver; cần Fire QA | `A/modules/my-map-safety/android/src/main/java/expo/modules/mymapsafety/BootReceiver.kt`, `MyMapForegroundService.kt` cùng thư mục; prefs của receiver khác trạng thái JS/PlatformTrackingService |
| SOS chủ động, lưu/đồng bộ sự kiện | Có | Có | Có | `A/src/services/liveSafety.ts`, `sosLocation.ts`, `A/src/screens/SOSScreen.tsx`; source I tương ứng; lưu sự kiện không chứng minh bên nhận đã nhận |
| Mở số khẩn cấp | Khác cách làm — hệ thống xác nhận | Khác cách làm — mở dialer, người dùng ấn gọi | Khác cách làm — thiếu dialer thì không gọi được | `A/src/services/liveSafety.ts`, `A/plugins/native/TravelPlatformModule.kt`, `I/modules/my-map-ios/ios/MyMapTravelModule.swift`; cần fallback trên tablet |
| Phát hiện va chạm/té ngã khi app mở | Khác cách làm — CoreMotion | Khác cách làm — SensorManager | Khác cách làm — phụ thuộc cảm biến | `A/src/services/incidentDetection.ts`, `A/modules/my-map-safety/{ios,android}`, `A/src/screens/SmartScreen.tsx`; thuật toán/ngưỡng native khác nhau |
| Giám sát nền, rơi cao + 5 phút không tương tác | Thiếu — I chủ động dừng motion khi background | Có | Khác cách làm — service có; barometer có thể thiếu | `I/modules/my-map-ios/ios/MyMapTravelModule.swift`, `A/plugins/native/SafetyMonitorService.kt`, `A/src/components/SafetyMonitor.tsx`; iOS deadline/height luôn 0 |
| Geofence và thông báo tới/rời địa điểm | Khác cách làm — Expo/CoreLocation | Có | Khác cách làm — chưa xác nhận Expo geofencing không GMS | `A/src/services/geofencing.ts`; `I/modules/my-map-safety/ios/MyMapSafetyModule.swift`; GPS fallback không tự bảo đảm geofence fallback |
| Ảnh/kỷ niệm địa điểm, SQLite, timeline | Có | Có | Có | `A/src/services/photoPins.ts`, `moments.ts`, `A/src/db/database.ts`, `A/src/screens/TimelineScreen.tsx`; bản I tương ứng |
| Camera/video/micro/lời nhắn | Có | Có | Khác cách làm — kiểm thiết bị có phần cứng | `A/src/screens/MomentCameraScreen.tsx`, `A/src/components/ChatAudioRecorder.tsx`; plugin hardware optional trên Android |
| Hàng đợi offline và đồng bộ dữ liệu | Có | Có | Có | `A/src/services/sharedSync.ts`, `privateChat.ts`, `moments.ts`, `localProfile.ts`; I tương ứng; scheduling do OS quyết định |
| Bạn bè, chia sẻ vị trí/quyền riêng tư | Có | Có | Có | `A/src/services/realtimeFriends.ts`, `sharingPrivacy.ts`, `ghostMode.ts`; I tương ứng; phụ thuộc backend/auth |
| Chat | Có | Có | Có | `A/src/services/privateChat.ts`, `A/src/screens/ChatScreen.tsx`; I tương ứng; chưa thử hai thiết bị |
| Gọi LiveKit/WebRTC khi app hoạt động | Có | Có | Có | `A/src/services/calls.ts`, `A/src/screens/CallScreen.tsx`; token endpoint `mymap-livekit`; chưa xác minh gọi thật/khóa màn hình |
| Báo cuộc gọi/chat khi app bị đóng | Thiếu | Thiếu | Thiếu | Chưa tìm thấy token registration + server delivery + lifecycle incoming-call hoàn chỉnh; `notificationInbox.ts` chỉ đọc inbox/local notifications |
| Thông báo local | Có | Có | Có | `A/src/services/geofencing.ts`, `destinationPrediction.ts`, `A/src/screens/CatalogScreen.tsx`; I tương ứng; cần cấp quyền |
| Push remote APNs/FCM/ADM | Thiếu — SDK có, chưa có pipeline | Thiếu — FCM components có, chưa có pipeline | Thiếu — không có ADM | Chưa thấy `getExpoPushTokenAsync`/`getDevicePushTokenAsync` trong source app của A/I; APK Amazon vẫn chứa FCM service |
| Email/password và tài khoản khách | Có | Có | Khác cách làm — Firebase Auth cần kiểm Fire thật | `A/src/services/auth.ts`, `firebase.ts`, `I/src/services/auth.ts`; không được kết luận toàn bộ Firebase cần GMS |
| Google Sign-In | Có | Có | Khác cách làm — kiểm GMS rồi báo dùng phương thức khác | `A/src/components/GoogleFirebaseButton.tsx`; có `hasPlayServices`, nhưng UI không tự ẩn và không có web OAuth fallback |
| Phone OTP | Có | Có | Khác cách làm — luồng kiểm chứng app/reCAPTCHA chưa thử | `A/src/services/auth.ts`; chưa coi SMS là fallback đã chứng minh cho Fire |
| Apple Sign-In | Khác cách làm — I chỉ bật theo env | Thiếu — chưa có web/link-account | Thiếu — chưa có web/link-account | `A/src/services/auth.ts`; `I/app.config.ts`, `MYMAP_ENABLE_APPLE_SERVICES`; email khác không tự liên kết cùng Firebase UID |
| Game Center sign-in | Khác cách làm — I chỉ bật theo env | Không áp dụng được | Không áp dụng được | `A/modules/my-map-game-center/ios/MyMapGameCenterModule.swift`; `I/app.config.ts`; giữ phương thức tài khoản chung khác |
| Magic link | Thiếu | Thiếu | Thiếu | `A/src/services/auth.ts` trả thông báo chưa cấu hình gửi; không coi callback parser là đủ tính năng |
| Khóa ứng dụng sinh trắc | Khác cách làm — Face ID/Touch ID | Khác cách làm — BiometricPrompt API 28+ | Khác cách làm — tùy OS/cảm biến | `A/src/components/AppLock.tsx`, `platformCapabilities.ts`, `A/modules/my-map-capabilities/{ios,android}`; chưa có fallback PIN/device credential |
| Mã hóa vault/chữ ký thiết bị | Khác cách làm — Keychain/CryptoKit | Khác cách làm — AndroidKeyStore | Khác cách làm — AndroidKeyStore | `A/modules/my-map-capabilities`; I tương ứng; có API không có nghĩa toàn bộ SQLite đã mã hóa |
| Home screen Widget khoảnh khắc | Khác cách làm — I có timeline, bật theo env | Có | Khác cách làm — launcher phải hỗ trợ | `I/src/widgets/MomentWidget.tsx`, `I/src/services/momentWidget.ts`, `A/plugins/native/MomentWidget.kt`, `MomentWidgetWorker.java`; **iOS widget chưa có ở A** |
| Live Activities / trạng thái tracking ngoài app | Thiếu — thư viện có capability, chưa có start/update/end | Khác cách làm — ongoing notification | Khác cách làm — ongoing notification | Không có `createLiveActivity`/luồng lifecycle trong source I; `A/plugins/native/PlatformTrackingService.kt`; extension có mặt không chứng minh tính năng chạy |
| Quick Settings tile / shortcut tương đương | Thiếu — chưa có App Intent/Shortcut/Control | Khác cách làm — tile mới điều khiển service thông báo | Khác cách làm — service tồn tại, Fire có thể không có surface tile | `A/modules/my-map-safety/android/src/main/java/expo/modules/mymapsafety/MyMapTileService.kt`; `MyMapForegroundService.kt` cùng thư mục không trực tiếp ghi GPS/SQLite; chưa tìm consumer của extra `mymap_action` |
| Apple Watch / Wear companion | Khác cách làm — I có Watch app SOS/điều hướng | Thiếu — không có Wear app | Không áp dụng được — chưa có companion Fire/Wear | `I/companions/watch/MyMapWatchApp.swift`, `I/modules/my-map-ios/ios/MyMapCompanionModule.swift`; **chưa có ở A**; `A/modules/my-map-safety/android/src/main/java/expo/modules/mymapsafety/MyMapSafetyModule.kt::notifyWearDevice` chỉ rung điện thoại |
| Android Auto / CarPlay | Khác cách làm — I có code nhưng entitlement/build flag chưa xác nhận | Có | Không áp dụng được — flavor loại Auto | `I/plugins/with-ios-companions.cjs`, `I/modules/my-map-ios/ios/MyMapCarPlaySceneDelegate.swift`, `A/plugins/native/MyMapCarService.kt`; chưa có CarPlay ở A |
| AI chung GGUF/rnllama | Có — I bổ sung hardware/hash APIs | Có — 64 bit/RAM/model phù hợp | Khác cách làm — cùng engine, thiết bị phải đủ cấu hình | `A/src/services/deviceAi.ts`, `I/src/services/deviceAi.ts`, `I/modules/my-map-capabilities/ios/MyMapCapabilitiesModule.swift`; **Swift trong A thiếu aiHardware/hashAiModel** |
| AI tối ưu riêng hệ thống | Khác cách làm — I FoundationModels nếu available | Khác cách làm — Nano/AICore nếu available | Không áp dụng được — Nano stub unavailable | `I/modules/my-map-capabilities/ios/SystemAI.swift`, `A/modules/my-map-capabilities/android/src/{google,amazon}/java/expo/modules/mymapcapabilities/NanoAi.kt`; không tự chuyển provider khi Nano lỗi |
| OCR/nhãn ảnh trên máy | Khác cách làm — Apple Vision | Khác cách làm — ML Kit bundled | Khác cách làm — bundled; phải thử không GMS | `A/modules/my-map-capabilities/ios/PhotoAnalyzer.swift`, `A/modules/my-map-capabilities/android/src/main/java/expo/modules/mymapcapabilities/PhotoAnalyzer.kt`, `A/modules/my-map-capabilities/android/build.gradle`; không đánh đồng bundled với model tải bằng GMS |
| Tìm bằng giọng nói offline | Có — I Speech/on-device | Khác cách làm — Android 12+ recognizer | Khác cách làm — có provider mới dùng, nhập chữ dự phòng | `I/modules/my-map-capabilities/ios/OfflineSpeech.swift`, `A/modules/my-map-capabilities/android/src/main/java/expo/modules/mymapcapabilities/SpeechInput.kt`, `A/src/components/VoiceSearchButton.tsx`; **A chỉ hiện nút Android và thiếu Swift recognition API** |
| TTS dẫn đường | Khác cách làm — AVSpeechSynthesizer | Khác cách làm — voice offline đã cài | Khác cách làm — voice/provider tùy Fire | `A/src/utils/guidanceSpeech.ts`, `A/modules/my-map-capabilities`; I tương ứng |
| Video tổng kết/chia sẻ file Moment | Có — I có native adapter | Có | Có | `I/modules/my-map-ios/ios/MyMapMomentsModule.swift`, `A/plugins/native/MomentPlatformModule.kt`, `A/src/services/moments.ts`; **adapter iOS chưa có ở A** |
| Nhạc/background playback | Có | Có | Có | `A/src/services/musicPlayback.ts`, `musicControls.ts`, expo-audio plugin; I tương ứng |
| Điều khiển Spotube qua localhost | Khác cách làm — I không có native mở app/installation | Có | Khác cách làm — cần cài Spotube phù hợp | `A/src/services/spotube.ts`, `I/src/services/iosTravel.ts`; loopback là chức năng thực tế, không mặc định là dev junk |
| Quảng cáo | Khác cách làm — I mặc định App ID test, local QA flag true | Có — cần release guard | Khác cách làm — APS vẫn qua AdMob, chưa có GMS gate | `A/app.config.ts`, `A/src/services/adsPrivacy.ts`, `A/src/components/NativeAdCard.tsx`, `I/app.config.ts`; chưa coi Amazon ads đã an toàn |

## 3. Khác biệt cấu hình và nguồn tái tạo

### 3.1. Version, toolchain, native và dependencies

| Hạng mục | iOS hiện có ở I | Google Android ở A | Amazon ở A |
| --- | --- | --- | --- |
| Nguồn version/build | `package.json=1.0.4`, `app.json=1.0.4`, build `37`; EAS production autoIncrement riêng | app.json code `36`; generated Gradle hardcode `36/1.0.4`; tên artifact lấy package.json | Chung code/version với Google |
| Cấu hình iOS trong A | `buildNumber=23`, Apple Sign-In/Game Center bật mặc định; thiếu adapters I | Embedded vào APK với build iOS `23` | Giống Google |
| Runtime | Expo `~57.0.24`, RN `0.86.3`, React `19.2.3`, llama.rn `0.12.9` | Cùng version khai báo; `newArchEnabled=true`, `hermesEnabled=true` | Giống Google |
| iOS deployment | Plugin `expo-build-properties`: 16.4, static frameworks; Firebase `disableSPM=true` | A không có expo-build-properties hoặc thiết lập iOS tương đương | Không áp dụng |
| Native build | CNG + CocoaPods; chưa có native project local | Gradle wrapper 9.3.1, Kotlin 2.3.20; SDK 24/36/36 trong APK | Giống Google |
| Architecture release | iPhone arm64/simulator tách theo SDK, chưa kiểm artifact | Script mặc định ARM 32+64; flag minify/shrink/compression | Giống Google; AI local chỉ hỗ trợ tiến trình 64 bit |
| Dependencies chỉ I | `@expo/ui`, `expo-widgets`, `expo-build-properties`, module `my-map-ios` | Không có các dependency trực tiếp này trong A/package.json | Giống Google |
| Source set riêng Android | Không áp dụng | Car SDK 1.7.0, native MapLibre OpenGL 13.6.1 cho Auto; ML Kit GenAI prompt beta4 | Amazon Appstore SDK 3.0.9; Nano stub; không Auto/GenAI |
| Dependency chung hai flavor | Không áp dụng | Firebase app/auth, Google Sign-In, AdMob, APS SDK 12.0.1 + APS AdMob adapter 6.0.0; ML Kit text/image bundled | Vẫn chứa cùng nhóm này; không có cơ chế tách autolinking GMS-only |
| Ký | Workflow test tạo unsigned; chưa có store archive/export/signing pipeline | `.signing/release.properties` bắt buộc cả lúc cấu hình Gradle; release dùng signingConfigs.release | Chung signing config Google; chưa có phân tách credential theo store |
| Post-install | I tải iOS llama artifact đã pin hash | Script prepare Android tải JNI artifact đã pin hash và patch dependencies | Cùng Android prepare |

Các file native Android do plugin copy (`PlatformLocation*`, `TravelPlatformModule`, `SafetyMonitorService`, `PlatformTrackingService`, `MomentPlatformModule`, `MomentWidget`, `MomentWidgetWorker`) đang khớp SHA-256 với template `A/plugins/native/`. Nhưng `android/` bị ignore; vì vậy pipeline mới phải tái tạo từ template và cấu hình, không dựa vào checkout native đang có.

### 3.2. Plugin inventory

Chung về tên plugin trong app.json của A/I: LiveKit Expo, WebRTC config-plugin, expo-audio, expo-location, expo-sqlite, MapLibre, expo-image-picker, expo-camera, expo-sensors, expo-notifications, expo-splash-screen, expo-video.

| Plugin/option khác | A — Google và Amazon | I — iOS |
| --- | --- | --- |
| `expo-location` | Bật background Android và iOS; chưa set `locationAlwaysPermission` | Chỉ bật background iOS; cùng khoảng trống legacy usage description |
| `expo-audio` | recordAudioAndroid=true, background recording=false, playback=true | Không option Android; recording=false, playback=true |
| `expo-camera` | recordAudioAndroid=true | Không option Android |
| `withMyMapAndroid.ts` | Luôn thêm; sinh flavor, permissions, services, widget, source, rules, signing, localhost policy | Không có |
| `with-ios-companions.cjs` | Không có | Luôn sửa Scene/AppDelegate; tùy flag thêm CarPlay entitlement hoặc Watch target |
| `expo-widgets` | Không khai báo trực tiếp; lockfile có optional peer không đồng nghĩa module đã cấu hình | Chỉ khi EXPO_PUBLIC_ENABLE_IOS_WIDGET=true; App Group `group.com.pnhl.vibecoding`, widget nhỏ/vừa |
| Apple authentication | app.config luôn usesAppleSignIn + plugin | Chỉ khi MYMAP_ENABLE_APPLE_SERVICES=true |
| Firebase app | Plugin tên thuần | Plugin options `ios.disableSPM=true`; static frameworks qua build-properties |
| Mobile Ads | Cả hai App ID lấy env rồi fallback test; không release validation | iOS App ID lấy env rồi fallback test; không release validation |
| expo-video | Background playback và PiP=false | Giống A |

A chưa có `APP_STORE_TARGET` hay profile có khả năng loại module Google-only khỏi Amazon. Flavor Gradle đã tách Auto/GenAI, nhưng lựa chọn plugin và RN autolinking vẫn chung.

### 3.3. iOS Info.plist, entitlements, extension và scheme

| Thuộc tính | iOS dự kiến sinh từ A | iOS dự kiến sinh từ I |
| --- | --- | --- |
| Schemes | `mymap`, `com.pnhl.vibecoding` | Hai scheme trên + Google reversed client từ env/plist |
| Apple Sign-In | usesAppleSignIn=true | Tùy flag Apple Services |
| Game Center | `com.apple.developer.game-center=true` | Chỉ khi Apple Services=true |
| App Group | Chưa có cấu hình widget | Expo widget plugin thêm group khi bật; cần profile cho app và extension |
| CarPlay | Chưa có entitlement hoặc scene | Khi bật: `com.apple.developer.carplay-maps=true`, CarPlay scene |
| Watch | Chưa có target/plugin | Khi bật: target MyMapWatch, bundle suffix `.watchkitapp`, watchOS 9+; số build lấy ios.buildNumber |
| Background modes tự khai báo | `location`, `audio`, app.config thêm `processing` | app.config thay bằng `location`, `audio`, `processing`, `remote-notification` |
| `fetch` | Không thấy tự khai báo trong config A | Không thấy tự khai báo trong config I; phải đối chiếu IPA/plugin output để giải thích finding của chủ dự án |
| BG scheduler ID | `com.expo.modules.backgroundtask.processing` | Giống A |
| Location usage | WhenInUse và AlwaysAndWhenInUse tiếng Việt; legacy Always thiếu | Tương tự A |
| Face ID | Tiếng Việt trong app.config | Giống A |
| Speech và photo-library-add | Không set tường minh trong app.config A | Speech, photo-library-add và motion tiếng Việt trong app.config I |
| APNs entitlement | Không có chứng cứ signed entitlement | Chưa có chứng cứ signed entitlement; remote-notification trong plist không thay thế signing/APNs setup |
| Debug dylib guard | Không có | Script iPhone/simulator dùng Release, nhưng chưa có kiểm recursively `.debug.dylib` / `__preview.dylib` |

Đây là inventory source/config. Chưa có final Info.plist hay signed entitlements để xác nhận đầy đủ giá trị thực tế của build iOS. Không dùng `.local-expo-config.json` làm nguồn hiện hành vì đó là cache có thể cũ.

### 3.4. Android manifest và permission inventory của APK build 36

Hai APK có tập quyền chung dưới đây. Mặc định các tên ngắn trong bảng mang tiền tố `android.permission.`; tên khác namespace được viết đầy đủ. Đây là **inventory hiện trạng**, chưa phải whitelist đã duyệt.

| Nhóm | Quyền chung | Lý do/đề xuất cần duyệt |
| --- | --- | --- |
| Vị trí | ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION | Ghi hành trình/bản đồ/SOS; background phải gắn với thao tác bật tracking và disclosure |
| Foreground | FOREGROUND_SERVICE, FOREGROUND_SERVICE_LOCATION, FOREGROUND_SERVICE_MEDIA_PLAYBACK, FOREGROUND_SERVICE_SPECIAL_USE | Tracking nền, nghe nhạc, cảm biến an toàn; SPECIAL_USE cần chứng minh use case và subtype hiện có |
| Camera/audio | CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS | Chụp/quay, chat voice, gọi; giữ theo thao tác người dùng |
| Storage legacy | READ_EXTERNAL_STORAGE (maxSdk 32), WRITE_EXTERNAL_STORAGE (maxSdk 32) | Rà picker/export theo OS; đề xuất bỏ WRITE nếu không cần, giới hạn READ theo luồng còn dùng |
| Overlay | SYSTEM_ALERT_WINDOW | Chưa tìm thấy luồng xin/hiển thị overlay; đề xuất bỏ bằng plugin/blocklist sau khi kiểm dependency |
| Bluetooth | BLUETOOTH (maxSdk 30), BLUETOOTH_ADMIN | Audio/dependency; chưa thấy use case scan/connect app trực tiếp; cần attribution trước khi giữ/bỏ |
| Mạng, vận hành | INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE, WAKE_LOCK, RECEIVE_BOOT_COMPLETED, VIBRATE | Network, tracking, notifications; cần nối receiver với recorder thực và xử lý từ chối FGS |
| Sinh trắc | USE_BIOMETRIC, USE_FINGERPRINT | Khóa ứng dụng; phần fallback phần cứng/OS còn thiếu |
| Hoạt động | ACTIVITY_RECOGNITION | Module safety khai báo nhưng nhận dạng hiện đọc sensor heuristic; chưa thấy request runtime cho quyền này; đề xuất rà bỏ nếu không dùng protected activity APIs |
| Thông báo | POST_NOTIFICATIONS | Cảnh báo local/ongoing; remote push chưa triển khai đầy đủ |
| Google push/services | `com.google.android.c2dm.permission.RECEIVE`, `com.google.android.providers.gsf.permission.READ_GSERVICES` | Có trong cả Amazon; phải phân tách FCM khỏi ADM/fallback |
| Ads/privacy sandbox | `com.google.android.gms.permission.AD_ID`, ACCESS_ADSERVICES_AD_ID, ACCESS_ADSERVICES_ATTRIBUTION, ACCESS_ADSERVICES_TOPICS | SDK quảng cáo thêm; Amazon cần quyết định no-GMS strategy, không tự mặc định giữ |
| Install referrer | `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE` | Dependency thêm; cần attribution theo manifest merger và tối giản Amazon |
| Quyền app tự sinh | `com.pnhl.vibecoding.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Bảo vệ receiver động của AndroidX |

Các quyền badge chung, chưa có yêu cầu chủ động từ app:

```text
com.sec.android.provider.badge.permission.READ
com.sec.android.provider.badge.permission.WRITE
com.htc.launcher.permission.READ_SETTINGS
com.htc.launcher.permission.UPDATE_SHORTCUT
com.sonyericsson.home.permission.BROADCAST_BADGE
com.sonymobile.home.permission.PROVIDER_INSERT_BADGE
com.anddoes.launcher.permission.UPDATE_COUNT
com.majeur.launcher.permission.UPDATE_BADGE
com.huawei.android.launcher.permission.CHANGE_BADGE
com.huawei.android.launcher.permission.READ_SETTINGS
com.huawei.android.launcher.permission.WRITE_SETTINGS
android.permission.READ_APP_BADGE
com.oppo.launcher.permission.READ_SETTINGS
com.oppo.launcher.permission.WRITE_SETTINGS
me.everything.badger.permission.BADGE_COUNT_READ
me.everything.badger.permission.BADGE_COUNT_WRITE
```

Chỉ Google APK có `androidx.car.app.ACCESS_SURFACE`, `androidx.car.app.NAVIGATION_TEMPLATES`, `com.google.android.apps.aicore.service.BIND_SERVICE`. `BIND_QUICK_SETTINGS_TILE` là permission bảo vệ service, không phải uses-permission mới của ứng dụng.

Component/metadata khác biệt quan sát từ thuộc tính `android:name` trong manifest hai APK: Google có thêm MyMapCarService, CarAppMetadataHolderService và CAR_HARDWARE_MANAGER metadata, CarAppPermissionActivity, CarAppNotificationBroadcastReceiver, provider authority `androidx.car.app.connection.provider`, car application/minCarApiLevel metadata và CarAppService/NAVIGATION intent entries; Amazon không có nhóm này. Không thấy nhóm android:name chỉ riêng Amazon. SDK Amazon riêng không nhất thiết tạo manifest component riêng.

Cả hai còn `FirebaseInitProvider`, `FirebaseMessagingService`, `ExpoFirebaseMessagingService`, `MobileAdsInitProvider`; Amazon chưa có ADM receiver/service. Cả hai dùng package, schemes, FileProvider authority và widget receiver giống nhau. Cùng package/certificate là điều kiện cần để cập nhật giữ dữ liệu; chưa kiểm lại chữ ký hoặc migration trong khảo sát này.

Hardware location/GPS/network/camera/autofocus optional trong A/plugin và manifest nguồn. Main network-security config cho cleartext loopback `localhost`, `127.0.0.1`; debug thêm `10.0.2.2`. Các thay đổi quyền sau khảo sát phải áp dụng vào plugin tái tạo và có whitelist/check manifest hợp nhất; chỉ chỉnh app.json sẽ không chặn permission từ dependency.

### 3.5. Biến môi trường và cấu hình riêng

Không công bố giá trị thực. `EXPO_PUBLIC_*` được đưa vào app; không dùng tiền tố này cho server key, signing password hoặc private credential.

| Nhóm | Tên/khác biệt |
| --- | --- |
| Apple riêng I | MYMAP_ENABLE_APPLE_SERVICES, MYMAP_ENABLE_CARPLAY, MYMAP_ENABLE_WATCH; mặc định false nếu không set |
| Widget riêng I | EXPO_PUBLIC_ENABLE_IOS_WIDGET; phải thống nhất giá trị khi prebuild và bundle |
| Google OAuth | EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; I thêm GOOGLE_IOS_REVERSED_CLIENT_ID, A chưa thêm reversed scheme |
| Quảng cáo | EXPO_PUBLIC_ADMOB_ANDROID_APP_ID, EXPO_PUBLIC_ADMOB_IOS_APP_ID, EXPO_PUBLIC_ENABLE_TEST_ADS; APS: EXPO_PUBLIC_AMAZON_APS_APP_ID chỉ adapter Android A |
| Ad units chung | EXPO_PUBLIC_ADMOB_NATIVE_{SMART,FRIENDS,TIMELINE,STATS,PROFILE,MEMORIES,HEATMAP,SETTINGS,PLACE}_ID và cùng tập EXPO_PUBLIC_ADMOB_BANNER_*; chưa tách tên theo platform/store |
| Backend chung | EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY |
| Map/offline chung | EXPO_PUBLIC_STADIA_MAPS_API_KEY, OPENFREEMAP_BASE_URL, OFFLINE_TILE_URL, MAPLIBRE_STYLE_URL, MAPLIBRE_DEM_URL, CESIUM_ION_TOKEN, OSM_TILE_URL, OSM_SEARCH_URL, OSM_REVERSE_URL, OSM_OVERPASS_URL (các tên sau đều có tiền tố EXPO_PUBLIC_) |
| Routing chung | EXPO_PUBLIC_ROUTING_GATEWAY_URL, ROUTING_PROVIDERS, OSRM_URL, VALHALLA_URL, GRAPHHOPPER_URL, GRAPHHOPPER_KEY, TOMTOM_TRAFFIC_KEY (cùng tiền tố EXPO_PUBLIC_) |
| Media/dữ liệu chung | EXPO_PUBLIC_MAPILLARY_ACCESS_TOKEN, EXPO_PUBLIC_SPOTIFY_CLIENT_ID, EXPO_PUBLIC_SPOTIFY_REDIRECT_URI, EXPO_PUBLIC_VIETFUEL_URL |
| Biến cũ trong A/.env | EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY, EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY; chưa thấy consumer trong app config đã đọc; cần rà trước khi loại |
| iOS CI secrets | FIREBASE_IOS_PLIST_BASE64, MYMAP_IOS_ENV; chưa có store signing credential trong workflow |
| iOS prepare/AI | RNLLAMA_SKIP_POSTINSTALL trong EAS; RNLLAMA_SKIP_DOWNLOAD, MYMAP_SKIP_DEPENDENCY_INSTALL, MYMAP_SKIP_POD_INSTALL trong workflow |
| Android build | JAVA_HOME, NODE_ENV=production, EXPO_PUBLIC_ENABLE_TEST_ADS; script đọc local .signing, không có release secret injection trong CI |
| Store target mới | APP_STORE_TARGET chưa được sử dụng ở A/I; cần thêm sau duyệt |

A/.env có Android App ID non-test, iOS App ID trống, test-ads=false. I/.env.local có test-ads=true và không có iOS AdMob App ID trong inventory; process/CI env có thể override, nên không suy ra giá trị của IPA remote chỉ từ tệp local.

### 3.6. CI, EAS và reproducibility

- A chỉ có `.github/workflows/build-beta-apk.yml`: Node 20/Java 17, `npm install --legacy-peer-deps`, typecheck, clean prebuild, `assembleRelease`, copy đường dẫn APK không có flavor và tên artifact 0.6.1. Không có lint/test, release credential injection, bước prepare/patch, build iOS/AAB/Amazon, post-build whitelist/hash parity. Cách copy artifact không khớp source set Google/Amazon hiện tại.
- A/scripts/build-release.ps1 dùng JDK 21, hai task assembleGoogleRelease/assembleAmazonRelease, prepare AI/patch dependencies, R8/resource shrink/bundle compression, signing local và kiểm DEX. Không prebuild native từ nguồn, không AAB/iOS, không check 9 tiêu chí build, không ràng buộc commit/config snapshot; có thể dùng Gradle đã cũ.
- I/eas.json có development/preview/production; local version source, production autoIncrement=true. Chưa có ba profile cùng release ID; autoIncrement iOS riêng không đồng bộ Android.
- I CI source-check dùng Node 24, npm ci --ignore-scripts, typecheck/test/Swift parse. CI test dùng macos-latest, prebuild/pods, unsigned iPhone **Release**, simulator smoke test tùy chọn; có Watch validation riêng. Chưa có archive/export App Store ký hoặc chứng minh provenance cho IPA, chưa pin Xcode/macOS image và Pod lock trong nguồn.
- Hai package-lock độc lập. Android Gradle chưa có dependency locking/verification manifest riêng; patch node_modules phải chạy có kiểm và fail khi upstream đổi. Firebase/AdMob/ML Kit transitive dependencies cần khóa theo từng flavor.
- Tái tạo từ cùng commit + lockfiles + build-input manifest là mục tiêu thực tế. SHA của IPA/APK ký lại có thể đổi do chữ ký/timestamp; không đồng nhất việc build lặp lại với byte-for-byte reproducibility. JS iOS không cần giống bytecode Android; chỉ so hash hai APK với cùng JS inputs.
- Ba **kênh** yêu cầu ít nhất năm artifact: iOS signed IPA + unsigned IPA, Play AAB + Google release APK, Amazon release APK. `build:all` nên tạo một release set chứa các artifact đó; không bỏ AAB/APK phụ để chỉ còn đúng ba file.

## 4. Đánh giá chín vấn đề đã biết

| # | Hiện trạng xác nhận | Đề xuất sau duyệt | Độ khó |
| --- | --- | --- | --- |
| 1. AdMob iOS test ID | A/I đều fallback test; A iOS env trống, I local test flag true; Google/Amazon APK có ID non-test | Fail release nếu thiếu/test App ID hoặc unit ID không đúng platform; debug mới nhận test ID; tách ad-provider theo capability/store, không chỉ NODE_ENV | Thấp/vừa |
| 2. Widget debug dylib | Finding từ IPA do chủ dự án cung cấp; I script dùng Release, chưa có artifact scan | Archive/export đúng Release cho app và mọi extension/Watch; quét recursively `.debug.dylib` và `__preview.dylib`; xác định producer trước khi đổi Xcode build setting, không xóa dylib thủ công | Vừa |
| 3. allowBackup | Hai APK true; chưa có rules bảo vệ dữ liệu trong nguồn | Đề xuất false + rules cho cloud backup/device-transfer trên Android 12+, fullBackupContent cho OS cũ; quyết định chính sách giữ/export dữ liệu và vault key trước | Thấp/vừa |
| 4. Android permissions | Có toàn bộ inventory mục 3.4; nhiều quyền từ dependency | Giữ tracking/camera/micro/audio có use case; đề xuất loại overlay/WRITE legacy/ACTIVITY_RECOGNITION không dùng; attribution merged manifest, whitelist theo store, kiểm khả năng export/notification trước khi bỏ | Vừa |
| 5. Legacy location description | A/I không set locationAlwaysPermission; expo-location plugin còn tạo NSLocationAlwaysUsageDescription bằng default | Set cả ba location descriptions tiếng Việt trong nguồn/plugin. Đề xuất: “MyMap sử dụng vị trí trong nền khi bạn bật ghi hành trình để tiếp tục lưu tuyến đường ngay cả khi khóa màn hình hoặc chuyển sang ứng dụng khác.” | Thấp |
| 6. Background modes rộng | location/audio có luồng; processing có sharedSync; remote-notification I chưa có push pipeline; fetch chưa thấy trong config | Giữ ba mode có chứng cứ; bỏ/hoãn remote-notification nếu chưa triển khai silent push; kiểm final plugin output để xử lý fetch. Soạn review notes đúng hành vi, không dùng audio/processing để giả lập safety service liên tục | Vừa |
| 7. Firebase plist flags | I/GoogleService-Info.plist IS_ANALYTICS_ENABLED=false, IS_ADS_ENABLED=false; A không có plist iOS; SDK quảng cáo riêng tồn tại | Đối chiếu Firebase app/project, GADApplicationIdentifier, SDK init, consent và chủ đích analytics; không tự đổi false thành true. AdMob có cấu hình độc lập nên hai flag chưa chứng minh quảng cáo hỏng | Thấp/vừa |
| 8. Dev strings | Source app gọi ws://127.0.0.1 cho Spotube; release network policy cho loopback. Không tìm endpoint app hardcode localhost:8081/9999 hay 10.0.2.2 ngoài debug config trong phạm vi source khảo sát | Giữ loopback Spotube với lý do; quét bundle/resources/native release, phân loại framework constant và endpoint thật; loại dev route có thể chạy, không cấm mù mọi chuỗi localhost | Thấp/vừa |
| 9. Amazon không GMS | GPS fallback + Google hasPlayServices + Nano stub có; ads/FCM chưa đầy đủ; Firebase/OCR không thể kết luận chỉ từ namespace | Capability API cho GMS/provider/sensors/biometric/dialer; tách GMS-only native/init; email/guest/account linking, ADM, ads off hoặc APS độc lập, OCR bundled kiểm Fire, rnllama chung. Test no-GMS cold start + feature paths, không chỉ catch JS | Cao |

Quét chữ ký/flags iOS và dev strings **trong IPA** còn thiếu vì chưa có artifact local. Chưa đánh dấu bất kỳ vấn đề nào là hoàn tất xử lý ở Giai đoạn 0.

## 5. Phương án tương đương và ngoại lệ đề xuất

Độ khó là mức tương đối cho implementation + build/test; không phải cam kết thời gian. Tất cả ngoại lệ dưới đây còn **chờ duyệt**.

| Tính năng | Phương án | Độ khó | Quyết định/giới hạn |
| --- | --- | --- | --- |
| SOS/cảm biến an toàn | Một state machine JS/TS cho bật/tắt, pending/cancel/SOS, queue offline, sensor capability; adapter native tối thiểu | Cao | iOS source hiện foreground-only. Đề xuất ngoại lệ nền có chủ đích, mô tả rõ UI; không hứa ngang Android bằng BGTask |
| GPS nền/reboot | Một controller và persistence contract; CoreLocation iOS, system LocationManager Fire, Expo/provider Android; hợp nhất tile/boot với controller thực | Cao | Kiểm permission/OS lifecycle; không coi notification service là GPS recorder |
| Không có barometer/dialer | Tắt suy luận độ cao; vẫn cho SOS chia sẻ vị trí, thông báo liên hệ, trạng thái khả năng rõ ràng | Vừa | Tablet không gọi số bằng tel nếu không có handler; không tự coi yêu cầu SOS đã được gửi/nhận |
| Widget | Mang widget adapter/layout I về A; cùng snapshot/filter, account cleanup, TTL và deeplink | Vừa | iOS ảnh bạn bè hiện TTL 15 phút, ảnh riêng 24 giờ; Android WorkManager refresh khác. Đồng bộ ý nghĩa/riêng tư, không hứa lịch refresh bằng nhau |
| Live Activities | Tạo start/update/end/restore cho tracking iOS; Android/Fire ongoing notification đọc chung TrackingSnapshot | Vừa | Source I chưa có luồng Live Activity dù thư viện hỗ trợ |
| Quick tile / iOS shortcut | Nối tile vào tracking/SOS thật; iOS App Shortcut/App Intent trước, Control Center tùy OS; Fire dùng shortcut/widget/in-app khi không có tile | Vừa | Không thêm permission mới mặc định; cần kiểm đăng nhập, khóa app và thao tác người dùng |
| Apple Watch / Wear OS | Mang Watch source I về nguồn chung; Wear tối thiểu nhận cảnh báo + nút yêu cầu SOS gửi về điện thoại | Cao | Hàm notifyWearDevice hiện chỉ rung điện thoại. Đề xuất hoãn Wear và companion Fire thành ngoại lệ rõ ràng nếu ngoài phạm vi |
| Android Auto / CarPlay | Dùng NavigationSnapshot JS chung; giữ native car UI từng OS, đưa adapter I về A | Cao | CarPlay cần Apple cấp entitlement; đề xuất ngoại lệ chưa phát hành nếu chưa được cấp. Fire không có Android Auto |
| AI | rnllama local là provider cơ sở; aiHardware/hash/stop chung; Nano và FoundationModels là provider tối ưu có capability detection | Vừa | Mang Swift I về A; 32 bit/thiếu RAM không chạy local model và phải hiện lý do; Nano lỗi không âm thầm đổi hành vi |
| OCR/speech/TTS | API capability chung; Vision/Speech iOS, bundled ML Kit/on-device recognizer Android/Fire; nhập chữ khi thiếu recognizer | Vừa | Không loại tất cả ML Kit vì tên Google; xác nhận variant/khả năng Fire thực tế |
| Khóa app | Face ID/Touch ID ↔ BiometricPrompt; kiểm khả năng trước khi cho bật; chốt fallback PIN/device credential hoặc vô hiệu hóa có giải thích | Vừa | Không để Fire thiếu sensor bị kẹt ngoài dữ liệu; quyết định fallback ảnh hưởng bảo mật cần duyệt |
| Apple/Google login | Provider adapter + web OAuth nếu hỗ trợ; email/guest chung; link credentials vào cùng Firebase UID | Vừa/cao | Phương thức đăng nhập khác chưa bảo đảm cùng tài khoản; phải test tài khoản Apple-only trên Amazon |
| Push | Token registry theo capability/store, backend APNs/FCM/ADM; local notification layer chung | Cao | WebSocket/polling chỉ dự phòng foreground/reconnect, không bảo đảm báo SOS/chat khi app bị đóng; đề xuất ADM cho Fire |
| Ads | Ad-provider gate trước load/init; Amazon no-GMS mặc định không ads, hoặc APS provider độc lập sau thiết kế | Vừa/cao | APS AdMob mediation hiện tại không chứng minh độc lập GMS; không đưa SDK Google-only initializer vào no-GMS release nếu không an toàn |
| Export recap/share/media | Contract chung dùng native AVFoundation I ↔ Media3 Android/Fire, kèm cancel/error/ownership checks | Vừa | Mang MyMapMoments adapter I về A; giữ file format/deeplink giống nhau |
| iOS visits/significant changes | Dùng cho tiết kiệm pin ở iOS; Android/Fire giữ adaptive tracking/geofence contract | Vừa | Native API iOS có nhưng nhiều wrapper trong A chưa có caller; cần xác nhận use case trước khi gọi là parity |
| Magic link/Game Center | Magic link hoàn thiện cùng account contract hoặc hoãn cả ba; Game Center là provider iOS tùy chọn | Vừa | Không xem Game Center là yêu cầu bắt buộc Android; bảo đảm có đường truy cập tài khoản khác |
| Spotube | Giữ websocket loopback cho thiết bị có Spotube; nhạc trong app/TTS chung; iOS installation/open-app có giới hạn | Thấp/vừa | Không xóa loopback bằng blacklist dev strings làm hỏng tính năng |

## 6. Pipeline đề xuất để duyệt, chưa triển khai

1. Xác lập repository nguồn duy nhất có Git; hợp nhất có chọn lọc adapters và tests I vào A. Khôi phục remote/history phù hợp thay vì tự tạo lịch sử mới cho A. Rà secrets trước commit đầu; không copy .env/plist/keystore hoặc artifacts vào Git.
2. Một release manifest version/build, lấy build number vượt các bản đã phát hành; lần tăng phải áp dụng cả ba kênh và mọi target iOS. Không tăng độc lập theo job/EAS profile. Khóa SHA commit, lockfile, build flags và public config fingerprint cho release set.
3. Tạo profile `ios-store`, `android-play` (AAB), `android-amazon` (APK), profile/helper phụ cho Google APK và unsigned iOS Release. Build từ một checkout sạch đã kiểm; signed và unsigned iOS dùng cùng nguồn/Release settings. Unsigned IPA là đầu vào ký lại, không tự cài chạy trên iPhone thông thường.
4. APP_STORE_TARGET chọn native plugin/source/dependencies; capability lúc chạy quyết định chức năng. Để giữ hash JS hai APK, tránh inline store env làm đổi bundle; ưu tiên native build-info/capability với cùng public JS config. Nếu bắt buộc JS inputs khác phải đưa quyết định hash vào duyệt trước.
5. Secret injection: Firebase files từ file secret, Android keystore/password từ runner/EAS secret, Apple distribution/provisioning cho app + extension + Watch từ cơ chế ký bảo mật. Server credentials giữ trên backend; chỉ tài liệu hóa tên và cách cấp, không giá trị.
6. CI lint/typecheck/test, build release set, kiểm artifact, lưu SHA/provenance/public-config fingerprint và upload artifacts. Pin Node/JDK/Xcode/macOS/SDK theo pipeline đã kiểm; npm ci, dependency locking, kiểm post-install patches và native artifact hashes.
7. Post-build gate: iOS flags/descriptions/background/AdMob/no-debug-dylib/extension versions; Android debug/backup/permissions/IDs/GMS components; version/build/provenance và hai APK JS hash chung. Kiểm dependency/components ở artifact final, không chỉ source app.json.
8. Sau pipeline mới bắt đầu parity theo ưu tiên an toàn → dữ liệu/chat → tiện ích → phần khác, mỗi nhóm thay đổi commit nhỏ có behavior note. Sau đó test iPhone, Android GMS và Fire thật, đặc biệt khóa màn hình/reboot/no-network/update giữ dữ liệu.

Chưa có signing/App Store provisioning để xác nhận store build; cần resolve qua môi trường bảo mật sau khi duyệt. `A/google-services.json` đang được import trực tiếp từ JS (`src/services/firebase.ts`) và chưa được A/.gitignore loại trừ; đây là điểm cần sửa quy trình injection. A không có Git nên chưa thể kết luận đã commit secret. I/.gitignore loại private Firebase/env/signing; `git ls-files` đối với nhóm private đã kiểm chỉ trả `.env.example`, chưa phải scan toàn history.

### 6.1. Các kiểm chứng còn cần ở giai đoạn sau

- iOS signed/unsigned IPA: đối chiếu cùng source, đúng Release cho extension; usage descriptions; entitlements/provisioning từng target; không debug dylib; widget/Watch thực sự được embed.
- Android Google/Amazon: kiểm merged manifests + DEX/native libraries, chữ ký/version/update, ABI/16 KB, SDK initializers và cold launch trên no-GMS. Kiểm DEX startup hiện tại chỉ bảo vệ hai entry points, không chứng minh toàn app không crash.
- GPS/SOS: khóa màn hình, chuyển app, reboot, thu hồi permission, GPS/network tắt, không barometer/dialer; thao tác hủy sự cố không tạo SOS; queue offline được replay đúng và có trạng thái bên nhận.
- Dữ liệu: ảnh/video/audio, chat/gọi hai tài khoản, notifications, widget xóa nội dung khi logout/đổi tài khoản, app lock, offline, cập nhật từ bản cũ giữ dữ liệu.
- Ads: release dùng đúng App ID và units từng platform; consent/no-fill; Amazon thiếu GMS không gọi SDK không được hỗ trợ; tránh request ads trước gate.

## 7. Tài liệu chính thức dùng để kiểm chứng phương án

Các kết luận về source/APK dựa trên tệp local. Các ràng buộc nền tảng dưới đây đã đối chiếu tài liệu chính thức ngày khảo sát:

- [Expo Widgets](https://docs.expo.dev/versions/latest/sdk/widgets/): widget và Live Activities là API riêng; có dependency/extension không chứng minh app đã tạo activity. Áp dụng cho nhận định Live Activities chưa có lifecycle trong source I.
- [ML Kit model installation paths](https://developers.google.com/ml-kit/tips/installation-paths): phân biệt bundled model trong app và unbundled model do Play Services quản lý. Source đang dùng bundled text/image; khả năng Fire vẫn cần test thực tế.
- [Firebase Android setup](https://firebase.google.com/docs/android/setup): chỉ những SDK có dependency Play Services yêu cầu GMS; cần đánh giá từng sản phẩm/provider thay vì loại Firebase Auth theo tên package.
- [Google Mobile Ads iOS setup](https://developers.google.com/admob/ios/quick-start): AdMob được cấu hình qua GADApplicationIdentifier và SDK riêng. Vì vậy cần đối chiếu thực tế trước khi thay flags Firebase plist.
- [Amazon device messaging migration](https://www.developer.amazon.com/docs/app-porting/device-messaging.html): ADM hoặc A3L là phương án Fire OS; fallback polling không thay thế delivery khi app bị đóng.
- [Apple CarPlay entitlement](https://developer.apple.com/documentation/carplay/requesting-carplay-entitlements): cần entitlement được Apple cấp và provisioning phù hợp trước khi phát hành CarPlay.
- [Apple background execution modes](https://developer.apple.com/documentation/xcode/configuring-background-execution-modes): chọn mode theo tác vụ thật; không khai báo rộng để giữ tiến trình sống.
- [Apple background strategies](https://developer.apple.com/documentation/backgroundtasks/choosing-background-strategies-for-your-app): hệ thống quyết định thời điểm chạy tác vụ; không dùng BGProcessingTask làm cam kết phát hiện té ngã liên tục.
- [Android Auto Backup](https://developer.android.com/identity/data/autobackup) và [Android 12 backup changes](https://developer.android.com/about/versions/12/behavior-changes-12): rules theo OS/cloud/device transfer; allowBackup=false riêng có thể chưa chặn D2D trên một số thiết bị.
- [Android foreground start restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start): receiver/tile phải kiểm điều kiện permission/lifecycle và xử lý trường hợp hệ thống từ chối service.
- [Apple distribution to registered devices](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices): iPhone thông thường cần ứng dụng được ký/provisioned; unsigned artifact phải ký lại trước khi sideload.

## 8. Điểm dừng và nội dung cần duyệt

Giai đoạn 0 hoàn tất ở mức khảo sát source hai checkout + hai APK local. Chưa thực hiện Giai đoạn 1–3, chưa thêm quyền hoặc đổi hành vi. Trọng tâm duyệt là hợp nhất nguồn I về repository chung, chính sách backup, parity an toàn foreground-only trên iOS, push ADM cho Fire, ads no-GMS và các ngoại lệ Watch/Wear/CarPlay/phần cứng trong mục 5. Các ngoại lệ chưa được chấp thuận tự động.

Sau khi duyệt có thể bắt đầu Giai đoạn 1; đường dẫn repository Git nguồn chính cần được xác lập trước các commit triển khai. Nếu IPA/build inputs thực tế khác checkout I, phải cập nhật đối chiếu artifact trước khi tuyên bố sửa xong những finding riêng IPA.
