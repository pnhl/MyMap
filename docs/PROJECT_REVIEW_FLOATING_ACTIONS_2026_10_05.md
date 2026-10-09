# Đánh giá MyMap: nút nổi và hướng phát triển

Ngày: 05/10/2026. Phạm vi: 14 màn hình, UI chung/navigation, service và SQLite, native Android/Auto/cảm biến, module an toàn, bản đồ/định tuyến/nhạc, mã backend trong workspace, tài liệu và tests liên quan. Không truy cập backend đang chạy, không đọc khóa riêng và không thay đổi mã ứng dụng trong lượt đánh giá này.

Người dùng xác nhận muốn **các nút nổi độc lập trên giao diện**, tương tự màn hình Bản đồ.

## Kết luận

Có thể triển khai trên toàn bộ ứng dụng và giữ chức năng hiện tại. Cần tạo một lớp hành động nổi dùng chung, thay vì chỉ thay nền hoặc góc bo của nút. Nút hành động nhanh giữ vị trí khi cuộn; dữ liệu, công tắc và các thao tác cần ngữ cảnh vẫn gắn với nội dung tương ứng.

Hiện Bản đồ có lớp overlay riêng tại [MapScreen.tsx](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/screens/MapScreen.tsx:1150>). Các trang khác đặt header và nội dung trong vùng cuộn của [ScreenScaffold.tsx](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/ui/ScreenScaffold.tsx:19>). [AppDock.tsx](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/ui/AppDock.tsx:61>) chỉ dùng các bong bóng độc lập và thanh bên cho Bản đồ, còn trang khác có nền chung. Nút hiện có ở [glass.tsx](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/ui/glass.tsx:52>), nhưng chưa có hệ thống ghim/ẩn/sắp xếp hoặc lưu bố cục nút theo trang.

## Cách bố trí theo màn hình

| Màn hình | Phù hợp làm nút nổi | Nội dung/thao tác cần giữ cùng ngữ cảnh |
| --- | --- | --- |
| Bản đồ | Định vị, lớp, công cụ, SOS, ghi chuyến, chụp, chat, nhạc | Hướng rẽ, ETA, thời tiết và giới hạn tốc độ là thông tin; cần bố trí gọn, vẫn đọc được |
| Hành trình | Lịch/hôm nay, chia sẻ, xuất, phát lại | Ngày/tháng, chuyển ngày và các điểm dừng |
| Kỷ niệm | Chụp/thêm, tìm kiếm, mở bộ lọc | Lưới ảnh và bộ lọc đang chọn |
| Bạn bè | Thêm bạn, QR, tìm kiếm, mở bản đồ | Chấp nhận/từ chối phải đi cùng đúng người |
| Cá nhân | Sửa hồ sơ, mã QR, cài đặt | Thông tin tài khoản, thống kê, lưu/hủy khi sửa |
| Heatmap | Về vị trí, vừa khung, lớp/bộ lọc | Chú giải màu và thống kê |
| Chi tiết địa điểm | Chỉ đường, lưu, chia sẻ, chụp | Ghi chú, công tắc cảnh báo và chọn phương tiện |
| Chi tiết kỷ niệm | Chia sẻ, sửa, xem toàn màn hình | Trường nhập liệu, lưu thay đổi và xác nhận xóa |
| Đồng hành/Smart | Ghi chuyến, ETA, tạo cảnh báo địa điểm | Cài đặt từng địa điểm và xác nhận sự cố |
| Âm nhạc | Mini-player, phát/tạm dừng, bài trước/sau, mở hàng đợi | Chọn nguồn, tua, âm lượng, nhập tệp và cấu hình Spotube |
| SOS | Gọi và chia sẻ vị trí ở vị trí cố định dễ thấy | Nhấn giữ, hủy, số điện thoại và thao tác theo từng liên hệ |
| Cài đặt | Quay lại, tìm kiếm cài đặt, lối tắt | Công tắc và mô tả cần đi cùng từng thiết lập |
| Đăng nhập | Quay lại, trợ giúp, mở chính sách | Đăng nhập/OTP/đồng ý phải đi cùng trường nhập và bàn phím |
| Chính sách/giới thiệu | Quay lại, đóng, mục lục | Văn bản đọc được và có thể cuộn |

Đề xuất mặc định: 2–4 hành động nhanh theo ngữ cảnh, một nút “Thêm” để mở các thao tác còn lại. Đây là lựa chọn thiết kế đề xuất, không phải giới hạn kỹ thuật. Năm mục điều hướng có thể dùng các nút tròn độc lập trên mọi trang.

## Thay đổi kiến trúc cần thiết

1. Tạo thành phần nút và cụm nút nổi chung, hỗ trợ biểu tượng, nhãn, trạng thái đang xử lý/vô hiệu hóa và tác vụ hiện có.
2. Bổ sung vị trí overlay bên ngoài ScrollView trong ScreenScaffold. Đo chiều cao dock và cụm nút để chừa khoảng trống cho nội dung.
3. Dùng cùng một quy tắc cho dọc/ngang/tablet: dọc ở mép dưới hoặc cạnh phải; ngang chuyển về hai bên; tính vùng an toàn và bàn phím thay vì lưu tọa độ pixel cố định.
4. Modal/sheet có quyền ưu tiên: lớp nút của trang nền không được nhận chạm xuyên qua. Quảng cáo native tiếp tục nằm trong nội dung, có khoảng trống quanh vùng tương tác.
5. Các nút chỉ gọi action/service có sẵn. [locationTracking.ts](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/services/locationTracking.ts:229>), [platformLocation.ts](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/services/platformLocation.ts:107>) và [musicControls.ts](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/services/musicControls.ts:28>) đã có nền để dùng chung; không khởi tạo thêm GPS watcher hay player cho từng nút.
6. Điều hướng/chọn điểm đến/phát lại hiện còn state trong MapScreen. Nếu điều khiển trực tiếp từ trang khác, cần đưa state đó vào controller chung trước.

Nút có thể nhỏ về hình ảnh nhưng cần vùng bấm đủ rộng, nhãn TalkBack và trạng thái rõ ràng. Android khuyến nghị vùng chạm ít nhất 48×48 dp; bố cục phải tính tai thỏ, bàn phím và thanh hệ thống. Nguồn: [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps), [Android layout basics](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics).

Lộ trình UI đề xuất: lớp nút chung + dock → thử Kỷ niệm/Bạn bè/Hành trình → các trang chi tiết/nhạc → biểu mẫu và SOS → tùy biến lối tắt. Kiểm tra dọc/ngang, máy nhỏ, chữ lớn, bàn phím, sheet, hàng cuối danh sách và vùng quảng cáo sau từng nhóm.

## Những tính năng đã có nền tảng

MyMap đã có ghi GPS nền, SQLite cục bộ, lịch ngày/tháng, ảnh gắn vị trí và ghi chú, tìm kiếm, bản đồ 3D, nhiều engine/provider, route preferences, dự báo phía trước, bạn bè/presence, geofence, Scratch Map, thành tích, Wrapped, Time Capsule, phát lại, SOS và nhạc. Xuất JSON/CSV/GPX/GeoJSON đã có; hàm nhập GPX/GeoJSON cũng có nhưng chưa thấy màn hình sử dụng. Không nên quảng bá các mục này như những tính năng mới chưa tồn tại.

## Hướng phát triển có giá trị

Mức độ Nhỏ/Vừa/Lớn là đánh giá tương đối về phạm vi; không phải cam kết thời gian hoặc chi phí.

| Ưu tiên | Hướng phát triển | Giá trị cho người dùng | Nền hiện tại và phần còn thiếu | Phạm vi |
| --- | --- | --- | --- | --- |
| Cao | Nút nổi tùy biến | Ghim/ẩn/sắp xếp lối tắt theo trang; thuận tay trái/phải; bố cục riêng dọc/ngang | Có overlay Bản đồ; cần hệ thống chung, lưu action ID/điểm neo và giới hạn chống che nội dung | Vừa |
| Cao | Trung tâm chất lượng GPS | Hiện độ chính xác, lần lưu cuối, mất tín hiệu, trạng thái chạy nền và lý do đoạn hành trình bị thiếu | Có error/retry/hàng đợi; cần giao diện chẩn đoán và theo dõi độ mới dữ liệu | Vừa |
| Cao | Hành trình theo từng chuyến | Đặt tên, tạm dừng, điểm dừng, album, chất lượng bản ghi, xuất/phát lại một chuyến | GPS đang là luồng điểm; cần bảng session và truy vấn theo ngày/chuyến | Vừa–lớn |
| Cao | Chỉ đường ổn định + giọng nói | Tiếp tục khi đổi trang; tính lại khi lệch tuyến; vẫn giữ tuyến cũ lúc mạng chậm | Routing/HUD đã có; cần service trạng thái và tiến trình dọc tuyến | Lớn |
| Cao | Sao lưu/khôi phục đầy đủ | Chuyển máy không mất ảnh, GPS và cài đặt | Xuất JSON hiện chỉ ghi URI ảnh; cần gói dữ liệu + tệp thật, kiểm tra toàn vẹn và phục hồi. Cloud sync mã hóa là giai đoạn sau | Vừa; cloud lớn |
| Tiếp theo | Bản đồ ngoại tuyến hoàn chỉnh | Chọn vùng/hành lang tuyến, xem dung lượng, tải tiếp, dùng khi mất mạng | Downloader hiện nhỏ và chưa nối renderer; cần pack chứa tiles/style/assets và nguồn cho phép tải. Offline routing là hạng mục riêng | Lớn |
| Tiếp theo | Chuyến đi nhóm/link theo dõi có thời hạn | Điểm hẹn, ETA, xác nhận đến nơi, thu hồi chia sẻ | Có presence/geofence; cần quyền theo nhóm, session máy chủ, link token và push | Lớn |
| Tiếp theo | Widget/nút nhanh hệ thống thực sự | Ghi chuyến và xem trạng thái từ màn hình chính/thông báo/Quick Settings | Có snapshot và native tile nhưng chưa nối đủ với recorder thật | Vừa |
| Sau đó | Voice message thật/nhật ký đa phương tiện | Ghi âm gửi bạn hoặc đính vào địa điểm, nhiều ảnh mỗi điểm, album theo chuyến | Voice Ping mới có animation/timer; cần recorder, tệp, upload/phát, quyền người nhận | Vừa–lớn |
| Sau đó | Ghi nhớ chỗ đỗ xe | Lưu chỗ xe, ảnh/ghi chú tầng, nhắc giờ và đường quay lại | Tái sử dụng GPS, ảnh, điểm lưu và định tuyến | Nhỏ–vừa |
| Sau đó | Khám phá theo địa giới thực | Tỉnh/thành/quốc gia đã ghé, chỉ số đúng phạm vi, Wrapped theo thời gian thực | Các chỉ số hiện có còn ước lượng; cần địa giới hợp lệ và thống kê GPS thực | Vừa |
| Sau đó | Nhạc gắn với kỷ niệm/chuyến | Lưu tên bài vào chuyến, playlist cá nhân theo chuyến, điều khiển gọn khi chỉ đường | Player chung/Spotube đã có; tài khoản và catalog tiếp tục ở Spotube | Nhỏ–vừa |

## Những phần cần hoàn thiện trước khi mở rộng mạnh

Các kết luận dưới đây dựa trên mã tại workspace, không khẳng định trạng thái server bên ngoài.

- **Vị trí ảnh:** [photoPins.ts](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/services/photoPins.ts:23>) trả tọa độ cố định TP.HCM khi cả vị trí mới và vị trí cuối đều không có. Cần đánh dấu chưa xác định hoặc cho chọn vị trí, tránh ghim sai thành phố.
- **Lịch sử cũ:** [TimelineScreen.tsx](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/screens/TimelineScreen.tsx:35>) lấy cửa sổ 25.000 điểm từ [database.ts](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/db/database.ts:116>); dữ liệu cũ vẫn còn nhưng có thể không hiện khi chọn ngày xa. Cần query theo khoảng ngày và phân trang.
- **Tuyến và thống kê:** [traveledTrace.ts](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/services/traveledTrace.ts:30>) tách đoạn mất GPS, trong khi thống kê/xuất còn có thể nối các điểm liên tiếp. Nên dùng cùng một mô hình đoạn/chuyến cho bản đồ, khoảng cách và file xuất.
- **Chỉ đường:** [MapScreen.tsx](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/screens/MapScreen.tsx:532>) cập nhật origin theo thời gian/quãng đường; [MapScreen.tsx](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/screens/MapScreen.tsx:676>) xóa tuyến/guidance trước fetch. Cần giữ tuyến trong lúc cập nhật, phân biệt lệch tuyến với GPS nhiễu và tính khoảng cách dọc đường tới chỗ rẽ.
- **Offline:** [offlineMap.ts](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/services/offlineMap.ts:66>) tải 18 raster tiles ở zoom 12–13 cho preset thành phố; chưa thấy renderer đọc `offline_tiles`. Có màn hình tải không đồng nghĩa đã hỗ trợ offline đầy đủ.
- **Chia sẻ:** [liveTripShare.ts](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/services/liveTripShare.ts:131>) chia sẻ văn bản; [liveSafety.ts](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/services/liveSafety.ts:183>) ghép URL chứa tọa độ + timestamp. Chưa thấy cơ chế hết hạn/thu hồi link ở backend trong workspace.
- **Voice Ping:** [VoicePingModal.tsx](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/components/VoicePingModal.tsx:71>) chỉ có animation, timer và metadata, chưa ghi tệp âm thanh.
- **Widget/Wear:** [widgetBridge.ts](<C:/Users/ThinkBook 16 G8/Documents/mymap/src/services/widgetBridge.ts:18>) mới ghi AsyncStorage; `notifyWearDevice` trong module an toàn chỉ rung điện thoại. Tile native hiện dùng service thông báo khác với recorder GPS thật.
- **Social/backend:** chat/interactions đang dùng broadcast và cache cục bộ; cần hội thoại bền vững và quyền tại máy chủ trước khi mở rộng đi nhóm. Migrations hiện nối Firebase vào schema có sẵn, chưa chứa toàn bộ schema/RPC/Edge Functions để dựng lại backend độc lập.
- **An toàn/tốc độ:** cần thống nhất trạng thái hai luồng detector, hiển thị cảm biến khả dụng và nguồn/độ tin cậy giới hạn tốc độ. Không thể coi nhận diện ngã/collision hoặc dữ liệu luật giao thông mọi nước là đã đầy đủ chỉ vì có giao diện.

Đề xuất thứ tự: UI nổi thống nhất và sửa các điểm gây hiểu nhầm dữ liệu → chất lượng GPS + hành trình theo phiên → chỉ đường + backup → offline/đi nhóm/widget → voice/khám phá/nhạc theo chuyến.

## Giới hạn đánh giá

Đây là lượt đọc và đánh giá, không thay giao diện hoặc chạy lại build/tests. Kết quả 151 tests và APK v30 là kết quả đã hoàn thành ở lượt nhạc trước; chúng không chứng minh toàn bộ backend, cảm biến, Vivo/Fire OS thực địa hoặc Auto trên xe thật. Backend đang chạy và tài khoản thật chưa được kiểm tra trong lượt này.

Hai APK nhạc v30 đã có trong `dist/releases/spotube-music-v30/`; chúng chưa chứa thiết kế nút nổi toàn ứng dụng được đề xuất ở tài liệu này.

