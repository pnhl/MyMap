# Các chức năng chưa hoàn thiện — Android, Amazon, iOS

Ngày rà soát: **12/10/2026**. Mã nguồn đối chiếu: **686481e**.

## Phạm vi và cách đọc

- Android = bản Google Play; Amazon = bản Fire OS; iOS = bản Apple.
- **Chưa có**: chưa tìm thấy đường triển khai tương ứng trong source đã rà soát.
- **Một phần**: có chức năng nền, nhưng thiếu phạm vi cụ thể nêu trong bảng.
- **Chờ triển khai/kiểm nhận**: đã có code; thiếu bằng chứng cấu hình production, giao nhận thực tế hoặc kiểm thử thiết bị.
- **Giới hạn nền tảng**: hành vi khác nhau có chủ đích, không phải mọi trường hợp đều cần bổ sung cùng một SDK.

Đây là kiểm kê source và bằng chứng build/QA trong repo, không phải kiểm toán toàn bộ dịch vụ production. Không đọc giá trị secret hay dữ liệu người dùng. Các số tổng kết trong báo cáo ngày 08/10 đã lỗi thời; không dùng lại để tính số chức năng còn thiếu. Các mục dưới đây được gộp theo chức năng, tránh đếm trùng tên trong catalog.

Checkpoint mới nhất: Android Preview 40 đã dùng cấu hình Firebase thật, cài song song bản chính, cập nhật từ Preview 39, khởi động và mở màn hình đăng nhập Google trên Android 15. **Chưa kiểm đăng nhập tài khoản hoàn tất**. Các bản native iOS/Fire và nhiều luồng hai tài khoản vẫn chưa nghiệm thu. Preview này cũng chưa cấu hình gateway và các backend production còn lại.

## 1. Chưa tìm thấy triển khai hoàn chỉnh, áp dụng cho cả ba bản

| Nhóm chức năng | Phần chưa triển khai | Android | Amazon | iOS |
|---|---|---|---|---|
| Đăng nhập nâng cao | Passkey; MFA thực sự, ngoài đăng nhập OTP một yếu tố | Chưa có | Chưa có | Chưa có |
| Chống giả mạo ứng dụng | Tích hợp kiểm chứng ứng dụng/thiết bị ở client và server; lựa chọn cơ chế phù hợp từng store | Chưa có | Chưa có | Chưa có |
| Mã hóa giao tiếp đầu cuối | E2EE chat; giao thức quản lý/khôi phục khóa nhiều thiết bị | Chưa có | Chưa có | Chưa có |
| Thanh toán | Mua hàng/subscription, xác minh giao dịch, quyền sử dụng trả phí; SDK từng store | Chưa có | Chưa có | Chưa có |
| Tìm kiếm thông minh | Image embeddings; semantic/vector search; AI Memory Search; managed search và scale-out vector DB | Chưa có | Chưa có | Chưa có |
| AI thị giác nâng cao | Nhận diện địa danh bằng model; camera nhận diện vật thể/biển báo trực tiếp; nhận diện ổ gà/hư hỏng mặt đường | Chưa có | Chưa có | Chưa có |
| Offline hoàn toàn | Engine tính/tính lại tuyến offline; geocoding/tìm địa chỉ offline; chế độ du lịch nước ngoài đầy đủ | Chưa có | Chưa có | Chưa có |
| Chế độ di chuyển mới | Hiking; định tuyến giao thông công cộng/GTFS; EV routing có điểm sạc | Chưa có | Chưa có | Chưa có |
| Chuyến đi thông minh | Live Trip Room cộng tác realtime; Smart Departure; Route Quality Score; Road Comfort Mode; Walking Safety Mode | Chưa có | Chưa có | Chưa có |
| Khám phá và gắn kết | Best Time to Visit; Quiet Places; Travel Challenges; Trending Places | Chưa có | Chưa có | Chưa có |
| Creator và thương mại địa điểm | Creator Maps/guides; pipeline Curated Places; Paid Collections; Business Pages; Verified Place; Sponsored Places; Local Offers | Chưa có | Chưa có | Chưa có |
| Xe kết nối | OBD, đọc pin EV thật, tự nhận diện xe bằng Bluetooth; Eco Driving Score/Family Driving Report dựa trên dữ liệu xe | Chưa có | Chưa có | Chưa có |
| Uy tín cộng đồng | Mô hình uy tín người báo cáo; quy trình sửa thông tin địa điểm cộng đồng | Chưa có | Chưa có | Chưa có |
| Môi trường trên hành trình | Lớp chất lượng không khí trên bản đồ; cảnh báo ô nhiễm; tuyến có ngữ cảnh môi trường; cảnh báo chuyến đi theo thời tiết | Chưa có | Chưa có | Chưa có |
| Chứng thực lịch sử vị trí | Timestamp bên tin cậy; trang xác minh độc lập; log vị trí bất biến từ lúc ghi nhận, thay vì chỉ ký khi xuất | Chưa có | Chưa có | Chưa có |
| Chia sẻ và email | NFC share; referral có attribution; email cảnh báo đăng nhập; email recap hàng tháng | Chưa có | Chưa có | Chưa có |
| Vận hành và đo lường | Product analytics, funnels/cohorts/retention/feature adoption; session replay; A/B; remote config/kill switch; crash/ANR/performance monitoring và traces/dashboard tập trung | Chưa có | Chưa có | Chưa có |

Ghi chú:

- Firebase Auth, khóa sinh trắc và SecureStore hiện có không thay thế passkey/MFA/App Check.
- Play Integrity là cơ chế riêng Android; App Attest là cơ chế riêng Apple. Amazon cần thiết kế cơ chế phù hợp Fire OS, không mặc định dùng GMS.
- Backend đã có một số rate limit, cache, audit của kiểm duyệt và kiểm tra quyền. Dòng vận hành không có nghĩa toàn bộ backend không có log hoặc bảo vệ.
- OCR/classification/dHash và dữ liệu biển báo OSM/Mapillary đã có; chúng không thay thế model camera realtime hoặc semantic search.
- Có bộ tạo hash chain/chữ ký và CLI kiểm file xuất trong `locationProof.ts`/`verify-location-proof.cjs`. Phần còn thiếu là tính đáng tin của dữ liệu **trước khi xuất**, timestamp ngoài thiết bị và verifier web.

## 2. Có chức năng nhưng còn thiếu phạm vi — chung cho cả ba bản

| Chức năng hiện có | Phần chưa hoàn thiện |
|---|---|
| SOS, người thân, hàng đợi offline | Chưa có bằng chứng người nhận nhận được khi app đóng; cần kiểm identity/RLS và luồng gửi lại trên hai tài khoản. Mở dialer/SMS vẫn cần người dùng xác nhận. |
| Safety timer | Có countdown khi nghi sự cố; chưa có hẹn giờ an toàn chuyến đi do người dùng đặt kèm thông báo/escalation cho người thân. |
| Bất động/dừng bất thường | Có tối ưu GPS khi đứng yên và flow nghi té; chưa có workflow an toàn độc lập cho bất động hoặc dừng bất thường, có quy tắc và escalation. |
| Lệch tuyến/pin thấp | Đã tính lại đường và có GPS tiết kiệm pin; thiếu cảnh báo lệch hành trình cho người thân và chế độ pin thấp tự ưu tiên gửi vị trí/SOS. |
| Check-in/cảnh báo địa điểm/recap server | Client gọi `vc_create_checkin`, `vc_create_place_alert`, `vc_generate_trip_recap`; chưa thấy định nghĩa ba RPC này trong source backend/migrations đã rà. Cần đối chiếu server thật và kiểm người nhận; chưa kết luận server đang thiếu RPC. |
| Chia sẻ đến khi tới nơi | Có phiên LiveTrip/ETA; chưa xác nhận quyền chia sẻ server tự hết khi đến đích. |
| Vùng riêng tư/Ghost/trễ vị trí | Cổng lọc tọa độ đã áp dụng vào các đường presence chính; còn kiểm toàn app, đổi tài khoản, thu hồi quyền và hai thiết bị. SOS chủ động là luồng riêng. |
| Hẹn giờ/chia sẻ bằng link hoặc QR | Có mã kết bạn/scanner và helper URL; chưa đầy đủ QR chuyến đi/nhóm, resolver có phân quyền, TTL/revoke thực thi server và viewer. App Links/Universal Links có cấu hình điều kiện, cần kiểm triển khai thật. |
| Kho dữ liệu riêng/backup | Có AES-GCM, khóa thiết bị, thẻ khẩn cấp và xuất lịch sử mã hóa; chưa mã hóa toàn GPS DB/ảnh, restore backup, luân chuyển/khôi phục khóa và backup E2EE nhiều thiết bị. |
| Nhóm gia đình/bạn thân | Quản trị nhóm chat và danh sách bạn thân đã có; thiếu vai trò gia đình/quyền phụ huynh, preset bạn thân xuyên mọi loại nội dung. |
| Hồ sơ/feed | Có avatar riêng, follower/feed sự kiện và đánh giá; thiếu trang creator/public web profile hoàn chỉnh, feed khám phá/cá nhân hóa; cần kiểm hai tài khoản và ACL ảnh. |
| Tương tác cộng đồng | Có like/comment/RSVP/report/moderation; thiếu hỗ trợ thống nhất mọi media, ảnh bình luận/review đầy đủ, xác minh đã ghé thăm và event-map riêng. |
| Báo nguy hiểm đường bộ | Có TTL, xác nhận/phủ nhận và Wilson confidence; thiếu mô hình uy tín, kiểm abuse quy mô lớn và xác minh nguồn có thẩm quyền. |
| Lập chuyến đi | Có nhiều chặng và giờ dừng; chưa tối ưu toàn lịch trình, cộng tác tự merge hoặc gói chuyến đi offline đầy đủ. |
| Đồng bộ/xung đột | Có outbox, CAS, tombstone và lựa chọn thủ công; thiếu tự hợp nhất nội dung. Lịch background thực tế phụ thuộc OS và chưa nghiệm thu. |
| Bản đồ/tuyến offline | Có tile raster từ nguồn cho phép và lưu geometry/chỉ dẫn tối đa 20 tuyến; thiếu gói vector/tile/POI/trip đồng bộ đầy đủ và tính lại đường khi mất mạng. Nguồn tile phải cho phép tải offline. |
| Album/EXIF | Có nhóm tháng/địa điểm, OCR và ảnh tương tự; chưa tự phân đoạn/tạo album theo chuyến đi. Có native đọc/ghi EXIF nhưng chưa nối đầy đủ vào luồng nhập ảnh kỷ niệm. |
| AI chú thích/nhật ký/trợ lý | Có text AI và model local; chưa caption trực tiếp từ ảnh, planner dựa trên POI/thời tiết/giao thông đã xác thực, giải thích lựa chọn tuyến bằng AI hoặc tổng kết AI đầy đủ. |
| Voice navigation | Có STT tìm nơi và TTS đọc chỉ dẫn; chưa trợ lý hội thoại điều khiển dẫn đường. Cần engine/giọng tiếng Việt offline và QA từng thiết bị. |
| Cập nhật model | Có tải/import GGUF, kiểm hash và hủy; thiếu cập nhật model từ xa, resume tải qua restart và kiểm suy luận trên máy thật. |
| Xe/chi phí/bảo dưỡng | Có hồ sơ xe, đỗ xe, nhiên liệu/EV nhập tay và nhắc bảo dưỡng; thiếu cảnh báo mốc km tự động, telemetry thật và kiểm local notifications. Điểm lái hiện là heuristic GPS. |
| Chất lượng không khí | Có dữ liệu dự báo Open-Meteo/CAMS và backend cache/auth/rate limit; cần xác nhận cấu hình/gói production phù hợp, quan trắc OpenAQ và các lớp/cảnh báo ở mục 1. |
| Low Data Mode | Có cache, debounce và công tắc từng lớp; chưa có chế độ toàn app áp dụng thống nhất cho upload/video/map. |
| Backend/geospatial | Có nhiều RPC/Edge Functions; cần kiểm endpoint legacy và toàn vòng đời thật. Chưa có scale-out/index địa lý cho toàn nghiệp vụ. |

### Dữ liệu đường và trải nghiệm dẫn đường còn hạn chế

Các điểm sau áp dụng trên cả ba app dùng chung source, ngoài khác biệt phần cứng/quyền OS:

- **ETA:** có thời gian theo traffic lúc tính tuyến, nhưng một số flow dùng khoảng cách/tốc độ hoặc đường chim bay; chưa nhất quán traffic ETA và dự báo lịch sử.
- **Xe máy:** có provider profile; cần kiểm hạn chế xe máy tại Việt Nam và fallback từng provider.
- **Giao thông:** có flow tiles và jam/closed sections; chưa có lớp Incident Details riêng cho tai nạn/công trường. Cần kiểm tile trên máy thật và độ phủ.
- **Giới hạn tốc độ/biển báo:** có OSM/Mapillary và cảnh báo; chưa kiểm đầy đủ hướng hiệu lực, độ mới, độ phủ hoặc tự cập nhật giới hạn từ camera phía trước.
- **Làn đường:** có guidance khi provider trả; thiếu hình học từng làn/độ phủ đồng đều giữa provider.
- **Ảnh đường phố:** có ảnh/lịch sử Mapillary; chưa có trải nghiệm street-view liền mạch và bao phủ mọi đường.
- **Giá nhiên liệu:** có parser/UI giá tham khảo; chưa xác nhận feed live ổn định và giá thực từng trạm. Lỗi DNS ghi ở báo cáo cũ cần kiểm lại, không coi là kết luận hiện tại.
- **Đi bộ/xe đạp:** service có profile; UI và kiểm tuyến thực tế chưa thành trải nghiệm hoàn chỉnh.
- **An toàn ban đêm:** có chỉ dấu dữ liệu; chưa có mô hình đánh giá/định tuyến an toàn.

## 3. Có code, còn chờ cấu hình production hoặc nghiệm thu

| Chức năng | Android Google Play | Amazon Fire OS | iOS |
|---|---|---|---|
| Đăng nhập Google | Preview 40 mở được màn hình Google; chưa hoàn tất đăng nhập/token. Release chính cần kiểm OAuth/package/chữ ký tương ứng | Đang ẩn theo thiết kế no-GMS | Có source; chưa nghiệm thu đăng nhập trên iPhone |
| Email/password/guest và liên kết UID | Cần QA đầy đủ, collision/đổi tài khoản trên bản thực | Cần QA no-GMS | Cần QA bản iPhone |
| Phone OTP | Cần SMS thật/liên kết tài khoản | Còn chặn ở kiểm chứng SMS/reCAPTCHA no-GMS | Cần SMS thật/liên kết tài khoản |
| Magic link | Cần Hosting/App Links/callback | Cần Hosting/App Links/callback | Cần Hosting/Universal Links/callback |
| Push khi app đóng | Code client/registry/backend có; cần cấu hình, deploy và kiểm giao nhận | ADM cần SDK compile, cấu hình và thiết bị thật | Cần APNs/entitlement, cấu hình và thiết bị thật |
| Chat/voice/video/group call/PTT | Có code; chưa QA gửi nhận/gọi hai máy và báo cuộc gọi khi app đóng | Tương tự, thêm ADM/no-GMS | Tương tự, thêm APNs/lifecycle iPhone |
| Gateway Cloudflare/provider | Source gateway xác thực/quota/allowlist và scanner đã có; chưa ghi nhận triển khai/health/provider thật của phiên bản mới, Preview thiếu base URL production | Dùng cùng gateway; cần cấu hình và kiểm Fire | Dùng cùng gateway; cần cấu hình và kiểm iPhone |
| GPS khóa màn hình/reboot, geofence, té/va chạm | Có native/source; cần kiểm quyền, pin, reboot, chuyển app và đường thực tế | Cần cold start/recorder/provider vị trí thật và giới hạn ở mục 4 | Cần build native và kiểm iPhone; motion nền giới hạn ở mục 4 |
| Camera/media/recap/OCR/STT/TTS/AI | Có code; cần kiểm native, chất lượng và lifecycle trên máy thật | Cần kiểm thiết bị/engine/cảm biến sẵn có | Có source Swift/Vision/AVFoundation; chưa compile và QA bản hiện tại |
| Widget/shortcut/trạng thái ongoing | Có code; cần kiểm launcher, quyền và lifecycle | Phụ thuộc launcher; fallback trong app | Có widget/AppIntent/Live Activity; cần build, entitlement nếu áp dụng và QA |
| Quảng cáo | App/ad-unit IDs đã cấu hình; Preview dùng test ads; chưa kiểm inventory thật, consent/no-fill | Đang tắt, chưa có provider no-GMS được nghiệm thu | IDs có; chưa kiểm inventory, consent/ATT/no-fill trên iPhone |
| Bản phát hành | Có APK Preview; chưa chứng minh bộ release ký cuối cùng cùng commit | Có unsigned fixture build, chưa APK production được nghiệm thu | Cần macOS/Xcode, Podfile.lock, archive/signing và IPA |

Người dùng đã cho biết secret server được đưa lên Cloudflare. Bảng trên chỉ nói **chưa có bằng chứng kiểm nhận phiên bản gateway hiện tại**; không kết luận tài khoản Cloudflare chưa có Worker hoặc secret. Tương tự, repo ghi nhận một số Edge Functions LiveKit/environment từng deploy và probe đạt; điều đó chưa chứng minh toàn app production hoạt động đầy đủ.

## 4. Phần riêng từng nền tảng và các giới hạn có chủ đích

| Nền tảng | Mục còn thiếu hoặc giới hạn |
|---|---|
| iOS | **CarPlay** có source nhưng đang tắt, cần entitlement/provisioning rồi nghiệm thu. |
| iOS | **CoreMotion giám sát té/va chạm nền** chưa đạt tương đương Android; hiện chỉ cam kết foreground. Quyền background location không bảo đảm motion chạy liên tục. |
| iOS | **Apple Watch** có source, chưa kiểm ghép đôi/WatchConnectivity và SOS xác nhận trên iPhone. Apple sign-in/Game Center có source, chưa QA trên máy thật. |
| iOS | **Control Center controls**, CallKit/PushKit chưa triển khai. iOS visits/significant-change chưa nối use case; Spotube không có launcher/client native tương ứng Android. |
| Android | **Android Auto/Wear OS** có source; Wear Kotlin compile đã đạt, chưa kiểm Data Layer/head unit/đồng hồ thật và phân phối. Full-screen incoming call intent chưa triển khai. |
| Android | Google sign-in và Gemini Nano phụ thuộc dịch vụ/phần cứng tương thích; không suy từ việc bật Firebase provider rằng mọi APK đã cấu hình OAuth đúng. |
| Amazon | **Quảng cáo đang tắt**; chưa có provider no-GMS được thiết kế/nghiệm thu. IDs AdMob Android hiện dùng cho bản Google, không có quảng cáo hoạt động trên Fire. |
| Amazon | **Geofence nền** chỉ được đánh giá khi GPS recorder opt-in chạy; nếu tắt recorder chỉ có watcher foreground. Chưa có passive geofence service độc lập. |
| Amazon | **Google sign-in, Nano, Wear/Auto** không hỗ trợ theo thiết kế hiện tại. Dùng email/guest, UID đã liên kết và GGUF khi phần cứng đủ điều kiện. |
| Amazon | STT/TTS, dialer, GPS, barometer/widget tùy thiết bị/launcher; cần kiểm Fire thật. Thiếu engine/phần cứng phải hiển thị không hỗ trợ. |

Các mục riêng hệ điều hành không mặc định là lỗi cần đưa lên cả ba store. Chi tiết quyết định hiện hành: [EXCEPTIONS.md](EXCEPTIONS.md).

## 5. Thứ tự cần hoàn tất trước khi xem là sẵn sàng phát hành

1. Hoàn tất đăng nhập tài khoản thật và liên kết UID; đối chiếu RPC/backend legacy; kiểm riêng tư/chia sẻ/chat/SOS bằng hai tài khoản.
2. Cấu hình public gateway URL đúng profile, triển khai/kiểm health phiên bản Worker và gọi provider qua token đăng nhập; xác nhận quota/429/401. Không đưa secret vào bundle.
3. Hoàn tất APNs/FCM/ADM và kiểm push/cuộc gọi/SOS khi app đóng. Foreground polling không thay thế kết quả này.
4. Build iOS trên macOS; kiểm Android/Fire/iPhone thật, GPS nền/reboot/quyền/pin, AI/speech/media và thiết bị companion.
5. Tạo đủ năm artifact release từ cùng commit, qua gates/chữ ký; xác nhận cấu hình quảng cáo/consent và xử lý các khóa lịch sử cần xác minh/restrict/rotate theo BUILD.md. Đây là công việc phát hành, tách khỏi danh sách feature chưa có.

## Nguồn đối chiếu

- [PARITY_PROGRESS.md](PARITY_PROGRESS.md), [PARITY_NOTES.md](PARITY_NOTES.md), [EXCEPTIONS.md](EXCEPTIONS.md), [MANUAL_TEST_CHECKLIST.md](MANUAL_TEST_CHECKLIST.md).
- [FEATURE_PROVIDER_PROGRESS_2026_10_08.md](FEATURE_PROVIDER_PROGRESS_2026_10_08.md): danh mục rộng; dùng sau khi đối chiếu với checkpoint mới. Các dòng cũ về push/API key protection/iOS tạm hoãn không đại diện trạng thái hiện tại.
- [package.json](../package.json), [extensionPreferences.ts](../src/services/extensionPreferences.ts), [geoGateway.ts](../src/services/geoGateway.ts), [Worker](../cloudflare/geo-gateway/src/index.ts).
- [smartFeatures.ts](../src/services/smartFeatures.ts), [offlineRoutes.ts](../src/services/offlineRoutes.ts), [offlineMap.ts](../src/services/offlineMap.ts), [tripPlanner.ts](../src/services/tripPlanner.ts), [liveTripShare.ts](../src/services/liveTripShare.ts).
- [locationProof.ts](../src/services/locationProof.ts), [CLI verifier](../scripts/verify-location-proof.cjs), [deviceAi.ts](../src/services/deviceAi.ts), [airQuality.ts](../src/services/airQuality.ts).
- [pushRegistration.ts](../src/services/pushRegistration.ts), [notificationDelivery.ts](../src/services/notificationDelivery.ts), [push backend](../supabase/functions/mymap-push/handler.ts), [calls.ts](../src/services/calls.ts).
- [iOS safety](../modules/my-map-safety/ios/MyMapSafetyModule.swift), [native tracking/safety](../plugins/native), [iOS companions](../modules/my-map-ios/ios), [Wear](../companions/wear), [Watch](../companions/watch).

Các extension mặc định tắt để người dùng chủ động bật. Việc tắt công tắc không tự chứng minh chức năng chưa triển khai. SQLite dùng chung hiện có cũng không bị tính là thiếu chỉ vì catalog từng đề xuất Room/Core Data.

Báo cáo này không sửa tính năng, không build lại ứng dụng, không thay đổi cấu hình production và không chứa giá trị secret.
