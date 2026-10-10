# Ngoại lệ và giới hạn nền tảng

Đặc tả 10/10/2026 là quyết định hiện hành. Ngoại lệ dưới đây không thay thế blocker signing, provider credentials, backend hoặc QA. Không gọi foreground polling là push khi app đóng.

| ID | Phạm vi | Hành vi và lý do | Phương án chung / nghiệm thu |
|---|---|---|---|
| E1 | iOS CoreMotion nền | Motion dừng khi background. Đã đánh giá phiên recorder giữ background location: quyền này không cấp bảo đảm thực thi CoreMotion liên tục; không dùng audio/processing để giữ app sống. Chưa có chứng cứ iPhone cho giám sát rơi cao/5 phút nền. | UI nêu foreground-only; SOS và GPS recorder vẫn có. Đây là giới hạn trải nghiệm có chủ đích, không tuyên bố đạt giám sát nền như Android. |
| E2 | Fire geofence | Native đánh giá vùng khi recorder GPS opt-in đang chạy; khi recorder tắt chỉ watcher foreground. Không tự khởi động thêm service ngầm chỉ để geofence. Không dùng Expo geofencing qua GMS. | Bật ghi hành trình để có cảnh báo nền, cần provider vị trí thật. Event queue owner riêng, replay khi app mở có mạng, có thể retry ít nhất một lần. Cần Fire QA. |
| E3 | Ads Fire | Tắt GMA/APS mặc định, cả facade và native APS entry point. Chưa có provider quảng cáo độc lập GMS được thiết kế/nghiệm thu. | Không quảng cáo trên Fire. IDs Android đã cung cấp chỉ dùng bản Google; IDs iOS dùng iOS. |
| E4 | Surface riêng OS | Game Center/Apple sign-in/Watch trên Apple; Nano/Android Auto/Wear trên Google; Fire không companion/Auto. Tile/widget phụ thuộc launcher; Control Center tùy OS chưa triển khai. | Email/guest, liên kết cùng UID, SOS/ghi hành trình trong app. iOS AppIntent mở app để người dùng xác nhận; không tự gửi SOS. |
| E5 | AI/cảm biến/speech/TTS | GGUF yêu cầu tiến trình 64 bit, RAM/model hợp lệ; accelerometer/barometer/dialer/recognizer/voice có thể thiếu. System AI chỉ tối ưu khi provider available. | Hiện lý do và lựa chọn nhập chữ/provider đã chọn; không tự đổi AI khi lỗi, không mô phỏng cảm biến hoặc gọi tel trên tablet thiếu dialer. |
| E6 | Spotube | Loopback WebSocket là chức năng thật. Android/Fire cần cài Spotube; iOS không có native launcher Android. | Nhạc hệ thống/app vẫn dùng; giữ loopback trong bundle và phân loại riêng khỏi Metro. |
| E7 | iOS visits/significant changes | Không nối callback khi chưa có use case rõ; không xin thêm quyền/scheduling để tạo cảm giác parity. | Dùng recorder hành trình opt-in. Không tính API có sẵn là chức năng đã chạy. |
| E8 | App lock | Dùng PIN/passcode của hệ điều hành qua device credential; không lưu PIN riêng trong JS/SQLite. Chỉ cho bật sau capability check và xác thực. | Máy không có sinh trắc vẫn dùng khóa màn hình nếu OS hỗ trợ. Native module lỗi không tự mở khóa. Kiểm tình huống thay đổi credential trong checklist. |

CarPlay/push production/phone OTP Fire/magic-link Hosting chưa sẵn sàng là **BLOCKED hoặc DONE-UNVERIFIED**, không được che thành ngoại lệ. CallKit/PushKit và full-screen intent mặc định không có; đặc tả cho phép tùy chọn, chưa thêm quyền/entitlement. User force-stop, OS battery restrictions và thiếu GPS/network có thể ngăn delivery/recorder; phải kiểm trên thiết bị, không hứa background vô hạn.
