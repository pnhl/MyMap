# Sửa ghi hành trình — 04/10/2026

## Các lỗi đã xác nhận trong mã

- Bộ lọc GPS so sánh đợt vị trí đến trễ với một điểm mới hơn và ép khoảng thời gian âm thành 1 giây. Các điểm hợp lệ bị coi là nhảy GPS. Kiểm thử tuyến 44,48 km với 401 điểm trước sửa chỉ lưu 101 điểm cuối, khoảng 11,12 km; sau sửa lưu đủ 401 điểm.
- Chế độ cân bằng yêu cầu vị trí mỗi 60 giây / 40 m, rồi giữ dữ liệu nền cho tới khi đủ cả 120 giây và 100 m. Dữ liệu chưa chuyển sang SQLite có thể mất khi tiến trình ngắt.
- Trạng thái người dùng bật ghi không được lưu riêng; ứng dụng không khôi phục dịch vụ đã ngắt khi mở lại. Lỗi khởi động dịch vụ bị chuyển âm thầm sang ghi trong ứng dụng.
- Bộ lọc vị trí đứng yên có độ chính xác vừa phải bỏ điểm trước khi tới nhánh heartbeat.
- Trang Hành trình chỉ liệt kê điểm dừng tối thiểu 5 phút, khiến một chuyến đi liên tục trông như chưa được lưu.

## Thay đổi

- Cân bằng: yêu cầu GPS mỗi 5 giây / 5 m. Chính xác cao: 2 giây / 3 m. Tiết kiệm pin: 30 giây / 25 m. Đây là yêu cầu gửi cho hệ điều hành, không phải bảo đảm thiết bị luôn trả vị trí đúng nhịp.
- Không giữ đợt GPS để chờ thêm khoảng cách/thời gian; không tự dừng GPS khi đứng yên.
- Sắp xếp các đợt GPS, xử lý vị trí đến trễ theo thứ tự thời gian riêng, dùng chung một hàng đợi ghi cho nền và trong ứng dụng.
- Lưu tạm đợt GPS trước khi ghi SQLite, thử lại lỗi ghi tạm thời và khôi phục các điểm chưa ghi sau khi tiến trình khởi động lại.
- Lưu lựa chọn bật/tắt; chỉ khôi phục một hành trình người dùng đã bật, không hỏi lại quyền trong bước khôi phục. Đã bấm dừng thì không tự bật lại.
- Khởi động dịch vụ trước khi chờ điểm GPS đầu; chờ tối đa 4 giây cho thao tác bắt đầu. Không chèn tọa độ cũ từ chuyến trước.
- Lỗi dịch vụ được báo rõ. Quyền vị trí gần đúng được yêu cầu đổi sang vị trí chính xác. Khi không có quyền nền, giao diện ghi rõ chỉ ghi khi mở ứng dụng.
- Trang Hành trình hiển thị bản đồ đường đi, số điểm và khoảng thời gian đã lưu kể cả khi chưa có điểm dừng; báo khoảng trống GPS trên 3 phút.

## Kiểm tra

- `npm run typecheck`: đạt.
- `npm test`: 80/80 đạt, gồm 14 kiểm thử chạy mã ghi hành trình và SQLite thực. 10 kiểm thử đầu đã thất bại trên mã trước sửa.
- Android release x86_64: build đạt, cài trên máy giả lập Android API 35 riêng để kiểm tra.
- Chạy nền + tắt màn hình: gửi 6 vị trí di chuyển sau điểm đầu trong 36 giây; trang Hành trình đọc lại 7 điểm, khoảng 0,4 km. Dịch vụ vị trí vẫn ở trạng thái foreground service.
- Dừng tiến trình bằng Android rồi mở lại: dịch vụ tự khởi động lại; 7 điểm cũ vẫn còn. Gửi thêm điểm mới: 8 điểm, khoảng 0,6 km.
- Build APK release đầy đủ đạt; đã kiểm tra chứa `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`.

Ảnh kiểm tra: [ghi nền](journey-validation/timeline-background.png), [khôi phục](journey-validation/timeline-recovery.png).

APK: `dist/releases/MyMap-1.0.0-release.apk`, SHA-256 trong tệp `.apk.sha256` cạnh APK. Cài cập nhật lên bản cũ để giữ dữ liệu.

## Giới hạn kiểm chứng

Chưa có hãng/model và log của điện thoại người dùng, nên chưa thể kết luận riêng trường hợp thực tế 40 km chỉ ghi 10 km là do đúng một lỗi nào. Kiểm thử đã xác nhận và sửa các lỗi mã có thể gây hiện tượng này; cần thử một chuyến đi trên điện thoại thực để kiểm chứng thêm hạn chế chạy nền của thiết bị.

MyMap chỉ có thể lưu các vị trí hệ điều hành trả về. GPS mất tín hiệu, thiết bị tắt, ứng dụng bị Android buộc dừng hoặc quyền bị thu hồi vẫn có thể tạo khoảng trống. Sau khi bị buộc dừng, cần mở lại ứng dụng để khôi phục. Các tọa độ chưa từng được nhận/lưu trước đây không thể dựng lại chính xác.
