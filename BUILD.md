# Build MyMap cho iOS, Google Play và Amazon

Nguồn chung là repo này. `release.json` giữ version 1.0.4, build 38 và application ID; các bản đều dùng cùng Git commit. `android/`, `ios/` là mã sinh từ Expo CNG, không chỉnh trực tiếp. Không dùng lại native project sinh cho Play để build Amazon.

## Chuẩn bị

1. Cài Node 24, Python 3 và Git. Android cần JDK 21, Android SDK 36; iOS cần macOS, Xcode và CocoaPods. Dùng `npm ci --ignore-scripts` để cài đúng lockfile. Script chuẩn bị native tải llama.rn 0.12.9 với SHA-256 đã khóa.
2. Sao chép `.env.example` thành `.env`, điền cấu hình trong máy hoặc secret manager. Không gửi khóa vào chat hoặc commit các file cấu hình/ký. Các biến `EXPO_PUBLIC_*` được nhúng vào ứng dụng: chỉ đặt thông tin được phép công khai, không đặt service-role key hay mật khẩu.
3. Khôi phục `google-services.json` cho Android và `GoogleService-Info.plist` cho iOS của cùng Firebase project và `com.pnhl.vibecoding`. Có thể đặt đường dẫn qua `GOOGLE_SERVICES_JSON`/`GOOGLE_SERVICES_PLIST`. Cấu hình Firebase được dùng cho native build; JS lấy tùy chọn từ native Firebase, không import JSON/plist.
4. Giữ nguyên keystore của ứng dụng đã phát hành. Với bản ký local, đặt keystore và `release.properties` trong `.signing/`. `storeFile` được giải quyết tương đối từ `android/app`; các tên trường là `storeFile`, `storePassword`, `keyAlias`, `keyPassword`. Không tạo key thay thế cho ứng dụng đã có người dùng.
5. Đăng nhập EAS bằng `npx --no-install eas login`, liên kết đúng EAS project bằng `eas init`, đưa UUID vào `EAS_PROJECT_ID`. Dùng `eas credentials` để cấu hình Android keystore và Apple distribution certificate/provisioning cho app chính, widget và Watch. Apple App Groups cần `group.com.pnhl.vibecoding` trên các target liên quan.

## Biến cấu hình

| Biến | Mục đích |
|---|---|
| `MYMAP_STORE` | `play`, `amazon`, `ios`; profile EAS tự đặt |
| `MYMAP_RELEASE` | `true` cho release; thiếu AdMob app ID thật làm build dừng |
| `EXPO_PUBLIC_ENABLE_TEST_ADS` | Bắt buộc `false` cho release |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | Ghi đè App ID mặc định trong `config/admob.json`; Android và Amazon dùng chung Android ID |
| `EXPO_PUBLIC_ADMOB_NATIVE_<PLACEMENT>_ID`, `EXPO_PUBLIC_ADMOB_BANNER_<PLACEMENT>_ID` | Đơn vị quảng cáo Android hiện có |
| `EXPO_PUBLIC_ADMOB_IOS_NATIVE_<PLACEMENT>_ID`, `EXPO_PUBLIC_ADMOB_IOS_BANNER_<PLACEMENT>_ID` | Native iOS có ID mặc định riêng trong `config/admob.json`; banner để trống thì không yêu cầu banner |
| `EAS_PROJECT_ID` | Project UUID cho build và Expo push |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Backend dùng Firebase ID token và RLS |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_REVERSED_CLIENT_ID` | OAuth client/scheme cho Google Sign-In; Fire ẩn phương thức Google |
| `MYMAP_ENABLE_WIDGETS` | Mặc định bật; `false` chỉ dùng cho cấu hình đã chấp thuận bỏ widget/Live Activity |
| `MYMAP_ENABLE_WATCH` | Mặc định bật Watch target; `false` chỉ dùng cho cấu hình đã chấp thuận bỏ Watch |
| `MYMAP_ENABLE_CARPLAY` | Chỉ `true` sau khi Apple cấp entitlement và profile có quyền CarPlay |
| `EXPO_PUBLIC_EMAIL_LINK_DOMAIN`, `EXPO_PUBLIC_EMAIL_LINK_CONTINUE_URL` | Firebase Hosting hostname và continue URL HTTPS được phép; không dùng Dynamic Links cũ |
| `EXPO_PUBLIC_AMAZON_APS_APP_ID` | Khởi tạo APS tùy chọn; Fire không dùng AdMob SDK |

PLACEMENT gồm `SMART`, `FRIENDS`, `TIMELINE`, `STATS`, `PROFILE`, `MEMORIES`, `HEATMAP`, `SETTINGS`, `PLACE`. Cấu hình public phải giống nhau ở mọi profile Android để bundle có cùng hash; việc chọn SDK native dùng `MYMAP_STORE`, không dùng biến public khác nhau cho từng cửa hàng.

ID AdMob public đã cập nhật theo ảnh chủ dự án cung cấp trong `config/admob.json`; không cần file `.env` riêng để nhận các ID này. Native dùng chung một ad unit cho các vị trí trên mỗi hệ điều hành; biến môi trường không rỗng có thể ghi đè từng vị trí. Chưa có banner ID nên banner dự phòng vẫn tắt. Test ads mặc định tắt; QA cần thiết bị thử được đăng ký hoặc bản test riêng.

Amazon dùng **full Google Mobile Ads SDK**, hỗ trợ thiết bị không có Google Play theo [Google](https://developers.google.com/admob/android/sdk). Google Sign-In/FCM/Auto vẫn bị loại. Giữ consent trước khi khởi tạo/tải ads, xử lý no-fill và ẩn khi không có quảng cáo; không yêu cầu cài GMS. Các quyền Advertising ID/AdServices vẫn bị loại khỏi Amazon, nên không có quảng cáo cá nhân hóa qua những API này. Cần thử consent và tải native ads trên Fire thật; việc hiển thị còn phụ thuộc inventory và trạng thái xét duyệt AdMob. [Amazon Appstore được AdMob hỗ trợ](https://support.google.com/admob/answer/9989980).

Trong EAS, tạo environment `production`, thêm public configuration đồng nhất và hai biến kiểu **file** `GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICES_PLIST`. File Firebase bị Git ignore nên cần các biến file trên cloud. Token CI `EXPO_TOKEN` chỉ dùng trong secret manager.

## Chạy kiểm tra và build

```sh
npm run lint
npm run typecheck
npm test
python3 -m unittest discover -s tests -p '*_test.py'
node scripts/check-source-secrets.cjs
```

`lint` kiểm tra cú pháp TS/TSX và quy tắc không nạp Google-only SDK ngoài facade phát hiện khả năng, không nhúng file Firebase private vào JS. Commit toàn bộ thay đổi trước khi build; `release:check` từ chối working tree bẩn hoặc file credentials bị theo dõi.

```sh
npm run release:check
npm run build:ios
npm run build:android
npm run build:amazon
npm run build:all
```

EAS CLI đã khóa trong lockfile. `ios-store` tạo IPA đã ký; `android-play` tạo AAB; `android-apk` tạo APK Play; `android-amazon` tạo APK Fire. `build:all` yêu cầu mọi artifact thành công, commit EAS khớp HEAD, rồi chạy kiểm tra nội dung và bundle. Trên macOS, script tạo thêm unsigned IPA. Trên Windows, script báo cần job macOS để hoàn thành unsigned IPA; không coi bốn artifact cloud là đủ cho toàn bộ yêu cầu.

Unsigned IPA không cài trực tiếp như TestFlight: cần ký lại theo phương thức sideload phù hợp. Dùng `bash scripts/build-ios-unsigned.sh` trên cùng commit macOS. Bản này dùng Release, tắt debug dylib và không nhận signing certificate.

Build Android local trên PowerShell:

```powershell
./scripts/build-android-store.ps1 -Store play
./scripts/build-android-store.ps1 -Store amazon
```

Script cũ `build-release.ps1` chuyển tiếp vào các script mới, sinh lại CNG riêng cho mỗi cửa hàng. Build Play local cần `BUNDLETOOL_JAR`; `python scripts/fetch-bundletool.py` tải bundletool chính thức với checksum cố định. Artifact nằm trong `dist/releases/build-38/`. Cần build trên Linux/CI nếu Windows Device Guard chặn Hermes; không đổi sang JSC để tránh lỗi này.

Wear OS tối thiểu là project `companions/wear`, cùng application ID, version/build và signing key với điện thoại. Sau khi prebuild Android, chạy Gradle wrapper từ thư mục `android`: `./gradlew -p ../companions/wear assembleRelease bundleRelease`. CI Play tạo thêm Wear APK/AAB. Upload Wear vào phân phối Wear OS của cùng ứng dụng. Data Layer yêu cầu package và chữ ký khớp, đồng hồ đã ghép đôi và tiện ích Wear OS đã bật. Với Play App Signing, cấu hình signing/track sao cho bản điện thoại và Watch cài trên thiết bị có cùng certificate; upload key local chưa chứng minh được điều này.

## GitHub Actions

Workflow `.github/workflows/release.yml` chạy lint, typecheck, test và scan credentials ở PR/push. Chạy thủ công `build_release=true` để build từ commit được chọn. Các job Android riêng cho Play/Amazon; job macOS unsigned; job macOS EAS signed iOS; job cuối so sánh artifacts.

Các GitHub secrets cần đặt: `MYMAP_PUBLIC_ENV` (nội dung cấu hình public đồng nhất), `FIREBASE_ANDROID_BASE64`, `FIREBASE_IOS_PLIST_BASE64`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, `EXPO_TOKEN`. Không bật shell tracing. EAS production environment vẫn cần các biến file Firebase và đúng EAS project.

Git remote là [pnhl/MyMap](https://github.com/pnhl/MyMap), nhánh chính `main`. Chưa cấu hình GitHub/EAS secrets trong phiên này. Workflow build bản ký chỉ chạy thủ công sau khi có đủ cấu hình; kết quả CI của từng commit xem trong tab Actions.

Workflow XCTest iOS cũ vẫn được giữ để chạy thủ công, dùng fixture Firebase không có thông tin thật. Workflow bootstrap tải nguồn bên ngoài và ghi đè repository đã được gỡ. Cấu hình Expo duy nhất là `app.config.ts`; không giữ `app.config.js` cũ vì nó che khuất cấu hình mới.

## Guard sau build

`scripts/verify-artifacts.py` kiểm tra version/build/app ID, quyền theo `config/android-permissions.json`, backup/transfer bị chặn, release không debuggable, test AdMob ID bị từ chối, Amazon không có component FCM/Auto bắt buộc GMS. Cả Play và Amazon phải có AdMob application ID; provider khởi tạo Mobile Ads được phép trên Amazon. APK phải có chữ ký hợp lệ, không dùng certificate debug; khi so sánh Play/Amazon phải cùng certificate và bundle SHA-256. AAB kiểm tra manifest qua bundletool và chữ ký JAR.

iOS kiểm tra mô tả quyền tiếng Việt, background modes đúng `location/audio/processing`, version của widget/Watch, không có debug/preview dylib và các endpoint Metro đã biết. IPA signed cần provisioning; trên macOS kiểm thêm `codesign --verify --deep --strict` và distribution profile. Báo cáo chạy ngoài macOS không được hiểu là đã xác minh codesign. Kết quả ghi `dist/releases/verification.json`.

## Backend push và đăng nhập

Migration `20261009193712_three_store_push_delivery.sql` đã áp dụng vào backend đang dùng. `mymap-push` và phần push trong `mymap-call-maintenance` đã deploy; lịch phút có sẵn gọi maintenance. Worker chỉ nhận token đã đăng ký từ chủ tài khoản, lease từng job, kiểm receipt, retry có giới hạn và thu hồi token hết hiệu lực. Không đưa nội dung chat vào push. Không gọi worker bằng service-role key từ ứng dụng.

Expo push cần APNs/FCM credentials đúng EAS project. Thiếu project/token/quyền thông báo, ứng dụng vẫn giữ inbox và polling khi mở. Fire không đăng ký Expo/FCM; xem giới hạn polling trong ma trận bàn giao. Chưa kiểm chứng APNs/FCM trên thiết bị thật.

Liên kết email trong Cài đặt dùng Firebase `linkWithCredential` để giữ UID của Apple/Google/khách. Khi email thuộc tài khoản khác, ứng dụng báo xung đột; không tự gộp dữ liệu. Bật Email/Password trong Firebase Console. Magic link cần bật Email Link, authorized domain, Hosting App Links/Universal Links và SHA-256/Apple Team ID đúng; nút ẩn khi chưa cấu hình. Tham khảo [Firebase account linking](https://firebase.google.com/docs/auth/web/account-linking), [Hosting email links](https://firebase.google.com/docs/auth/android/email-link-auth).

## Trạng thái nghiệm thu

Đọc `docs/THREE_STORE_IMPLEMENTATION.md` và chạy `docs/MANUAL_THREE_STORE_QA.md`. Bộ IPA/AAB/APK điện thoại mới chưa được tạo đầy đủ. Không thay artifact build 36 cũ bằng tên build 38. Chỉ phát hành sau khi CI và checklist thiết bị thật hoàn tất.
