# Prompt bàn giao MyMap — việc còn lại và đóng gói APK

Sao chép nội dung từ “Bắt đầu prompt” đến “Kết thúc prompt” vào phiên làm việc tiếp theo.

## Bắt đầu prompt

Bạn đang tiếp tục phát triển MyMap tại `C:\Users\ThinkBook 16 G8\Documents\mymap`. Hãy sửa mã, kiểm thử và hoàn thiện ứng dụng để có thể phát hành, không dừng ở đề xuất. Đọc hướng dẫn của repository nếu có và giữ các thay đổi hiện tại. Không ghi đè hoặc xóa dữ liệu GPS, ảnh, tài khoản hay khóa ký. Không giả lập dữ liệu trong ứng dụng production. Khi thiếu tài khoản/thiết bị/quyền dịch vụ, tiếp tục phần có thể làm và ghi rõ phần chưa xác minh.

### Trạng thái đã có

- React Native/Expo/TypeScript; SQLite local; Firebase Auth; Supabase cho kết nối bạn bè/Khoảnh khắc; MapLibre Native, Leaflet và các web map; AdMob; Spotube companion.
- Phiên bản hiện tại `1.0.1`, Android `versionCode 32`, applicationId `com.pnhl.vibecoding`. Chưa có bản release mới hoàn tất.
- Đọc `docs/RELEASE_1_0_1_REPAIRS.md`, `docs/PROJECT_REVIEW_FLOATING_ACTIONS_2026_10_05.md`, `docs/SPOTUBE_MUSIC_V30.md` và `docs/MOMENTS_CAMERA_WIDGET_V31.md` trước khi sửa.
- Đã sửa trong mã: tọa độ heatmap giữ GPS/ảnh gốc; lưới scratch được dựng lại từ GPS, số ô/diện tích thực và bỏ phần trăm/tên khu vực giả; định vị zoom 16; camera chờ style, giữ lệnh mới nhất, bỏ mốc sẵn sàng giả; bám vị trí chỉ đường, kéo map tạm dừng và Về giữa bật lại; web map không tải lại trang theo mỗi GPS; truy vấn giới hạn tốc độ theo tọa độ/hướng, loại kết quả cũ; các nút nổi độc lập; feed Khoảnh khắc tập trung ảnh và bộ lọc; sửa crash bộ ghi âm khi rời chi tiết ảnh; timeline đọc đúng ngày/tháng và không nối đoạn mất GPS; chẩn đoán GPS/quảng cáo và phản hồi lỗi Spotube.
- `npm run typecheck` và 172 kiểm thử đã qua. Đây là kiểm thử mã, không chứng nhận mọi luồng production.
- Bản phát triển đã chạy trên giả lập riêng. GPS dùng tọa độ mô phỏng để kiểm tra, không phải chuyến đi thật. Đã kiểm tra định vị/zoom, tìm Bến Thành và chỉ đường, kéo bản đồ tạm dừng bám vị trí, Về giữa phục hồi; chụp/lưu ảnh local và mở ảnh rồi quay lại feed. Ảnh QA nằm trong `docs/release-v32-validation`.
- Người dùng xác nhận Spotube **5.1.2**, đã nhập cùng cổng vào hai ứng dụng nhưng vẫn không kết nối. Chưa xác nhận kết nối thành công trên điện thoại người dùng.

### Việc còn lại, theo thứ tự

1. **Bản đồ và chỉ đường trên thiết bị thật:** kiểm tra GPS lạnh, cấp/từ chối quyền, GPS kém, mất mạng, định vị/zoom, đổi lớp/engine, dọc/ngang, quay lại ứng dụng. Chạy một tuyến thực; xác minh marker và camera di chuyển theo GPS, kéo map giữ góc nhìn, Về giữa phục hồi bám vị trí. Kiểm tra timeout tile/sprite/glyph của OpenFreeMap và khả năng đổi nguồn khi lỗi. Đừng tự kết luận upstream đã ổn chỉ vì bản đồ tải được một lần. Kiểm tra route refresh không mất tuyến cũ, không nhảy camera và không chọn sai đường song song/nút giao.
2. **Giới hạn tốc độ:** đối chiếu dữ liệu OSM có/không có `maxspeed`, hướng, conditional, đường một chiều, rẽ sang đường khác. Phân biệt dữ liệu có trong OSM, ước lượng và chưa biết. Không biến ước lượng thành biển báo đã xác nhận; giữ cảnh báo tự động theo chính sách hiện có hoặc ngưỡng người dùng chủ động đặt. Kiểm tra tốc độ GPS không nhảy bất thường khi đứng yên/mất tín hiệu.
3. **Spotube 5.1.2:** tái hiện với APK chính thức trên cùng điện thoại, cổng cố định (ví dụ 8765), endpoint `ws://127.0.0.1:<port>/ws`. Phân biệt server chưa chạy/cổng chưa áp dụng, socket đã mở chờ chấp nhận và lỗi lệnh sau kết nối. Thử đổi cổng rồi mở lại Spotube; chấp nhận/từ chối/hủy/timeout/chuyển nền/mở lại. Kiểm tra điện thoại có chặn Spotube ở nền không. Không scan cổng, không bỏ hộp thoại chấp nhận, không chuyển sang thiết bị khác/LAN ngoài phạm vi. Với 5.1.2, thiết lập LAN không phải điều kiện bắt buộc của server loopback; đối chiếu nguồn chính thức trước khi thêm hướng dẫn. Giữ lại lỗi cụ thể để tìm nguyên nhân, không chỉ thay thông báo.
4. **Quảng cáo production:** kiểm tra trạng thái AdMob của ứng dụng và 9 native ad units, App ID, UMP/privacy form và phản hồi No Fill/lỗi mạng. Dùng panel chẩn đoán trong Cài đặt. Kiểm tra retry, giải phóng native ad khi rời màn hình, assets/AdChoices/media và giao diện của các loại creative. Banner fallback chỉ hoạt động khi có banner unit hợp lệ; không dùng native ID làm banner. Quảng cáo thử nghiệm chỉ dành cho QA; không bấm quảng cáo để kiểm tra.
5. **Khoảnh khắc cùng bạn bè:** kiểm tra end-to-end với hai tài khoản thực: chụp ảnh/quay video, chọn người nhận, nhóm, gửi/nhận/thu hồi quyền, offline rồi sync, retry, widget, recap, lời nhắn chữ/giọng nói. Kiểm tra không lộ ảnh sau logout/chuyển tài khoản/thu hồi quyền. Hoàn thiện màu/spacing/nút của chi tiết ảnh và modal theo cùng theme với feed; không chỉ làm đẹp màn hình trống. Kiểm tra mở ảnh rồi quay lại không tái phát crash recorder.
6. **Các tính năng đang có:** kiểm tra ghi GPS nền/service và phục hồi sau process death, timeline ngày/tháng dài, ảnh có GPS, scratch migration, tìm địa điểm, bạn bè/live presence, nhạc local/radio và chuyển nguồn Spotube, SOS theo thao tác người dùng. Chỉ sửa các lỗi có bằng chứng; không gửi tin/alert thật trong QA nếu chưa được người dùng chỉ định.
7. **UI/UX toàn ứng dụng:** rà soát màn hình nhỏ, ngang, tablet, chữ lớn, bàn phím, safe area, sáng/tối; nút độc lập cố định ngoài vùng cuộn, không che nội dung hoặc dock. Kiểm tra loading/empty/error/offline rõ ràng và nút có tác dụng thật. Giữ thiết kế hiện có; tránh viết lại toàn ứng dụng.
8. **Tính năng bổ sung:** ưu tiên hoàn thiện các công cụ đã thêm (chất lượng GPS, chẩn đoán quảng cáo, lọc Khoảnh khắc, retry/offline). Chỉ bổ sung tính năng nhỏ giúp sử dụng hoặc phát hành nếu có luồng hoàn chỉnh và dữ liệu thật; không mở rộng thành một hệ thống mới trước khi xử lý các lỗi P0.
9. **Xác minh và bàn giao:** chạy `npm run typecheck`, `npm test` và kiểm tra giao diện các luồng vừa sửa. Ghi rõ mã đã sửa, kiểm chứng thực tế, giới hạn còn lại. Cập nhật tài liệu và ảnh QA. Không coi kiểm thử mock là kết nối dịch vụ thật.

### Cấu trúc source và APK cần giữ

```text
mymap/
├── app.json                         # version, Android package/versionCode, Expo plugins
├── package.json / package-lock.json # version và dependencies
├── src/                            # UI, bản đồ, GPS, dữ liệu, dịch vụ
├── tests/                          # kiểm thử hồi quy
├── plugins/
│   ├── withMyMapAndroid.ts          # cấu hình native phải tồn tại sau prebuild
│   └── native/                     # Kotlin/Java/widget/flavor templates
├── android/
│   ├── gradlew.bat / gradle.properties
│   └── app/
│       ├── build.gradle            # google/amazon, versionCode, signing, build types
│       ├── src/main/               # manifest/native code/resources release
│       ├── src/debug/              # chỉ cấu hình phát triển, Metro 10.0.2.2
│       └── build/outputs/
│           ├── apk/google/release/app-google-release.apk
│           ├── apk/amazon/release/app-amazon-release.apk
│           └── bundle/googleRelease/app-google-release.aab
├── .signing/                       # riêng tư, không đưa vào ZIP/commit/prompt/log
│   ├── release.properties          # cấu hình khóa thực sự mà Gradle đang dùng
│   ├── mymap-release.p12
│   └── mymap-amazon-release.jks     # không tự đổi khóa ký giữa các bản cập nhật
├── .env                            # cấu hình dịch vụ; không in giá trị riêng tư
├── scripts/build-release.ps1        # build có ký, minify/shrink/compression, SHA-256
├── .local/                         # backup/log/emulator/APK test; không phát hành
└── dist/releases/
    ├── MyMap-1.0.1-android-release.apk
    ├── MyMap-1.0.1-android-release.apk.sha256
    ├── MyMap-1.0.1-amazon-release.apk
    └── MyMap-1.0.1-amazon-release.apk.sha256
```

`google` là flavor Android; `amazon` là flavor Amazon. Hai APK được script đóng gói riêng. Mặc định mỗi APK chứa cả `armeabi-v7a` và `arm64-v8a`; đây không phải các APK tách riêng theo ABI. `x86_64` chỉ dùng cho giả lập khi QA. Xác minh khóa ký thực tế trong Gradle trước khi kết luận APK nào dùng khóa nào; việc có một file khóa trong `.signing` không đồng nghĩa flavor đang sử dụng nó.

### Khi được yêu cầu đóng gói

Chỉ bắt đầu đóng gói sau khi sửa xong các lỗi còn lại và các kiểm tra phù hợp đã đạt. Yêu cầu hiện tại của người dùng là sửa map và chuẩn bị prompt; chưa cần tạo APK trong bước này.

Từ thư mục gốc dự án, lệnh build chính thức hiện có:

```powershell
npm run typecheck
npm test
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-release.ps1 -Channel both -Architectures "armeabi-v7a,arm64-v8a" -OutputDirectory "dist/releases"
```

Nếu chỉ cần Android, đổi `-Channel both` thành `-Channel android`; Amazon dùng `-Channel amazon`. Không truyền `-TestAds` cho bản phát hành. Script đặt `EXPO_PUBLIC_ENABLE_TEST_ADS=false`, dùng JDK 21, khóa ký hiện có, R8/resource shrink/bundle compression và tạo file SHA-256.

Kiểm tra APK bằng Android SDK `apksigner verify --verbose` và `Get-FileHash -Algorithm SHA256`; kiểm tra applicationId/versionName/versionCode/ABI và thử cài cập nhật giữ dữ liệu trên thiết bị QA. Không phát hành APK debug hoặc APK quảng cáo thử nghiệm. Nếu cần Google Play AAB, dùng task `:app:bundleGoogleRelease` với cùng env production, JDK/SDK và signing; kiểm tra quy trình AAB riêng vì script hiện chỉ xuất APK.

**Lịch sử build và cập nhật 08/10/2026:** ngày 05/10 Windows Device Guard chặn `node_modules/hermes-compiler/hermesc/win64-bin/hermesc.exe`, làm task `:app:createBundleGoogleReleaseJsAndAssets` lỗi exit 4551. Ngày 08/10 compiler nguyên bản đã chạy bình thường, 174 kiểm thử đạt và cả hai APK release 1.0.1 (32) đã đóng gói, xác minh chữ ký/checksum; xem `docs/RELEASE_1_0_1_PACKAGING_2026_10_08.md`. Không thay đổi chính sách bảo mật. Nếu lỗi chặn tái diễn, không tắt/bỏ qua chính sách hoặc đổi tên/copy compiler để lách chặn; dùng môi trường được phép chạy Hermes. Không coi debug là release.

Kết quả cuối phải gồm: danh sách lỗi đã sửa, bằng chứng kiểm thử, việc còn lại nếu có, đường dẫn APK/AAB và checksum khi thực sự build được. Không tuyên bố sẵn sàng phát hành chỉ vì build hoặc test đã qua.

## Kết thúc prompt
