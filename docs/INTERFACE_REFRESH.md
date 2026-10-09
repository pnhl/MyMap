# Giao diện MyMap — 04/10/2026

Giao diện dùng nền tối phẳng, màu nhấn xanh dịu và chữ Nunito Sans hiện có. Các trang nội dung dùng nền riêng, không còn bản đồ phía sau chữ. Logo được bỏ khỏi tiêu đề các trang; biểu tượng ứng dụng và màn hình khởi động vẫn giữ nhận diện MyMap.

- Tiêu đề trang thay cho logo. Thanh điều hướng luôn hiển thị tên cả năm mục; Timeline đổi thành Hành trình.
- Bản đồ ưu tiên ghi hành trình và lưu kỷ niệm trước thống kê. Công cụ phụ và lớp bản đồ mở thành bảng phía dưới có nhãn, nút đóng và vùng cuộn. Các lựa chọn bộ dựng bản đồ nằm trong Tùy chọn nâng cao.
- Hành trình có thống kê hai cột trên điện thoại, ngày/tháng và hướng dẫn khi chưa có điểm dừng.
- Bạn bè có bốn cách tìm với nhãn rõ, ô tìm ngay dưới lựa chọn, kết quả sau khi tìm và mã QR chia sẻ.
- Cá nhân có một mục Cài đặt và biểu tượng bánh răng ở tiêu đề. Quyền riêng tư, xuất dữ liệu, ngôn ngữ và thiết bị đều nằm trong Cài đặt. Các chức năng xuất dữ liệu, quyền vị trí và chia sẻ vị trí vẫn dùng dịch vụ hiện có.

## Kiểm tra

- `npm run typecheck`: đạt. Hai lỗi TypeScript có sẵn ở nút gửi lời rủ và kiểu chữ khoảng cách dẫn đường cũng đã được sửa.
- `npm test`: 68/68 đạt. Hai kiểm tra giao diện cũ được cập nhật cho tiêu đề không logo và công cụ mở bằng bảng phía dưới.
- Đóng gói JavaScript Android và dựng debug/release cho x86_64: đạt.
- Giao diện thực tế được kiểm tra trên máy giả lập Android API 35, 1080 × 2400, mật độ 420 dpi. Các màn Bản đồ, Hành trình, Bạn bè, Cá nhân và Cài đặt hiển thị được; lối vào Cài đặt từ Cá nhân hoạt động.
- Bảng lớp bản đồ mở/đóng được; Tùy chọn nâng cao mở và cuộn tới đủ năm bộ dựng bản đồ. Đã kiểm tra thêm ở 320 × 640 dp với cỡ chữ 1.3.
- Phiên kiểm tra dùng dữ liệu máy giả lập riêng và không đăng nhập tài khoản. Chưa kiểm tra trực tiếp trên iOS. APK x86_64 dùng cho máy giả lập, không phải bản phát hành cho điện thoại ARM.

Ảnh chụp thực tế: [Bản đồ](interface-refresh/home.png), [Hành trình](interface-refresh/timeline.png), [Bạn bè](interface-refresh/friends.png), [Cài đặt](interface-refresh/settings.png), [Lớp bản đồ](interface-refresh/layers.png).
