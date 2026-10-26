## narrated-video-edit v1.0.0 (tiếng Việt)

Skill cho trợ lý AI: biến clip có giọng nói thành video social kiểu editor thiết kế, với phiên âm cục bộ, caption từng từ, B-roll có giấy phép, sticker, 190 hiệu ứng đã đo, chuẩn hóa độ to và kiểm toán độc lập. Ba cổng người dùng bắt buộc để bạn luôn nắm quyền.

**Tải `narrated-video-edit-v1.0.0.zip` bên dưới và tải lên Claude** (Cài đặt, Skills, Thêm, Tải Skill lên), hoặc giải nén vào `~/.claude/skills/` cho Claude Code. Rồi chuẩn bị máy một lần: `cd narrated-video-edit/scripts && npm install && node setup.mjs && node selftest.mjs`. Các bước đầy đủ: [docs/INSTALL.md](docs/INSTALL.md). Video hướng dẫn: [docs/media/install-guide-vi.mp4](docs/media/install-guide-vi.mp4).

**Đây là điểm khởi đầu, không bảo đảm kết quả.** Hãy chuẩn bị chỉnh cho hợp máy, cảnh quay và ngôn ngữ của bạn. [docs/CUSTOMIZE.md](docs/CUSTOMIZE.md) chỉ chỗ chỉnh.

- Đã kiểm: `selftest.mjs` đạt 68/68 từ bản sao sạch trên Windows 11; `effects-selftest.mjs` đạt 190/190.
- Chưa kiểm: macOS, Linux, và chạy trong sandbox của một cuộc chat claude.ai thường.
- Hướng dẫn của skill viết bằng tiếng Việt; trợ lý trả lời bằng ngôn ngữ của bạn. Hoan nghênh bản dịch tiếng Anh.
- Zip nặng 4 MB, có thư mục `narrated-video-edit/` ở cấp trên cùng như Claude yêu cầu. SHA-256 nằm trong tệp `.sha256`.

Cảm ơn tác giả FFmpeg, Whisper, faster-whisper, OpenCV, MediaPipe, Playwright, GSAP, lottie-web, Noto Emoji, Fluent Emoji, Iconify, năm bộ phông mở, các kho ảnh công khai, và Nattalie Choprasert với ba video hướng dẫn dựng với Claude. Xem [CREDITS.md](CREDITS.md).

---

## narrated-video-edit v1.0.0 (English)

An agent skill that turns a clip with a voice in it into a designer-style social video: local word-by-word transcription, per-word captions, B-roll from licensed sources, stickers, 190 measured effects, loudness normalisation, and an independent audit. Three mandatory user gates keep you in control.

**Download `narrated-video-edit-v1.0.0.zip` below and upload it to Claude** (Settings, then Skills, then Add, then Upload skill), or unzip it into `~/.claude/skills/` for Claude Code. Then prepare the machine once: `cd narrated-video-edit/scripts && npm install && node setup.mjs && node selftest.mjs`. Full steps: [docs/INSTALL.en.md](docs/INSTALL.en.md). Tutorial video: [docs/media/install-guide-en.mp4](docs/media/install-guide-en.mp4).

**This is a starting point, not a guaranteed result.** Expect to adjust it to your machine, your footage and your language. [docs/CUSTOMIZE.en.md](docs/CUSTOMIZE.en.md) shows where.

- Verified: `selftest.mjs` passes 68 of 68 checks from a clean copy on Windows 11; `effects-selftest.mjs` passes 190 of 190.
- Not verified: macOS, Linux, and running inside a plain claude.ai chat sandbox.
- Skill instructions are in Vietnamese; the assistant answers in your language. English translation welcome.
- The zip is 4 MB and has the `narrated-video-edit/` folder at its top, as Claude requires. Its SHA-256 is in the `.sha256` file.

Thanks to the authors of FFmpeg, Whisper, faster-whisper, OpenCV, MediaPipe, Playwright, GSAP, lottie-web, Noto Emoji, Fluent Emoji, Iconify, five open fonts, the public image collections, and Nattalie Choprasert for three tutorials on editing videos with Claude. See [CREDITS.en.md](CREDITS.en.md).
