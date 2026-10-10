# Ghi chú hành vi và chênh lệch audit

Yêu cầu ngày 10/10/2026 thay thế quyết định cũ khi xung đột. Không cài, chạy, ký bằng credential thật trong lượt triển khai này.

## Nguồn gộp

Phase 0 ghi repo chưa có Git và thiếu adapter iOS. Hiện Git đã chứa `modules/my-map-ios/ios` (Travel, Moments, Companion, CarPlay, QuickAction), `modules/my-map-capabilities/ios` (hardware/hash/stop AI, Speech, Vision), `src/widgets` (Moment/Journey), `companions/watch`, plugin tạo targets, Android recorder/Boot/tile và Wear. Không copy đè checkout MyMap-IOS cũ. Live Activity start/update/end đã có; cần kiểm restore. Boot/tile hiện nối PlatformTrackingService thật, khác finding trước gộp.

## Quyết định áp dụng

- Fire ads chuyển từ bật ở commit 65bc84a sang tắt mặc định theo đặc tả mới. Không khởi tạo GMA/Google Sign-In trên Fire; giữ ID Android/iOS đã cung cấp cho store phù hợp.
- Thêm `remote-notification` vào background modes cho hợp đồng push. `location` chỉ ghi hành trình người dùng bật; `audio` chỉ playback thật; `processing` cho Expo background tasks. Loại `fetch` khỏi kết quả config cuối, không dùng audio/processing giữ CoreMotion sống.
- iOS motion hiện foreground-only. Background location không bảo đảm CoreMotion chạy liên tục; chưa chứng minh được điều kiện OS trên iPhone, giữ giới hạn này rõ trong UI và EXCEPTIONS.md.
- Firebase analytics/ads flags false giữ nguyên; consent của Mobile Ads là luồng riêng. Không bật analytics để sửa quảng cáo.
- Bluetooth dùng WebRTC định tuyến tai nghe; giữ các quyền SDK phù hợp. Launcher badge không thuộc chức năng bắt buộc, loại bằng manifest merger tools:node=remove.
- Build 38 cao hơn các artifact build 36 và iOS 37 đã cung cấp. Chưa có chứng cứ số version cao nhất trên store; phải kiểm trước phát hành, không suy đoán số đã publish.

## Blocker phải nghiệm thu bên ngoài

Ký thật và bộ 5 artifact cùng commit; macOS/Xcode compile Swift; Apple entitlement push/CarPlay; ADM SDK/config/key và FCM/APNs credentials; triển khai backend production; iPhone/Android/Fire/Wear thật. Hoàn thiện code có thể kiểm bằng fixture, giữ provider chưa sẵn sàng sau cờ, không tuyên bố foreground polling thay được ADM khi app đóng.

## Checkpoint L1 và rà bí mật

Năm profile và manifest release set đã có; fingerprint public không ghi giá trị key/URL. Signing local tách play/amazon, configure/compile Gradle không đọc file ký. Native dependency locks là input còn thiếu: production dừng khi chưa có lock được resolve và review trên host phù hợp. Không gọi pipeline tái lập hoàn tất chỉ vì có npm lock.

Scanner history đọc 666 blobs (30 commits gần nhất và objects reachable). Phát hiện chuỗi giống Firebase API key trong **5 blob lịch sử** của `.github/workflows/build-firebase-xctest-ios.yml`, mỗi blob hai dòng. Không dùng key để kiểm online, không in giá trị. Có thể là fixture cũ, chưa đủ chứng cứ gọi key đang hoạt động; chủ dự án cần xác minh, giới hạn API/package/certificate và rotate nếu thật. Source hiện tại không có finding. Không sửa/rewrite lịch sử chia sẻ khi chưa được yêu cầu; kết quả history scan vẫn fail trung thực.

## Checkpoint L2

Guard kiểm DEX definition + init method thay vì tìm string, ELF load segments 16 KB cho ABI64, ZIP alignment, rules chứa exclude database/sharedpref/root/file/external; so inputs nhúng và sidecar; bộ đủ năm artifact. Google phone/Wear phải cùng signer; Amazon được ký riêng theo quyết định store credentials, không ép ba APK cùng chứng chỉ.

Chuỗi dev được phân loại: constants RN/Expo, loopback Spotube hợp lệ, executable fetch/WebSocket route dev. Scanner không phải decompiler Hermes/native; vẫn cần smoke test cold start và kiểm config endpoint. Không cấm mọi localhost. Tests synthetic/mocked kiểm guard, không thay APK/IPA thật.

Nguồn sinh widget settings đã kiểm: expo-widgets 57.0.23 `plugin/build/ios/xcode/addXCConfigurationList.js` áp dụng **SWIFT_OPTIMIZATION_LEVEL=-Onone cho cả Debug và Release**. Final Release modifier đổi -O/wholemodule, ENABLE_DEBUG_DYLIB=NO, ENABLE_PREVIEWS=NO trên mọi target; không xóa dylib khỏi IPA. Chưa có Xcode/IPA để khẳng định đây là producer duy nhất của finding cũ.
