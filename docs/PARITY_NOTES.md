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

## Checkpoint L3/L4 — hợp đồng và provider

TrackingSnapshot owner/mode/error được persist cùng controller và gửi sang Live Activity/native notification. Android recorder cập nhật cùng schema khi reboot, thiếu provider/quyền hoặc FGS bị từ chối. NavigationSnapshot giữ nguyên dữ liệu route bên cạnh instruction/speed. Safety reducer phân biệt pending/cancel/queued/accepted/delivered; SOS UI chỉ báo máy chủ ghi nhận, không suy ra người thân đã nhận. Dialer native/JS kiểm handler trước khi mở.

Capability API kiểm GMS, location provider, accelerometer/barometer, device credential/dialer, 64 bit/RAM, ads/push. GMS probe dùng reflection/catch LinkageError; facade không require Google SDK khi thiếu GMS. Native JVM tests có ClassLoader từ chối Google class, nhưng **chưa chứng minh whole-app cold start trên Fire**. Firebase Auth/Common còn vì email/guest và widget; không gọi toàn Firebase là GMS-only.

Manifest đã hợp nhất Fire cho thấy Expo Notifications kéo cả `FirebaseMessagingRegistrar` và Ktx registrar dù service đã bị remove. Plugin cuối nay remove cả hai metadata discovery và giữ auto-init=false. FCM classes còn là dependency của Expo Notifications, không claim toàn DEX không chứa chữ Firebase. Gate chặn initializer/service/receiver bắt buộc GMS. Google merged manifest dùng permission Nano `com.google.android.apps.aicore.service.BIND_SERVICE`; sửa whitelist tên cũ sai, không thêm permission mới vào app.

Liên kết Google/Apple/phone là thao tác riêng trong Settings, dùng linkWithCredential trên UID hiện tại. OTP dùng verifyPhoneNumber rồi credential linking, không dùng ConfirmationResult.confirm để vô tình đổi UID. Collision/đổi owner giữa flow bị từ chối; email vẫn portable. Magic-link sender/callback đã có, nút ẩn khi thiếu Hosting. Cần provider console/SMS/reCAPTCHA trên Fire thật.

ADM native/client/backend nằm sau MYMAP_ENABLE_ADM (mặc định false); SDK JAR phải có SHA đúng, API key asset qua injection. Thêm **hai uses-permission ADM** chỉ khi bật: Amazon RECEIVE và permission nhận của package được protectionLevel=signature; receiver yêu cầu Amazon SEND signature permission. Đây là quyền cần cho quyết định push ADM đã duyệt, không thêm overlay/full-screen/call permission. Warm/cold intent được consume một lần, owner check; native payload generic. Registry v2, lease ownership, revoke/token rotation và provider errors có tests. Expo chỉ fallback registry v1 khi function v2 chưa tồn tại, không fallback lỗi quyền/mạng. Backend mới chưa deploy và ADM SDK chưa có để compile; foreground inbox không thay ADM closed-app.

Fire geofence mới nối system recorder opt-in, dùng hysteresis accuracy, state và event queue private theo UID. Native phát local notification khi app background; replay server khi resume có mạng, không gửi event owner khác. Recorder tắt dùng watcher foreground; queue tối đa 1000, báo lỗi khi đầy thay vì bỏ sự kiện cũ. Retry sau process death có thể tạo delivery ít nhất một lần; không hứa exactly-once backend. Không tạo service/permission mới cho geofence.

Recap request schema chung qua AVFoundation/Media3, owner check trước/sau export, có cancel UI/native. Watch/Wear code chung giữ cuối nghiệm thu; bản Wear cũ không chứng minh source mới. CarPlay vẫn false mặc định. Cloudflare secret store hiện có không được đọc/đổi/triển khai trong lượt này theo hạn chế credential mới; tên biến CI/EAS và hướng dẫn injection ở BUILD.md.

## Native locking và giới hạn chứng minh

Đã resolve Gradle locks/checksums trên fixture Firebase giả, không .env/.signing. Compile/test Google/Fire không cần keystore. Lượt strict verification đầu phát hiện thiếu checksum AAPT2 từ detached configuration (dependency report không resolve đủ tool runtime); đã bổ sung bằng compile thật, không tắt verification để phát hành. Cần kiểm lại strict, host Linux/macOS tools và toàn release/R8/ABI trước khi gọi lock hoàn tất. Podfile.lock vẫn BLOCKED trên Windows. Không tạo five-artifact release set giả để vượt gate.
