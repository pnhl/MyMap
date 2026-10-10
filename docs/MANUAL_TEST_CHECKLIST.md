# Nghiệm thu thiết bị thật

Trạng thái toàn bộ checklist: **chưa chạy trong lượt này**. Không dùng credential thật/cài app/ký hoặc upload store trong phiên triển khai. Thực hiện sau khi chủ dự án cho phép một phiên nghiệm thu riêng.

Mỗi lượt ghi: thiết bị/OS/store; commit; version/build; SHA artifact và embedded JS; inputs fingerprint; signer; fresh install hay upgrade; account thử A/B; permission/network/GPS; thời gian; pass/fail và log đã che dữ liệu. Dùng năm artifact của cùng release set; không dùng APK cũ làm bằng chứng source mới.

| Kịch bản | iPhone | Android GMS | Fire thật | Kết quả cần thấy |
|---|---|---|---|---|
| Cold start fresh/reboot/update | ☐ | ☐ | ☐ | Không crash; Fire thiếu GMS không load Google sign-in/GMA/FCM initializer. Kiểm logcat và màn hình thật. |
| Email/guest/logout/switch owner | ☐ | ☐ | ☐ | Dữ liệu owner riêng; widget/push cũ xóa; guest không nhận remote private push. |
| Liên kết email/Google/Apple/OTP | ☐ | ☐ | ☐ | UID trước/sau giữ nguyên; collision từ chối; đổi owner giữa OAuth/OTP từ chối. Google ẩn khi thiếu GMS. Fire OTP kiểm reCAPTCHA thực tế, không coi email fallback là OTP đạt. |
| Magic link | ☐ | ☐ | ☐ | Nút ẩn nếu thiếu Hosting; gửi/callback/link hết hạn/máy khác yêu cầu email; domain/app links thật. |
| Map/search/navigation/offline | ☐ | ☐ | ☐ | Tải map/route được phép, tắt mạng vẫn mở dữ liệu; route instruction/speed trong NavigationSnapshot khớp car UI. |
| GPS recorder khóa màn hình ≥30 phút | ☐ | ☐ | ☐ | SQLite có điểm thật; timestamp/tránh spike; notification/Live Activity cùng trạng thái. Không chỉ thấy notification. |
| Reboot/OS kill/khôi phục | ☐ | ☐ | ☐ | Chỉ restore recorder đã bật và còn quyền; tile/shortcut ghi GPS thật. iOS theo lifecycle OS, không hứa launch tự động. |
| Thu hồi foreground/background permission | ☐ | ☐ | ☐ | Service dừng hoặc báo lỗi rõ; không trạng thái đang ghi giả, không vòng lặp FGS crash. |
| Tắt GPS/provider, thiếu GPS phần cứng | ☐ | ☐ | ☐ | Báo provider unavailable; bật lại phục hồi có điểm thật; không tạo vị trí giả. |
| SOS online/offline/replay | ☐ | ☐ | ☐ | Lưu/queued/server accepted phân biệt recipient delivered; vị trí hợp lệ; replay sau có mạng; không gửi nhầm owner. |
| Pending incident → hủy | ☐ | ☐ | ☐ | Không sinh SOS muộn sau cancel/tắt monitor/restart; motion nền iOS đúng giới hạn UI E1. |
| Tablet không dialer/barometer/cảm biến | — | ☐ | ☐ | Không gọi tel khi thiếu handler; SOS chia sẻ còn; capabilities hiển thị đúng. |
| Geofence enter/exit/hysteresis | ☐ | ☐ | ☐ | Không báo ở sample đầu/biên thiếu chính xác; Fire nền chỉ khi recorder bật; event persisted và replay đúng owner. |
| Chat/call hai tài khoản A↔B | ☐ | ☐ | ☐ | RLS không đọc chéo; camera/micro denial/revocation; token LiveKit đúng room; Bluetooth routing. |
| Push app đóng/cold tap/warm tap | ☐ APNs | ☐ FCM | ☐ ADM | Tin generic; call channel high/TTL60; mở đúng Call/Chat; không fullscreen mặc định. Kiểm device nhận, không chỉ HTTP provider accepted. |
| Push token rotate/reinstall/logout/race | ☐ | ☐ | ☐ | Token/provider/store cập nhật; lease cũ không gửi sau chuyển owner; duplicate không spam; revoke khi offline báo lỗi rõ. |
| Camera/photo/video/audio | ☐ | ☐ | ☐ | Permission theo thao tác; phần cứng optional; không ghi mic nền ngoài luồng được phép. |
| Widget owner/filter/TTL/sign-out | ☐ | ☐ | ☐ nếu launcher | Friends/personal/anniversary đúng; hết TTL không lộ nội dung; xóa snapshot khi đổi account/logout. |
| Live Activity / ongoing notification | ☐ | ☐ | ☐ | Start/update/end/restore, tắt recorder/permission denied không giữ trạng thái cũ; không hiển thị tọa độ nhạy cảm. |
| Khóa app + device PIN fallback | ☐ | ☐ | ☐ | Không sinh trắc vẫn xác thực bằng mã OS; chưa có credential không cho bật; hủy/lockout/đổi credential/relaunch không kẹt dữ liệu. |
| Vault/keychain/keystore/backup | ☐ | ☐ | ☐ | Đọc/ghi/sign có xác thực đúng; cloud/device-transfer không mang khóa/SQLite; không tuyên bố toàn DB mã hóa. |
| GGUF/system AI/hash/cancel/32 bit/RAM | ☐ | ☐ | ☐ | Model sai hash từ chối; thiếu RAM/ABI nêu lý do; stop dừng generation; provider lỗi không âm thầm đổi. |
| OCR/offline speech/TTS | ☐ | ☐ | ☐ | Fire không GMS/không mạng dùng bundled OCR; nhận giọng khi provider có; thiếu recognizer nhập chữ; TTS thiếu voice báo đúng. |
| Recap/export/cancel/share/switch owner | ☐ | ☐ | ☐ | Cancel dừng native job; tệp private đúng owner; account thay đổi không share tệp owner trước; lỗi/dung lượng thấp hiển thị. |
| Music/Spotube/background audio | ☐ | ☐ | ☐ | Playback opt-in; Spotube loopback còn trên Android/Fire; không nhầm dev endpoint. |
| Ads/consent/no-fill/real unit | ☐ | ☐ | ☐ tắt | Release không sample/wrong platform; consent/ATT phù hợp; Fire không khởi tạo GMA/APS. Không click quảng cáo thật để test. |
| Upgrade từ build đang phát hành | ☐ | ☐ | ☐ | Signature phù hợp; SQLite/private media/queue giữ; version mới lớn hơn số store; rollback plan không xóa dữ liệu. |
| Watch/Wear/Car | ☐ Watch/CarPlay | ☐ Wear/Auto | ngoại lệ | Version đồng nhất, Google phone/Wear cùng signer; SOS yêu cầu xác nhận điện thoại; entitlement CarPlay trước khi bật. |

Sau QA chạy L2 trên IPA ký, IPA unsigned, AAB và hai APK cuối: signatures/profiles từng target, recursively dylib, usage descriptions/modes, DEX init, ABI/16KB/ZIP, permissions/backup, provenance và JS hash bằng nhau. Lưu verification.json, macOS signature proof và release-set.json cùng artifact. Nếu có lỗi không đánh dấu DONE-VERIFIED cho toàn tính năng.
