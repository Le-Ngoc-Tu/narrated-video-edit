# Chính sách bảo mật (Security policy)

[Tiếng Việt](#tiếng-việt) | [English](#english)

## Tiếng Việt

### Báo cáo những gì

Skill này chạy lệnh trên máy bạn: nó khởi chạy FFmpeg và Chrome, chạy script Node và Python, tải ảnh và một mô hình giọng nói. Hãy báo mọi thứ có thể khiến một đầu vào độc hại (video được dựng sẵn, chữ phụ đề, phản hồi của nguồn ảnh, tệp kế hoạch) chạy lệnh ngoài ý muốn, đọc hoặc ghi tệp ngoài thư mục làm việc, làm lộ video hoặc âm thanh của bạn, hoặc vượt danh sách giấy phép cho phép để nhận tài nguyên bị hạn chế.

Không phải lỗi bảo mật: caption xấu, ảnh minh họa chưa khớp, hiệu ứng nhìn không đẹp. Hãy mở issue thường cho những việc đó.

### Cách báo cáo

Dùng **báo cáo lỗ hổng riêng tư** của GitHub: mở tab *Security* của kho, chọn *Report a vulnerability*. Xin đừng đăng chi tiết khai thác trong issue công khai. Kèm phiên bản (thẻ phát hành hoặc commit), hệ điều hành và các bước ngắn nhất tái hiện lỗi.

Bạn có thể chờ phản hồi xác nhận trong khoảng một tuần. Đây là dự án tình nguyện nên việc sửa theo khả năng; lỗi nghiêm trọng được ưu tiên. Người báo muốn được ghi công sẽ được nêu tên trong ghi chú phát hành.

### Phiên bản được hỗ trợ

Chỉ bản phát hành mới nhất được sửa lỗi.

### Những việc skill làm có chủ ý

- Phiên âm chạy cục bộ. Video và âm thanh của bạn không được tải lên.
- Tìm ảnh gửi vài từ khóa tiếng Anh rút từ lời nói tới các API công khai ghi trong `data/asset-sources.json` và `data/decor-sources.json`. Skill báo người dùng trước khi làm.
- Skill không đọc, in hay lưu khóa API.
- Việc tải về chỉ giới hạn trong các giấy phép được nhận, và mỗi tệp được ghi vào `credits.json`.

Nếu bạn đổi các đặc tính này trong bản fork, hãy nói rõ trong tài liệu của bạn.

## English

### What to report

This skill runs commands on your machine: it launches FFmpeg and Chrome, runs Python and Node scripts, and downloads images and a speech model. Please report anything that could let a malicious input (a crafted video, subtitle text, an image-source response, a plan file) run unintended commands, read or write files outside the working folder, leak your video or audio, or bypass the license allow-list so that restricted material is accepted.

Not security issues: a bad caption, a poor image match, an effect that looks ugly. Use a normal issue for those.

### How to report

Use GitHub's **private vulnerability reporting**: open the repository's *Security* tab, then *Report a vulnerability*. Please do not post exploit details in a public issue. Include the version (release tag or commit), your OS, and the smallest steps that reproduce the problem.

You can expect an acknowledgement within about a week. This is a volunteer project, so fixes follow on a best-effort basis; critical problems come first. Reporters who want credit are named in the release notes.

### Supported versions

Only the latest release receives fixes.

### Things the skill does on purpose

- Transcription runs locally. Your video and audio are not uploaded.
- Image search sends short English keywords drawn from your speech to public APIs listed in `data/asset-sources.json` and `data/decor-sources.json`. The skill tells the user before doing it.
- No API key is read, printed or stored by the skill.
- Downloads are limited to the accepted licenses and each one is recorded in `credits.json`.

If you change these properties in a fork, say so clearly in your own documentation.
