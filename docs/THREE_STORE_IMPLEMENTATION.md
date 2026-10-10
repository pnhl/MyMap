# Bàn giao triển khai ba cửa hàng — 10/10/2026

> **Tài liệu lịch sử của lượt trước.** Quyết định mới và trạng thái hiện hành nằm ở [PARITY_PROGRESS.md](PARITY_PROGRESS.md), [PARITY_NOTES.md](PARITY_NOTES.md), [BUILD.md](BUILD.md), [EXCEPTIONS.md](EXCEPTIONS.md). Đặc biệt: Fire ads hiện tắt, ADM có client/backend nhưng chờ hạ tầng, iOS modes có remote-notification. Các số test/build/backend bên dưới không chứng minh commit mới.

Đã chuyển về một cây nguồn, release 1.0.4/build 38. Báo cáo phase 0 giữ nguyên để so sánh trước/sau. Đây là trạng thái **mã nguồn và kiểm tra**, chưa phải chứng nhận đã chạy đủ ba bản trên thiết bị thật. Những khác biệt dưới đây được giải thích, nhưng ngoại lệ chưa có xác nhận riêng của chủ dự án vẫn ở trạng thái chờ duyệt.

## Ma trận sau triển khai

“Có” nghĩa là đã có đường thực thi trong source; các điều kiện phần cứng, credentials và kiểm thử thực địa vẫn áp dụng.

| Tính năng | iOS | Google Play | Amazon/Fire | Nguồn / điều kiện |
|---|---|---|---|---|
| MapLibre, tìm địa điểm, dẫn đường | Có | Có | Có | `src/components/MapLibreNativeMap.tsx`, `roadRouting.ts`; GPU/network |
| Bản đồ/tuyến offline | Có | Có | Có | `offlineMap.ts`, `offlineRoutes.ts`; tải dữ liệu được cấp phép trước |
| Vị trí khi app mở | CoreLocation | Expo/provider hệ thống | LocationManager | `platformLocation.ts`; Fire không có GPS thì báo chờ/không khả dụng |
| Ghi GPS khi khóa màn hình | Expo/CoreLocation | Foreground recorder | LocationManager foreground recorder | `locationTracking.ts`, `PlatformTrackingService.kt`; giữ quyền nền cần dùng |
| Khôi phục recorder sau reboot | Lifecycle iOS | Receiver kiểm quyền và prefs recorder | Cùng receiver | `BootReceiver.kt`; OS có thể chặn khởi động nền; UI cho bật lại |
| SOS lưu/đồng bộ | Có | Có | Có | `liveSafety.ts`, `SOSScreen.tsx`; không có dialer vẫn lưu SOS |
| Gọi khẩn cấp | Xác nhận hệ thống | Dialer, người dùng ấn gọi | Nếu thiết bị có dialer | Không thêm quyền CALL_PHONE; Fire tablet có thể không gọi được |
| Va chạm/rơi khi app mở | CoreMotion | SensorManager | Cảm biến có sẵn | `MyMapTravelModule.swift`, `SafetyMonitorService.kt`; không mô phỏng cảm biến thiếu |
| Va chạm nền, rơi cao/5 phút | Ngoại lệ E1 | Có theo thuật toán hiện có | Nếu có cảm biến/OS cho phép | iOS đã hiển thị giới hạn thật, không hứa giám sát khi khóa máy |
| Geofence | Expo/CoreLocation | Expo | GPS khi app mở, E2 | `geofencing.ts`; bỏ đường Expo geofence cần GMS trên Fire |
| SQLite, ảnh/kỷ niệm/timeline | Có | Có | Có | DB và logic JS chung |
| Camera/video/micro | Có | Có | Có nếu có phần cứng | Không xin quyền cho đến thao tác cần dùng |
| Offline queue/sync | Có | Có | Có | `sharedSync.ts`, `moments.ts`, `privateChat.ts` |
| Bạn bè/chia sẻ riêng tư | Có | Có | Có | RLS/Firebase UID, `sharingPrivacy.ts`, `ghostMode.ts` |
| Chat | Có | Có | Có | `privateChat.ts`; cần kiểm hai thiết bị |
| LiveKit/WebRTC | Có | Có | Có | `calls.ts`; token backend và quyền micro/camera |
| Báo chat/cuộc gọi khi đóng app | Expo/APNs sau cấu hình | Expo/FCM sau cấu hình | Inbox/polling khi mở, E3 | Thông báo generic và mở Call/Chat theo đúng owner, gồm cold start |
| Thông báo local | Có | Có | Có | Quyền notification hiện có; polling không tự xin thêm quyền |
| Push remote | APNs qua Expo | FCM qua Expo | Polling foreground, E3 | `pushRegistration.ts`, `notificationDelivery.ts`, backend leased worker |
| Email/password/khách | Có | Có | Có, cần Fire QA | Firebase native Auth; không đồng nhất mọi thư viện Firebase với GMS bắt buộc |
| Google Sign-In | Native nếu cấu hình | Native nếu có GMS | Ẩn | Facade không require SDK khi native module bị loại |
| Phone OTP | Có nếu Firebase cấu hình | Có nếu Firebase cấu hình | reCAPTCHA/provider, E4 | Chưa kiểm SMS thực tế; email/password là lựa chọn chung |
| Apple Sign-In và cùng tài khoản | Apple native + liên kết email | Đăng nhập email đã liên kết | Đăng nhập email đã liên kết | `linkAccountEmail` giữ nguyên UID, không merge email collision |
| Game Center | Native | Không áp dụng, E5 | Không áp dụng, E5 | Giữ email/password cho tài khoản chung |
| Magic link | Hosting/Universal Link | Hosting/App Link | Hosting/App Link | Có sender/callback và xác nhận email trên máy khác; ẩn nút khi thiếu cấu hình |
| Khóa ứng dụng | Face ID/Touch ID/passcode | BiometricPrompt/device credential | Device credential/cảm biến nếu có | `AppLock.tsx`, `MyMapCapabilities`; không lưu PIN riêng |
| Vault/chữ ký thiết bị | Keychain/CryptoKit | AndroidKeyStore | AndroidKeyStore | Không tuyên bố toàn bộ SQLite đã mã hóa |
| Widget khoảnh khắc | ExpoWidgets/App Group | MomentWidget | Nếu launcher hỗ trợ | `momentWidget.ts`, `MomentWidget.kt`; owner/friends/TTL, xóa khi đăng xuất |
| Trạng thái hành trình ngoài app | Live Activity/Dynamic Island nếu hỗ trợ | Ongoing notification | Ongoing notification | `journeyActivity.ts`, `JourneyActivity.tsx`; start/update/end, không nhúng tọa độ |
| Quick action | Home screen App Shortcuts | Quick Settings tile | Tile nếu Fire có surface, E5 | Shortcut SOS/camera/tracking; tile điều khiển recorder thật |
| Đồng hồ | Watch target + WatchConnectivity | Wear companion tối thiểu | Không áp dụng, E5 | Watch hướng dẫn/SOS; Wear cảnh báo + yêu cầu SOS xác nhận trên điện thoại |
| Màn hình xe | CarPlay sau entitlement, E6 | Android Auto | Không áp dụng, E5 | Code CarPlay đã tích hợp; chưa tự bật quyền Apple chưa cấp |
| GGUF/rnllama chung | Có | Có | Có nếu đủ RAM/64 bit | Hash/model validation; không bảo đảm mọi Fire tablet đủ RAM |
| AI hệ thống tối ưu | Apple Intelligence nếu có | Nano/AICore nếu có | Không áp dụng, E5 | Provider không có thì báo và vẫn có GGUF để chọn |
| OCR/nhãn ảnh | Apple Vision | ML Kit bundled | ML Kit bundled, cần Fire QA | Không tải model phụ thuộc GMS cho Fire |
| Speech offline | SFSpeech on-device nếu ngôn ngữ hỗ trợ | Offline recognizer nếu có | Nếu có recognizer, E5 | `VoiceSearchButton.tsx`; nhập chữ luôn có |
| TTS | Giọng hệ thống | Giọng hệ thống | Nếu có voice/provider | `guidanceSpeech.ts`; không quảng cáo giọng chưa cài |
| Video recap/chia sẻ | Native AVFoundation adapter | Media3 native | Media3 native | `MyMapMomentsModule.swift`, `moments.ts` |
| Nhạc/audio nền | Có | Có | Có | `musicPlayback.ts`; background audio dùng thật |
| Spotube localhost | Không có native launcher Android, E5 | Có nếu cài Spotube | Nếu cài Spotube | Loopback chức năng giữ lại; không xóa nhầm thành chuỗi Metro |
| Quảng cáo | AdMob IDs iOS riêng | AdMob IDs Android | Cùng AdMob IDs Android | Full Mobile Ads SDK hỗ trợ không có Google Play; consent/no-fill chung, không thêm quyền Advertising ID cho Fire; cần device QA |

## Ngoại lệ và cấu hình cần xác nhận

| ID | Khác biệt | Lý do và phương án hiện tại | Trạng thái |
|---|---|---|---|
| E1 | iOS không giám sát va chạm/rơi liên tục khi khóa máy | CoreMotion của app dừng ở background; giữ SOS, GPS nền, phát hiện foreground; không thêm entitlement/permission để hứa khả năng OS không cấp | Chờ duyệt khác biệt |
| E2 | Fire geofence foreground | Thay đường geofence Google bằng GPS/watch dùng chung; OS/thiết bị cần provider. Geofence nền độc lập recorder chưa được triển khai | Chờ duyệt hoặc yêu cầu native background bổ sung |
| E3 | Fire không có push khi ứng dụng đóng | Loại FCM, không đăng ký token Expo trên Fire; inbox polling 15 giây khi active. ADM cần đăng ký credentials/SDK riêng và phép bổ sung nếu phát sinh | Chờ duyệt fallback đúng gợi ý phase 0 |
| E4 | Phone OTP Fire chưa nghiệm thu | Firebase reCAPTCHA/provider phải thử thiết bị và cấu hình nhà cung cấp; email/password cùng UID đã có | Chờ QA |
| E5 | Surface/provider riêng nền tảng | Game Center, Nano, Android Auto, Watch/Wear, tile, giọng nói, Spotube tùy OS/phần cứng; có lựa chọn chung trong app | Chờ duyệt không áp dụng |
| E6 | CarPlay chưa bật mặc định | Apple phải cấp `com.apple.developer.carplay-maps`; chỉ bật khi provisioning phù hợp | Chờ entitlement chủ dự án |
| E7 | Trước đây loại AdMob khỏi Fire | Đã sửa theo yêu cầu chủ dự án: bật full Mobile Ads SDK và ID Android trên Amazon; SDK hỗ trợ không có Google Play, giữ consent và không thêm quyền Advertising ID | Đã xử lý trong mã; chờ QA Fire/inventory thật |

Watch target mặc định bật; phải ký app Watch cùng cấu hình Apple phù hợp. Wear APK đã biên dịch, nhưng luồng Data Layer trên hai thiết bị chưa kiểm. Không coi có APK là đã gửi SOS thành công trên đồng hồ.

## Chín finding

| Finding | Xử lý | Bằng chứng / bước còn lại |
|---|---|---|
| 1. AdMob iOS test | Release guard chặn sample ID; app/unit IDs theo OS | Thiếu ID iOS thật trong cấu hình private hiện tại, build sẽ dừng |
| 2. Widget debug dylib | Release và ENABLE_DEBUG_DYLIB=NO tất cả target; ZIP guard | Chưa có IPA mới để xác minh artifact thật |
| 3. allowBackup | false, exclude cloud và device transfer | CNG Android đã xác minh; guard APK/AAB bắt buộc |
| 4. Quyền thừa | Loại storage cũ/overlay/activity recognition; whitelist từng store | Cần đối chiếu merged release manifest qua CI; GPS/FGS/audio/safety có lý do dưới đây |
| 5. Location Always tiếng Anh | Gán mô tả tiếng Việt cụ thể | Guard Info.plist; chờ IPA |
| 6. Background modes | Chỉ location/audio/processing | App Review mô tả recorder, playback, background task; không yêu cầu silent remote notification |
| 7. Firebase flags vs AdMob | Giữ analytics/ads Firebase tắt; AdMob consent/config riêng | Firebase Analytics flags không bật/tắt SDK Google Mobile Ads độc lập; không bật analytics để chữa quảng cáo |
| 8. Endpoint dev | Network config 10.0.2.2 chỉ debug; IPA guard endpoint Metro | RN/Expo dependency có thể chứa text chẩn đoán; không xóa loopback Spotube dùng thật; chờ release bundle scan |
| 9. Fire thiếu GMS | Native exclusion Google Sign-In/AdMob, Nano flavor stub, GPS fallback, polling, lazy imports | Amazon autolinking đã kiểm; chưa có APK điện thoại mới/chưa chạy Fire thật |

## Quyền và App Review

Không thêm loại quyền Android điện thoại mới. Giữ foreground/background location cho hành trình được người dùng bật; FOREGROUND_SERVICE_LOCATION cho recorder; MEDIA_PLAYBACK cho nhạc; SPECIAL_USE cho safety monitor có thông báo thường trực; camera/micro cho thao tác chụp/gọi; POST_NOTIFICATIONS/VIBRATE cho cảnh báo hiện có; BOOT_COMPLETED cho khôi phục recorder được bật trước đó; biometric/device credential cho khóa app. Tắt theo dõi và safety phải dừng service tương ứng. Người dùng vẫn có thể từ chối quyền.

Wear companion chỉ khai báo VIBRATE, một loại quyền đã có trong hệ sản phẩm; không xin microphone, camera, location hoặc quyền gọi điện. iOS speech usage là quyền của tính năng speech đã có ở nhánh iOS được hợp nhất, không tự kích hoạt speech ở startup. Không thêm quyền CarPlay nếu chưa có cấu hình explicit.

## Kiểm tra thực tế trong phiên

- TypeScript và lint source/store isolation: đạt.
- Node tests: 316/316 đạt; gồm sender push, RLS/lease Postgres thật trong PGlite, tài khoản cùng UID, facade không GMS.
- Guard IPA giả lập: 4 test đạt (không thay thế kiểm IPA thật).
- Amazon CNG prebuild: đạt; autolinking không còn Google Sign-In/AdMob, vẫn có Firebase Auth/rnllama.
- Kotlin native capabilities Amazon và Safety Release: đạt; app GoogleDebug và AmazonDebug (bao gồm recorder, tile, bridge Wear) đã compile thành công. Đây không phải release artifact.
- Export JS raw Android/Fire sau Magic Link: cùng SHA-256 `CC202E7E00A8EB56C8D9AC460576CB22F660C4FA0F5B435AF509F1C017A9A831`. Export `--no-bytecode` chỉ dùng kiểm logic, không đổi Hermes release; artifact cuối vẫn phải so sánh lại.
- Wear APK/AAB 1.0.4/code 38: Gradle Release thành công sau khi bổ sung icon; chữ ký APK cần đối chiếu Play trên thiết bị dùng Play App Signing.
- Backend push: migration/RLS áp dụng, hai Edge Functions active; 10 HTTP scheduled requests gần nhất trả 200; số thiết bị đăng ký 0, chưa gửi thử tới người dùng.

Chưa hoàn tất: signed IPA, unsigned IPA, AAB Play, hai APK điện thoại từ commit cuối; Swift/Xcode native compile và toàn bộ QA thiết bị thật. Windows Device Guard chặn Hermes compiler; Expo cũng không sinh iOS project trên Windows. EAS chưa đăng nhập/liên kết project và cấu hình ký; GitHub chưa có remote/secrets. Các trạng thái này không được ghi thành “build thành công”.

Tài liệu kỹ thuật: [Wear Data Layer](https://developer.android.com/training/wearables/data/overview), [Firebase account linking](https://firebase.google.com/docs/auth/web/account-linking), [Firebase Hosting email links](https://firebase.google.com/docs/auth/android/email-link-auth). Private push tables bật RLS nhưng không có public policy là chủ đích; RPC service-role và register-owner là đường truy cập. Advisory về anon SECURITY DEFINER được giữ vì Firebase token đi qua role anon và được xác thực issuer/audience/UID trong hàm; không dùng user_metadata làm quyền truy cập.
