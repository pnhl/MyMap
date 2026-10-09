# Đóng gói MyMap 1.0.1 — 08/10/2026

Đã tạo hai APK release có ký từ mã hiện tại. Không thay đổi phiên bản hoặc khóa ký trong lần đóng gói này.

| Thuộc tính | Kết quả |
| --- | --- |
| Application ID | `com.pnhl.vibecoding` |
| Version name / code | `1.0.1` / `32` |
| ABI trong mỗi APK | `armeabi-v7a`, `arm64-v8a` |
| JavaScript | Hermes bytecode 98, bundle được nén trong APK |
| Chữ ký | APK Signature Scheme v2 hợp lệ; cùng chứng thư với cả hai APK 1.0.0 trước đó |
| Chứng thư SHA-256 | `f33d4f0a947f39d269fec02b6095152cbb3e486593d270c5ed44c0b96cc5a3ab` |
| Cấu hình build | Production; minify, resource shrink, bundle compression; `EXPO_PUBLIC_ENABLE_TEST_ADS=false` |

## Tệp bàn giao

| Kênh | Tệp | Dung lượng (byte) | SHA-256 |
| --- | --- | ---: | --- |
| Android / Google | `dist/releases/MyMap-1.0.1-android-release.apk` | 45.308.973 | `C2B321C9765B91538F993158B4BA00E19115076A2802294731CB874B7F8A15E9` |
| Amazon | `dist/releases/MyMap-1.0.1-amazon-release.apk` | 45.308.066 | `35B2D93BF1EAFF558DDE73850B2C82166CBAEEAE4D75359E8FE19C57B3825DCC` |

Mỗi APK có tệp `.apk.sha256` đi kèm và đã được đối chiếu với hash tính lại. Các bản 1.0.0 và bản cũ được giữ nguyên.

## Kiểm chứng

- `npm run typecheck`: đạt.
- `npm test`: 174/174 đạt.
- Gradle: `BUILD SUCCESSFUL`, hai task `assembleGoogleRelease` và `assembleAmazonRelease`, 6 phút 54 giây.
- Android SDK 36.0.0 `apksigner verify`: cả hai APK hợp lệ và giữ chứng thư của bản trước.
- `aapt dump badging`: đúng application ID, version name, version code; manifest không bật `debuggable` hoặc `testOnly`.
- Kiểm tra ZIP: đủ hai ABI ARM, có bundle Hermes nhúng; `zipalign -c -P 16 4` đạt. Đây là kiểm tra căn chỉnh ZIP, không thay thế kiểm tra ELF hoặc chạy trên thiết bị dùng trang bộ nhớ 16 KB.
- Hermes compiler nguyên bản đã chạy bình thường. Lỗi Device Guard exit 4551 ghi nhận ngày 05/10 không tái hiện trong lần build này; không thay đổi chính sách bảo mật.

Log trong `.local/packaging-2026-10-08-build.log`, `-typecheck.log`, `-tests.log`, `-verification.log` và log chữ ký/manifest từng kênh. Script kiểm tra riêng: `.local/verify-packaging-2026-10-08.ps1`.

## Phạm vi chưa xác minh trong lần đóng gói

Không có điện thoại hoặc giả lập đang kết nối qua ADB, nên chưa cài/chạy hai APK release mới hoặc thử cập nhật giữ dữ liệu. QA debug trước đó được ghi tại `RELEASE_1_0_1_REPAIRS.md`; cần kiểm tra GPS ngoài đường, quảng cáo production, Spotube 5.1.2 và chia sẻ giữa hai tài khoản trên thiết bị thật.

Build có cảnh báo R8 về stack map của thư viện Google Play Services Auth 21.5.0 và cảnh báo Gradle deprecated; build vẫn đạt. Chưa nâng cấp thư viện hoặc Gradle trong lần đóng gói này. Chưa tạo AAB, chưa tải lên cửa hàng.

## Lệnh đã chạy

```powershell
& ./scripts/build-release.ps1 -JavaHome "$env:USERPROFILE/.jdks/jbr-21.0.11" -Channel both -Architectures 'armeabi-v7a,arm64-v8a' -OutputDirectory 'dist/releases'
```
