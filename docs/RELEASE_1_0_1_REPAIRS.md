# MyMap 1.0.1 — sửa lỗi và chuẩn bị phát hành

Ngày: 05/10/2026. Android versionCode: 32. Tài liệu này mô tả mã đã sửa và giới hạn xác minh, không chứng nhận ứng dụng đã sẵn sàng phát hành.

**Cập nhật 08/10/2026:** đã đóng gói thành công APK release Android và Amazon 1.0.1 (32), có ký, hai ABI ARM. Typecheck và 174 kiểm thử đạt; chữ ký, manifest, bundle Hermes, căn chỉnh ZIP và checksum đã kiểm tra. Xem [báo cáo đóng gói](RELEASE_1_0_1_PACKAGING_2026_10_08.md). Lỗi chặn Hermes ghi nhận ngày 05/10 dưới đây là kết quả lịch sử và không tái hiện trong lần build mới.

## Các yêu cầu đã xử lý trong mã

| Yêu cầu | Thay đổi | Giới hạn còn cần xác minh |
| --- | --- | --- |
| Quảng cáo không hiển thị | Thử lại khi UMP chưa cho phép yêu cầu, hiển thị trạng thái đồng ý/cấu hình/tải/lỗi trong Cài đặt; chuyển sang banner khi có ID hợp lệ | Phân phối quảng cáo thật phụ thuộc AdMob/UMP. Chưa xác minh tài khoản production. |
| Quảng cáo thô | Màu theo giao diện, khoảng cách và chữ rõ hơn; giữ đăng ký tài sản native, AdChoices và kích thước media | Các mẫu quảng cáo khác nhau phải kiểm tra trên thiết bị. |
| Heatmap sai tọa độ | Giữ tọa độ GPS/ảnh gốc; chỉ gộp các điểm trùng nhau ở độ chính xác 5 chữ số; lọc tọa độ/độ chính xác không hợp lệ | Bản đồ tương tác dùng vị trí thật. Dữ liệu cũ không thể phục hồi độ chính xác GPS đã mất. |
| Nút và UI/UX | Nút nổi độc lập nằm ngoài vùng cuộn; có trạng thái bận, vô hiệu hóa, nhãn trợ năng, xử lý bàn phím/vùng an toàn; cập nhật dock và các trang chính | Các trang chi tiết vẫn giữ một số thành phần cũ. |
| Nút định vị không zoom | Zoom 16 sau khi có GPS; xếp lệnh camera chờ bản đồ sẵn sàng; heatmap hiện dấu vị trí | GPS phụ thuộc quyền, thiết bị và điều kiện tín hiệu. |
| Giới hạn tốc độ không ổn định | Truy vấn tọa độ thực, chọn đoạn đường gần và xét hướng; không dùng lại cache của đường xa; hủy truy vấn cũ và kết quả lỗi thời | OSM có thể thiếu/sai biển báo. Dữ liệu ước lượng được phân biệt; cảnh báo tự động không dùng ước lượng. |
| Bản đồ không bám vị trí | Camera theo GPS hợp lệ; kéo bản đồ tạm dừng; nút Về giữa bật lại theo dõi; cập nhật dữ liệu web map không tải lại trang | Cần chạy thử ngoài đường trên thiết bị thật. |
| Chỉ đường và refresh tuyến | Thêm heading/accuracy vào truy vấn OSRM/Valhalla chống bắt sai đường song song/ngược chiều; đánh giá cự ly tới polyline (evaluateRouteProximity) cập nhật km/ETA mượt mà; phát hiện lệch tuyến >55m để reroute; giữ nguyên tuyến cũ khi mạng lỗi/chậm; chọn điểm đến không giật camera | Cần chạy thử lộ trình thật ngoài đường có nhiều hẻm và nút giao song song. |
| Lỗi/timeout OpenFreeMap | Báo lỗi rõ ràng khi tile/sprite/glyph lỗi hoặc timeout sau 15s; bổ sung nút thao tác trực tiếp trên thông báo: "Dùng OSM dự phòng", "Thử lại", "Đổi lớp khác" | Cần kiểm tra trên mạng 3G/4G chập chờn hoặc ngoại tuyến. |
| Spotube không kết nối | Không khóa nút kết nối vì kiểm tra cài đặt; mở Spotube để chấp nhận; báo đúng cổng/lỗi; giữ socket được chấp nhận khi lệnh phát nhạc riêng lẻ lỗi | Kiểm tra với Spotube chính thức 5.1.2; thiết bị/phiên bản người dùng chưa biết. |
| Khoảnh khắc cùng bạn bè | Feed tập trung ảnh, ảnh đầu lớn, tác giả, bộ lọc hôm nay/7 ngày, xem thêm; tải ảnh local trước remote; giữ tạo nhóm/widget/recap | Tài khoản và quyền chia sẻ thật cần kiểm tra end-to-end. |
| Tiến độ cào giả | Lưới hex diện tích bằng nhau; dựng lại từ GPS gốc; số ô/diện tích/ô mới thực; bỏ tỷ lệ hành chính/toàn cầu và tên thành phố tự sinh | Không có polygon hành chính để tính phần trăm một thành phố/quốc gia. |
| Hoàn thiện tính năng và tính năng bổ sung | Chẩn đoán GPS, chẩn đoán quảng cáo, thao tác nổi, lọc feed; timeline đọc đúng khoảng ngày/tháng kể cả dữ liệu cũ hơn 25.000 điểm và không nối khoảng mất GPS; phân biệt biển báo OSM với ước tính cả dọc lẫn ngang | Đây là các cải tiến có phạm vi kiểm chứng; chưa chứng nhận mọi dịch vụ bên ngoài. |

## Kiểm chứng

- `npm run typecheck`: đạt.
- `npm test`: 174/174 kiểm thử đạt, gồm SQLite khoảng thời gian, di trú scratch map, tọa độ/ảnh, giới hạn tốc độ theo hướng, đồng ý quảng cáo, Spotube, camera native chờ style, cú pháp bridge của các web map, đánh giá cự ly tuyến đường (evaluateRouteProximity) và ràng buộc hướng (heading/bearings) khi tìm tuyến đường bộ.
- Metro đã tạo bundle Android thành công khi thử build release.
- Lần thử ngày 05/10 chưa tạo được APK release: Windows Device Guard chặn `node_modules/hermes-compiler/hermesc/win64-bin/hermesc.exe`; Gradle dừng ở `:app:createBundleGoogleReleaseJsAndAssets`, exit 4551. Lần build ngày 08/10 đã thành công với compiler nguyên bản; chính sách Windows được giữ nguyên.
- Bản phát triển dùng các variant `googleDebug`/`amazonDebug` và Metro theo cơ chế React Native thông thường; cấu hình build release vẫn dùng Hermes.
- Bản debug Google x86_64 đã build và chạy trên giả lập riêng `MyMap_V32_QA`. Đã kiểm tra bản đồ hiển thị, dấu vị trí/zoom với tọa độ GPS mô phỏng tại TP.HCM; chụp/lưu ảnh local, mở chi tiết rồi quay lại feed. Lỗi bộ ghi âm bị giải phóng khi rời chi tiết ảnh đã được sửa và có kiểm thử hồi quy.
- MapLibre từng timeout tile/sprite/glyph ở lần đầu; lượt sau đã tải được bản đồ. Đã bổ sung báo tải chậm/lỗi, chờ style thực, giữ lệnh camera mới nhất, bỏ mốc sẵn sàng giả 1,2 giây và không tạo layer tuyến đường rỗng. Bổ sung nút chuyển ngay sang nguồn OSM raster dự phòng nếu OpenFreeMap không tải được. Các lỗi mạng upstream cần tiếp tục kiểm tra trên thiết bị/mạng thật.
- Chỉ bản debug cho phép máy chủ phát triển giả lập `10.0.2.2`. Cấu hình mạng release vẫn chỉ cho HTTP loopback phục vụ Spotube.
- Kiểm tra chỉ đường trên giả lập: tìm Bến Thành, hiển thị tuyến/điều hướng; dịch chuyển GPS mô phỏng; kéo bản đồ làm xuất hiện nhãn Về giữa; bấm Về giữa làm mất nhãn và phục hồi bám vị trí. Ảnh QA lưu trong `docs/release-v32-validation`. Chưa thay thế kiểm tra ngoài đường.
- Người dùng xác nhận Spotube 5.1.2. Chưa chứng nhận kết nối thành công trên máy người dùng; giả lập mới chưa hoàn tất thiết lập tài khoản/metadata Spotube.
- APK quảng cáo thử nghiệm, nếu tạo được, chỉ dành cho `.local`, không dùng làm bản phát hành.

## Kết nối Spotube

1. Dùng Spotube và MyMap trên cùng điện thoại.
2. Chọn cổng Connect cố định, ví dụ `8765`, trong Spotube và nhập cùng số trong MyMap; không dùng chế độ cổng ngẫu nhiên.
3. Sau khi đổi cổng, đóng rồi mở lại Spotube để server nhận cấu hình mới.
4. Bấm Kết nối trong MyMap. Khi Spotube mở hộp thoại, chọn chấp nhận rồi quay lại MyMap.
5. Nếu chưa được, xem thông báo tại phần Kết nối. Phân biệt lỗi chưa mở socket, chờ chấp nhận và lỗi điều khiển sau khi kết nối.

Giao thức được đối chiếu với nguồn chính thức [Spotube 5.1.2](https://github.com/team-spotube/spotube/tree/v5.1.2/lib/provider/server). Chính sách đồng ý quảng cáo dựa trên [Google UMP](https://developers.google.com/admob/android/privacy).

## Các bước còn lại trước phát hành

1. APK release Android/Amazon đã tạo và xác minh ngày 08/10; thử cài/cập nhật giữ dữ liệu trên thiết bị thật. Nếu cần phát hành bằng AAB, tạo và xác minh AAB riêng.
2. Trên điện thoại thật: GPS lạnh, cấp/từ chối quyền, định vị/zoom, chạy chỉ đường, kéo map rồi Về giữa, mạng chậm/mất mạng.
3. Xác minh AdMob production và thông báo đồng ý; không bấm quảng cáo trong QA.
4. Kết nối Spotube thật với cổng cố định và kiểm tra chấp nhận, từ chối, ngắt kết nối, phát/tạm dừng.
5. Hai tài khoản bạn bè: chụp/gửi/nhận ảnh, thu hồi quyền chia sẻ, nhóm, widget và đồng bộ sau offline.
6. Kiểm tra trên máy nhỏ, ngang, chữ lớn, sáng/tối; hoàn thiện metadata store và chính sách dữ liệu theo hành vi thực tế.

Bản sao mã trước sửa nằm tại `.local/release-v32-before`. Log kiểm thử và build nằm tại `.local/release-v32-*.log`.
