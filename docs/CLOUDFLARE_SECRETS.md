# Cloudflare Secrets Store của MyMap

Đã tạo store `mymap-production` và xác nhận 8 secret ở trạng thái `active` ngày 10/10/2026. Account/store ID trong `config/cloudflare-secrets.json` chỉ là định danh, không cấp quyền đọc secret. Không đưa OAuth token Cloudflare vào repository. Cloudflare One Client/WARP là ứng dụng kết nối mạng, không phải kho secret.

| Secret | Nội dung được lưu |
|---|---|
| `MYMAP_MOBILE_BUILD_ENV` | Cấu hình `.env` hiện có, gồm khóa, địa chỉ và các thiết lập public của ứng dụng |
| `MYMAP_STADIA_MAPS_API_KEY` | Khóa Stadia, tách riêng để Worker chỉ nhận khóa cần dùng |
| `MYMAP_TOMTOM_TRAFFIC_KEY` | Khóa TomTom |
| `MYMAP_MAPILLARY_ACCESS_TOKEN` | Token Mapillary |
| `MYMAP_FIREBASE_ANDROID_JSON` | File Firebase Android của `com.pnhl.vibecoding` |
| `MYMAP_FIREBASE_IOS_PLIST` | File Firebase iOS cùng project/bundle, lấy từ cấu hình iOS cục bộ hiện có |
| `MYMAP_ANDROID_KEYSTORE_BASE64` | Keystore đang dùng, giữ nguyên khóa ký; base64 là cách đóng gói, Secrets Store thực hiện mã hóa |
| `MYMAP_ANDROID_SIGNING_JSON` | `storePassword`, `keyAlias`, `keyPassword` của keystore đó |

Chỉ lưu những giá trị hiện có; không tự sinh khóa ký mới hoặc tạo credentials giả. Chứng chỉ/provisioning Apple và Expo token chưa được nhập vì chưa có trong nguồn cấu hình đã kiểm tra. File gốc cục bộ được giữ để build hiện tại tiếp tục hoạt động; chưa đổi hay thu hồi khóa ở nhà cung cấp.

## Kiểm tra và nhập cấu hình

Tooling Cloudflare đã khóa phiên bản trong `cloudflare/geo-gateway/package-lock.json`:

```sh
npm ci --prefix cloudflare/geo-gateway
node cloudflare/geo-gateway/node_modules/wrangler/bin/wrangler.js login
npm run secrets:plan
npm run secrets:upload
```

`secrets:plan` chỉ in tên, kích thước và những file còn thiếu; không gửi dữ liệu lên mạng. `secrets:upload` kiểm tra toàn bộ payload trước khi gửi, dùng stdin thay vì đối số chứa secret, ép API Cloudflare chính thức, tắt telemetry và bật log sanitization. Receipt trong `.local/cloudflare-secret-receipts.json` chỉ chứa tên/ID/thời gian. Không ghi nội dung secret vào receipt hoặc Git. Chạy lại giữ nguyên những secret đã có receipt; đây không phải đồng bộ tự động khi `.env` thay đổi.

Nếu file Firebase iOS nằm ở nơi khác, đặt `MYMAP_PRIVATE_IOS_PLIST` bằng đường dẫn file thật trước khi chạy. Script kiểm tra bundle ID; lần nhập này đã kiểm tra cả Firebase project trùng Android. Không sao chép nội dung plist vào chat. File `.env`, Firebase, keystore, `.dev.vars` và state Wrangler đều bị Git ignore.

Để cập nhật một secret đã tồn tại, dùng `wrangler secrets-store secret update` với store ID trong cấu hình, secret ID từ receipt/dashboard và `--remote`. Nhập giá trị qua prompt kín hoặc stdin. Không dùng `--value`, không dán secret vào shell history, không xóa secret cũ chỉ để chạy lại importer.

## Sử dụng trên server và giới hạn hiện tại

[Cloudflare lưu secret mã hóa](https://developers.cloudflare.com/secrets-store/integrations/workers/). Sau khi lưu, dashboard/API quản lý chỉ trả metadata, không trả lại giá trị. Worker được cấp binding mới gọi được `await env.BINDING_NAME.get()`. Không tạo endpoint trả `.env`, khóa ký hoặc token cho ứng dụng mobile. Keystore này được lưu trong Secrets Store; đây không phải giao diện tải file backup trực tiếp.

Ví dụ binding chỉ một khóa cần dùng trong Worker:

```json
{
  "secrets_store_secrets": [
    {
      "binding": "TOMTOM_KEY",
      "store_id": "5e8f3d5f55c643fc8130111f59cdf94d",
      "secret_name": "MYMAP_TOMTOM_TRAFFIC_KEY"
    }
  ]
}
```

Việc lưu trữ này **chưa chuyển các API ứng dụng đang gọi trực tiếp sang proxy Cloudflare**. Các giá trị `EXPO_PUBLIC_*` hoặc native config cần trên thiết bị vẫn có thể trích xuất từ APK/IPA, dù bản gốc được lưu mã hóa trên Cloudflare. Muốn giữ khóa provider hoàn toàn phía server cần Worker proxy có xác thực, giới hạn request và không cho caller tùy chọn upstream URL. Với khóa bắt buộc dùng ở native SDK, áp dụng giới hạn package/bundle/certificate của nhà cung cấp. AdMob app/unit IDs và Supabase publishable URL/key là cấu hình client, không coi là khóa quản trị bí mật.

CI/EAS hiện vẫn dùng cơ chế credentials mô tả trong `BUILD.md`; chưa tự động lấy secret từ Cloudflare. Secrets Store không có API tải plaintext để thay thế trực tiếp GitHub Secrets. Cần một đường cấp cấu hình build riêng có xác thực CI trước khi đổi workflow, và không đưa signing credentials vào ứng dụng. Backend Supabase đang chạy giữ nguyên cấu hình riêng của nó.

Giới hạn hiện tại của [Secrets Store](https://developers.cloudflare.com/secrets-store/manage-secrets/): một store/account, tối đa 100 secret, mỗi giá trị không quá 65.536 byte. Importer từ chối giá trị quá lớn trước khi upload.
