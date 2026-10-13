# Release 1.0.4 / build 41 — 13/10/2026

## Phạm vi

Chủ dự án yêu cầu release Google Play, Amazon và iOS; riêng iOS dùng xtool. Sau khi được thông báo xtool không build trực tiếp dự án hiện tại, chủ dự án chọn **giữ yêu cầu xtool và ghi rõ blocker iOS**, không chuyển sang EAS/Xcode.

Android/Amazon giữ application ID `com.pnhl.vibecoding`, dùng các khóa release cũ riêng từng store, không dùng khóa Preview và không tạo khóa thay thế. Build number 41 cao hơn các artifact 36–40 đã tạo trong phiên; version thương mại giữ 1.0.4. Artifact sẽ nằm ở `dist/releases/build-41/`; receipt/checksum/verification ghi ngoài Git sau khi gates đạt. Không upload cửa hàng.

## Đầu vào và kiểm tra

- Firebase Android thật của project `mymap-a3ae4`, package chính; chứng chỉ Google release hiện có khớp Android OAuth client đã đăng ký. Không ghi cấu hình SDK hoặc mật khẩu/token vào tài liệu.
- Chỉ nạp biến public còn được source sử dụng; bỏ các tên provider secret legacy khỏi môi trường build. Giữ `EXPO_NO_DOTENV=1` để Expo/Metro không tự nạp lại `.env` legacy. Secret provider nằm server.
- Local config có Supabase public inputs, nhưng **chưa có routing gateway URL production**. App vẫn dùng nguồn public/fallback theo code; traffic/Mapillary và các chức năng bắt buộc gateway chưa được cấu hình trong artifact này.
- Quảng cáo Google dùng IDs release đã cấu hình; test ads tắt. Amazon giữ quảng cáo và ADM tắt theo cấu hình đã nghiệm thu source hiện hành.
- Chọn ARM64 cho hai APK/AAB, phù hợp đường native AI 64 bit đã compile. Không tuyên bố hỗ trợ ABI 32 bit bằng artifact này.
- Build script dùng signing config riêng từng store, Gradle dependency verification strict, R8/resource shrink và tạo provenance trước artifact gate. Gate kiểm package/version/chữ ký, permissions, backup, Hermes, JNI startup definitions, ELF/ZIP 16 KB và provider credentials. Kiểm cùng JS/input fingerprints giữa Google/Amazon/AAB sau khi build xong.
- Các test source/gates không thay thế QA GPS/push/SOS/gọi/AI trên máy thật hoặc xác nhận đăng nhập Google hoàn tất.
- Smoke test Release R8 phát hiện Google bị ẩn dù Firebase/OAuth đúng: reflection gọi `GoogleApiAvailability.getInstance/isGooglePlayServicesAvailable` bị R8 đổi tên. Đã bổ sung consumer keep rules tại module capabilities; gate Google APK/AAB yêu cầu class và cả hai method definitions có code, không chỉ có string/reference. Artifact trước sửa không được bàn giao. Các artifact cuối phải build lại từ source có bản sửa này và kiểm UI Google.
- PowerShell cần `[string[]]` cho danh sách Gradle tasks: nhánh Amazon chỉ có một task, nếu để string thì splatting truyền từng ký tự. APK/AAB Google được kiểm trong một lần verifier để không quét APK lặp lại.

## Blocker iOS với xtool

Đối chiếu [xtool upstream](https://github.com/xtool-org/xtool) và `Sources/XToolSupport/DevCommand.swift` trong bản clone ngày 13/10:

1. `PackOperation.run()` yêu cầu `Package.swift`/`Package@*.swift`; `xtool dev build` build ứng dụng SwiftPM. MyMap hiện là Expo/React Native/CocoaPods, không có SwiftPM app manifest tương ứng. Không thể thêm một Package.swift rỗng rồi coi là đã build MyMap.
2. `dev build --sign --ipa` ký sản phẩm SwiftPM được build trước đó; `install` có đường ký/cài app đã có, không biên dịch thay CocoaPods/React Native. Chưa có IPA MyMap mới để ký.
3. Windows cần WSL/Linux, Swift và Darwin SDK được trích từ Xcode theo hướng dẫn xtool. Máy hiện chỉ có distro docker-desktop, Docker daemon chưa chạy; chưa có runtime xtool/Swift/Darwin SDK đã cấu hình.
4. Chưa có Firebase plist iOS, Podfile.lock đã resolve hay Apple signing/provisioning inputs cho bản này. Khóa `.signing/mymap-release.p12` hiện là Android keystore, không phải Apple distribution certificate.

**Kết quả iOS: BLOCKED, chưa build hoặc ký IPA.** Chủ dự án đã chọn giữ blocker này. Không đổi đuôi APK thành IPA, không dùng app Swift mẫu thay MyMap, không thay xtool bằng EAS/Xcode ngầm. Để dùng xtool thuần cần thiết kế/migrate cả native dependency graph thành SwiftPM và nghiệm thu; đó là công việc riêng lớn hơn một lần build release. Nếu sau này cho phép Xcode/macOS, có thể dùng pipeline CocoaPods hiện có sau khi bổ sung inputs phù hợp.

## Bàn giao

Chỉ bàn giao Android/Amazon sau khi artifact gates đạt. Receipt thực tế nằm cạnh binaries, ghi hash, source commit, ABI, trạng thái iOS và các cấu hình production còn thiếu. Không gọi đây là release set đầy đủ năm artifact khi chưa có hai IPA.
