# Cài đặt

[Tiếng Việt](INSTALL.md) | [English](INSTALL.en.md)

Có hai việc phải xảy ra, và chúng độc lập với nhau:

1. **Đưa skill cho trợ lý của bạn** (phần hướng dẫn). Mục 2.
2. **Chuẩn bị chiếc máy sẽ làm việc** (FFmpeg, Chrome, Python, các mô hình). Mục 1 và 3.

Skill chỉ là công thức. FFmpeg, Chrome và mô hình giọng nói chạy trên máy tính của bạn; skill không tự cài chúng được từ bên trong sandbox của một cuộc chat.

> Phát triển và thử trên **Windows 11**. Script tự chọn `Scripts/python.exe` hay `bin/python` theo hệ điều hành nên macOS và Linux có thể chạy, nhưng chưa thử. Lệnh cho hai hệ này bên dưới là lệnh thông dụng, chưa được kiểm ở đây.

## 1. Máy cần gì

| Công cụ | Phiên bản | Kiểm | Cài (thông dụng) |
| --- | --- | --- | --- |
| Node.js | 20 trở lên | `node -v` | [nodejs.org](https://nodejs.org) |
| FFmpeg và ffprobe | bản đầy đủ gần đây | `ffmpeg -version` | Windows: `winget install Gyan.FFmpeg`. macOS: `brew install ffmpeg`. Linux: trình quản lý gói của bạn |
| Google Chrome | bản hiện hành | mở bình thường | [google.com/chrome](https://www.google.com/chrome/). Hoặc đặt `CHROME_PATH` tới một tệp chạy Chromium |
| Python | 3.11 trở lên, hoặc `uv` | `python --version` | [python.org](https://www.python.org) hoặc [uv](https://docs.astral.sh/uv/) |
| Đĩa | khoảng 1 GB cho self-test, thêm khoảng 3 GB cho mô hình `large-v3` ở lần chạy thật đầu tiên | | |

`ffmpeg` và `ffprobe` phải nằm trong `PATH`. Cài xong hãy mở terminal **mới**.

## 2. Đưa skill cho trợ lý

Tải **`narrated-video-edit-v1.1.0.zip`** ở [trang Releases](../../../releases/latest). Zip chứa đúng một thư mục `narrated-video-edit/`, bên trong có `SKILL.md`. Cấu trúc đó là yêu cầu của Claude: zip để `SKILL.md` lẻ ngay gốc sẽ không được nhận.

### A. Claude trên web hoặc ứng dụng máy tính

1. Bấm tên tài khoản hoặc ảnh đại diện (góc dưới bên trái), chọn **Cài đặt**. Ở một số phiên bản chỗ này tên là **Customize**, rồi **Skills**.
2. Mở **Skills**. Bấm **Thêm**, rồi **Tải Skill lên**.
3. Kéo zip vào khung nét đứt, hoặc duyệt tìm. Một lượt quét bảo mật chạy khi tải lên.
4. Bấm **Tải lên**, rồi **bật** skill.

Skill cần tài khoản bật thực thi mã; xem [bài hướng dẫn](https://support.claude.com/en/articles/12512198) của Anthropic. Nếu muốn xem tận mắt, có [video hướng dẫn 45 giây](media/install-guide-vi.mp4).

> Nhắc lại: tải lên chỉ làm Claude *biết* skill. Script của nó có chạy được hay không tùy môi trường. Xem mục "Chạy được ở đâu" trong [README](../README.md#cài-đặt).

### B. Claude Code

Cài cho cá nhân, dùng ở mọi dự án:

```bash
# macOS, Linux
mkdir -p ~/.claude/skills
unzip narrated-video-edit-v1.1.0.zip -d ~/.claude/skills
```

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
Expand-Archive .\narrated-video-edit-v1.1.0.zip -DestinationPath "$HOME\.claude\skills"
```

Kiểm có tệp `~/.claude/skills/narrated-video-edit/SKILL.md`. Chỉ cho một dự án thì dùng `<dự án>/.claude/skills/`. Chạy `claude` rồi mô tả việc cần làm, hoặc gõ `/narrated-video-edit`.

### C. Antigravity CLI

Chép thư mục `narrated-video-edit` vào `~/.gemini/antigravity-cli/skills/`. Nếu bạn giới hạn skill bằng `include_only` trong `~/.gemini/config/skills.json`, thêm `narrated-video-edit` vào đó. Giữ `description` của skill ngắn (skill này 329 ký tự): Antigravity CLI bỏ qua skill có mô tả dài.

### D. Ứng dụng khách Agent Skills khác

Thư mục theo đặc tả mở [Agent Skills](https://agentskills.io/specification). Đặt `narrated-video-edit/` vào nơi ứng dụng của bạn đọc skill.

### Hoặc từ bản clone, không cần zip

```bash
git clone https://github.com/Le-Ngoc-Tu/narrated-video-edit.git
cp -r narrated-video-edit/skills/narrated-video-edit ~/.claude/skills/
```

## 3. Chuẩn bị công cụ (một lần)

Chạy trong **thư mục skill đã cài**, ví dụ `~/.claude/skills/narrated-video-edit`:

```bash
cd scripts
npm install
node setup.mjs
node selftest.mjs
```

- `node setup.mjs` kiểm Node, FFmpeg và Chrome, rồi tạo `.venv` riêng có `faster-whisper` và `opencv-python-headless`. Nó không đụng vào Python của hệ thống. Cờ: `--skip-python` (bạn tự cung cấp Python, đặt `NVE_PYTHON` tới nó), `--with-segmentation` (thêm MediaPipe, khoảng 300 MB, chỉ cần cho chữ đặt phía sau người nói).
- `node selftest.mjs` chạy cả đường ống trên một giọng đọc tổng hợp kèm sẵn, với mô hình Whisper `small` (tải ở lần dùng đầu, khoảng nửa gigabyte). Thêm `--online` để có thêm một lượt tìm ảnh thật. Lần chạy khỏe mạnh kết thúc với mọi dòng đều `ok`. Khi mở issue, xin dán kèm kết quả này.
- Dựng thật mặc định dùng Whisper `large-v3`; nó tải một lần ở clip thật đầu tiên.

Biến môi trường có thể cần: `CHROME_PATH` (tệp chạy trình duyệt), `NVE_PYTHON` (Python có faster-whisper và OpenCV), `NVE_SEG_PYTHON`, `NVE_CACHE` (nơi lưu tệp tải về), `NVE_STYLES` và `NVE_EFFECTS` (dùng bản riêng của bảng phong cách hoặc thư mục hiệu ứng, xem [CUSTOMIZE.md](CUSTOMIZE.md)). Trên Windows, đặt `PYTHONUTF8=1` nếu bạn tự chạy các trợ giúp Python.

## 4. Lần chạy đầu

Nếu trợ lý không tìm thấy skill, hãy chỉ chỗ (ví dụ "skill nằm ở `~/.claude/skills/narrated-video-edit`"), rồi:

> Dùng narrated-video-edit dựng `~/Videos/talk.mp4`. Tiếng Việt, dọc cho Reels, phong cách explainer.

Thứ tự bạn sẽ thấy:

1. Vài câu hỏi ngắn kèm mặc định (video, ngôn ngữ, nền tảng, phong cách).
2. Một **ảnh storyboard** có mốc giờ và danh sách những gì sẽ thêm vào. Trợ lý dừng lại. Bạn trả lời để duyệt hoặc đổi.
3. Một **ảnh tổng hợp các hình đã chọn**. Trợ lý dừng lần nữa. Bỏ hình nào sai.
4. Video đã dựng `out.mp4`, kèm `out.srt` và `out.credits.txt`, cùng báo cáo kiểm toán. Dán `out.credits.txt` vào mô tả video.

Tệp làm việc nằm trong thư mục `work/` ngoài thư mục skill. Video gốc không bao giờ bị sửa.

## 5. Cập nhật và gỡ

- **Cập nhật:** tải zip mới và thay thư mục. Giữ `.venv` và `node_modules` nếu muốn khỏi cài lại (chúng không nằm trong zip). Nếu bạn đã sửa `data/`, hãy gộp thay đổi của bạn trước.
- **Gỡ:** xóa thư mục `narrated-video-edit`. Trong Claude: *Skills*, mở skill, gỡ nó.

## 6. Xử lý lỗi

| Triệu chứng | Nguyên nhân có khả năng và cách sửa |
| --- | --- |
| Claude từ chối zip, hoặc báo không có `SKILL.md` | Zip làm từ nội dung thư mục thay vì từ chính thư mục. Dùng zip phát hành, hoặc nén chính thư mục `narrated-video-edit` để các mục bắt đầu bằng `narrated-video-edit/` |
| Skill không tự kích hoạt | Bật nó ở Skills; hoặc gọi theo tên (`/narrated-video-edit` trong Claude Code); hoặc nói việc cần làm bằng lời gần với mô tả của skill (dựng video có giọng nói thành video social) |
| `setup.mjs`: không thấy ffmpeg hoặc ffprobe | Cài FFmpeg, mở terminal mới, kiểm `ffmpeg -version` |
| `setup.mjs`: không có Chrome | Cài Chrome hoặc đặt `CHROME_PATH` tới Chromium hay Edge |
| Lỗi Python hoặc thiếu `faster-whisper` | Chạy lại `node setup.mjs`; hoặc đặt `NVE_PYTHON` tới Python có `faster-whisper` và `opencv-python-headless<5` |
| Chữ lỗi hoặc `UnicodeEncodeError` trên Windows | Đặt `PYTHONUTF8=1` |
| Lần phiên âm đầu có vẻ đứng | Mô hình đang tải (`small` khoảng 0,5 GB, `large-v3` khoảng 3 GB). Kiểm mạng và dung lượng đĩa |
| Cảnh báo `NODE_TLS_REJECT_UNAUTHORIZED` mỗi lần chạy Node | Một biến môi trường trên máy bạn đang tắt kiểm tra chứng chỉ của mọi chương trình Node. Hãy bỏ nó khỏi biến môi trường |
| Kiểm toán trượt | Đọc `references/06-audit.md`, liệt kê từng mục kiểm và cách sửa. Dự kiến tối đa ba vòng sửa |
| Ít hoặc kém kết quả B-roll | Nguồn ảnh công khai có hạn; skill bỏ ô nào không lấp được. Bạn có thể đưa thư mục ảnh riêng bằng `--user-assets` |
| Chạy được ở Claude Code nhưng không chạy ở chat claude.ai | Xem "Chạy được ở đâu" trong README: sandbox của chat có thể thiếu Chrome, FFmpeg hoặc mạng |

Vẫn vướng? [Mở issue](../../../issues/new/choose) kèm hệ điều hành, phiên bản Node, lệnh lỗi và kết quả của nó.
