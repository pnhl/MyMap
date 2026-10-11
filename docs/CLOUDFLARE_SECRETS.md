# Cloudflare Secrets Store và Geo Gateway

Store `mymap-production` đã được xác nhận có 8 secret active trong lần thiết lập trước ngày 10/10/2026. Lượt chuyển proxy chỉ kiểm kê tên và sửa mã; không đọc giá trị, không chứng minh trạng thái triển khai production hiện tại. Account/store IDs trong `config/cloudflare-secrets.json` là metadata. Cloudflare One Client/WARP là ứng dụng kết nối mạng, không phải kho secret.

## Secret đã lưu trước đây

| Tên | Mục đích |
|---|---|
| `MYMAP_MOBILE_BUILD_ENV` | Bản lưu cấu hình cũ; **không được khôi phục nguyên khối thành `.env`, `MYMAP_PUBLIC_ENV` hoặc EAS public env** |
| `MYMAP_STADIA_MAPS_API_KEY` | Khóa Stadia chỉ dành cho gateway |
| `MYMAP_TOMTOM_TRAFFIC_KEY` | Khóa TomTom chỉ dành cho gateway |
| `MYMAP_MAPILLARY_ACCESS_TOKEN` | Token Mapillary chỉ dành cho gateway |
| `MYMAP_FIREBASE_ANDROID_JSON` | Cấu hình Firebase Android dùng khi build |
| `MYMAP_FIREBASE_IOS_PLIST` | Cấu hình Firebase iOS dùng khi build |
| `MYMAP_ANDROID_KEYSTORE_BASE64` | Bản lưu keystore Android; base64 là cách đóng gói, không phải mã hóa |
| `MYMAP_ANDROID_SIGNING_JSON` | Bản lưu thông tin ký Android |

`MYMAP_GRAPHHOPPER_KEY` và `MYMAP_CESIUM_ION_TOKEN` là tên Secrets Store bổ sung khi bật các provider tương ứng; chưa có bằng chứng chúng đã được nhập trong lần thiết lập 8 secret trên. Worker chỉ được cấp các secret provider cần dùng, không cấp Firebase file, signing file hoặc bản `.env` cũ. Importer mới chỉ chấp nhận public env sạch và lưu dưới tên `MYMAP_MOBILE_PUBLIC_ENV`; nó từ chối các tên khóa provider public cũ, không đọc/trích khóa provider từ Expo env, không cập nhật bản archive `MYMAP_MOBILE_BUILD_ENV`.

## Cấp secret cho Worker

Secret đã lưu phải được nối thành `secrets_store_secrets` binding trong Wrangler, hoặc binding tương đương trên dashboard. Worker lấy giá trị qua `.get()` trong runtime server. Secret Store không cung cấp API đọc plaintext cho app/CI. [Cloudflare Workers integration](https://developers.cloudflare.com/secrets-store/integrations/workers/).

| Binding runtime | Secret Store name | Cấu hình |
|---|---|---|
| `STADIA_KEY` | `MYMAP_STADIA_MAPS_API_KEY` | Đã khai báo trong Wrangler |
| `TOMTOM_KEY` | `MYMAP_TOMTOM_TRAFFIC_KEY` | Đã khai báo trong Wrangler |
| `MAPILLARY_TOKEN` | `MYMAP_MAPILLARY_ACCESS_TOKEN` | Đã khai báo trong Wrangler |
| `GRAPHHOPPER_KEY` | `MYMAP_GRAPHHOPPER_KEY` | Thêm binding khi dùng Secrets Store, hoặc dùng ordinary Worker secret `GRAPHHOPPER_KEY` |
| `CESIUM_ION_TOKEN` | `MYMAP_CESIUM_ION_TOKEN` | Thêm binding khi dùng Secrets Store, hoặc dùng ordinary Worker secret `CESIUM_ION_TOKEN` |

Adapter của Worker hỗ trợ cả binding `.get()` và ordinary Worker secret. Ordinary secrets được nhập qua `wrangler secret put GRAPHHOPPER_KEY` hoặc `wrangler secret put CESIUM_ION_TOKEN` ở thư mục gateway, với prompt kín; không có giá trị trong repo. [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

Khi tạo/cập nhật secret, dùng dashboard hoặc Wrangler với prompt kín/stdin; chỉ truyền tên và ID trên command line. Không dùng đối số chứa giá trị, không dán vào chat, shell history, `wrangler.jsonc`, log hoặc Git. Có thể tạo secret mới bằng:

```sh
node cloudflare/geo-gateway/node_modules/wrangler/bin/wrangler.js secrets-store secret create <STORE_ID> --name MYMAP_GRAPHHOPPER_KEY --scopes workers --remote
```

Đổi tên secret trong lệnh nếu cấp provider khác. Cập nhật secret đã tồn tại bằng `secrets-store secret update <STORE_ID> --secret-id <SECRET_ID> --remote`; chỉ lấy ID từ metadata/dashboard. Không chạy lại importer cũ để trích provider keys từ public `.env`. Cấu hình public mới phải được tạo theo danh sách trong [PUBLIC_CONFIG.md](PUBLIC_CONFIG.md). [Wrangler Secrets Store commands](https://developers.cloudflare.com/workers/wrangler/commands/secrets-store/).

## Bảo vệ app và vận hành

Mã proxy nằm trong `cloudflare/geo-gateway/`. App chỉ biết `EXPO_PUBLIC_ROUTING_GATEWAY_URL` và gửi Firebase ID token người dùng đã đăng nhập bằng header Authorization; anonymous token bị từ chối và guest dùng OSM public. Worker xác minh chữ ký và Firebase project, áp dụng quota, kiểm tra route/params trước khi gọi host provider cố định. Không chấp nhận caller-supplied upstream URL; không trả provider credentials hoặc signed provider image URLs về client. Thông tin deploy, auth và scan artifact ở [BUILD.md](BUILD.md).

Chỉ kiểm tra Worker production bằng `GET /health`: endpoint này không đọc hay trả secret. Không dùng endpoint trả `.env`, token, cấu hình private hoặc “test key”. Không bật log header Authorization, full upstream URL có query key, raw upstream errors hoặc raw request body. Worker mặc định tắt observability log.

Lưu key trong Cloudflare chỉ bảo vệ bản server. Mọi giá trị từng nằm trong `EXPO_PUBLIC_*` hoặc URL của bản APK/IPA cũ vẫn có thể đã lộ. Sau khi bản mới dùng proxy được phát hành, phải xoay/thu hồi các khóa Stadia, TomTom, Mapillary, GraphHopper và Cesium đã từng nhúng; chi tiết thứ tự ở [BUILD.md](BUILD.md). Public AdMob app/unit IDs, OAuth client IDs và Supabase publishable key không phải khóa provider server cần xoay trong đợt này.

Signing/CI giữ cơ chế riêng trong BUILD.md; chưa có bridge tự động tải plaintext secret từ Secrets Store sang GitHub/EAS. Không cấp signing credentials cho mobile bundle hoặc gateway.
