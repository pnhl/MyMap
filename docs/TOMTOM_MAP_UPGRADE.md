# Nâng cấp bản đồ và trình phát MyMap

Thay đổi đã được thực hiện trong mã nguồn. Chưa đóng gói APK phát hành mới; các APK 1.0.2 trong `dist/releases` chưa có phần nâng cấp này.

## Tính năng đã bổ sung

- Tìm địa điểm bằng TomTom Fuzzy Search, gợi ý sau khi ngừng nhập 800 ms; lịch sử tìm kiếm và địa điểm đã lưu vẫn có thể xem trên máy.
- Khám phá quanh vị trí hiện tại: cây xăng, quán ăn, cà phê, nhà thuốc, bãi đỗ xe và trạm sạc EV. Bệnh viện cũng được hiển thị trong lớp địa điểm trên bản đồ. Các địa điểm có tọa độ thật, không phải dữ liệu mẫu.
- TomTom Routing là nguồn ưu tiên khi có key. Hỗ trợ ô tô, xe máy, xe đạp và đi bộ ở tầng dịch vụ; giao diện dẫn đường hiện có lựa chọn ô tô/xe máy. Giữ tùy chọn tránh cao tốc, phà và đường chưa trải nhựa.
- Yêu cầu tối đa hai tuyến thay thế, tổng cộng tối đa ba tuyến. Có thể chọn bằng thẻ hoặc chạm tuyến trên bản đồ. Số tuyến thực tế do dịch vụ quyết định.
- ETA theo giao thông, mức chậm do giao thông và nhãn tuyến có thu phí. Đoạn đỏ lấy từ các section JAM/ROAD_CLOSURE có chỉ số tọa độ hợp lệ của chính tuyến TomTom. Không suy diễn kẹt xe từ tốc độ GPS của người dùng.
- Hiển thị giờ cập nhật và nút làm mới tuyến/giao thông. Dữ liệu là lần cập nhật gần nhất, không phải luồng tức thời liên tục. Khi đi lệch tuyến, ứng dụng tính lại tuyến như trước.
- Chỉ đường tiếp tục bám GPS; dưới 30 km/h nhìn gần, từ 30 km/h dùng khoảng nhìn cố định rộng hơn, thiết kế để thấy khoảng 500 m phía trước. Camera dùng chế độ nhìn từ trên xuống khi dẫn đường. Vị trí quá cũ không được coi là GPS mới.
- Thước mét nhỏ gọn; thước native dùng độ phân giải địa lý theo vĩ độ và zoom, hiển thị xấp xỉ ở góc nhìn 3D. Web engines dùng thước của thư viện hoặc khoảng cách đo trên mặt đất trong Cesium.
- Gợi ý làn rẽ từ OSRM/Valhalla khi nguồn trả dữ liệu làn. TomTom Calculate Route hiện dùng trong app không cung cấp dữ liệu đó. Chưa có hình học từng làn để vẽ lane chi tiết trên bản đồ.
- Dock có nền đặc, chữ rõ; các tab Kỷ niệm luôn giữ icon/nhãn, trạng thái chọn chỉ đổi màu. Khôi phục nút nổi khi quay lại màn hình sau bàn phím/camera.
- Trình phát MyMap thay giao diện kết nối Spotube: nhập nhạc từ máy, radio, hàng đợi, yêu thích, phát ngẫu nhiên/lặp, âm lượng, hẹn giờ và chia sẻ bài đang nghe. Mã tương thích Spotube cũ còn được giữ trong tầng dịch vụ nhưng không còn nút kết nối trong giao diện âm nhạc.
- Nguồn nhạc không phản hồi sau 20 giây sẽ dừng tải, giải phóng audio focus và cho phép thử lại. Danh sách mặc định giữ các kênh VOV; tìm thể loại khác dùng danh mục Radio Browser.

## Cấu hình và hạn mức

Key được cấu hình ở `.env` bằng `EXPO_PUBLIC_TOMTOM_TRAFFIC_KEY`. File này đã nằm trong `.gitignore`. Các biến `EXPO_PUBLIC_*` được đóng vào ứng dụng; đây không phải nơi giữ bí mật máy chủ. Cần quản lý giới hạn và hạn mức của key trong tài khoản TomTom trước phát hành rộng rãi.

Theo trang giá TomTom được kiểm tra ngày 08/10/2026, Search API có mức miễn phí 2.500 request/tháng, Routing và Traffic Flow Segment có mức 20.000 request/tháng cho từng API. Hạn mức thực tế và khả năng tính phí vượt mức phụ thuộc gói tài khoản/key; ứng dụng không đọc được số quota toàn tài khoản và chưa có giới hạn chi tiêu trên máy chủ.

Ứng dụng lưu đệm tìm kiếm/POI 10 phút, tuyến giao thông 2 phút trong bộ nhớ; không lưu tuyến TomTom có traffic vào cache lâu dài. HTTP 401/403/429 tạm dừng gọi lại nguồn TomTom tương ứng 5 phút, chuyển sang nguồn dự phòng. Làm mới chủ động vẫn cần Internet và dùng quota. Với tuyến dự phòng OSM, chỉ lấy tối đa sáu mẫu traffic theo yêu cầu; không tự polling liên tục.

Không tích hợp giá nhiên liệu trực tiếp, giá bãi đỗ hoặc số chỗ còn trống: các sản phẩm Fuel Prices/Parking tương ứng yêu cầu gói riêng. POI cây xăng/bãi đỗ/trạm sạc chỉ thể hiện địa điểm, không xác nhận giá, chỗ trống hay trụ sạc còn hoạt động.

Tài liệu chính thức:
- https://docs.tomtom.com/pricing
- https://docs.tomtom.com/search-api/documentation/search-service/fuzzy-search
- https://docs.tomtom.com/search-api/documentation/search-service/nearby-search
- https://docs.tomtom.com/routing-api/documentation/tomtom-maps/v1/calculate-route
- https://valhalla.github.io/valhalla/api/route/api-reference/

## Kiểm chứng

- `npm run typecheck`: đạt.
- `npm test`: 194 bài đạt, bao gồm tuyến thay thế, tránh đường, đoạn kẹt xe đúng geometry, làn rẽ, camera ngưỡng 30 km/h, thước mét, lịch sử tìm kiếm, cache POI, định danh marker native, bridge cập nhật cho cả ba web engine/Leaflet và timeout/thử lại/phát lại nguồn âm thanh.
- Key thực tế trả HTTP 200 cho POI Categories, Fuzzy Search, Nearby Search và Calculate Route. Thử xe máy ở Hà Nội trả ba tuyến.
- Máy giả lập Android API 35: bốn tab Kỷ niệm vẫn hiển thị khi chuyển qua lại; tìm EV trả trạm sạc TomTom tại Hà Nội; dẫn đường hiển thị ba tuyến và đổi tuyến được.
- Nhập tệp WAV kiểm tra qua trình chọn tệp Android thành công; trình phát phát hết tệp 10 giây. Radio phản hồi chậm trên môi trường QA đã đi vào trạng thái lỗi có thể thử lại thay vì tải vô hạn. Chưa xác nhận phát radio ổn định trên điện thoại thật.
- Chưa xác nhận lái xe thực tế, độ phủ traffic/làn tại mọi địa phương hoặc mọi kênh radio trên điện thoại thật. Không cam kết luôn có ba tuyến hay luôn có dữ liệu ùn tắc/làn.

## Đóng gói sau khi kiểm tra thiết bị thật

Giữ khóa ký hiện tại để cài cập nhật. Khi cần phát hành bản mới, tăng `expo.version`, `android.versionCode`, phiên bản `package.json`/`package-lock.json` và `versionName`/`versionCode` trong `android/app/build.gradle` đồng bộ trước khi chạy:

```powershell
./scripts/build-release.ps1 -Channel both -Architectures 'armeabi-v7a,arm64-v8a'
```

Cấu trúc đầu ra:

```text
dist/releases/
  MyMap-<version>-android-release.apk
  MyMap-<version>-android-release.apk.sha256
  MyMap-<version>-amazon-release.apk
  MyMap-<version>-amazon-release.apk.sha256
```

Sau build phải kiểm tra chữ ký, applicationId, versionCode/versionName, ABI, alignment và cài cập nhật trên bản cũ. Không đưa `.env`, `.signing`, keystore hay các log riêng tư vào tệp bàn giao công khai.
