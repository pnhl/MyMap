# Chạy MyMap XCTest trên Firebase Test Lab

Gói mã nguồn này dùng để chuyển dự án sang máy Mac. Đây chưa phải file có thể tải trực tiếp lên Firebase Test Lab, vì Test Lab yêu cầu các binary iOS được Xcode biên dịch cho thiết bị thật.

## 1. Chuẩn bị dự án trên macOS

1. Giải nén gói mã nguồn.
2. Cài Node.js LTS, Xcode và CocoaPods.
3. Tạo ứng dụng iOS trong Firebase với bundle ID `com.pnhl.vibecoding`, tải `GoogleService-Info.plist`, rồi đặt file vào thư mục gốc dự án.
4. Chạy:

   ```bash
   npm ci
   npx expo prebuild --platform ios
   cd ios
   pod install
   cd ..
   ```

5. Mở `ios/MyMap.xcworkspace` bằng Xcode và cấu hình Signing cho scheme `MyMap`.

## 2. Tạo XCTest target

Trong Xcode, chọn **File > New > Target** rồi thêm **UI Testing Bundle** với tên `MyMapUITests` và target application là `MyMap`.

Thay file test mặc định bằng:

`ios-tests/MyMapUITests/MyMapSmokeTests.swift`

Đảm bảo target `MyMapUITests` được bật trong mục **Test** của scheme `MyMap`.

## 3. Build và đóng gói cho Firebase

Từ thư mục gốc dự án, chạy:

```bash
bash scripts/package-firebase-xctest-ios.sh
```

Script sẽ build bằng `xcodebuild -sdk iphoneos build-for-testing` và tạo:

`dist/MyMap-Firebase-XCTest.zip`

ZIP đầu ra chứa đúng hai thành phần Firebase Test Lab cần:

- `Debug-iphoneos/`
- một file `.xctestrun`

Nếu workspace hoặc scheme có tên khác, truyền biến môi trường:

```bash
MYMAP_IOS_SCHEME="TênScheme" \
MYMAP_IOS_WORKSPACE="$PWD/ios/TênWorkspace.xcworkspace" \
bash scripts/package-firebase-xctest-ios.sh
```

## 4. Chạy trên Firebase Test Lab

Tải `dist/MyMap-Firebase-XCTest.zip` lên **Firebase Console > Test Lab > Run an XCTest**, hoặc dùng Google Cloud CLI:

```bash
gcloud firebase test ios run \
  --project mymap-a3ae4 \
  --test dist/MyMap-Firebase-XCTest.zip \
  --device model=MODEL_ID,version=IOS_VERSION,locale=vi_VN,orientation=portrait
```

Xem danh sách thiết bị và phiên bản đang hỗ trợ:

```bash
gcloud firebase test ios models list
gcloud firebase test ios versions list
```

Lưu ý: tài khoản Google Cloud hiện đăng nhập trên máy Windows không có quyền với project `mymap-a3ae4`. Khi chạy lệnh trên Mac, hãy đăng nhập tài khoản có quyền Owner hoặc Editor của project.
