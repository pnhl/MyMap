# Cấu hình Spotify cho MyMap

Client ID công khai: `803c9a3953f045e8822fa05d271a0fd0`.
Redirect URI đăng ký trong Spotify Dashboard, giữ đúng ký tự: `https://mymap.html-5.me/?i=1`.

## Đưa callback lên hosting

1. Sao lưu trang gốc hiện có của tên miền. Đưa `index.php` trong thư mục này vào thư mục web gốc của hosting. Nếu đã có `index.html`, tích hợp phần callback vào trang gốc hoặc chỉnh cấu hình để yêu cầu có `code`/`error` và `state` đi tới `index.php`; giữ nội dung trang hiện có cho các yêu cầu khác.
2. Không đổi Redirect URI sang đường dẫn `/index.php` trong Dashboard nếu vẫn dùng cấu hình APK này. Địa chỉ `/?i=1` phải phục vụ callback.
3. Trên điện thoại đã cài MyMap, mở địa chỉ kiểm tra `https://mymap.html-5.me/?i=1&error=access_denied&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`. Trang cần mở MyMap hoặc hiện nút **Tiếp tục trong MyMap**. Đây chỉ kiểm tra chuyển về ứng dụng, không tạo phiên đăng nhập.
4. Trong MyMap → Cài đặt → Âm nhạc → Liên kết Spotify, dùng tài khoản cá nhân để đăng nhập. Với Spotify app ở chế độ development, thêm tài khoản được phép sử dụng trong Dashboard trước khi kiểm tra.

Hosting hiện trả một trang kiểm tra JavaScript/cookie trước khi phục vụ nội dung. Cần kiểm tra trên trình duyệt điện thoại rằng trang này giữ nguyên `code` và `state`; nếu hosting bỏ tham số, chuyển callback sang hosting HTTPS giữ được chuỗi truy vấn rồi cập nhật Redirect URI và build lại.

## Đăng nhập xong nhưng báo Spotify chưa cho phép thao tác

Trong APK cũ, thông báo này xuất hiện ở bước gọi Web API sau khi callback đã về ứng dụng và đổi mã lấy token thành công. Với chế độ Development, Spotify cho phép người chưa nằm trong danh sách thử nghiệm đăng nhập nhưng trả **403** khi gọi API. Không cần thay callback chỉ vì lỗi này.

1. Mở [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), chọn ứng dụng có Client ID `803c9a3953f045e8822fa05d271a0fd0`.
2. Vào **Settings → Users Management → Add new user**, nhập tên và **đúng email của tài khoản Spotify đang đăng nhập trên điện thoại**. Email đăng nhập MyMap có thể khác email Spotify. Lưu lại.
3. Nếu App Status là Development, kiểm tra **tài khoản chủ ứng dụng Spotify Developer còn Premium**. Điều kiện này áp dụng cho chủ ứng dụng; không tự suy ra rằng mọi người dùng phải mua Premium.
4. Quay lại MyMap → Cài đặt → Âm nhạc và liên kết lại. Nếu vẫn lỗi, gửi mã HTTP và thông báo chi tiết trong APK mới; không gửi token hoặc Client Secret.

Bản sửa chỉ lưu token sau khi đọc hồ sơ thành công, hiển thị hướng xử lý riêng cho 403, thiếu scope, 401, 429 và lỗi máy chủ. Không thể vượt qua hạn chế tài khoản từ Spotify bằng thay đổi APK. Chưa đăng nhập thực tế bằng tài khoản cá nhân; kiểm thử bằng phản hồi OAuth/API giả lập, bao gồm token thành công nhưng hồ sơ bị từ chối, rồi liên kết lại sau khi cấp quyền.

Nguồn: [Development Mode và Users Management](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [yêu cầu Premium của chủ ứng dụng](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide).

## Luồng liên kết

MyMap tạo PKCE verifier/challenge và state ngẫu nhiên. Spotify trả authorization code về HTTPS callback; callback chuyển code và state tới `mymap://spotify`. MyMap kiểm tra state, đổi code lấy token trực tiếp tại Spotify và lưu token trong SecureStore của thiết bị. Hosting không giữ token, không cần Client Secret và không cần Android App Links/assetlinks.json.

Người dùng tìm bài hát trong MyMap; **Nghe** mở trình phát Spotify chính thức với đúng bài hát. Radio cũ vẫn giữ lại. MyMap không nhúng luồng âm thanh Spotify có quảng cáo: [chính sách Spotify](https://developer.spotify.com/policy) giới hạn mô hình thương mại của ứng dụng streaming, còn yêu cầu của dự án là giữ AdMob. Chủ ứng dụng đã đưa callback lên hosting; chưa kiểm thử một lần đăng nhập thật và không sử dụng tài khoản cá nhân của người dùng thay họ.

Nguồn: [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow), [Redirect URI](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).
