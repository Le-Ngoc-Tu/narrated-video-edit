# 02. Phân tích (khâu A)

`node analyze.mjs <video> --out work/analysis [--lang vi] [--model large-v3] [--prompt "..."] [--no-faces] [--words words.json]`

Ghi: `meta.json`, `audio.wav` (16 kHz mono), `words.json`, `pauses.json`, `faces.json`, `shots.json`, `loudness.json`.

## Phiên âm

- faster-whisper chạy cục bộ. Mặc định `large-v3` (độ chính xác cao nhất; cần khoảng 3 GB bộ nhớ GPU ở int8_float16, hoặc chạy CPU chậm hơn nhiều). Máy yếu hoặc cần nhanh: `--model small` hoặc `medium`. Mô hình tải một lần từ Hugging Face vào cache của người dùng (large-v3 khoảng 2,9 GB, small khoảng 460 MB): nói với người dùng nếu máy chưa có.
- Tự thử GPU rồi rơi về CPU. Ví dụ đo trên RTX 3050: 10 giây tiếng Anh phiên âm trong 1,4s (large-v3), nạp mô hình 14,5s.
- `words.json`: `words[{i,text,start,end,startMs,endMs,confidence}]`, `segments`, `language`. Định dạng tương thích kiểu `Caption` của Remotion (có `startMs`, `endMs`, `confidence`). `i` là chỉ số từ; kế hoạch neo vào `i`.
- Mốc từ của Whisper có thể lệch vài chục mili giây và đôi khi trễ ở đầu từ; audit đo lại độ lệch trên video thành phẩm (`audit-edit.mjs`).

## Việc phải làm sau khi chạy

1. Đọc `words.json` (ít nhất 20 từ đầu, mọi con số, mọi tên riêng). Sai ngôn ngữ: chạy lại với `--lang vi`. Sai tên riêng hoặc thuật ngữ: chạy lại với `--prompt "Motion Atlas, GSAP, ScrollTrigger"`. Từ sai còn lại: sửa tay `text` trong `words.json` (mốc giữ nguyên), vì caption lấy chữ từ đây.
2. Số: Whisper có thể viết "twelve" thành "12" hoặc ngược lại. Thẻ số liệu dùng chuỗi chữ số của từ nguồn; kiểm xem giá trị trên thẻ đọc đúng như người nói.
3. `confidence` thấp (dưới 0,5) ở nhiều từ nghĩa là âm thanh nhiễu hoặc sai ngôn ngữ: báo người dùng thay vì dựng tiếp.

## Khoảng ngắt (`pauses.json`)

Khoảng giữa hai từ từ 0,5s trở lên, trừ 0,18s đệm mỗi bên, là ứng viên để cắt. Chỉ là đề xuất: phong cách quyết định có cắt không (`cutPauses`, `minPauseToCut`). Cắt nhiều làm mọi mốc dịch; mọi bước sau dùng chung một bản đồ thời gian (`makeTimeMap` trong `common.mjs`) nên đừng tự tính lại bằng tay.

## Khung mặt (`faces.json`)

Video quay tay: mặt di chuyển và đổi cỡ liên tục nên hộp bao của mọi mặt có thể phủ gần cả khung. Skill vì vậy dùng hộp mặt THEO THỜI ĐIỂM (`facesIn` trong `plan-lib.mjs`), không dùng một khung cố định.

- Dò bằng YuNet (OpenCV Zoo, MIT, mô hình 232 KB gói sẵn ở `templates/models`): nhận cả mặt nghiêng và mặt nhỏ, cho thêm 5 điểm mốc (`marks`: mắt, mũi, khóe miệng) và điểm tin cậy. Thiếu mô hình hoặc OpenCV quá cũ thì dùng Haar (chỉ mặt nhìn thẳng; cần OpenCV dưới 5). Mẫu mỗi 0,5s, tọa độ theo tỉ lệ 0..1; trường `detector` ghi bộ dò đã dùng. Chỉ PHÁT HIỆN mặt, không nhận dạng danh tính. Đo trên vlog quay tay 13 phút: YuNet thấy mặt ở 50% số mẫu, Haar ở 30%.
- Không dò được mặt (người nói quay nghiêng, ánh sáng yếu, hoạt hình): `coverage` 0, kế hoạch dùng vùng an toàn mặc định ở phần giữa trên của khung và `audit-edit` báo WARN "khung mặt giả định". Khi đó phải kiểm bằng mắt trên ảnh duyệt hình xem sticker có che mặt không.
- Chưa kiểm chứng trên video người thật trong selftest (video mẫu là hình vẽ). Lần chạy đầu với video thật: mở `faces.json` xem `coverage`.

## Ranh giới cảnh gốc (`shots.json`)

Các lần cắt có sẵn trong video gốc (bộ lọc scene của ffmpeg). Dùng để tránh đặt zoom nhấn qua một cú cắt gốc; hiện chỉ ghi lại, chưa tự động tránh.

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách sửa |
| --- | --- | --- |
| `UnicodeEncodeError cp1252` | Python in tiếng Việt trên Windows | đặt `PYTHONUTF8=1` (script đã tự đặt) |
| Cảnh báo symlink của Hugging Face | Windows không bật Developer Mode | vô hại, bỏ qua |
| `Không nạp được model` | thiếu GPU, hết bộ nhớ, hoặc mất mạng lần đầu | dùng `--model small`, hoặc `--device cpu` qua `transcribe.py` |
| Video không có âm thanh | không có giọng để phiên âm | báo người dùng, dừng |
| Video quay dọc nhưng `meta.json` ngang | cờ xoay trong tệp | `analyze.mjs` đã đọc cờ rotation; kiểm `orientation` trong `meta.json` |
