# MyMap 1.0.0 — mã phiên bản 25

## Các sửa đã đóng gói

- Hành trình: bỏ cách lấy thưa xuống tối đa 100 điểm; xử lý toàn bộ GPS bằng các nhóm tối đa 100 điểm có điểm biên chung. Khóa cache chứa đầy đủ nhóm tọa độ, thời gian, độ chính xác. Giữ tất cả kết quả khớp đường; hiển thị các đoạn riêng biệt trên MapLibre Native, Leaflet, MapLibre GL JS, OpenLayers và Cesium. Khoảng mất dữ liệu trên 3 phút hoặc dịch chuyển bất khả thi được tách ra, thay vì nối một đường thẳng. Khi mất mạng, giữ các điểm GPS đã ghi. Không thể khôi phục chính xác đoạn đường không có dữ liệu GPS.
- SOS: tự xin quyền/lấy vị trí và theo dõi cập nhật khi mở màn hình. Hủy theo dõi khi rời màn hình, kể cả khi thao tác cấp quyền/khởi tạo chưa hoàn tất. Chỉ dùng dữ liệu dự phòng trong 2 phút và sai số tối đa 150 m. Địa chỉ được cập nhật khi dịch chuyển, tọa độ không chờ tra địa chỉ. FireOS lấy vị trí qua LocationManager của module nền tảng. Không chặn nút SOS trong lúc chờ GPS; giữ nút thử lại khi cần.
- Dẫn đường: thay URL trang web bằng API `https://valhalla1.openstreetmap.de`; thử trực tiếp API có trả tuyến/hướng dẫn tiếng Việt. Sửa chỉ số tọa độ thao tác theo từng chặng và bảng loại thao tác rẽ/vòng xuyến/quay đầu. Điểm xuất phát dùng tọa độ GPS thật thay vì làm tròn khoảng 100 m; giới hạn cập nhật điểm xuất phát để tránh hủy yêu cầu liên tục khi đang chạy. Xóa hướng dẫn cũ khi đổi tuyến hoặc lỗi. Các yêu cầu tránh đường vẫn không được tự động bỏ qua; xe máy dùng motor_scooter và thừa hưởng tùy chọn auto.
- OpenFreeMap 3D: thêm **Lớp bản đồ → OpenFreeMap · Thành phố 3D**, dùng Liberty với lớp fill-extrusion của OpenFreeMap, camera nghiêng 55° và zoom 16. Giữ góc nghiêng khi đưa camera về người dùng/fit tuyến. Chiều cao tòa nhà phụ thuộc dữ liệu nguồn, không phải mô hình ảnh 3D chụp thực tế.
- Quảng cáo: sửa promise tải quảng cáo native không trả lỗi SDK; chỉ tải cho trang đang mở, thử lại có khoảng nghỉ, giữ AdChoices/nhãn tài trợ và các asset bắt buộc. Tệp chính sách công khai được xuất từ nội dung hiện có trong ứng dụng. Xem `ADMOB_CONFIGURATION_FIX.md` cho phần cấu hình tài khoản còn cần chủ ứng dụng thực hiện.
- Spotify: giữ nguyên theo yêu cầu bỏ qua lỗi của chủ ứng dụng sau khi họ đưa callback lên hosting. Chưa kiểm tra lại OAuth thực tế.

## Kiểm tra

- TypeScript: thành công; toàn bộ 101 kiểm thử thành công. Các kiểm thử mới kiểm tra đủ 220 điểm, cache khi đổi đuôi tuyến, nhiều kết quả khớp đường, khoảng mất GPS, dự phòng ngoại tuyến, API host và chỉ số chặng, loại thao tác Valhalla, SOS tự cập nhật/hủy theo dõi/quyền bị từ chối và bản vá cầu nối quảng cáo.
- Android emulator: mở được ứng dụng; SOS tự nhận tọa độ và địa chỉ tại điểm GPS giả lập mà không bấm cập nhật. OpenFreeMap đã hiện tòa nhà 3D. Tìm Landmark 81, nhận tuyến xe máy khoảng 5,4 km / 17 phút, hướng dẫn rẽ, dự báo trước 5 km. Đây là dữ liệu thử, không phải hành trình người dùng.
- Quảng cáo Native nội dung mẫu của Google đã hiển thị, đủ nhãn tài trợ, headline/body/CTA/media/AdChoices. Không nhấn quảng cáo. Bản phát hành dùng ID Native thật, giữ UMP; chủ ứng dụng xác nhận chưa xuất bản biểu mẫu. Chưa xác nhận quảng cáo thật được cấp sau khi cấu hình.
- Cả hai APK Android và Amazon: Gradle release thành công, ký cùng chứng chỉ hiện có, ARM64/ARMv7, versionName 1.0.0/versionCode 25; giữ RECEIVE_BOOT_COMPLETED để tránh tái xuất hiện crash đã sửa.
- Ở lượt tiếp tục, ADB không còn thấy Vivo. Chủ ứng dụng chọn nhận APK để tự cài; chưa kiểm tra versionCode 25 trên Vivo. Bản trước versionCode 24 đã được kiểm tra riêng cho lỗi khởi động, không dùng kết quả đó để khẳng định mọi tính năng mới của versionCode 25.
- Chưa kiểm tra chuyến đi thực tế 40 km, thiết bị FireOS thật, Android Auto trên xe hoặc Spotify OAuth thực tế.

## Tệp giao

- `dist/releases/MyMap-1.0.0-android-release.apk`
- `dist/releases/MyMap-1.0.0-amazon-release.apk`
- `dist/releases/MyMap-public-policies.zip` — upload các HTML lên hosting để lấy URL chính sách cho AdMob.

Nguồn kỹ thuật: [Valhalla API và host dịch vụ](https://valhalla.github.io/valhalla/valhalla-intro/), [Các loại maneuver](https://valhalla.github.io/valhalla/api/route/api-reference/), [OSRM match](https://project-osrm.org/docs/v5.24.0/api/#match-service), [OpenFreeMap](https://openfreemap.org/quick_start/), [UMP](https://developers.google.com/admob/android/privacy).
