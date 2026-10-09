# MyMap Android / Amazon — sửa crash khởi động build 35

Bản thay thế: **1.0.4, versionCode 36**. Không dùng APK 1.0.3 build 35: đã tái hiện crash ở cả Google và Amazon release trên Android 15 với ABI arm64 qua native bridge.

## Nguyên nhân đã xác nhận

WebRTC `android-prefixed:144.7559.15` gọi `livekit.org.jni_zero.JniInit` trực tiếp từ native `JNI_OnLoad`. Consumer rules của `@livekit/react-native-webrtc` giữ `livekit.org.webrtc.**` và `org.jni_zero.**`; quy tắc thứ hai không khớp namespace có tiền tố `livekit.`. R8 loại lớp JNI không có lời gọi Java tĩnh, khiến tiến trình dừng ngay khi module WebRTC khởi tạo, dù người dùng chưa bật cuộc gọi.

Bằng chứng trước sửa:

- Log: `ClassNotFoundException: livekit.org.jni_zero.JniInit`, `Failed to find class livekit/org/jni_zero/JniInit`, sau đó fatal signal; stack native có `liblkjingle_peerconnection_so.so` / `JNI_OnLoad`.
- `usage.txt` của Google release build 35 liệt kê `livekit.org.jni_zero.JniInit` là lớp bị loại bỏ.
- Kiểm trực tiếp DEX của **cả hai APK build 35** bằng script mới đều thất bại vì thiếu class definition này.
- Hai regression tests thất bại trước sửa, đạt sau sửa; test regeneration thực thi plugin và kiểm cả trường hợp đã có rule namespace không tiền tố.
- Đây cũng là vấn đề đã được ghi nhận ở [LiveKit upstream](https://github.com/livekit/client-sdk-android/issues/735).

Sau khi sửa JNI và thử mở APK, còn phát hiện một lỗi R8 liên quan: `RNHeadlessAppLoader` bị loại bỏ dù manifest chọn nó qua metadata. `AppLoaderProvider` dùng `Class.forName()` và constructor không tham số, nên tác vụ nền không khởi tạo được. Bản thử đầu đã mở foreground được ba lần, nhưng vẫn có log thiếu loader. Đã bổ sung keep rule cụ thể cho lớp này trong bản cuối; hai regression tests loader cũng thất bại trước sửa và đạt sau sửa.

## Sửa đổi

- Thêm `-keep class livekit.org.jni_zero.** { *; }` vào Proguard của app.
- Lưu cùng quy tắc trong `plugins/withMyMapAndroid.ts`, áp dụng idempotent để Expo prebuild không làm mất bản sửa.
- Giữ `expo.modules.adapters.react.apploader.RNHeadlessAppLoader` và constructor/phương thức để Expo TaskManager nạp từ manifest được.
- Giữ tối ưu release và tính năng LiveKit/WebRTC.
- `scripts/verify-apk-startup.ps1` kiểm class definition `JniInit`/phương thức `init` và class definition/constructor của `RNHeadlessAppLoader` trong DEX của APK; không chỉ kiểm một chuỗi ký tự có xuất hiện trong file. Script đã từ chối cả hai APK build 35, và từ chối bản thử chỉ sửa JNI vì vẫn thiếu loader.
- `scripts/build-release.ps1` gọi kiểm tra này trước khi tạo checksum/bàn giao APK ở những lần build tiếp theo.
- Bump version chung 1.0.4 và Android build 36; không build iOS.

## Kiểm tra

- TypeScript: đạt.
- Tests: **307 đạt, 0 lỗi**, gồm 4 regression tests cho hai nhóm keep rules và Expo regeneration.
- Release build cuối Google/Amazon: **thành công**, 6 phút 38 giây, 916 tasks.
- APK DEX giữ nguyên hai class definitions/phương thức bắt buộc; bước kiểm tích hợp trong build đạt cho cả hai flavor.
- Chữ ký hợp lệ, cùng certificate với bản trước; đúng package/version/SDK/ARM32+ARM64, checksum khớp, không debuggable/testOnly.
- ZIP alignment 16 KiB và 41 thư viện ELF ARM64 mỗi APK đạt; không có file credentials/keystore tạm trong gói.
- Android: 3 lần khởi động lạnh bản cuối đạt, MainActivity foreground, PID ổn định tại 10/15 giây sau launch, không fatal JS/Java/native hoặc lỗi thiếu Expo loader; checksum APK cài trên máy ảo trùng file bàn giao.
- Amazon: 3 lần khởi động lạnh bản cuối đạt cùng các kiểm tra trên; checksum APK đã cài trùng file bàn giao. Tổng cộng **6 lần khởi động** cho hai flavor, không có lỗi thiếu lớp hoặc fatal.

## APK thay thế

Cài cập nhật APK phù hợp lên ứng dụng hiện tại; giữ cùng package/chứng thư ký. Hai flavor dùng cùng package nên không cài song song.

| Bản | File | Dung lượng | SHA-256 |
|---|---|---:|---|
| Android / Google | [MyMap-1.0.4-android-release.apk](../dist/releases/build-36/MyMap-1.0.4-android-release.apk) | 107.825.600 byte | `AF1129D4993F5903F404DFCDF7E7DA412315D2EB2241B16B1AE03344979DAB79` |
| Amazon / Fire OS | [MyMap-1.0.4-amazon-release.apk](../dist/releases/build-36/MyMap-1.0.4-amazon-release.apk) | 107.663.283 byte | `72BBB4F23BED140E3D6D73B1B329BF54DDEBAD7C4A47E7AB2F6BCE2D3D0FD8C8` |

Package `com.pnhl.vibecoding`, versionName 1.0.4, versionCode 36, min SDK 24, target SDK 36. Certificate SHA-256: `f33d4f0a947f39d269fec02b6095152cbb3e486593d270c5ed44c0b96cc5a3ab`.

Evidence cục bộ: `.local/android-fireos-build36-final.log`, `.local/build36-verification.log`, `.local/build36-elf-check.json`, `.local/build36-tests.log`, `.local/build36-typecheck.log`, `.local/build36-final-startup-evidence.json`, `.local/build36-android-startup.json`, `.local/build36-amazon-startup.json` và hai file smoke log; log từng lần khởi động và SHA APK cài được lưu cạnh chúng. Các chứng cứ chỉ là kiểm tra kỹ thuật, không thay UI QA/GPS ngoài đường hoặc cuộc gọi trên hai máy thật.

LDPlayer hiện có trên máy nhưng `basicSettings.adbDebug` đang tắt. Không đổi cấu hình hoặc khởi động lại máy ảo của người dùng. Việc tái hiện/kiểm tra dùng AVD QA Android 15 chạy riêng, không xóa dữ liệu LDPlayer.

Phạm vi bản sửa là crash khởi động. Không coi đây là kiểm thử toàn bộ chức năng hoặc thiết bị Fire OS thật; các giới hạn tính năng vẫn theo [báo cáo còn lại](ANDROID_FIREOS_REMAINING_2026_10_08.md).

Trạng thái: **DONE_WITH_CONCERNS** — đã tái hiện crash, sửa và kiểm lại chính APK release đã ký trên AVD Android 15. Chưa mở trực tiếp trên LDPlayer (ADB đang tắt) hoặc thiết bị Fire OS thật. Máy ảo QA riêng đã được dừng sau kiểm tra. Cảnh báo R8 stack map của Google Play Services và dependency audit từ đợt trước vẫn còn, không phải nguyên nhân crash JNI đã sửa.
