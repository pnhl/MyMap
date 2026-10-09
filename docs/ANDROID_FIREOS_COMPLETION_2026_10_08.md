# MyMap Android / Fire OS — bản tiếp tục 08/10/2026

**Cập nhật hotfix:** build 35 có lỗi crash khởi động WebRTC, đã tái hiện ở cả Google/Amazon. Source mới là 1.0.4 / build 36; xem [báo cáo sửa crash và xác minh APK thay thế](ANDROID_FIREOS_STARTUP_CRASH_BUILD36_2026_10_08.md). Chi tiết triển khai tính năng trong đợt build 35 dưới đây được giữ làm lịch sử; không cài APK build 35.

Mã nguồn 1.0.3, Android versionCode 35. Phạm vi hiện tại là Android và Fire OS; iOS tạm hoãn. UI, nghiệp vụ, dịch vụ và hàng đợi dùng React Native/Expo. Kotlin xử lý quyền, cảm biến, Keystore, speech hệ thống, ML Kit/AICore và checksum file lớn. Không đưa thêm runtime Flutter vào ứng dụng RN đang có.

**Chưa hoàn tất toàn bộ catalog.** Đã cập nhật đủ 296 dòng, giữ cả dòng lặp: 32 có luồng cơ bản, 166 đã triển khai một phần, 76 chưa triển khai, 22 tạm hoãn iOS. Đây là phân loại theo code/phạm vi từng dòng, không phải tỷ lệ sẵn sàng phát hành. Các tính năng provider không tự trở thành tính năng MyMap.

- [Bảng đối chiếu từng tính năng](FEATURE_PROVIDER_PROGRESS_2026_10_08.md).
- [Danh sách đầy đủ phần còn lại cho Android/Fire OS](ANDROID_FIREOS_REMAINING_2026_10_08.md).
- [Bản kiểm kê trước đợt triển khai](FEATURE_PROVIDER_AUDIT_2026_10_08.md).

## Phần đã bổ sung hoặc hoàn thiện trong đợt tiếp tục

| Luồng | Đã triển khai | Giới hạn cần giữ rõ |
|---|---|---|
| Cuộc gọi | LiveKit thoại/video/nhóm; giữ để nói; chủ cuộc gọi/chủ nhóm mới kết thúc cho mọi người; kiểm lại quyền; giải phóng mic/camera/audio khi blur/nền/đổi tài khoản | Chưa gọi thử trên 2 thiết bị, push cuộc gọi, background call hoặc E2EE |
| Máy chủ gọi | Khóa LiveKit lưu trong Supabase Secrets; Edge Function phát token 120 giây theo room/membership; cron mỗi phút dọn phòng với lease/retry và giới hạn quyền | RoomService API đã trả 200 nhưng chưa thử vòng đời phòng có người đang gọi |
| Nhóm chat | Mời/chấp nhận/hủy mời, đổi tên, chuyển chủ, xóa thành viên, rời nhóm; thay đổi thành viên/chặn làm đóng cuộc gọi cũ | Chưa phân quyền gia đình; chưa E2EE/push |
| Tin nhắn | Outbox gửi lại/hủy/thu hồi bền vững; JWT cố định theo tài khoản cho đọc/gửi/Storage; chặn gửi ảnh/âm thanh sang phòng vừa chuyển | Cần QA media và race conditions trên thiết bị thật |
| Bạn bè | Chặn/bỏ chặn, bạn thân, theo dõi/bỏ theo dõi hồ sơ opt-in, số follower, chia sẻ mã hồ sơ, feed sự kiện/đánh giá, mở đúng nội dung công khai | Chưa public profile/creator page đầy đủ; chưa preset Close Friends cho mọi loại nội dung |
| Cộng đồng | Like, bình luận/xóa theo quyền, RSVP; báo cáo nội dung, queue kiểm duyệt, lý do quyết định/audit, lọc nội dung bị gỡ/chặn | Đã cấp quyền kiểm duyệt cho lphan7138@gmail.com sau xác minh Firebase; client không tự cấp quyền |
| Hồ sơ | Tên/bio/avatar đồng bộ theo tài khoản; offline queue/revision; JPEG 512 px không mang EXIF gốc, Storage riêng tối đa 2 MB, signed URL 60 giây; chỉ owner sửa/xóa, bạn được chấp nhận hoặc hồ sơ public mới đọc | Signed URL đã cấp có thể còn dùng tới khi hết hạn; ảnh đã tải trên máy không thể thu hồi từ xa; chưa thử Storage HTTP và hai máy |
| Đường cộng đồng | Bỏ phiếu xác nhận/không còn, Wilson lower bound; null khi chưa có phiếu; hết hạn/chặn/kiểm duyệt được lọc khi refresh | Đây là dữ liệu cộng đồng chưa xác minh; chưa reputation chống lạm dụng |
| Lái xe | Lọc GPS không hợp lệ, tăng/giảm tốc mạnh, dừng, điểm êm theo ngày | Heuristic từ GPS; chưa telemetry xe, kết luận tai nạn hoặc đánh giá an toàn đã được xác thực |
| Tuyến ngoại tuyến | Lưu tối đa 20 gói geometry/cue mã hóa theo tài khoản; xem geometry và GPS trong WebView không mạng | Chưa tile/POI package, tính đường hoặc đổi tuyến ngoại tuyến |
| Tìm giọng nói | On-device SpeechRecognizer API 31+, kiểm engine, timeout/cancel theo lifecycle; không fallback server | Phụ thuộc engine/ngôn ngữ cài sẵn, nhiều máy Fire OS có thể không hỗ trợ |
| AI trên thiết bị | ML Kit Prompt/Gemini Nano trên Android có AICore; llama.rn GGUF CPU cho Android/Fire OS 64 bit; trợ lý văn bản, chú thích, nhật ký và từ khóa tìm địa điểm | Nano không chạy trên mọi Android; GGUF cần RAM/dung lượng; chưa suy luận trên thiết bị thật; chưa embeddings, semantic search hoặc vision captions |
| AI trong nội dung | Kỷ niệm và nhật ký có nút tạo gợi ý từ văn bản do người dùng kiểm tra; xem trước rồi dùng trong bản nháp | Không tự đọc ảnh, tự lưu hay tự đăng; kết quả mô hình nhỏ có thể sai |
| Model AI | Người dùng bấm tải Qwen 0.5B Instruct Q4_K_M ~469 MiB theo commit chính thức, kiểm kích thước và SHA-256 streaming native; hoặc nhập/xóa GGUF <750 MiB; hủy khi nền/blur | Không kèm weights trong APK; chưa cập nhật từ xa hoặc resume sau restart; model ngoài do người dùng chọn phải có giấy phép phù hợp |
| Không khí | Open-Meteo/CAMS current/hourly forecast, PM2.5/PM10/NO2/O3/CO/SO2, AQI và đơn vị/timestamp/nguồn; chọn GPS/địa điểm đã lưu; API auth, cache/rate limit/coalescing | Production chưa có quyền sử dụng thương mại; chưa dữ liệu trạm OpenAQ, layer map, cảnh báo hoặc route context |

Các tiện ích mở rộng mới có công tắc và **mặc định tắt** trong Cài đặt: calls, socialTools, communityTools, drivingInsights, offlineTrips, voiceSearch, deviceAi, airQuality. Tắt tiện ích ngăn gọi chức năng; AI/cuộc gọi/speech dừng theo lifecycle. Model tải về được giữ riêng trên thiết bị tới khi người dùng xóa.

## Cấu hình và dịch vụ đã áp dụng

Supabase project đang dùng: `uwlxysystowwnfvdmfzo`.

Migrations đã áp dụng: `android_social_completion`, `android_livekit_calls`, `android_call_scheduler`, `android_community_review`, `android_call_controls`, `android_environment_access`, `android_profile_avatars`, `android_profile_identity_compat`. Source nằm trong `supabase/features/`; test SQL sử dụng transaction rồi rollback, không giữ tài khoản QA.

Edge Functions đã triển khai: `mymap-livekit` v2, `mymap-call-maintenance` v4, `mymap-environment` v1. Gateway JWT verification tắt cho các hàm này vì LiveKit/environment tự xác minh Firebase RS256/issuer/audience, còn maintenance kiểm chứng scheduler trước khi dùng service role. Client không được chọn room tùy ý hay cấp quyền quản trị LiveKit.

Cron `mymap` dọn cuộc gọi mỗi phút đã có phản hồi HTTP 200. LiveKit URL/API key/API secret nằm trong Supabase Secrets, không ở EXPO_PUBLIC hoặc APK. Tệp credentials tạm `.local/livekit-deploy.env` đã được xóa. [Ảnh xác nhận Secrets](../.local/livekit-secrets-configured.jpg) chỉ có tên/digest.

Tài khoản Firebase Google `lphan7138@gmail.com` đã xác minh email, đối chiếu đúng UID/canonical identity rồi cấp `private.mm_moderators`. Probe vai trò và đọc queue theo identity này đạt, không đọc nội dung báo cáo. Khi bật Cài đặt → Tiện ích mở rộng → Cộng đồng và bạn thân (socialTools), tài khoản này thấy mục kiểm duyệt. Không cấp quyền quản trị Supabase/Firebase console.

## Kiểm tra đã đạt

- `npm run typecheck`: đạt.
- `npm test`: **303 bài đạt, 0 lỗi**; gồm ACL logic, account switch, outbox cancellation/retry, avatar ownership/orphan cleanup, AI disabled/cancel/download checksum và environment auth/cache.
- SQL thực thi trên dự án rồi rollback: `catalog-rls.sql`, `android-social-rls.sql`, `android-community-rls.sql`, `android-avatars-rls.sql`, `android-profile-identity-rls.sql` đạt. Test avatar kiểm predicate/policy quyền xóa; không xóa object thật bằng SQL vì Storage yêu cầu API.
- Deno check các hàm gọi, maintenance, environment: đạt.
- `compileGoogleDebugKotlin`, `compileAmazonDebugKotlin`, manifest hai flavor và CMake runtime AI arm64/x86_64: đạt trước bổ sung checksum; checksum native và code cuối cùng đã compile trong release build 35 cho cả hai flavor.
- Metro export Android/Hermes: đạt trước sửa cố định phiên catalog/chat; bundle release/Hermes của source cuối cũng đã đạt trong build 35.
- HTTP production không có Authorization: ba Edge Function mới trả **401**.
- `npm audit`: 34 cảnh báo dependency (9 moderate, 25 high, 0 critical); chưa khắc phục toàn bộ, không dùng `--force` đổi SDK.
- Supabase advisors đã đọc security/performance; vẫn có cảnh báo tồn tại, không coi là chứng nhận an toàn/phát hành.

**Chưa có thiết bị/emulator kết nối để QA.** Chưa thử mic/camera/cuộc gọi 2 máy, nhập/tải/suy luận GGUF, AICore tiếng Việt, quyền nền/kill app/Fire OS, render màn hình hoặc GPS ngoài đường. Tests/mock/compiler không thay các kiểm tra này.

Windows release gặp thiếu STL trong Expo native; script dependency patch nay liên kết rõ `c++_shared` cùng loại STL với RN, không trộn static runtime. Lỗi này không liên quan dữ liệu bản đồ.

## APK và build

Build 34 (1.0.2) là bộ cài cũ và không chứa các bổ sung này. Build 35 (1.0.3) đã tạo/ký và kiểm manifest, chữ ký, checksum, Hermes, ZIP alignment cùng 41 thư viện ELF ARM64 mỗi APK (16 KiB alignment). Cả hai flavor có ARM32 + ARM64. [APK và kết quả đóng gói](APK_BUILD35_ANDROID_FIREOS_2026_10_08.md). Chưa QA thiết bị.

```powershell
$env:RNLLAMA_SKIP_POSTINSTALL = '1'
npm ci
npm run prepare:android
npx expo prebuild --platform android --no-install
npm run typecheck
npm test
.\scripts\build-release.ps1 -Channel both -Architectures 'armeabi-v7a,arm64-v8a' -OutputDirectory 'dist/releases/build-35'
```

`prepare-android-ai.cjs` chỉ tải artifact Android đúng phiên bản/hash; không tải artifact iOS. Cần JDK 21, Android SDK/NDK và bộ ký riêng `.signing`. Proguard giữ JNI llama và API auth widget; Kotlin 2.3.20 được cấu hình qua plugin để tương thích metadata của ML Kit Prompt. Min SDK app vẫn 24; nhánh Nano chỉ được gọi từ API 26 và khi có AICore, Amazon không đóng gói Prompt SDK.

## Phần phải làm tiếp

1. **QA phần vừa triển khai:** hai tài khoản/hai máy Android + một máy Fire OS, tất cả case nền/blur/đổi tài khoản/hủy/rút quyền; test GPS trên đường, microphone/camera/audio và model AI thực tế. Kiểm APK không đủ để tuyên bố phát hành.
2. **Cấu hình:** moderator đã cấp đúng tài khoản chủ app chỉ định; còn quyền sử dụng Open-Meteo phù hợp; FCM/ADM delivery/server nếu triển khai push. Không tự cấp moderator hoặc biến private key thành biến môi trường client.
3. **Chưa có:** Passkeys/MFA, E2EE chat, app integrity/App Check, push/orchestration, hệ thống analytics/remote config/crash/ANR/traces, security email/monthly email, App Links/NFC/referral, live trip room/route quality/road comfort/walking safety/quiet places, creator/business/paid collections, eco/family driving, embeddings/vector/semantic search, pothole AI, offline routing/travel package đầy đủ, trusted timestamp/immutable audit, reputation/place corrections, môi trường trên map/cảnh báo, EV routing/public transport/hiking, Bluetooth car/billing. Danh sách từng dòng nằm trong báo cáo phần còn lại.
4. **Phần có sẵn chưa hoàn thiện:** ngoài các giới hạn bảng trên, kiểm lại luồng map/traffic/lane/sign/Mapillary/VietFuel/ads/music/tracking/SOS trên bản ký mới; quota, dữ liệu thực và hỗ trợ địa bàn do provider quyết định. Không tự suy đoán lane, tốc độ tối đa, giá AdBlue hoặc dữ liệu kẹt xe khi nguồn không cung cấp.
5. iOS giữ source hiện có nhưng không build/triển khai/QA ở giai đoạn này. Flutter không được thêm để tránh hai UI/runtime trong một app RN; có thể đánh giá module riêng khi có nhu cầu cụ thể.

## Giấy phép và cảnh báo dịch vụ

[Open-Meteo Terms](https://open-meteo.com/en/terms) quy định free endpoint chỉ phi thương mại; app có quảng cáo thuộc sử dụng thương mại. Environment production vì vậy trả lỗi cấu hình nếu chưa có `OPEN_METEO_API_KEY` hợp lệ hoặc khai báo mục đích phi thương mại thực sự. Không tự đặt cờ phi thương mại cho app có quảng cáo. Weather provider cũ vẫn cần rà soát/chuẩn hóa quyền sử dụng trước phát hành; thêm edge mới không tự sửa tất cả luồng weather cũ.

[Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) cung cấp dự báo CAMS; UI ghi forecast và nguồn/attribution, không coi là số đo trạm hoặc chất lượng chính xác ở từng ngõ.

[ML Kit Prompt Android](https://developers.google.com/ml-kit/genai/prompt/android/get-started) phụ thuộc AICore/thiết bị tương thích. [llama.rn](https://github.com/mybigday/llama.rn) là runtime cục bộ; [model Qwen chính thức](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/blob/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf) khai báo Apache-2.0. Không hứa chất lượng/speed của model trước khi test máy đích.

Supabase security advisors vẫn báo [security-definer RPC được gọi bởi anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) và [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Những RPC này phục vụ Firebase custom identity, có server ACL/trusted request guard; không thu hồi hàng loạt vì sẽ phá app. Cần tiếp tục kiểm từng RPC. [RLS không có policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) ở một số bảng private/RPC-only là cơ chế từ chối raw access, không tự mở policy. Còn [extension trong public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) và [Supabase leaked-password setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); Firebase hiện là auth chính.

Performance advisors còn [foreign key thiếu index](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [index chưa có usage](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) và [nhiều policy permissive](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies). Chưa tự xóa index/policy hoặc thay đổi toàn schema theo gợi ý mà chưa đối chiếu tải thực tế.
