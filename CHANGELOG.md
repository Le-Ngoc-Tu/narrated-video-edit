# Nhật ký thay đổi

[Tiếng Việt](CHANGELOG.md) | [English](CHANGELOG.en.md)

Mọi thay đổi đáng chú ý được ghi ở đây. Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Chưa phát hành]

### Thêm

- **Diện mạo gốc theo DNA** (`references/13-original-design.md`): `plan-skeleton --design dna.json`, chủ đề demo `dna`, màu nhấn và preset caption theo DNA; chữ caption, viền và phông giữ theo phong cách để đọc được trên mọi khung hình. `plan-lint` chặn DNA có màu nhấn dưới 3:1 với tấm nền caption.
- Công cụ của lõi sáng tạo dùng chung: `style-ledger.mjs` (sổ chống lặp ở `~/.narrated-video-edit/`), `concept-board.mjs`, `fontpack.mjs`, hạt giống và lược đồ DNA.

### Sửa

- Bộ lọc FFmpeg đọc từ tệp: FFmpeg 9 bỏ `-filter_complex_script`, mã đổi sang `-/filter_complex` (bản sửa của người dùng khi cài trên máy khác). `ffmpeg()` trong `common.mjs` tự lùi về `-filter_complex_script` một lần khi ffmpeg không nhận (FFmpeg 6.x, vd Ubuntu 24.04).

### Đã kiểm

- `selftest.mjs` đạt 121/121; chạy thật trên một đoạn vlog dọc 22 giây với DNA riêng, `plan-lint` và `audit-edit` đạt.

## [1.1.0] - 2026-10-27

Thêm phần dựng cho video hướng dẫn công cụ kiểu "người nói rồi chuyển sang bản quay màn hình", rút ra từ việc đối chiếu skill với một reel tiếng Việt thật (kế hoạch 51 trong kho Motion Atlas).

### Thêm

- **Từ điển tên riêng** (`data/glossary.json`, `work/glossary.json`, `glossary-apply.mjs`): sửa chính tả SAU phiên âm vì Whisper nghe "Claude" thành "Cloud" cả khi đã có `--prompt`. Biến thể trùng từ thường chỉ được thay khi người dùng đã khai thuật ngữ; `plan-board` hỏi ở cổng đầu; bản gốc ở `words.raw.json`, mọi lần thay ở `glossary-report.json`; `plan-lint` và `audit-edit` kiểm độc lập với bộ nhận dạng.
- **Clip chạy thật trong cutaway** (`clipStart`, `clipSpeed`, `clipFit`) ở lớp nền và trong thẻ lớp phủ; clip của người dùng chạy một lần rồi giữ khung cuối.
- **Kiểu trình bày `demo`**: nền hoa văn tự vẽ bằng mã, khung bo góc có viền và bóng, zoom vào vùng (`focus`), chú thích circle, arrow, underline theo tọa độ clip (`marks`) bám theo vùng đích khi zoom, chủ đề ở `data/demo-themes.json` (`pastel`, `night`), trần riêng `demoMaxShare`.
- **Thẻ mới**: `chips`, `headline`, `textspam` (cờ `coverFace`), và `title` thêm `kicker`, `highlight`, `plate`. Chữ của các thẻ này phải có trong lời nói quanh mốc neo.
- **Phong cách `creator`**, `plan-skeleton --user-footage` (đọc `footage.json`), cổng chất lượng truy vấn ảnh stock (`abstractQuery`), và `plan-lint` chặn hai vật thể lớn trùng cửa sổ.

### Sửa

Lỗi tìm thấy khi dựng thử 104 video dọc (9 đến 18 giây) từ một vlog ngang 13 phút:

- `plan-skeleton --keep` sập hoặc ra kế hoạch gần rỗng khi đoạn giữ nằm gọn trong một nhịp liền mạch: biên `--keep` nay luôn là chỗ cắt nhịp.
- `plan-lint` chặn nhầm một sticker trong video ngắn (trần mật độ theo phút): trần nay tính theo số sticker, tối thiểu 1.
- Lời tiếng Việt gần như không có sticker vì từ khóa đòi từ 5 chữ cái: ngưỡng nay theo ngôn ngữ (`keywordMinLength` trong `data/decor-keywords.json`, tiếng Việt 4).
- Thẻ showcase rộng bị kéo ra ngoài khung khi hai vị trí đầu bị mặt chiếm.
- Caption chữ trắng trên nền pastel của cảnh demo gần như không đọc được: nay đổi sang chữ tối có quầng sáng.

### Đã kiểm

- `node selftest.mjs` đạt 118/118 từ bản sao trong kho này (Windows 11); `effects-selftest.mjs` đạt 190/190.
- Trên phiên âm thật của reel mẫu: 9/9 "Cloud" thành "Claude" sau khi khai thuật ngữ; bỏ 7 truy vấn ảnh rác; vị trí chú thích lệch dưới 1,2 px so với vật đánh dấu trong khung hình thật.

### Giới hạn đã biết

- Khung demo đã được dựng thử trên một vlog ngang thật (104 bản dọc, audit đạt cả 104) nhưng chưa trên bản quay màn hình thật. Trong khung dọc, clip 16:9 chỉ chiếm khoảng một phần ba chiều cao. Hai chủ đề nền là gợi ý ban đầu.
- Ranh giới cảnh từ `--user-footage` theo ranh giới nhịp (7 đến 10 giây): cần chỉnh `start` và `end` về đúng từ.
- Chỉ thử trên Windows 11.

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

[1.1.0]: https://github.com/Le-Ngoc-Tu/narrated-video-edit/releases/tag/v1.1.0
[1.0.0]: https://github.com/Le-Ngoc-Tu/narrated-video-edit/releases/tag/v1.0.0
