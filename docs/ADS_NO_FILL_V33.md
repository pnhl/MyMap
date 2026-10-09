# MyMap 1.0.2 (33) — xử lý no-fill và bỏ bảng chẩn đoán

Ngày 08/10/2026. Ảnh người dùng cho thấy `consent · ready` và các vị trí quảng cáo trả `no-fill`. Theo [Google Mobile Ads](https://developers.google.com/admob/android/reference/com/google/android/gms/ads/AdRequest#ERROR_CODE_NO_FILL), mã này nghĩa là yêu cầu thành công nhưng không có quảng cáo để trả về. Ảnh không xác định được nguyên nhân thiếu nguồn phân phối của tài khoản AdMob.

## Thay đổi

- Gỡ bảng “Chẩn đoán quảng cáo” khỏi Cài đặt và xóa component của bảng. Nhật ký trạng thái phục vụ phát triển vẫn được lưu nội bộ. Mục “Lựa chọn quyền riêng tư quảng cáo” vẫn cho phép người dùng thay đổi lựa chọn Google.
- No-fill được phân loại là `unavailable`, không ghi thành lỗi ứng dụng hoặc hiện thông báo lỗi trên giao diện. Native chưa tải được và không có banner dự phòng hợp lệ thì không tạo thẻ hoặc khoảng trống.
- Sửa cơ chế cũ ngừng thử lại sau ba lần lỗi. Với no-fill, thử lại sau 60/120/240 giây, rồi tối đa mỗi 300 giây; chỉ chạy khi màn hình được mở và app ở trạng thái active. Thành công sẽ đặt lại khoảng chờ.
- Giữ khoảng chờ và khóa yêu cầu theo ad unit trong phiên, tránh đổi màn hình để gửi dồn yêu cầu hoặc tạo hai yêu cầu native đồng thời cho cùng ad unit.
- Lỗi mạng/tạm thời dùng khoảng chờ từ 30 giây; `invalid-request` dừng thử lại trong phiên. Giải phóng quảng cáo tải về muộn khi màn hình đã đóng và hủy timer khi rời màn hình/về nền.
- Giữ UMP `canRequestAds`, ID production, yêu cầu quảng cáo không cá nhân hóa, tài sản Native/AdChoices và banner dự phòng đã cấu hình.
- Tăng phiên bản thành `1.0.2`, Android versionCode `33` để phân biệt bản sửa với APK 1.0.1 (32).

## Kiểm chứng và APK

- Typecheck đạt; 181/181 kiểm thử đạt.
- Kiểm thử mới kiểm tra no-fill nhiều hơn ba lần rồi tải thành công; đổi màn hình không vượt thời gian chờ; không gửi trùng yêu cầu; tạm dừng retry ở nền; quảng cáo trả về muộn được hủy đúng một lần.
- Build Google/Amazon release đạt trong 3 phút 44 giây. Hai APK được ký bằng chứng thư hiện có, cùng application ID `com.pnhl.vibecoding`, chứa ARMv7/ARM64, bundle Hermes 98 và không bật quảng cáo mẫu.
- `apksigner verify`, kiểm tra version/manifest, ABI, bundle, căn chỉnh ZIP và SHA-256 đều đạt. Mỗi APK có tệp `.apk.sha256` đi kèm. Không có thiết bị ADB kết nối, nên chưa cài/chạy APK mới trên điện thoại trong phiên này.

| Tệp | Dung lượng byte | SHA-256 |
| --- | ---: | --- |
| `dist/releases/MyMap-1.0.2-android-release.apk` | 45.308.837 | `0AF4CFF4FFEB6FC69B97EC38D0BEFBABD7CA858253A558781873CDE6C1C7EE70` |
| `dist/releases/MyMap-1.0.2-amazon-release.apk` | 45.307.930 | `ADA6D4656FA942A1C6B09C31E7FA61CEFE3936810DA58A2D32925A3B99345E3F` |

Log: `.local/ads-v33-typecheck.log`, `ads-v33-tests.log`, `ads-v33-build.log`, `ads-v33-verification.log` và log chữ ký/manifest từng kênh.

## Nếu vẫn chưa có quảng cáo thật

Bản sửa xử lý phục hồi phía ứng dụng, không chứng nhận AdMob đã phân phối quảng cáo. Cần kiểm tra trong tài khoản AdMob: app đã sẵn sàng, giới hạn phân phối/Policy Center, ad unit Native thuộc đúng App ID, liên kết cửa hàng và xác minh app-ads.txt. Không tự thay ID production bằng ID mẫu hoặc dùng ID Native làm banner. Hướng dẫn cấu hình hiện có ở `ADMOB_CONFIGURATION_FIX.md` và `ADMOB_ID_UPDATE_V27.md`.
