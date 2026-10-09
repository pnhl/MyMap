# Cấu hình quảng cáo MyMap 1.0.0

**Cập nhật bản 1.0.2 (33), 08/10/2026:** bảng “Chẩn đoán quảng cáo” đã được gỡ khỏi giao diện theo yêu cầu. `no-fill` được ghi nhận nội bộ là chưa có quảng cáo, không hiện lỗi cho người dùng. Cơ chế tải giữ thời gian chờ theo ad unit khi đổi màn hình, chỉ tải ở màn hình đang mở khi app hoạt động; thử lại sau 60/120/240/300 giây khi no-fill, tiếp tục tối đa mỗi 5 phút cho tới khi có quảng cáo. Không gửi yêu cầu song song cho cùng ad unit. Lỗi cấu hình `invalid-request` dừng thử lại trong phiên. Lựa chọn quyền riêng tư quảng cáo vẫn có trong Cài đặt.

**Cập nhật 05/10/2026:** từ versionCode 27, dùng App ID `ca-app-pub-9161074667002246~7998118867` và đơn vị Native `ca-app-pub-9161074667002246/5866779544` theo yêu cầu mới của chủ ứng dụng. Thông báo quyền riêng tư đã được chủ ứng dụng xuất bản; cần gắn với App ID mới. Tệp `app-ads.txt` đã được tạo trong `docs/admob-hosting`. Chi tiết ở [ADMOB_ID_UPDATE_V27.md](ADMOB_ID_UPDATE_V27.md). Phần dưới ghi lại cấu hình và lỗi của phiên kiểm tra trước.

Ứng dụng giữ App ID `ca-app-pub-9161074667002246~1602625156` và đơn vị Native `ca-app-pub-9161074667002246/8411182870`. Chủ ứng dụng đã xác nhận đơn vị này là Native và chưa xuất bản biểu mẫu quyền riêng tư.

Máy thử nhận lỗi UMP: `Publisher misconfiguration: ... no form(s) configured for the input app ID`. Nếu SDK chưa có lựa chọn đồng ý hợp lệ từ phiên trước, `canRequestAds` là false và bản phát hành không gửi yêu cầu quảng cáo.

## Việc cần làm trong AdMob

1. Giải nén `dist/releases/MyMap-public-policies.zip`, đưa `privacy.html`, `terms.html`, `about.html` vào thư mục public của hosting. Các tệp được xuất từ chính sách hiện có trong ứng dụng. Nếu dùng hosting đã cung cấp, URL quyền riêng tư dự kiến là `https://mymap.html-5.me/privacy.html`; kiểm tra URL mở được trước khi nhập vào AdMob. URL này chưa được Codex triển khai.
2. Mở [AdMob](https://admob.google.com/) → **Quyền riêng tư và thông báo / Privacy & messaging** → **Quy định Châu Âu / European regulations** → **Tạo thông báo / Create message**.
3. Chọn đúng MyMap có App ID trên, nhập tên ứng dụng và URL chính sách đã đăng, chọn ngôn ngữ và các đối tác quảng cáo thực sự sử dụng. Giữ lựa chọn đồng ý/từ chối rõ ràng.
4. Xem trước thông báo, **Xuất bản / Publish**, kiểm tra trạng thái đã xuất bản cho đúng ứng dụng. Cấu hình thêm thông báo theo khu vực khác nếu AdMob yêu cầu cho nơi phân phối ứng dụng.
5. Kiểm tra trạng thái sẵn sàng của ứng dụng, Trung tâm chính sách, giới hạn phân phối và liên kết cửa hàng trong AdMob. Đơn vị Native phải thuộc đúng App ID. Bản Android/FireOS phát hành dùng ID thật; không dùng quảng cáo mẫu.
6. Mở lại MyMap, vào trang có quảng cáo (Bạn bè, Hành trình, Cài đặt…). UMP sẽ cập nhật trạng thái khi khởi động và hiển thị biểu mẫu khi khu vực yêu cầu. Có thể đổi lựa chọn qua Cài đặt → Quyền riêng tư quảng cáo.

Không cần người dùng xóa dữ liệu hành trình. Việc xuất bản thông báo và nhận quảng cáo thật còn phụ thuộc trạng thái tài khoản/dịch vụ AdMob; bản sửa không thể tạo nguồn quảng cáo khi dịch vụ trả `no-fill`.

## Sửa trong ứng dụng

- Sửa cầu nối Android của thư viện NativeAd: trả lỗi SDK về JavaScript thay vì để promise treo. Bản vá áp dụng lại bằng `scripts/patch-android-dependencies.cjs` khi build.
- Tải quảng cáo cho trang đang mở, thử lại lỗi tạm thời sau 30/60/120 giây, hủy lịch thử lại và giải phóng quảng cáo khi rời trang.
- Giữ headline, advertiser, body, CTA, media và AdChoices được đăng ký với NativeAdView. Media có kích thước tối thiểu 120 × 120 dp; nội dung không che bản đồ/SOS.
- APK thử riêng trong `.local` dùng mẫu Native của Google Ad Manager để kiểm tra SDK/hiển thị trên emulator. Quảng cáo Native mẫu cài ứng dụng của AdMob trả lỗi click action trên emulator; mẫu nội dung đã tải và hiển thị. Không có thao tác nhấn quảng cáo trong kiểm thử.
- Script build ép `EXPO_PUBLIC_ENABLE_TEST_ADS=false` cho APK phát hành; APK bật quảng cáo mẫu chỉ được ghi trong `.local`. Cấu hình Gradle theo dõi cờ này để tạo lại bundle khi chuyển chế độ.

Tài liệu Google: [Tạo thông báo cho ứng dụng](https://support.google.com/admob/answer/10113207), [Thêm URL chính sách](https://support.google.com/admob/answer/10113106), [UMP và canRequestAds](https://developers.google.com/admob/android/privacy).
