# GitHub Actions: tự build MyMap-Firebase-XCTest.zip

Workflow này dùng GitHub-hosted `macos-26` runner (Node 22, Xcode 26.4+ phù hợp Expo SDK 57) để tạo native iOS project, thêm `MyMapUITests`, build bằng Xcode cho `iphoneos`, rồi đóng gói đúng cấu trúc Firebase Test Lab cần.

## Chạy

1. Đẩy toàn bộ source lên GitHub.
2. Mở repository > **Actions**.
3. Chọn **Build Firebase XCTest iOS**.
4. Chọn **Run workflow**.
5. Khi job hoàn tất, mở phần **Artifacts** của run.
6. Tải artifact **MyMap-Firebase-XCTest**.
7. Giải nén artifact GitHub một lần. File cần upload vào Firebase là:

   `MyMap-Firebase-XCTest.zip`

Không upload ZIP artifact bên ngoài của GitHub nếu bên trong nó còn chứa `MyMap-Firebase-XCTest.zip`.

## Workflow làm gì

- `npm ci --legacy-peer-deps`
- `npx expo prebuild --platform ios --clean`
- tự thêm UI Testing target `MyMapUITests`
- tạo shared scheme `MyMapFirebaseTests`
- `pod install --repo-update`
- `xcodebuild ... -sdk iphoneos build-for-testing`
- đóng gói `Debug-iphoneos/` + đúng 1 file `.xctestrun`
- upload kết quả thành GitHub Actions artifact

## Code signing

Mặc định workflow build không dùng Apple Developer certificate rồi ký ad-hoc các bundle (`MYMAP_IOS_SIGNING_MODE=adhoc`). Điều này giúp CI tạo được gói kiểm thử mà không phải lưu chứng chỉ Apple trong repository.

Nếu Firebase/Xcode của bạn yêu cầu Apple Developer signing đầy đủ, đổi `MYMAP_IOS_SIGNING_MODE` thành `xcode` và cài certificate + provisioning profile vào runner trước bước build. Không commit `.p12`, mật khẩu hay provisioning profile vào Git.

## File Firebase mong đợi

Bên trong `MyMap-Firebase-XCTest.zip` phải có dạng:

```text
Debug-iphoneos/
  MyMap.app/
  MyMapUITests-Runner.app/
  ...
MyMapFirebaseTests_iphoneos<version>-arm64.xctestrun
```

Tên `.xctestrun` cụ thể phụ thuộc phiên bản Xcode/iOS SDK trên runner.
