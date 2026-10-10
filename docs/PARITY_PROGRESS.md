# Tiến độ parity — 10/10/2026

Quy ước: DONE-VERIFIED có bằng chứng tự động trong phạm vi ghi rõ; DONE-UNVERIFIED có code nhưng chưa nghiệm thu thiết bị; BLOCKED cần đầu vào bên ngoài. Không dùng credential thật trong lượt này, không tải lên cửa hàng.

| Cụm | Trạng thái | Bằng chứng / còn lại |
|---|---|---|
| L1 kiểm nguồn gộp | DONE-VERIFIED | Git chứa module my-map-ios, Swift speech/AI, widgets, Watch, Android plugins/native, Wear. Phase 0 là ảnh chụp trước khi gộp. |
| L1 pipeline 5 artifact | DONE-UNVERIFIED | Có năm profile, release-set assembler và fingerprint embedded/sidecar; 2 test inputs/assembler đạt. Native lock chưa resolve/duyệt, production dừng rõ. Chưa có bộ 5 artifact. |
| L2 artifact gates | DONE-UNVERIFIED | Có guard IPA/APK/AAB; cần bổ sung DEX/ELF, từng target và provenance, rồi chạy artifact thật. |
| L3 chín finding | DONE-UNVERIFIED | Xem PARITY_NOTES.md; không dùng APK build 36 làm bằng chứng build mới. |
| L4 hợp đồng và chức năng | DONE-UNVERIFIED | Kiểm theo ma trận phase 0; ADM cần SDK/credentials, các luồng native cần thiết bị. |
| L5 kiểm thử/tài liệu | DONE-UNVERIFIED | Cập nhật kết quả sau từng cụm; QA máy thật chưa chạy. |
| Ký/5 artifact production | BLOCKED | Cần macOS/Xcode, cấu hình EAS và signing được chủ dự án sử dụng trong phiên riêng. Lượt này cấm dùng credential thật. |
| Push production | BLOCKED | Cần ADM/FCM/APNs credentials, entitlement, triển khai backend và hai thiết bị kiểm nhận. |
| CarPlay | BLOCKED | MYMAP_ENABLE_CARPLAY=false cho đến khi có entitlement/provisioning. |
| Native locks | BLOCKED | Cần macOS resolve Podfile.lock và resolve/review Maven checksums từng flavor; không tạo lock giả. |
| Secret lịch sử | BLOCKED | Scanner đọc 666 blobs: 5 phiên bản cũ của .github/workflows/build-firebase-xctest-ios.yml có chuỗi Firebase API key. Source hiện tại sạch. Chủ dự án cần xác minh/restrict/rotate nếu là key thật; không tự rewrite Git history. |

Checkpoint đầu: HEAD trước thay đổi `19bc57de585a8e452ca8f590c19fd0817ebabc55`, source sạch. Các test cũ không được tự động coi là nghiệm thu yêu cầu mới.
