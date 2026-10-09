# Checklist QA ba cửa hàng

Chạy trên iPhone thật, điện thoại Android có GMS và Fire tablet không cài GMS. Ghi model/OS, app version/build, source commit, file SHA-256 và signing certificate. Đánh dấu từng ô Đạt/Lỗi/Không áp dụng kèm lý do; ô trống nghĩa là chưa thử. Tất cả ô dưới đây đang trống.

Không gọi số khẩn cấp thật để thử. Kiểm tra màn hình dialer và hủy trước khi gọi; thử sự kiện SOS với tài khoản thử và người nhận đã đồng ý. Dùng mô phỏng cảm biến/test rig an toàn, không thả thiết bị hoặc tạo va chạm thật. Không ghi token, số điện thoại, tọa độ riêng tư hoặc nội dung chat vào báo cáo công khai.

| Kiểm tra / kết quả mong đợi | iPhone | Android | Fire |
|---|---|---|---|
| Cài bản mới: mở lạnh, không crash, đúng 1.0.4/build 38 | | | |
| Từ bản cũ build 36/37: nâng cấp tại chỗ cùng app ID/key; giữ SQLite, ảnh, hành trình, lựa chọn | | | |
| Tắt mạng khi mở: xem dữ liệu local và lỗi kết nối có thể xử lý | | | |
| Từ chối từng quyền: app vẫn mở; tính năng nói rõ quyền cần có | | | |
| Email/password: đăng nhập/đăng xuất/khôi phục mật khẩu | | | |
| Khách: dữ liệu local vẫn có; liên kết email giữ nguyên UID | | | |
| Apple -> liên kết email -> đăng nhập Android/Fire: cùng UID và cùng dữ liệu server | | | |
| Email đã thuộc tài khoản khác: báo xung đột, không trộn dữ liệu | | | |
| Google native: GMS hoạt động; Fire ẩn nút, không lỗi TurboModule | | | |
| Game Center: đăng nhập iOS; Android/Fire không quảng cáo tính năng này | | | |
| Magic link đã cấu hình: nhận email, cold/warm app link, đúng tài khoản | | | |
| Magic link trên máy khác: yêu cầu nhập đúng email; link hết hạn báo lỗi | | | |
| Phone OTP: reCAPTCHA/app verification và mã sai/hết hạn | | | |
| Bản đồ/tìm/route: provider lỗi có trạng thái rõ, không dùng vị trí demo | | | |
| GPS không GMS: Fire dùng LocationManager; không GPS thì có thông báo rõ | | | |
| Recorder: ghi 10–15 phút, khóa màn hình, kiểm timestamp/SQLite tăng đúng | | | |
| Dừng recorder: thông báo/tracking indicator dừng, không còn ghi điểm mới | | | |
| GPS bị tắt/quyền thu hồi: báo trạng thái, bật lại có thể khôi phục | | | |
| Reboot/update: recorder chỉ phục hồi nếu trước đó được bật và quyền còn đủ | | | |
| Tile Android / iOS shortcut: mở SOS/camera; tracking điều khiển recorder thật | | | |
| SOS offline: lưu queue; có mạng đồng bộ, không tạo bản ghi người khác | | | |
| Dialer: số cấu hình đúng; tablet không dialer báo lỗi nhưng vẫn lưu SOS | | | |
| Va chạm foreground mô phỏng: cảnh báo; hủy/tiếp tục có kiểm soát | | | |
| Safety nền Android: service/notification đúng; iOS hiển thị giới hạn foreground | | | |
| Không barometer/cảm biến: không hứa độ cao rơi hoặc tự tạo incident | | | |
| Geofence tới/rời: chỉ event đã bật; Fire foreground có accuracy/hysteresis | | | |
| Camera/video/micro: chỉ bật sau thao tác; đóng màn hình giải phóng phần cứng | | | |
| Moment: tạo, sửa, xóa, chia sẻ file/recap; đổi tài khoản không lộ cache cũ | | | |
| Friends widget: chỉ ảnh đã được chia sẻ; thu hồi/xóa/TTL xóa dữ liệu hiển thị | | | |
| Widget: cùng ý nghĩa dữ liệu, mở đúng Moment; logout xóa widget | | | |
| Live Activity/ongoing: bắt đầu, cập nhật, stop; không có instance mồ côi | | | |
| Chat offline/reconnect: gửi lại đúng owner, không mất/nhân đôi nội dung | | | |
| LiveKit: hai thiết bị gọi, từ chối quyền, ngắt mạng, reconnect, hangup | | | |
| APNs/FCM: active/background/closed, bấm thông báo mở đúng Call/Chat | | | |
| Đổi tài khoản: thông báo owner cũ không mở dữ liệu; token reassociate đúng | | | |
| Fire polling: khi mở nhận inbox trong chu kỳ; khi đóng không hứa ADM | | | |
| App lock: sinh trắc/device passcode, cancel, sai credential, resume từ nền | | | |
| Không passcode: không bật khóa giả; không khóa người dùng vĩnh viễn | | | |
| AdMob: real app/unit IDs đúng OS, consent, no-fill không vòng request vô hạn | | | |
| Fire: mở Settings/ads/privacy/login không require SDK Google đã bị loại | | | |
| GGUF: model đúng/hash đúng/64 bit/RAM đủ; model lỗi báo và không mất dữ liệu | | | |
| AI hệ thống không có: chọn GGUF; không báo Nano/Apple Intelligence đã hoạt động | | | |
| OCR/nhãn ảnh không GMS: bundled model hoạt động hoặc lỗi có thể xử lý | | | |
| Speech offline không provider/ngôn ngữ: nhập chữ được; không xin quyền ở boot | | | |
| TTS/music background: voice đã cài, audio focus, pause/resume, tắt service | | | |
| Bản đồ/route offline đã tải: không yêu cầu public tile server tải trái điều kiện | | | |
| Apple Watch: signing/cài app, route stale, haptic, SOS cần xác nhận điện thoại | | | |
| Wear: cùng package/certificate, paired + enabled, cảnh báo tới đồng hồ thật | | | |
| Wear SOS: điện thoại nhận notification; hủy không gọi, mất kết nối báo thất bại | | | |
| Auto/CarPlay nếu được cấp: route chọn từ phone, stop, không quảng cáo trên xe | | | |

Ghi kết quả vào báo cáo riêng có commit và ngày chạy. Ngoại lệ E1–E7 trong `THREE_STORE_IMPLEMENTATION.md` cần chủ dự án duyệt; không tự đánh dấu “Không áp dụng” cho một lỗi chưa điều tra. Chỉ phát hành khi bộ artifact cuối đã qua guard và các ca áp dụng đều đạt.
