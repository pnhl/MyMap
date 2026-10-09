# MyMap — tiến độ triển khai danh mục tính năng

Cập nhật 08/10/2026. Mã nguồn 1.0.2. Đây là báo cáo triển khai và kiểm tra mã nguồn, không phải xác nhận sẵn sàng phát hành. Chưa đóng gói APK trong đợt triển khai tính năng này.

Cập nhật đóng gói sau đó: đã tạo APK Android release 1.0.2, mã build 34 theo yêu cầu mới của người dùng; xem [APK_BUILD_2026_10_08.md](APK_BUILD_2026_10_08.md) để lấy bộ cài và kết quả kiểm tra. Các giới hạn tính năng/kiểm thử thiết bị dưới đây vẫn còn áp dụng.

Kiểm kê ban đầu trong `FEATURE_PROVIDER_AUDIT_2026_10_08.md` là ảnh chụp trước khi triển khai; các nhận xét về voice ping giả, worker giả, thiếu renderer ngoại tuyến và thiếu các công cụ hành trình đã được xử lý ở mức mô tả dưới đây. Bảng đối chiếu cập nhật nằm trong `FEATURE_PROVIDER_PROGRESS_2026_10_08.md`.

## Mã đã triển khai

| Nhóm | Luồng đã có | Mã chính / giới hạn thực tế |
|---|---|---|
| Chuyến đi | Tạo/chỉnh sửa 2–20 điểm dừng, giờ khởi hành, thời gian ở lại, lịch trình và dẫn đường từng chặng | `CatalogScreen`, `tripPlanner`, `catalogRules`; tính tuyến qua provider thực tế, không dựng tuyến thẳng để thay lỗi mạng |
| Cộng tác | Chia sẻ chuyến đi, danh sách địa điểm và nhật ký cho bạn đã kết nối; sửa theo phiên bản; một phiếu bầu/người; tuyến yêu thích riêng | `catalogStore`, `TripPoll`, `favoriteRoutes`; xung đột cần chọn lại bản máy chủ, chưa tự hợp nhất nội dung |
| Xe / chi phí | Hồ sơ xe, mốc km, nhiên liệu/điện, tiêu hao ghi nhận từ các lần đổ đầy, chia chi phí và dự toán hành trình | `vehicleConsumption`, `VehicleInsights`, `CatalogScreen`; nhập tay, chưa đọc OBD hoặc pin xe thật |
| Đỗ xe / bảo dưỡng | Ghim vị trí đỗ, tìm xe, ảnh đỗ riêng trên thiết bị, hẹn giờ local notification, nhắc ngày/km và đánh dấu hoàn tất | `parkingPhoto`, `CatalogScreen`; mốc km là trạng thái theo số người dùng nhập, chưa có cảnh báo tự động khi xe thực tế vượt mốc |
| Nhật ký / cộng đồng | Nhật ký cá nhân/dùng chung, cuộc hẹn có thời gian/vị trí, đánh giá 1–5 sao, tìm sự kiện/đánh giá gần đây | `NearbyContent`, `catalog_content.sql`; công khai là lựa chọn chủ động, chưa có RSVP, quản trị kiểm duyệt hoặc xác minh đã đến địa điểm |
| Cảnh báo đường | Báo nguy hiểm, ổ gà, ngập, tai nạn, đóng đường, đèn hỏng; xác nhận/phủ nhận; tự hết hạn; lớp bản đồ mặc định tắt | `CommunityRoads`, `community_roads.sql`; nội dung do cộng đồng báo, chưa có điểm uy tín/xác minh cơ quan |
| Messenger | Hội thoại riêng/nhóm, lịch sử phân trang, typing/đã đọc, emoji, ảnh/video/ghi âm thật; gửi lại/hủy offline/thu hồi | `ChatScreen`, `privateChat`, `chat_notifications.sql`, `chat_cancellation.sql`; cập nhật bằng polling khi mở màn hình, chưa gọi thoại/video, E2EE hoặc quản lý thành viên nhóm |
| Tương tác map | Ghim lời nhắn cho bạn đã kết nối hoặc một người cụ thể; tim/buzz/invite/emoji chỉ đến người nhận | `friendSocial`, `private_social.sql`; vị trí đi qua bộ lọc riêng tư; lời nhắn hết hạn sau 30 phút, polling 10 giây khi màn hình hoạt động |
| Thông báo | Hộp thông báo từ máy chủ, đánh dấu đã đọc, mở đúng hội thoại; thông báo hẹn giờ trên thiết bị | `notificationInbox`, `AppHeader`; đây chưa phải FCM/APNs push delivery |
| Riêng tư | Chuyến đi riêng tư, vị trí trễ 5/15/30 phút, ẩn có thời hạn, làm mờ/đóng băng toàn cục và theo người nhận | `sharingPrivacy`, `ghostMode`, `global_privacy.sql`; server chặn presence đang bay khi tạm dừng. Còn cần kiểm thử hai thiết bị và rà soát tiếp cuộc đua đổi tài khoản lúc lấy JWT |
| Bảo mật thiết bị | Khóa sinh trắc, AES-GCM, thẻ khẩn cấp mã hóa local, chữ ký P-256 cho file xuất và công cụ kiểm chữ ký | `AppLock`, `platformCapabilities`, `locationProof`, module Kotlin/Swift; GPS DB và ảnh thường chưa được mã hóa toàn bộ; file xuất có chữ ký không xác minh nguồn GPS hoặc dữ liệu trước khi xuất |
| Ảnh / tìm kiếm | OCR, phân loại ảnh, gợi ý album, tìm ảnh tương tự bằng dHash; tìm toàn app, gõ không dấu và sai một ký tự | `MediaToolsScreen`, `photoInsights`, `mediaInsights`, `SearchScreen`; ML Kit Android / Vision iOS. Chưa có embeddings, caption AI, nhận diện địa danh bằng model hoặc semantic search |
| Ngoại tuyến / sync | Xem 18 tile raster tải từ nguồn được cấu hình, kiểm tra định dạng ảnh; hàng đợi đồng bộ catalog/chat/moments; xóa offline bền vững | `OfflineMapsScreen`, `OfflineMapView`, `offlineMap`, `sharedSync`; chưa có vector offline hoặc offline routing. Tác vụ nền mặc định tắt, lịch chạy do hệ điều hành quyết định |
| Thống kê | Recap tuần/tháng/năm và hồ sơ đọc lịch sử GPS theo trang, vượt giới hạn 25.000 điểm; bỏ nối qua mất tín hiệu/nhảy GPS bất thường | `observedHistory`, `observedJourneyStats`, `mapWrapped`, `ProfileScreen`; dựa trên dữ liệu còn lưu trên thiết bị, không phải tổng lịch sử đã xóa theo retention |
| Chỉ đường giọng nói | Mốc 500/200/60 m, chống đọc lặp, dừng khi rời màn hình/nền; báo khi không phát được | `guidanceSpeech`, `NavigationHud`, `MapScreen`; mặc định tắt, cần giọng phù hợp cài trên thiết bị; Kotlin chỉ chọn giọng không yêu cầu mạng |
| TomTom mới | Vùng đi tới 10–60 phút cho xe máy/ô tô; so sánh tối đa 5 điểm đến bằng ô tô; bộ nhớ đệm 5 phút và backoff khi hết quyền/quota | `ReachableRangeScreen`, `reachableRange`, `RouteComparisonScreen`, `routeMatrix`; mặc định tắt, chỉ tính chủ động. Không thay Matrix ô tô thành kết quả xe máy |
| Wikidata mới | Mô tả Việt/Anh và liên kết Wikipedia/Wikidata khi địa điểm OSM có mã Q hợp lệ | `LandmarkCard`, `landmarkMetadata`; mặc định tắt, không suy đoán địa danh bằng tên/ảnh. Structured data; chưa tải ảnh Commons hoặc diễn giải AI |

## Android / iOS

- React Native chứa UI, nghiệp vụ và các dịch vụ dùng chung.
- Kotlin trong `modules/my-map-capabilities` thực hiện BiometricPrompt, Android Keystore AES/P-256, ML Kit, giọng đọc hệ thống và FLAG_SECURE. Module `my-map-safety` giữ phần cảm biến/vị trí Android.
- Swift thực hiện LocalAuthentication, CryptoKit/Keychain, Vision và AVSpeechSynthesizer; lớp che riêng tư áp dụng lúc app mất active, không chặn mọi screenshot iOS.
- Hai module Kotlin đã biên dịch thành công bằng Gradle `compileDebugKotlin`. Chưa tạo APK/AAB.
- Metro đã xuất bundle JavaScript cho Android và iOS. Bundle iOS **không** xác nhận Swift/Xcode build.
- Expo từ chối tạo dự án iOS trên Windows. Chưa có thư mục dự án iOS được tạo trong workspace; chạy `scripts/prepare-ios.sh` trên macOS với Xcode/CocoaPods và `GoogleService-Info.plist` đúng app để tạo workspace, sau đó kiểm thử Simulator/thiết bị.

## Kiểm chứng trong đợt này

- `npm run typecheck`: qua.
- `npm test`: 262 bài qua, gồm SQLite thực trong bộ nhớ, upload/edit/delete đồng thời, hủy tin nhắn, đổi tài khoản, riêng tư, thống kê nhiều trang và parser/provider.
- `npx expo export --platform android --platform ios --output-dir .local/catalog-export --no-bytecode`: qua; artifact kiểm tra nằm trong `.local`, không phải bộ cài.
- Gradle `:my-map-capabilities:compileDebugKotlin :my-map-safety:compileDebugKotlin`: BUILD SUCCESSFUL.
- `tests/catalog-rls.sql`: chạy trên Supabase MyMap và rollback; kiểm CAS, collaborator/stranger, dữ liệu tuyến lỗi, phiếu bầu điểm bị bỏ, media ACL, notification, cancel/tombstone, vị trí mờ và presence pause.
- Probe TomTom tại Hà Nội: Reachable Range HTTP 200, 50 điểm ranh giới; Matrix Routing HTTP 200, 1 cell thành công. Chỉ kiểm khả năng dịch vụ, chưa kiểm giao diện hay độ đúng tuyến trên điện thoại.
- Những migration ứng dụng nằm trong `supabase/features/`; đã áp dụng vào MyMap, không phải dự án Supabase khác. Không đưa provider token/private signing key vào báo cáo.

## Còn phải triển khai / hoàn thiện

1. **Thiết bị và phát hành:** build/test iOS trên Mac, chạy thử GPS ngoài đường và khi khóa máy, hai tài khoản/hai thiết bị, Google/Apple login với cấu hình ký thực, ảnh/video/notifications/quảng cáo và nhà cung cấp dữ liệu live. Chưa có chứng nhận parity Android–iOS.
2. **Giao tiếp:** FCM/APNs, điều phối push, tham gia/rời nhóm, block/report, E2EE, voice room, push-to-talk trực tiếp, gọi thoại/video/nhóm. Cần Apple/Google configuration và dịch vụ cấp token/signaling như LiveKit; không dựng token hay phòng giả.
3. **AI / search:** nhận diện landmark bằng model, captions/journal/assistant AI, embeddings/semantic index, model download/update, STT và voice place search. Hiện có OCR/classification cơ bản, không đánh đồng với AI assistant.
4. **Bản đồ:** EV routing có kế hoạch sạc từ provider, vector offline, offline routing/trip package đầy đủ, transit/hiking, chất lượng đường/comfort score, OpenAQ có key và lọc license, dữ liệu chính xác của speed limit/lane/sign hướng áp dụng. Range và Matrix mới không thay các chức năng này.
5. **Cộng đồng:** followers, creator/business pages, guides, offers, moderation, uy tín/confidence report, RSVP/event map, sửa địa điểm cộng đồng và review có ảnh/xác minh. Dữ liệu expired map notes cần lịch dọn riêng, không chỉ ẩn ở API.
6. **Nền tảng:** iOS widget/video recap/CarPlay tương đương, Bluetooth xe, billing/entitlements, passkeys/MFA, App Check/Integrity/App Attest; Crashlytics/ANR/performance, analytics/funnels/remote config/kill switch, app/universal links/NFC.
7. **Bảo mật dữ liệu:** mã hóa GPS DB và ảnh còn lại, phục hồi backup mã hóa, timestamp đáng tin, chứng cứ chống sửa ngay từ lúc ghi, quản lý/luân chuyển khóa và kiểm thử quyền trên thiết bị. Signed URL chat đã cấp còn hiệu lực tối đa 5 phút sau khi thu hồi; polling không phải push.

Thông tin tài khoản Apple Developer, Google Play và hạ tầng gọi/AI chưa được người dùng cung cấp trong câu hỏi đang chờ. Những phần này chưa được đánh dấu hoàn thành. Tài liệu không suy ra đã triển khai toàn bộ 296 dòng catalog.

## Tài liệu nhà cung cấp đã đối chiếu

- [TomTom Reachable Range](https://docs.tomtom.com/reachable-range-api/documentation/tomtom-maps/v1/calculate-reachable-range): polygon là vùng xấp xỉ; không dùng pedestrian/bicycle cho endpoint này.
- [TomTom Matrix Routing v2](https://docs.tomtom.com/matrix-routing-v2-api/documentation/synchronous-matrix): cell theo origin/destination index, lỗi có thể ở từng cell, giới hạn khu vực và quyền key.
- [TomTom pricing](https://docs.tomtom.com/pricing): hạn mức hiện hành theo sản phẩm; quota/entitlement của tài khoản có thể khác. App không cam kết mọi API luôn miễn phí hoặc tự tăng plan.
- [Wikidata data access](https://www.wikidata.org/wiki/Help:Data_access): EntityData theo mã thực, không lấy nội dung dự đoán.
- [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/): chia sẻ file local qua share sheet.

## Cấu trúc chuẩn bị build

```text
src/                         React Native: screens, components, services, utils
modules/my-map-capabilities/  Kotlin Android + Swift iOS; expo-module.config.json
modules/my-map-safety/        native location/sensors/safety
android/                     Gradle project hiện tại
ios/                         tạo bằng Expo prebuild trên Mac; chưa có trong workspace
plugins/                     Expo config plugins
supabase/features/           nguồn SQL tính năng đã áp dụng
tests/                       JS/SQLite tests và SQL fixture rollback
scripts/prepare-ios.sh       chuẩn bị Xcode workspace trên Mac
app.config.ts                Expo/native app config
package.json + package-lock.json
.env                         cấu hình local; không đưa vào báo cáo/version control
.signing/                    cấu hình ký riêng; không chia sẻ
.local/                      log/bundle kiểm tra; không đóng gói hoặc phát hành
```

Đóng gói APK/IPA là bước riêng sau kiểm thử và yêu cầu của người dùng; chưa thực hiện trong đợt này.
