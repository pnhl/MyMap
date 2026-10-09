# MyMap — tiến độ triển khai 08/10/2026

Mã nguồn 1.0.4 / Android build 36. Phạm vi Android và Fire OS; iOS tạm hoãn theo yêu cầu mới.

Đã bổ sung cuộc gọi LiveKit/nhóm/PTT, quản lý nhóm chat, quyền chặn/theo dõi/bạn thân, tương tác/kiểm duyệt cộng đồng, đồng bộ hồ sơ/avatar riêng, gói geometry ngoại tuyến, phân tích GPS lái xe, speech offline, Gemini Nano và GGUF cục bộ, tải model có checksum, trợ lý văn bản trong kỷ niệm/nhật ký và dự báo không khí Open-Meteo. Tiện ích mở rộng mới mặc định tắt.

TypeScript và 307 tests đạt; SQL ACL/account/membership/moderation/avatar được test trên máy chủ rồi rollback trong đợt tính năng trước. APK build 35 có crash khởi động do R8 loại JNI WebRTC; đã thay bằng build 36 giữ JNI và Expo headless loader, có kiểm DEX thực tế tích hợp vào build. Hai APK mới đạt kiểm manifest/chữ ký/checksum/Hermes/ZIP cùng ELF 16 KiB; [bản sửa và APK mới](ANDROID_FIREOS_STARTUP_CRASH_BUILD36_2026_10_08.md). Chưa QA thiết bị thật, chưa hoàn tất toàn bộ catalog và Open-Meteo production vẫn cần quyền sử dụng phù hợp với app có quảng cáo.

Tài khoản Google đã xác minh `lphan7138@gmail.com` đã được cấp vai trò quản trị cộng đồng trong MyMap, gắn theo canonical identity máy chủ; client không tự cấp vai trò. Bật Cộng đồng và bạn thân để mở kiểm duyệt.

- [Chi tiết bản Android/Fire OS](ANDROID_FIREOS_COMPLETION_2026_10_08.md).
- [Danh sách chi tiết theo trạng thái, cập nhật cho build 36](FEATURE_STATUS_DETAIL_ANDROID_FIREOS_2026_10_08.md).
- [Bảng đối chiếu đủ 296 dòng](FEATURE_PROVIDER_PROGRESS_2026_10_08.md): 32 có luồng cơ bản, 166 chưa hoàn thiện, 76 chưa có, 22 tạm hoãn iOS.
- [Danh sách còn lại](ANDROID_FIREOS_REMAINING_2026_10_08.md).
- [Báo cáo cũ của build 34](FEATURE_IMPLEMENTATION_BASELINE_BUILD34_2026_10_08.md), giữ để đối chiếu lịch sử; không dùng kết luận cũ cho source mới.
