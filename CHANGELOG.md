# Nhật ký thay đổi

[Tiếng Việt](CHANGELOG.md) | [English](CHANGELOG.en.md)

Mọi thay đổi đáng chú ý được ghi ở đây. Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [1.0.0] - 2026-10-26

Bản phát hành công khai đầu tiên, tách từ kho Motion Atlas để skill cài được riêng.

### Thêm

- Skill `narrated-video-edit`: phiên âm cục bộ từng từ (faster-whisper), dò mặt (YuNet), tách người tùy chọn (MediaPipe), caption từng từ với sáu preset, B-roll từ nguồn có giấy phép (Wikimedia Commons, Openverse, NASA, Cleveland Museum of Art) hiện như vật thể thiết kế, sticker, emoji động, thẻ số liệu, lower third, 190 hiệu ứng đã đo trong 11 họ, chuẩn hóa độ to -14 LUFS, kiểm toán độc lập, ba cổng người dùng bắt buộc.
- `tools/validate-skill.mjs` (frontmatter, tệp được nhắc tới, JSON, cú pháp, khóa bí mật, tệp giấy phép) và `tools/build-release.mjs` (zip lặp lại được, thư mục `narrated-video-edit/` ở cấp trên cùng như Claude yêu cầu).
- Tài liệu song ngữ, tiếng Việt là mặc định: README, cài đặt, tinh chỉnh, ghi công.
- Showreel, video hướng dẫn thêm skill vào Claude và banner động, có bản tiếng Việt và tiếng Anh.
- Tệp cộng đồng: hướng dẫn đóng góp, chính sách bảo mật, quy tắc ứng xử, mẫu issue và pull request. Kho cố ý không có CI; cách phát hành bằng tay nằm ở `CONTRIBUTING.md`.

### Đã kiểm

- `node selftest.mjs` đạt 68/68 từ bản sao sạch của `skills/narrated-video-edit` trên Windows 11; `effects-selftest.mjs` đạt 190/190.

### Giới hạn đã biết

- Chỉ thử trên Windows 11. Tiếng Việt thử trên một vlog thật 13 phút, tiếng Anh trên giọng đọc tổng hợp.
- Hướng dẫn của skill viết bằng tiếng Việt; chưa có bản tiếng Anh.
- Chưa thử việc công cụ có chạy được trong sandbox của một cuộc chat claude.ai thường hay không.

[1.0.0]: https://github.com/Le-Ngoc-Tu/narrated-video-edit/releases/tag/v1.0.0
