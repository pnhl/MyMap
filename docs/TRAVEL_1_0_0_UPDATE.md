# MyMap 1.0.0 · Android và FireOS

## Thay đổi đã triển khai

- Giữ giao diện bản đồ toàn màn hình, dock tròn, bạn bè và các tính năng MyMap hiện có. Không còn logo góc trái của các trang.
- Khi nằm ngang, tìm kiếm/dock ở trái, công cụ ở phải; nút hiển thị 36 dp với vùng chạm ít nhất 44 dp. Thời tiết, hành trình, camera, ghim, SOS, lớp bản đồ và âm nhạc vẫn truy cập được. HUD dẫn đường gọn ở hai bên.
- Cài đặt có tùy chọn tránh phà/cao tốc/đường chưa trải nhựa, ngưỡng tốc độ riêng, âm thanh và rung. Tùy chọn lưu trên thiết bị; dữ liệu thiếu không được biến thành giới hạn tốc độ giả. Dấu `mph` được đổi đúng sang km/h; giới hạn có điều kiện chưa đánh giá được sẽ hiện chưa xác định. Ước tính quốc gia hiện chỉ triển khai cho Việt Nam và được ghi rõ là ước tính.
- Tuyến đường chỉ dùng nhà cung cấp có thể áp dụng các yêu cầu tránh đường. Không dùng lại tuyến OSRM không có ràng buộc hoặc cache của cấu hình khác. Gateway phải trả `preferencesApplied: true`. Valhalla phải bật `allow_hard_exclusions`; khi máy chủ cảnh báo bỏ qua ràng buộc, tuyến bị từ chối. Tránh đường chưa trải nhựa cho xe máy cần gateway hỗ trợ; không âm thầm bỏ qua tùy chọn. [Valhalla API](https://valhalla.github.io/valhalla/api/route/api-reference/).
- Giữ thời tiết tại điểm 5 km tiếp theo trên tuyến, điểm đến và vị trí/khoảng cách lối rẽ. Tốc độ không có GPS tin cậy hoặc không cập nhật sau 10 giây sẽ hiện `—`.
- Android có Car App Service, NavigationTemplate, bản đồ OpenFreeMap bằng MapLibre trên Surface của xe và hướng dẫn lối rẽ. Điểm đến chọn trên điện thoại; màn hình xe có GPS native và nút kết thúc dẫn đường từ host. FireOS không đóng gói Android Auto. Chưa kiểm tra trên đầu xe/DHU, chưa được Google duyệt chất lượng ứng dụng xe. [Android Auto navigation](https://developer.android.com/training/cars/apps/navigation).
- FireOS dùng foreground service `LocationManager`/SQLite riêng để ghi GPS, không phụ thuộc Play Services hoặc vòng đời JavaScript. Điểm được commit vào hàng đợi trước khi ghi SQLite; lỗi ghi giữ điểm và thử lại. Bản Android giữ cơ chế Expo foreground/background đã sửa lỗi mất quãng đường. Cả hai khôi phục theo ý định ghi được lưu; dừng thủ công luôn tắt ghi. Force-stop của hệ điều hành vẫn chặn chạy nền cho tới khi mở lại ứng dụng.
- SOS mở `ACTION_DIAL` với số đã cấu hình trước khi lấy GPS/gửi sự kiện; thêm gợi ý hiển thị bàn phím số cho trình gọi tương thích. Số mặc định 112, có thể thay trong Cài đặt. Không yêu cầu quyền CALL_PHONE và không tự thực hiện cuộc gọi trong các kiểm thử.
- Cảm biến an toàn chỉ bật khi người dùng chủ động bật và cho phép thông báo. Theo dõi gia tốc, xoay và thay đổi áp suất trong foreground service; rơi trên 20 m phải đồng thời có bằng chứng khí áp, rơi tự do và va chạm. Không có khí áp kế thì không kết luận độ cao. Cảnh báo không phải chứng nhận phát hiện tai nạn.
- Sau 5 phút không mở khóa/tương tác trong MyMap ở sự kiện rơi cao, ứng dụng đang mở sẽ tự mở trình gọi; khi ở nền sẽ hiện thông báo có nút mở số. Không thể suy ra mọi thao tác trong ứng dụng khác trên điện thoại đang mở khóa. Android không cho ứng dụng thông thường tự gọi số khẩn cấp bằng ACTION_CALL; người dùng vẫn cần ấn Gọi. [Android Intent](https://developer.android.com/reference/android/content/Intent).
- Điều khoản, quyền riêng tư đầy đủ và giới thiệu chi tiết luôn có trong Cài đặt; trang tài khoản có tóm tắt tối đa ba dòng và liên kết đọc đầy đủ, đăng ký email có xác nhận chấp thuận.
- AdMob native và các vị trí quảng cáo cũ được giữ, chỉ yêu cầu quảng cáo sau bước UMP consent; không đặt quảng cáo lên bản đồ lái xe, màn hình Android Auto hoặc luồng SOS. APS App ID vẫn là cấu hình riêng, không dùng Amazon Appstore ID làm APS ID.
- Spotify dùng Client ID người dùng cung cấp, PKCE và token SecureStore; tìm bài hát trong MyMap, nghe bằng trình phát Spotify chính thức. Xem `spotify-hosting/README.md` để đưa callback lên hosting.
- Có đủ 21 lựa chọn ngôn ngữ trong ảnh, gồm Cornish và Kazakh. 60 nhãn điều khiển chung/an toàn/tài khoản/âm nhạc đã có 20 bản dịch ngoài tiếng Việt; 19 ngôn ngữ có thêm 1.379 chuỗi nội dung tĩnh và chuỗi có biến, gồm chính sách/cài đặt/tài khoản. Catalog chỉ được nạp khi chọn ngôn ngữ để giảm bộ nhớ trên FireOS. Chuỗi có biến giữ dữ liệu người dùng nguyên vẹn khi thay nội dung chữ. Bản dịch mở rộng do máy dịch tạo từ nội dung ứng dụng, không gửi dữ liệu/tài khoản người dùng; cần kiểm duyệt chất lượng ngôn ngữ trước khi công bố. Cornish mới có 60 nhãn chính và dùng tiếng Anh dự phòng cho nội dung dài. Một số chuỗi do nhà cung cấp trả về vẫn có thể chưa dịch. Lựa chọn được lưu và hỗ trợ chữ RTL/CJK.
- Bản đồ mặc định OpenFreeMap, mã nguồn MIT, có thể dùng thương mại miễn phí; giữ ghi công dữ liệu OSM. Giấy phép và điều kiện tải ngoại tuyến ở `MAP_PROVIDER_LICENSES.md`.

## SDK và build

Amazon Appstore ID: `amzn1.devportal.mobileapp.5da38626eb454bfcb8403c32d2a1e1c5`.
SDK Appstore Maven `com.amazon.device:amazon-appstore-sdk:3.0.9`; Android Auto chỉ thuộc flavor `google`. Đây là Appstore SDK, khác Amazon Publisher Services. Đã thêm keep rules để R8 giữ lớp Appstore SDK.

DRM chưa bật và chưa có `AppstoreAuthenticationKey.pem` do Amazon Developer Console cấp. App ID không thể thay khóa này. Nếu chọn tích hợp DRM, cần lấy khóa công khai đúng ứng dụng và bổ sung luồng licensing; chưa kiểm tra lại cảnh báo bằng một lần upload Amazon Console. [Amazon SDK](https://developer.amazon.com/docs/appstore-sdk/integrate-appstore-sdk.html).

Hai APK cùng package `com.pnhl.vibecoding`, versionName `1.0.0`, versionCode `24` để nâng cấp bản 23. Mỗi APK hỗ trợ ARMv7/ARM64, release signing của dự án, Hermes, R8, resource shrinking, nén thư viện native. Không phải hai ứng dụng cài song song. Native source/flavors/manifest được giữ trong plugin prebuild; script build vá tương thích AGP 9 cho Firebase/AdMob sau khi cài dependency.

Build: `./scripts/build-release.ps1 -Channel both`. APK kiểm thử x86_64 chỉ dùng trong emulator, không phải APK ARM giao cho người dùng.

## Kiểm tra và giới hạn

TypeScript và 92 kiểm thử: dữ liệu hành trình, replay hơn 40 km, hàng đợi/retry, quyền bắt buộc của tác vụ GPS nền, định tuyến có ràng buộc, biển báo quốc tế/mph, ngưỡng thấp hơn, PKCE/state sai và 21 catalog ngôn ngữ.

Đã sửa crash trên Vivo Y22s Android 14: APK thiếu quyền `RECEIVE_BOOT_COMPLETED` cần cho tác vụ vị trí Expo được lưu qua khởi động. Cài bản ký mới đè lên ứng dụng hiện có, quyền đã được hệ thống cấp, ba lần khởi động lạnh đều sống và không có crash mới trong log sau thay thế. Foreground service ghi GPS được khôi phục. Xem `ANDROID_STARTUP_CRASH_FIX.md`.

Emulator riêng: bản đồ dọc/ngang, đổi ngôn ngữ English, bật Safety foreground service, SOS mở trình gọi mặc định với 112, native FireOS GPS mock khi tắt màn hình. 6 điểm GPS bổ sung trong lần kiểm tra nền, hàng đợi rỗng và không còn lỗi SQLite. Điểm cuối của profile 5 giây có thể chờ lần lấy tiếp theo; không suy ra độ tin cậy chuyến 40 km thực tế từ bài kiểm tra ngắn này.

APK ARM cuối cùng: đã kiểm tra thêm nội dung cài đặt English, chữ Arabic/RTL, nút mở số trong màn hình SOS chuyển tới trình gọi mặc định với 112 và nút Call. Không ấn Call. Bản Amazon ARM mở được trên emulator; điều này chưa thay thế kiểm tra phần cứng Fire thật. Cả hai APK khoảng 42,67 MiB và đã xác minh chữ ký.

Chưa có thiết bị Fire/đầu xe thật, cảm biến rơi/va chạm thật hoặc tài khoản Spotify đã hoàn tất callback. Không thể cam kết giới hạn tốc độ đúng mọi luật trên toàn thế giới khi OSM thiếu/không cập nhật biển báo. Nguồn dữ liệu và biển báo thực tế quyết định kết quả. Emulator MapLibre native hiện có lỗi nhãn chữ đã ghi nhận từ lần kiểm tra trước; cần kiểm tra thêm trên thiết bị thật.
