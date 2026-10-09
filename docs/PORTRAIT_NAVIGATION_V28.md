# Chỉ đường dọc — MyMap 1.0.0, versionCode 28

## Bố cục

- Gom điểm đến, phương tiện, khoảng cách đến lối rẽ và hướng rẽ tiếp theo vào một thẻ phía trên.
- Dự báo 5 km tiếp theo luôn hiển thị trong hàng nhỏ; nút phát/tạm dừng radio và SOS nằm cạnh hàng này.
- Gom thời gian dự kiến, giờ đến, quãng đường còn lại, chia sẻ, kết thúc, tốc độ GPS và giới hạn tốc độ vào một thẻ phía dưới. Dùng thông tin tuyến đường bộ hiện tại cho ETA/quãng đường và nội dung chia sẻ khi có dữ liệu tuyến.
- Loại bỏ thẻ Live Trip riêng trong lúc chỉ đường dọc để tránh lặp điểm đến và hiển thị hai số liệu khác nhau.
- Mở rộng thông tin để đọc đầy đủ hướng rẽ, tuyến đường, nguồn giới hạn tốc độ, thời tiết tại đích/5 km phía trước và điều khiển radio. Nội dung dài cuộn trong phần trống giữa hai thẻ.
- Đo chiều cao thẻ thực tế để đặt nút cạnh bản đồ và vùng camera. Khi màn hình thấp hoặc chữ lớn làm thiếu chỗ, ba nút cạnh bản đồ chuyển thành một hàng. SOS luôn ở hàng trên.
- Thẻ dưới nằm phía trên toàn bộ thanh điều hướng và vùng an toàn; không đặt tốc độ dưới các tab.
- Giới hạn tốc độ chưa xác định dùng dấu —; giá trị ước tính dùng viền xám và ghi rõ nguồn. Cảnh báo âm thanh/rung vẫn dùng logic hiện tại.
- Thanh trạng thái dùng chữ tối khi bản đồ OpenFreeMap Liberty 3D có nền sáng.

Các thay đổi tập trung ở `PortraitNavigationHud.tsx`, `NavigationHud.tsx` và phần bố trí HUD/camera trong `MapScreen.tsx`. Bố cục HUD ngang hiện có được giữ. Các ID AdMob mới của versionCode 27 được giữ trong cả hai bản phát hành.

## Kiểm tra

- TypeScript: đạt.
- 105 kiểm thử hiện có: đạt.
- Cả hai APK release dùng cùng chứng chỉ ký của ứng dụng, package `com.pnhl.vibecoding`, versionName 1.0.0, versionCode 28, ARMv7/ARM64.
- Kiểm tra giao diện thực tế được thực hiện trên máy giả lập Android; ảnh trong `navigation-portrait-validation` ghi lại màn hình thử, không phải mockup thiết kế.
- APK Android cuối được cài và kiểm tra ở 360 × 800 dp/chữ 100% và 320 × 640 dp/chữ 130%. Dùng điểm đến có tên dài và hướng rẽ dài để kiểm tra việc rút gọn nội dung. Các nút SOS/kết thúc không bị che; ba nút bản đồ chuyển sang hàng ngang ở màn hình nhỏ.
- Mở/thu gọn thông tin hành trình hoạt động; phần chi tiết có vùng cuộn giới hạn. Nút kết thúc đưa về bản đồ thường. Sau các thao tác kiểm tra, ứng dụng vẫn chạy và đoạn log khởi động/điều hướng được kiểm tra không có FATAL EXCEPTION.
- Không bấm SOS, không gửi tin nhắn/chia sẻ ra ngoài, không bấm quảng cáo trong kiểm tra.

Không suy ra kiểm chứng chuyến đi thực tế hoặc cảm biến trên Vivo/FireOS từ kiểm tra giao diện trên máy giả lập.
