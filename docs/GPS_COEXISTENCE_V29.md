# GPS dùng cùng ứng dụng khác — MyMap 1.0.0, build 29

## Phạm vi và bằng chứng

Người dùng báo công tắc định vị và Độ chính xác của Google trên Vivo đều bật nhưng nhiều ứng dụng cùng yêu cầu bật định vị. Chưa có kết nối ADB tới Vivo nên chưa xác định được nguyên nhân chung của hệ thống. Trong mã MyMap không tìm thấy thao tác thay đổi LOCATION_MODE, tắt dịch vụ định vị hoặc tạo nhà cung cấp vị trí giả.

Người dùng xác nhận buộc dừng MyMap giúp ứng dụng khác định vị trở lại. Đây là bằng chứng lỗi có liên quan đến MyMap đang chạy; chưa đủ để xác định API/driver nào trên Vivo gây ra biểu hiện này. Các thay đổi dưới đây xử lý vòng đời và yêu cầu GPS tồn đọng đã xác minh được trong ứng dụng.

Hai lỗi độc lập tìm thấy trong MyMap:

- Các khách hàng dùng PlatformLocation gọi start/stop trực tiếp trên một nguồn native. Đóng một khách hàng sẽ dừng nguồn của khách hàng còn lại.
- Các yêu cầu hiện tại dùng mặc định mayShowUserSettingsDialog của Expo; việc không nhận được vị trí có thể kéo theo yêu cầu cài đặt của Google dù GPS hệ thống còn hoạt động. Một số Promise.race chỉ dừng đợi kết quả, không gỡ yêu cầu GPS.

## Sửa

- Nguồn GPS giao diện có danh sách khách hàng và hàng đợi cấu hình. Mỗi khách hàng chỉ gỡ đăng ký của mình. Điều khiển native chỉ dừng khi khách hàng cuối rời đi hoặc ứng dụng chuyển nền.
- MyMap không tự bật/tắt hay yêu cầu thay đổi cài đặt định vị toàn thiết bị khi lấy tọa độ. Hộp thoại cấp quyền cho riêng ứng dụng vẫn hoạt động bình thường.
- Khi GPS có nhưng nguồn mạng của Google không có, hoặc đăng ký nguồn Google thất bại, dùng LocationManager của Android. Quyền vị trí và trạng thái dịch vụ vẫn được kiểm tra.
- Mỗi lần lấy vị trí có thời gian chờ và gỡ đăng ký lúc hoàn tất/hết thời gian. SOS dùng đăng ký liên tục có thể gỡ thay vì lặp các yêu cầu GPS bỏ dở.
- Tạm dừng nguồn giao diện khi MyMap chạy nền; chỉ đường cũng gỡ đăng ký khi rời màn hình bản đồ. Ghi hành trình đã được cho phép vẫn chạy qua foreground service riêng.
- Ghi hành trình có nguồn native dự phòng khi nguồn Google không khởi động được. Không hạ ghi nền thành watcher chỉ chạy khi màn hình mở.
- Hỏng một nhà cung cấp native trong lúc đăng ký sẽ dọn listener đã tạo. Tắt nguồn mạng không còn bị báo là tắt toàn bộ GPS khi nguồn GPS vẫn bật.
- Đồng bộ nguồn Kotlin trong plugins/native và android/app/src/main/java. Giữ bố cục chỉ đường build 28, chứng chỉ ký, package và ID AdMob hiện có.

## Kiểm tra

- TypeScript đạt; 114 kiểm thử đạt, gồm 9 tình huống quản lý GPS/nguồn dự phòng mới.
- Các bài kiểm thử hành trình hiện có tiếp tục kiểm tra quyền, ghi nền, hồi phục và lưu tuyến đường 40 km.
- Kiểm tra native trên máy giả lập được ghi riêng trong phần bên dưới. Không suy ra thiết bị Vivo đã hết lỗi hoặc mọi ứng dụng bên thứ ba đã được sửa từ kết quả giả lập.

### APK và kiểm tra native

- Hai APK release ký hợp lệ, package `com.pnhl.vibecoding`, versionName `1.0.0`, versionCode `29`, ARMv7/ARM64. Kích thước/hàm băm trong `dist/releases/gps-coexistence-v29/verification.json`.
- Cài đè APK Android cuối trên giả lập API 35; mở ứng dụng và chọn chỉ đường thành công. Không thấy FATAL EXCEPTION/TypeError/ReferenceError trong đoạn log kiểm tra.
- Cài ứng dụng QA độc lập `com.mymap.qa.gpsprobe` chỉ trên giả lập do phiên làm việc này tạo. Ứng dụng QA có foreground service nhận GPS mỗi giây, không có API khóa/tài khoản/dữ liệu người dùng.
- Tắt nguồn mạng giả lập bằng test provider, giữ GPS/công tắc định vị bật. Khi MyMap chỉ đường ở phía trước, dumpsys ghi nhận cả MyMap (1,2 giây/2 m) và ứng dụng QA (1 giây) đăng ký GPS, cả hai được giao tọa độ.
- Chuyển sang ứng dụng QA: đăng ký GPS giao diện của MyMap biến mất khỏi danh sách listener; ứng dụng QA tiếp tục nhận tọa độ mới và `cmd location is-location-enabled` vẫn trả `true`.
- Trở về MyMap, bật ghi hành trình: PlatformTrackingService hoạt động với `isForeground=true`, loại service location. Chuyển MyMap xuống nền, cả service ghi hành trình (5 giây/5 m) và ứng dụng QA tiếp tục nhận GPS. Log hệ thống có giao vị trí tới MyMap trong lúc chạy nền.
- Dừng ghi hành trình thành công, công tắc định vị vẫn bật. Không gọi SOS, gửi chia sẻ/tin nhắn hay bấm quảng cáo.

Trạng thái: hoàn tất sửa và kiểm chứng các vấn đề quản lý GPS đã tìm thấy; cần cài build 29 trên Vivo để xác nhận biểu hiện nhiều ứng dụng cùng yêu cầu bật định vị đã hết. Không có log Vivo để khẳng định nguyên nhân ở driver/dịch vụ hệ thống.

Tài liệu tham khảo: [Quản lý yêu cầu vị trí Android](https://developer.android.com/develop/sensors-and-location/location/request-updates), [Độ chính xác của Google](https://support.google.com/android/answer/15157297), [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/).
