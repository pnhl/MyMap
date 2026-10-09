# Khoảnh khắc, camera và widget — MyMap 1.0.0 / bản dựng 31

## Sử dụng

Vào **Kỷ niệm → Khoảnh khắc**. Nút camera nổi mở camera riêng bên trong MyMap. Các nút chụp ở Bản đồ, Kỷ niệm và chi tiết địa điểm cũng mở màn hình này.

- Chụp ảnh hoặc quay video tối đa 10 giây; chọn camera trước/sau, đèn, hẹn giờ 3 giây. Video mặc định không tiếng, có nút bật micro riêng. Xem lại, chụp lại và ghi chú trước khi lưu.
- Ảnh/video được lưu trên thiết bị trước. Gắn vị trí mặc định tắt; nếu bật, ứng dụng yêu cầu vị trí thật, không thay bằng tọa độ mẫu. Gửi vị trí cho bạn bè là một lựa chọn riêng ở bước chia sẻ.
- Chọn bạn bè đã kết nối hoặc một nhật ký nhóm để gửi; không chọn người nhận thì chỉ đồng bộ riêng vào tài khoản. Đăng nhập là cần thiết cho chia sẻ và đồng bộ đám mây.
- Ảnh chụp trước khi đăng nhập có thể được nhập vào tài khoản bằng nút **Nhập khoảnh khắc vào tài khoản**. Bước này giữ nội dung trên máy, không tự chia sẻ. Ảnh của một tài khoản đã đăng nhập khác không được nhập.
- Khoảnh khắc đã chia sẻ có cảm xúc, lời nhắn văn bản và ghi âm tối đa 30 giây. Có nghe lại và bỏ ghi âm trước khi gửi.
- **Nhật ký nhóm** cho phép tạo nhóm với bạn bè và chọn nhóm khi gửi. Rời nhóm chặn quyền xem các khoảnh khắc của người khác trong nhóm. Chủ nhóm vẫn giữ quyền đối với nội dung của mình; bản đầu tiên chưa có chuyển quyền hoặc giải tán nhóm.
- **Tổng kết video** ghép tối đa 20 khoảnh khắc trên máy theo thứ tự thời gian: ảnh 3 giây, mỗi video tối đa 10 giây, có ngày giờ, không kèm âm thanh. Xuất MP4 H.264 dọc 720 × 1280 bằng Media3. Bộ mã hóa có thể lưu khung 1280 × 720 cùng metadata xoay 90 độ. Chọn theo hôm nay, 7 ngày hoặc nhóm. Video đã xuất được lưu theo tài khoản và có thể chia sẻ lại.
- Với khoảnh khắc của chính mình chỉ có trên đám mây, chọn **Lưu trên máy** trước khi ghép tổng kết.
- **Widget** chọn ảnh mới của bạn bè, một người bạn, một nhóm, khoảnh khắc cá nhân hoặc ngày này năm xưa. Nút camera trên widget mở camera MyMap; chạm ảnh mở chi tiết khoảnh khắc.

## Quyền riêng tư và cập nhật

Bucket `mymap-moments` là riêng tư; ảnh, video và lời nhắn giọng nói không có URL công khai cố định. Backend kiểm tra JWT Firebase, quan hệ bạn bè và tư cách thành viên nhóm. Vị trí không gửi nếu người chụp chưa bật lựa chọn gửi vị trí. URL xem trong ứng dụng có thời hạn 15 phút; URL tải ảnh cho widget có thời hạn 2 phút. Người nhận có thể giữ bản đã tải hoặc đã chia sẻ ra ngoài.

Thư viện cục bộ và video tổng kết được tách theo tài khoản. Đổi tài khoản xóa ảnh đang hiển thị trên widget. Các bản chụp và video gốc vẫn lưu riêng cho tài khoản trước; không tự đưa sang tài khoản mới.

Khi MyMap đang mở màn hình khoảnh khắc, ứng dụng kiểm tra thay đổi qua RPC `mm_cursor` khoảng 15 giây một lần, chỉ tải lại khi có thay đổi. Firebase JWT hiện không tương thích trực tiếp với kênh Realtime của cấu hình này; bản này dùng REST đã xác thực. Không có thông báo push cho khoảnh khắc khi ứng dụng đóng.

Widget dùng WorkManager với chu kỳ tối thiểu 15 phút ở nền; Android có thể trì hoãn do tiết kiệm pin hoặc mạng. Launcher phải hỗ trợ App Widget. Launcher mặc định của một số thiết bị Fire OS không hỗ trợ thêm widget; thư viện, camera và nhật ký trong ứng dụng vẫn sử dụng được. Các widget MyMap trên cùng thiết bị dùng chung lựa chọn nội dung trong bản đầu tiên.

Camera chỉ chạy khi màn hình camera có focus và ứng dụng ở foreground. Rời ứng dụng dừng quay và giải phóng camera; trình phát và ghi âm cũng dừng khi ra nền. Không dùng camera hệ thống để chụp/quay. Hộp chia sẻ tệp vẫn dùng Android Sharesheet.

Màn hình mới có tiếng Việt và bản dịch tiếng Anh; ngôn ngữ khác dùng cơ chế dự phòng tiếng Anh hiện có. Các tính năng bản đồ, GPS, SOS, nhạc và cấu hình AdMob hiện tại được giữ lại.

## Backend và mã nguồn

Các migration đã áp dụng vào dự án Supabase `uwlxysystowwnfvdmfzo`:

1. `20261005061013_private_moments_camera_widget.sql`: nhóm, khoảnh khắc, lời nhắn, bucket riêng tư, RLS và RPC.
2. `20261005064637_moments_realtime_delivery.sql`: thử cấu hình publication.
3. `20261005065148_moments_firebase_refresh_cursor.sql`: chuyển sang cursor REST và bỏ hai bảng khỏi publication không sử dụng.

Firebase JWT có thể được Supabase gán vai trò `anon`. Vì vậy RPC được cấp cho `anon` và `authenticated`, nhưng mọi RPC kiểm tra issuer/audience và danh tính Firebase thông qua `private.mm_user()`; JWT thiếu xác thực bị từ chối. Quyền thực thi mặc định `PUBLIC` đã bị thu hồi. Cảnh báo [security-definer được cấp cho anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) cần được đọc trong bối cảnh này; không thể thu hồi toàn bộ vai trò `anon` mà vẫn giữ luồng Firebase hiện tại. Performance Advisor cũng ghi nhận [khóa ngoại chưa có index](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) trên bảng danh tính cũ `private.vc_external_identities`, không phải các bảng khoảnh khắc mới.

File chính: `src/services/moments.ts`, `src/services/momentPolicy.ts`, ba màn hình `MomentsScreen`, `MomentCameraScreen`, `MomentDetailScreen`, `plugins/native/MomentPlatformModule.kt`, `MomentWidget.kt`, `MomentWidgetWorker.java`. Plugin `withMyMapAndroid.ts` lưu cấu hình native để prebuild tiếp tục tạo receiver, FileProvider, tài nguyên widget và dependencies.

Lời nhắn giọng nói của người khác mất quyền truy cập qua khoảnh khắc khi khoảnh khắc bị xóa. Dọn tự động các tệp giọng nói không còn tham chiếu trong Storage chưa được bổ sung vào bản này; cần tác vụ backend dùng quyền quản trị để xóa bytes qua Storage API, không xóa trực tiếp bảng `storage.objects`.

## Kiểm thử và bản phát hành

TypeScript và **160/160 kiểm thử tự động** đã qua, bao gồm riêng tư vị trí, hàng đợi, lỗi tệp, đổi tài khoản, nhập dữ liệu khách và bộ chọn tổng kết. SQL transaction kiểm tra chủ sở hữu/người nhận/người lạ, nhóm, Storage ACL và gửi lặp đã qua và rollback toàn bộ fixture.

Trên APK release đã thu gọn bằng R8, máy giả lập Android 15 đã kiểm tra chụp/lưu ảnh thật từ camera giả lập, quay/lưu video 10 giây, xem lại, nhập dữ liệu khách, gửi video tới tài khoản kiểm thử, nhận ảnh bạn bè, widget cá nhân/bạn bè, deep link widget, ghi/gửi lời nhắn giọng nói, layout camera ngang, xuất MP4 và Android Sharesheet. Backend kiểm tra upload/download JPEG với byte hash khớp và chặn người lạ. Tài khoản kiểm thử và media được dọn sau kiểm tra.

Chưa kiểm tra trên Vivo hoặc thiết bị Fire OS thật; emulator không có camera trước. Không suy rộng các kiểm tra này thành bảo đảm mọi phần cứng camera, encoder hoặc launcher.

Hai APK ký release: Android/Google và Amazon/Fire OS, phiên bản `1.0.0`, versionCode `31`, ARM64 + ARMv7, minSdk 24, targetSdk 36. Chữ ký cùng bản cũ nên có thể cài nâng cấp; không gỡ ứng dụng nếu muốn giữ dữ liệu cục bộ. Cấu hình AdMob production vẫn được giữ, không chuyển sang đơn vị quảng cáo thử nghiệm.
