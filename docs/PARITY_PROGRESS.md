# Tiến độ parity — 10/10/2026

Quy ước: DONE-VERIFIED có bằng chứng tự động trong phạm vi ghi rõ; DONE-UNVERIFIED có code nhưng chưa nghiệm thu thiết bị; BLOCKED cần đầu vào bên ngoài. Không dùng credential thật trong lượt này, không tải lên cửa hàng.

| Cụm | Trạng thái | Bằng chứng / còn lại |
|---|---|---|
| L1 kiểm nguồn gộp | DONE-VERIFIED | Git chứa module my-map-ios, Swift speech/AI, widgets, Watch, Android plugins/native, Wear. Phase 0 là ảnh chụp trước khi gộp. |
| L1 pipeline 5 artifact | DONE-UNVERIFIED | Có năm profile, release-set assembler và fingerprint embedded/sidecar; tests inputs/assembler đạt. Android locks đã resolve; Pod lock còn BLOCKED. Chưa có bộ 5 artifact. |
| L2 artifact gates | DONE-UNVERIFIED | 10 test Python đạt; DEX startup methods có code, ELF64 và ZIP 16KB đạt trên Fire unsigned fixture sau R8. Chưa có năm artifact ký cùng commit. |
| L3 chín finding | DONE-UNVERIFIED | Xem PARITY_NOTES.md; không dùng APK build 36 làm bằng chứng build mới. |
| L4 hợp đồng và chức năng | DONE-UNVERIFIED | Kiểm theo ma trận phase 0; ADM cần SDK/credentials, các luồng native cần thiết bị. |
| L5 kiểm thử/tài liệu | DONE-UNVERIFIED | Cập nhật kết quả sau từng cụm; QA máy thật chưa chạy. |
| Ký/5 artifact production | BLOCKED | Cần macOS/Xcode, cấu hình EAS và signing được chủ dự án sử dụng trong phiên riêng. Lượt này cấm dùng credential thật. |
| Push production | BLOCKED | Cần ADM/FCM/APNs credentials, entitlement, triển khai backend và hai thiết bị kiểm nhận. |
| CarPlay | BLOCKED | MYMAP_ENABLE_CARPLAY=false cho đến khi có entitlement/provisioning. |
| Native locks | DONE-UNVERIFIED / BLOCKED iOS | Gradle app/Wear locks/checksums đã resolve; strict compile hai store/Wear và Fire unsigned R8 đạt Windows. Google full release/host khác còn chờ; Podfile.lock cần macOS. |
| Secret lịch sử | BLOCKED | Scanner đọc 666 blobs: 5 phiên bản cũ của .github/workflows/build-firebase-xctest-ios.yml có chuỗi Firebase API key. Source hiện tại sạch. Chủ dự án cần xác minh/restrict/rotate nếu là key thật; không tự rewrite Git history. |

Checkpoint đầu: HEAD trước thay đổi `19bc57de585a8e452ca8f590c19fd0817ebabc55`, source sạch. Các test cũ không được tự động coi là nghiệm thu yêu cầu mới.

## Bằng chứng cập nhật

- Lint/typecheck đạt; **345 Node tests và 10 Python gate tests đạt**, gồm linking UID/races, push registry/ADM/lease trên Postgres PGlite, warm push taps, snapshots/reducer, Fire geofence ownership, EAS per-store staging, ad config, release manifest, DEX defined methods và ELF alignment. Test fixture không phải signed artifact.
- Google/Fire native Kotlin gồm geofence recorder và native no-GMS boundary tests đã chạy trong source fixtures Firebase giả: mỗi store 2 JVM tests, không failures. Strict dependency verification compile đạt cả hai. Merged manifests: Fire 24 và Google 32 uses-permissions, allowBackup=false và đủ backup rules; Fire không còn GMA/FCM initializer. Compile không cần .env/keystore.
- Fire đã build APK **Release unsigned** với Firebase giả, R8/resource shrink và strict verification, arm64-v8a. APK SHA-256 `9f6a3902fd2d1100abd172b077e48c5008fdc7227965996dc89e926a4171411d`; DEX startup method definitions có code, mọi ELF64 PT_LOAD đạt 16 KB, zipalign -P16 đạt. Scanner đọc 1556 files, 7 framework constants, 21 Spotube loopback matches, không phát hiện executable dev route. Gate production từ chối APK vì chưa ký, đúng thiết kế. Không dùng APK này phát hành.
- Bundle **Hermes bytecode trích từ Fire APK fixture** và bundle output Google có cùng SHA-256 `f7837f889cb10ef16156596ca9e79049ff61118de9bc3b91fe692eae74982070`, magic `c61fbc03c103191f`. Chưa phải chứng cứ hash của hai APK ký cuối. Fixture lấy source đang làm việc; commit cuối vẫn phải rebuild.
- Wear compileReleaseKotlin với locks/checksums strict đạt, không ký; chưa nghiệm thu Data Layer trên đồng hồ. Windows CXX dùng staging path ngắn; JVM Gradle 4 GB để R8 tránh GC thrash. R8 hiện báo stack-map warnings từ Amazon SDK/Google Auth; cần QA và xem lại khi nâng R8.
- Source secret scan đạt; lịch sử vẫn có 5 blobs chưa xác minh như ghi trên. Không in secret, không rewrite history.
- Chưa có iOS Swift/Xcode compile, iPhone/Fire cold start, ADM SDK compile, real push hoặc năm artifact cùng commit. Không nâng toàn tính năng lên VERIFIED từ unit test.

## Ma trận 42 tính năng sau hợp nhất

Mã trạng thái: **V = DONE-VERIFIED** chỉ trong phạm vi test nêu ở cột cuối; **U = DONE-UNVERIFIED** có đường thực thi nhưng cần QA; **B = BLOCKED** cần hạ tầng/thiết bị/credential; **E = ngoại lệ** có ID tại EXCEPTIONS.md. U không đồng nghĩa release-ready. Các adapter/source được xác minh có trong repo; không dùng từ “Thiếu” không giải thích.

| Tính năng | iOS | Google | Fire | Bằng chứng / điều kiện |
|---|---|---|---|---|
| 1 MapLibre/search/navigation | U | U | U | MapLibreNativeMap, roadRouting; GPU/network |
| 2 Offline maps/routes | U | U | U | offlineMap/offlineRoutes, dữ liệu tải trước |
| 3 GPS foreground | U | U | U | CoreLocation/system LocationManager, provider capability |
| 4 GPS khóa màn hình | U | U | U | Controller/persistence + PlatformTrackingService; cần vị trí thật |
| 5 Reboot/update restore | U | U | U | iOS lifecycle; Android Boot/tile nối recorder thật, quyền/FGS check |
| 6 SOS chủ động/offline/replay | U | U | U | State/delivery contract V bằng tests; recipient receipt chưa có |
| 7 Emergency dialer | U | U | U/E5 | Native resolve/canOpenURL; tablet vẫn SOS vị trí |
| 8 Va chạm/té foreground | U | U | U/E5 | CoreMotion/SensorManager, native thresholds cần thực địa |
| 9 Va chạm/rơi/5 phút nền | E1 | U | U/E5 | iOS foreground-only; thiếu barometer không giả kết quả |
| 10 Geofence | U | U | U/E2 | Fire native recorder + queue, watcher khi foreground; không passive service riêng |
| 11 SQLite/photos/timeline | U | U | U | Shared DB/owner; upgrade chưa nghiệm thu |
| 12 Camera/video/micro | U | U | U/E5 | Request theo thao tác/phần cứng |
| 13 Offline queue/sync | U | U | U | JS integration tests V trong phạm vi database; OS scheduling U |
| 14 Friends/privacy/location share | U | U | U | RLS/Firebase UID; hai tài khoản QA |
| 15 Chat | U | U | U | privateChat + inbox, backend production QA |
| 16 LiveKit/WebRTC | U | U | U | calls/token/room; chưa gọi thật |
| 17 Closed-app call/chat alerts | B | B | B | APNs/FCM/ADM credentials, deployment và device delivery |
| 18 Local notifications | U | U | U | Quyền notification/provider OS |
| 19 Remote push | B | B | B | Registry/client/backend code V bởi mocked/PGlite tests; ADM SDK chưa compile |
| 20 Email/password/guest | U | U | U | Firebase Auth retained; no-GMS Fire auth QA |
| 21 Google sign-in | U | U | E4 | Facade/GMS boundary V; Fire ẩn |
| 22 Phone OTP + link | U | U | B | Link UID V tests; cần SMS/reCAPTCHA Fire thực tế |
| 23 Apple sign-in + same UID | U | U | U | Native Apple chỉ iOS; email/phone linked portable; collisions V |
| 24 Game Center | U | E4 | E4 | Apple provider capability; email portable |
| 25 Magic link | B | B | B | Sender/callback có; cần Hosting/Universal/App Links, ẩn nếu thiếu |
| 26 App lock/device PIN fallback | U | U | U | Capability precheck; device credential native, thay credential cần QA |
| 27 Vault/device signing | U | U | U | Keychain/KeyStore; không claim toàn SQLite encrypted |
| 28 Moment widget | U | U | U/E4 | Owner/filter/TTL/deeplink/reset; Fire launcher capability |
| 29 Live Activity/ongoing state | U | U | U | TrackingSnapshot start/update/end/restore/error, không tọa độ nhạy cảm |
| 30 Shortcut/tile | U | U | U/E4 | AppIntent mở xác nhận; tile nối recorder, Fire in-app fallback |
| 31 Watch/Wear | U | U | E4 | Version chung; Data Layer signer/thiết bị chưa nghiệm thu; không dùng Wear artifact cũ làm bằng chứng |
| 32 CarPlay/Auto | B | U | E4 | CarPlay flag false chờ entitlement; NavigationSnapshot chung |
| 33 GGUF/rnllama | U | U | U/E5 | Native hardware/hash/stop, model hash tests; RAM/ABI/hardware |
| 34 System AI | U/E5 | U/E5 | E4 | FoundationModels/Nano capability; không tự fallback khi lỗi |
| 35 OCR/labels | U | U | U | Vision/ML Kit bundled, Fire không mạng cần QA |
| 36 Offline speech | U/E5 | U/E5 | U/E5 | Swift API/VoiceSearchButton chung; thiếu recognizer nhập chữ |
| 37 TTS | U/E5 | U/E5 | U/E5 | Voice installed/provider capability |
| 38 Recap/export/cancel/share | U | U | U | RecapRequest chung, AVFoundation/Media3, ownership trước/sau/cancel |
| 39 Music/background audio | U | U | U | Playback opt-in, không dùng audio giữ safety service |
| 40 Spotube loopback | E6 | U/E6 | U/E6 | WebSocket giữ nguyên, scanner phân loại riêng |
| 41 Ads | U | U | E3 | Config/guards V; real inventory/consent/no-fill U, Fire native/facade off |
| 42 iOS visits/significant changes | E7 | E7 | E7 | Không use case rõ nên không gọi là parity |

## Chín finding

| # | Finding | Trạng thái | Bằng chứng / còn lại |
|---|---|---|---|
| 1 | AdMob test/wrong platform | DONE-VERIFIED config; DONE-UNVERIFIED release | Real IDs đã cung cấp, sample/wrong unit tests chặn; chưa IPA/APK cuối |
| 2 | Widget debug dylib | DONE-UNVERIFIED | Root cause expo-widgets Release -Onone đã sửa bằng build settings; recursive gate/tests; cần Xcode artifact |
| 3 | allowBackup | DONE-VERIFIED merged manifest; DONE-UNVERIFIED artifact | false + cloud/device-transfer five-domain excludes; cần APK/AAB guard thật |
| 4 | Android permissions | DONE-VERIFIED merged hai store; DONE-UNVERIFIED full release | Badge/storage/overlay/activity loại, Bluetooth cho WebRTC; whitelist Nano sửa theo manifest; ADM quyền conditional |
| 5 | Ba mô tả vị trí | DONE-VERIFIED config; DONE-UNVERIFIED IPA | Vietnamese final plugin + negative plist tests |
| 6 | Background modes/fetch | DONE-VERIFIED config; DONE-UNVERIFIED IPA | Final modifier sau plugins giữ location/audio/processing/remote-notification, loại fetch; behavior review notes |
| 7 | Firebase plist flags | DONE-VERIFIED policy; DONE-UNVERIFIED injected project | Giữ analytics/ads false; GMA/consent độc lập; không đọc/đổi credential thật |
| 8 | Dev strings | DONE-VERIFIED tests/Fire unsigned fixture; DONE-UNVERIFIED release set | JS/resources/native classification, Spotube loopback giữ; không decompile Hermes để chứng minh reachability hoàn toàn |
| 9 | Fire thiếu GMS | DONE-VERIFIED boundary/manifest; DONE-UNVERIFIED device | Native ClassLoader tests và Kotlin compile; cần cold start/paths trên Fire thật |

## Việc chủ dự án cần thực hiện

1. Xác minh/giới hạn/rotate các chuỗi API key lịch sử nếu là key thật; không gửi key vào chat.
2. Trên macOS đúng toolchain resolve/review Podfile.lock; chạy strict full-release Maven/R8/ABI và bổ sung checksum đúng nguồn khi gate báo thiếu. Đối chiếu build number cao nhất đã publish.
3. Trong phiên được phép sử dụng signing, cấu hình CI/EAS injection từ secret manager, certificates/profiles app/widget/Watch, từng store keystore; giữ mọi giá trị ngoài Git.
4. Cung cấp official ADM SDK/config/key qua secret/artifact private; triển khai additive registry SQL/worker, APNs/FCM/ADM và Hosting magic link. Chỉ bật flags sau kiểm provider.
5. Entitlement/provisioning CarPlay trước khi bật; push production entitlement phù hợp.
6. Chạy checklist trên iPhone/Android/Fire và hai tài khoản, Watch/Wear/Car; chạy L2 và giữ đủ năm artifact/provenance/signature proof/release-set từ cùng commit.
