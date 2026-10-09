# MyMap 1.0.3 — APK Android và Fire OS, build 35

**Không dùng bộ cài build 35:** đã tái hiện crash khởi động trong cả hai flavor do R8 loại lớp JNI của WebRTC. Bản sửa 1.0.4 / build 36 và kết quả xác minh được ghi trong [báo cáo crash](ANDROID_FIREOS_STARTUP_CRASH_BUILD36_2026_10_08.md). Thông tin dưới đây giữ để đối chiếu bộ cài cũ; các kiểm tra đóng gói trước đó không phát hiện được lỗi runtime này.

Đã đóng gói và ký thành công ngày 08/10/2026. Đây là bộ cài kiểm thử tính năng; chưa QA trên thiết bị thật và chưa xác nhận sẵn sàng phát hành toàn bộ catalog.

| Bản | APK | Dung lượng | SHA-256 |
|---|---|---:|---|
| Android / Google | [MyMap-1.0.3-android-release.apk](../dist/releases/build-35/MyMap-1.0.3-android-release.apk) | 107.822.964 byte (~102,83 MiB) | `93CA9F9D29D9CB3713FF435A7115197152B1FB3A4B459279CD7B8A7DE602070E` |
| Amazon / Fire OS | [MyMap-1.0.3-amazon-release.apk](../dist/releases/build-35/MyMap-1.0.3-amazon-release.apk) | 107.660.259 byte (~102,67 MiB) | `89E3BA8AD9C03A5FB6125DA41F180E1EFB90F79E66D5C9999A7D42A1A431D8FD` |

Cả hai bản có package `com.pnhl.vibecoding`, versionName `1.0.3`, versionCode `35`, min SDK 24, target/compile SDK 36, ARM32 và ARM64. Giữ cùng chứng thư ký các bản trước, SHA-256 certificate `f33d4f0a947f39d269fec02b6095152cbb3e486593d270c5ed44c0b96cc5a3ab`.

## Kiểm tra gói đã đạt

- Release build hai flavor: thành công; retry sau sửa liên kết C++ mất 10 phút 42 giây, 916 tasks.
- `apksigner verify --verbose --print-certs`: chữ ký hợp lệ, certificate không đổi.
- `aapt`: đúng package/version/SDK/ABI; không có cờ debuggable/testOnly.
- `zipalign -c -P 16 4`: đạt cho cả hai APK.
- ELF ARM64: **41 thư viện mỗi APK**, tất cả PT_LOAD alignment ít nhất 16 KiB; không chỉ kiểm ZIP.
- Có bundle Hermes bytecode v98, 8.576.888 byte, nén 3.505.690 byte. Native checksum AI và module hai flavor được compile trong release này.
- Có runtime AI ARM64 `librnllama.so`; không đóng gói runtime llama 32 bit. Tính năng GGUF báo không hỗ trợ trên app/OS 32 bit.
- Không có tệp `.env`, keystore/JKS, release.properties hoặc LiveKit credentials tạm trong archive. Model Qwen không kèm trong APK; người dùng tải chủ động ~469 MiB hoặc nhập GGUF riêng.
- Tệp `.sha256` đi cùng mỗi APK khớp SHA-256 của APK.

Code cùng bản này đã qua TypeScript, 303 tests và các test ACL/account/membership/moderation/avatar/identity trên Supabase bằng transaction rollback. Ba Edge Functions mới trả 401 cho request không đăng nhập. Các kiểm tra này không chứng minh toàn bộ luồng đã chạy đúng trên thiết bị.

## Cài và kiểm thử

Cài đúng bản dành cho thiết bị. Hai APK dùng cùng package/chứng thư; không cài song song hai flavor. Các tiện ích mới mặc định tắt trong Cài đặt → Tiện ích mở rộng. Bật từng phần để kiểm thử.

`lphan7138@gmail.com` đã được cấp quản trị cộng đồng theo UID Firebase Google đã xác minh/canonical profile trên máy chủ. Trong bản mới, bật **Cộng đồng và bạn thân**, mở màn hình tương ứng và chọn **Kiểm duyệt báo cáo cộng đồng**.

Chưa kiểm hai máy gọi LiveKit/media, mic/camera khi nền, GPS ngoài đường, quyền nền/kill app trên Fire OS, model GGUF/AICore/speech tiếng Việt hoặc UI thực tế. R8 còn cảnh báo stack map trong `play-services-auth-21.5.0`; build đạt nhưng đăng nhập Google phải kiểm trên bản ký mới. `npm audit` còn 34 cảnh báo (9 moderate, 25 high; 0 critical).

Không khí Open-Meteo production đang chờ cấu hình quyền sử dụng hợp lệ với app có quảng cáo; chưa tự bật endpoint free phi thương mại trong bản release. Các phần chưa hoàn thiện/chưa triển khai nằm trong [báo cáo còn lại](ANDROID_FIREOS_REMAINING_2026_10_08.md), iOS tạm hoãn.

## Cấu trúc đóng gói

```text
mymap/
├─ src/                         React Native UI/nghiệp vụ/dịch vụ
├─ modules/my-map-capabilities/ Kotlin cho chức năng native Android/Fire OS
├─ plugins/                     Cấu hình native tái tạo bằng Expo prebuild
├─ supabase/                    SQL và Edge Functions phía máy chủ
├─ .signing/                    Bộ ký riêng; không đưa vào APK/source công khai
├─ scripts/
│  ├─ prepare-android-ai.cjs     Android AI artifact theo phiên bản/SHA cố định
│  ├─ patch-android-dependencies.cjs
│  └─ build-release.ps1         Ký, build google/amazon/both, tạo checksum
├─ android/app/build/outputs/apk/
│  ├─ google/release/app-google-release.apk
│  └─ amazon/release/app-amazon-release.apk
└─ dist/releases/build-35/
   ├─ MyMap-1.0.3-android-release.apk
   ├─ MyMap-1.0.3-android-release.apk.sha256
   ├─ MyMap-1.0.3-amazon-release.apk
   └─ MyMap-1.0.3-amazon-release.apk.sha256
```

JDK 21, Android SDK/NDK và bộ ký riêng đã có trên máy hiện tại. Lệnh tái tạo trong [báo cáo triển khai](ANDROID_FIREOS_COMPLETION_2026_10_08.md). Giữ build 34 để đối chiếu; bộ cài mới không ghi đè artifact cũ.
