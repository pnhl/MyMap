# Các lớp bản đồ mở rộng

Đã cập nhật mã nguồn; không tạo APK trong lần sửa này. Phiên bản ứng dụng vẫn là 1.0.2.

## Giao diện và cách bật

Năm nút chính tách rời, nền tròn và nhãn trắng trên mọi trang. Nút đang chọn có biểu tượng và viền xanh; nút Bản đồ vẫn lớn hơn. Bố cục ngang giữ năm nút riêng ở cạnh trái.

Mở **Bản đồ → Lớp bản đồ → Bản đồ mở rộng** hoặc **Cá nhân → Cài đặt → Bản đồ mở rộng**. Có mười công tắc độc lập: giao thông, địa điểm, ảnh đường, biển báo, hạ tầng, đường cụt, lịch sử ảnh, phân tích ảnh, trợ lý biển báo và giá nhiên liệu. Tất cả mặc định `false`, không kế thừa một lựa chọn bật từ bản cũ. Lựa chọn chỉ thay đổi sau khi lưu thành công.

Khi tắt một lớp, marker/lớp tương ứng được gỡ, yêu cầu đang chạy được hủy và không khởi tạo yêu cầu mới cho lớp đó. Một tính năng phụ có thể cần dữ liệu đầu vào: bật trợ lý tải biển báo để tính khoảng cách, nhưng không bật lớp marker biển báo; bật lịch sử/phân tích cho phép chọn ảnh để sử dụng tính năng tương ứng. Tắt tất cả tính năng ảnh sẽ bỏ ảnh khỏi bảng chi tiết.

Những chức năng dẫn đường đã có (chọn tuyến, hướng dẫn rẽ, GPS follow, thước tỷ lệ, cài đặt âm thanh) vẫn hoạt động độc lập với lớp mở rộng.

## Dữ liệu thực tế

| Chức năng | Nguồn / cách sử dụng |
| --- | --- |
| Bản đồ giao thông | Raster Flow Tiles TomTom phủ lên bản đồ, kể cả chưa chọn điểm đến. Màu thể hiện tốc độ so với lưu thông thông thoáng. Tuyến đang dẫn đường có thêm các đoạn ùn tắc/đóng đường mà API trả về. Khi tắt, routing gửi `traffic=false` và sử dụng cache riêng. |
| Địa điểm | TomTom Search, OSM dự phòng; chạm điểm mở bảng chi tiết và nút chỉ đường. Bật giá nhiên liệu cũng tải cây xăng dù lớp địa điểm tổng thể tắt. |
| Ảnh đường | Mapillary imagery vector tiles → image entities. Nếu máy chủ tile không truy cập được, dùng ảnh thật liên kết với các map features gần điểm đang xem. Tối đa bốn tile và mười hai image entities cho một lượt. Thumbnail trong app; nút mở Mapillary để xem ảnh gốc/ảnh 360°. |
| Biển báo / hạ tầng | Mapillary map features, OSM nodes và ways: đèn tín hiệu, điểm qua đường, số làn, mặt đường, chiều rộng, chiếu sáng, vỉa hè… chỉ khi nguồn có dữ liệu. Lớp đường OSM có màu tím. Số làn từ thẻ OSM không phải hình học từng làn xe. |
| Đường cụt | Điểm OSM có `noexit=yes`; không suy đoán đường cụt từ đoạn đường bị thiếu dữ liệu. |
| Lịch sử ảnh | Các ảnh có ngày chụp thật quanh điểm chọn, khoảng 100 m; sắp xếp theo ngày. Có thể khác hướng chụp, không cam kết toàn bộ lịch sử hoặc luôn có nhiều thời điểm. |
| Phân tích ảnh | `/image_id/detections`: tổng hợp số vật thể của từng lớp nhận diện Mapillary. Không có mô hình AI mới chạy trên thiết bị và không xác nhận hiện trạng pháp lý của đường. |
| Trợ lý biển báo | Chiếu GPS và điểm biển báo lên tuyến đang chọn, tính khoảng cách dọc tuyến đến ba điểm phía trước trong 1 km. Loại điểm cách tuyến hơn 12 m; bỏ kết quả khi GPS cũ trên 15 giây, độ chính xác kém hơn 30 m, lệch tuyến hoặc vị trí trên vòng lặp không rõ ràng. Thẻ gợi ý hiện điểm gần nhất và mở chi tiết khi chạm. |
| Giá nhiên liệu | VietFuel `/api/fuel-prices` hoặc `/api/fuel-prices/{hãng}` khi tên điểm có hãng nhận diện được. Hiển thị cả Vùng 1 và Vùng 2, đơn vị, nguồn, ngày giá và thời điểm truy vấn. |

Khoảng cách đến biển là gợi ý **biển gần tuyến**, không xác nhận hướng hiệu lực. Biển có `maxspeed` OSM rõ ràng hiển thị km/h. Nhận diện Mapillary chỉ có con số nhưng thiếu đơn vị sẽ ghi “kiểm tra đơn vị”; không tự coi là km/h và không tự thay đổi giới hạn tốc độ pháp lý đang cảnh báo. Chưa có tự động áp dụng giới hạn mới theo hướng di chuyển khi thiếu dữ liệu xác thực.

VietFuel hiện cung cấp bảng giá theo hãng/vùng, không phải bảng giá xác nhận riêng cho từng trạm. Do đó app không gắn một giá duy nhất lên mọi cây xăng. Khi chạm **bất kỳ cây xăng có thể tương tác** do lớp POI của MyMap cung cấp, bảng giá tham khảo mở nếu công tắc giá bật. POI in sẵn trong tile nền không có dữ liệu tương tác từ nhà cung cấp. AdBlue chỉ xuất hiện nếu API thật sự trả sản phẩm này; không tự thêm giá. Ngày giá cũ hơn 14 ngày hoặc thiếu/sai ngày sẽ có nhãn dữ liệu cũ/chưa xác nhận.

## Cấu hình

Trong `.env` cục bộ (đã được bỏ qua khỏi Git):

```dotenv
EXPO_PUBLIC_TOMTOM_TRAFFIC_KEY=<key của dự án>
EXPO_PUBLIC_MAPILLARY_ACCESS_TOKEN=<Client Access Token của dự án>
EXPO_PUBLIC_VIETFUEL_URL=https://vietfuel-api.tranqui.workers.dev
```

Token Mapillary người dùng cung cấp đã được cấu hình cục bộ. Không chép token thật vào tài liệu, ảnh QA hoặc nhật ký. Graph dùng header OAuth, không đưa token vào URL; imagery tile API yêu cầu token trong URL nhưng code không ghi URL ra log. Các giá trị `EXPO_PUBLIC_*` nằm trong bundle client; nên cấu hình quyền/quota đúng tài khoản và dùng gateway nếu cần bảo vệ khóa ở phía server.

VietFuel cho phép đổi base URL HTTPS sang instance đang hoạt động/tự host có cùng schema. Không tự triển khai server trong lần sửa này.

## Kiểm tra ngày 08/10/2026

- Token Mapillary hợp lệ; Graph trả 95 map features trong khu vực Hà Nội, gồm hạ tầng và biển báo.
- Đã lấy được chín ảnh thật qua liên kết map features, đọc được 22 nhóm nhận diện trong một ảnh. Lịch sử tại điểm kiểm tra không trả thêm ảnh; không dùng dữ liệu giả để lấp chỗ trống.
- Graph image collection theo vùng trả HTTP 500 ở các yêu cầu thử. Imagery tile host cũng không truy cập được từ môi trường QA; phương án Graph associations đã hoạt động.
- TomTom traffic raster trả HTTP 200 và PNG.
- Overpass chính quá tải (504/406); instance Private.coffee cũng trả 500 trong lần đối chiếu. Parser và xử lý lỗi được kiểm thử; chưa xác minh lớp đường cụt/đường OSM bằng phản hồi live trong phiên này.
- **Base URL VietFuel công khai trong tài liệu không phân giải DNS tại thời điểm kiểm tra. Chưa xác minh giá trực tiếp hoặc AdBlue live.** Giao diện hiển thị lỗi tải; cần URL hoạt động trước khi kiểm thử đầu cuối phần này.
- TypeScript đạt; toàn bộ 211 bài kiểm tra đạt, gồm mặc định tắt, hủy yêu cầu, lọc biển theo tuyến, giải mã vector tile, fallback ảnh, giữ lớp qua cập nhật GPS, cache giao thông riêng và dữ liệu giá theo vùng.
- Kiểm tra trên giả lập Android: dock trắng tách rời ở Bản đồ và các trang khác; mười công tắc khởi tạo tắt. Không kiểm chứng biển báo khi lái xe thật. Native traffic tiles gặp timeout trên giả lập dù kiểm tra API từ máy tính trả HTTP 200; cần đối chiếu thêm trên điện thoại thực tế.

Không nên coi dữ liệu nhận diện từ ảnh là hệ thống hỗ trợ lái xe có chứng nhận. Biển thực tế và hướng hiệu lực cần được người dùng kiểm tra.

## Nguồn chính thức / giới hạn miễn phí

- [Mapillary FAQ: nền tảng miễn phí](https://help.mapillary.com/hc/en-us/articles/8348198426396-Mapillary-FAQ).
- [Mapillary API](https://www.mapillary.com/developer/api-documentation), [Mapillary API demo chính thức](https://github.com/mapillary/api-demo), [các trường entity và detections](https://mapillary.github.io/mapillary-python-sdk/docs/mapillary.config.api/mapillary.config.api.entities/).
- [TomTom Raster Flow Tiles](https://docs.tomtom.com/traffic-api/documentation/tomtom-maps/v1/traffic-flow/raster-flow-tiles), [bảng giá và quota hiện hành](https://docs.tomtom.com/pricing). Các dịch vụ freemium có hạn mức; không cam kết miễn phí khi vượt quota tài khoản. Giá nhiên liệu TomTom là dịch vụ riêng, không được sử dụng thay VietFuel.
- [VietFuel: API và schema của tác giả](https://github.com/TranQui004/vietfuel-api). Dự án cộng đồng không đại diện cho doanh nghiệp xăng dầu.
- [Overpass: máy chủ công cộng và chính sách](https://wiki.openstreetmap.org/wiki/Overpass_API). Khi phát hành nhiều người dùng cần endpoint được vận hành cho quy mô đó; máy chủ công cộng có thể quá tải.
- [Giấy phép ảnh Mapillary](https://help.mapillary.com/hc/en-us/articles/115001770409-Licenses); ảnh có tên tác giả, ngày chụp và liên kết về nguồn. Thư viện đọc vector tiles sử dụng BSD-3-Clause, `pbf` BSD-3-Clause.

Hướng dẫn đóng gói cũ nằm ở `TOMTOM_MAP_UPGRADE.md`; APK đã có trong `dist/releases` không bao gồm lần cập nhật này.
