## narrated-video-edit v1.0.0

An agent skill that turns a clip with a voice in it into a designer-style social video: local word-by-word transcription, per-word captions, B-roll from licensed sources, stickers, 190 measured effects, loudness normalisation, and an independent audit. Three mandatory user gates keep you in control.

**Download `narrated-video-edit-v1.0.0.zip` below and upload it to Claude** (Settings, then Skills, then Add, then Upload skill), or unzip it into `~/.claude/skills/` for Claude Code. Then prepare the machine once: `cd narrated-video-edit/scripts && npm install && node setup.mjs && node selftest.mjs`. Full steps: [docs/INSTALL.md](docs/INSTALL.md). Tutorial video: [docs/media/install-guide-en.mp4](docs/media/install-guide-en.mp4).

**This is a starting point, not a guaranteed result.** Expect to adjust it to your machine, your footage and your language. [docs/CUSTOMIZE.md](docs/CUSTOMIZE.md) shows where.

- Verified: `selftest.mjs` passes 68 of 68 checks from a clean copy on Windows 11.
- Not verified: macOS, Linux, and running inside a plain claude.ai chat sandbox.
- Skill instructions are in Vietnamese; the assistant answers in your language. English translation welcome.
- The zip is 4 MB and has the `narrated-video-edit/` folder at its top, as Claude requires. Its SHA-256 is in the `.sha256` file.

Thanks to the authors of FFmpeg, Whisper, faster-whisper, OpenCV, MediaPipe, Playwright, GSAP, lottie-web, Noto Emoji, Fluent Emoji, Iconify, five open fonts and the public image collections this project relies on. See [CREDITS.md](CREDITS.md).

---

## Bản phát hành v1.0.0 (tiếng Việt)

Skill cho trợ lý AI: biến clip có giọng nói thành video social kiểu editor thiết kế, với phiên âm cục bộ, caption từng từ, B-roll có giấy phép, sticker, 190 hiệu ứng đã đo, chuẩn hóa độ to và kiểm toán độc lập. Ba cổng người dùng bắt buộc để bạn luôn nắm quyền.

**Tải `narrated-video-edit-v1.0.0.zip` bên dưới và tải lên Claude** (Cài đặt, Skills, Thêm, Tải Skill lên), hoặc giải nén vào `~/.claude/skills/` cho Claude Code. Rồi chuẩn bị máy một lần: `cd narrated-video-edit/scripts && npm install && node setup.mjs && node selftest.mjs`. Các bước đầy đủ: [docs/INSTALL.vi.md](docs/INSTALL.vi.md). Video hướng dẫn: [docs/media/install-guide-vi.mp4](docs/media/install-guide-vi.mp4).

**Đây là điểm khởi đầu, không bảo đảm kết quả.** Hãy chuẩn bị chỉnh cho hợp máy, cảnh quay và ngôn ngữ của bạn. [docs/CUSTOMIZE.vi.md](docs/CUSTOMIZE.vi.md) chỉ chỗ chỉnh.

- Đã kiểm: `selftest.mjs` đạt 68/68 từ bản sao sạch trên Windows 11.
- Chưa kiểm: macOS, Linux, và chạy trong sandbox của một cuộc chat claude.ai thường.
- Hướng dẫn của skill viết bằng tiếng Việt; trợ lý trả lời bằng ngôn ngữ của bạn. Hoan nghênh bản dịch tiếng Anh.
- Zip nặng 4 MB, có thư mục `narrated-video-edit/` ở cấp trên cùng như Claude yêu cầu. SHA-256 nằm trong tệp `.sha256`.

Cảm ơn tác giả FFmpeg, Whisper, faster-whisper, OpenCV, MediaPipe, Playwright, GSAP, lottie-web, Noto Emoji, Fluent Emoji, Iconify, năm bộ phông mở và các kho ảnh công khai mà dự án dựa vào. Xem [CREDITS.vi.md](CREDITS.vi.md).
