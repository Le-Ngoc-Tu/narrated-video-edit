# 05. Dựng và render (khâu D, E)

## Hai lớp

```
video gốc ─► cắt khoảng ngắt ─► zoom nhấn ─► cutaway ─► base.mp4 (giọng gốc) ──┐
                                                                                ├─► overlay ─► out.mp4
plan.mapped.json ─► trình duyệt + GSAP ─► overlay/frames/f_00000.png (alpha) ───┘
                                       └► SFX + nhạc nền (hạ khi có giọng) + loudnorm
```

Vì sao hai lớp: ffmpeg cắt, ghép, zoom và xử lý âm thanh nhanh, giữ chất lượng gốc; trình duyệt thiết kế chữ và chuyển động bằng GSAP với đồng hồ ảo (mọi khung là hàm của thời gian `seek(t)`, không CSS animation, không timer).

## D1: `compose-base.mjs`

- Giai đoạn 1: `trim`/`atrim` các đoạn giữ lại rồi `concat`; mỗi đoạn có `afade` 15 ms hai đầu để không nghe tiếng "tách". Chuẩn hóa về kích thước ra (`1080x1920` hoặc `1920x1080`), 30 fps, âm thanh 48 kHz stereo.
- Giai đoạn 2: zoom nhấn bằng `scale eval=frame` theo biểu thức thời gian rồi `crop` (tâm hơi cao, 35% chiều cao, vì mặt thường ở nửa trên); mỗi cutaway là một luồng riêng (ảnh `push-in` hoặc `drift`, clip thì lấp đầy khung), mờ vào và ra theo phong cách (hype 0,05s, explainer 0,2s, documentary 0,3s), rồi `overlay` có `enable='between(t,a,b)'`.
- Âm thanh của clip cutaway bị bỏ: giọng người nói chạy liên tục.
- Bộ lọc dài nên ghi vào tệp và đọc bằng `-/filter_complex <tệp>` (tránh lỗi dấu phẩy và ngoặc khi truyền qua dòng lệnh). FFmpeg 7 trở lên dùng cú pháp này và FFmpeg 9 đã bỏ `-filter_complex_script`; FFmpeg cũ hơn (6.x) chỉ có `-filter_complex_script`. Hàm `ffmpeg()` của `common.mjs` thử cú pháp mới rồi tự lùi về cú pháp cũ một lần, nên mã luôn viết `-/filter_complex`. Dùng `--keep` để giữ thư mục `.tmp` (các tệp bộ lọc) khi gỡ lỗi.
- Giới hạn đã biết: zoom Ken Burns dùng `crop` làm tròn đến điểm ảnh nguyên nên có thể thấy rung nhẹ ở chuyển động rất chậm trên ảnh phân giải thấp. Ảnh nhỏ hơn khung sẽ bị phóng to và mờ: ưu tiên ảnh từ 1600 px trở lên (bộ chấm điểm đã cộng điểm độ phân giải).

## D2: `render-overlay.mjs`

- Chia caption thành lượt: tối đa `maxWords` từ hoặc 22 ký tự (dọc) và 34 ký tự (ngang), ngắt tại dấu câu và khoảng lặng trên 0,4s. Cả lượt hiện cùng lúc (băng chữ), từ đang nói được nhấn theo preset, mỗi lượt hiện tối thiểu 0,7s. Chi tiết preset ở `09-social-edit-design.md`.
- Vị trí tự tránh: dải caption tránh khung mặt (dời xuống dưới hoặc lên trên mặt nếu cần), sticker và thẻ chọn vùng trống ngoài mặt, ngoài caption, ngoài các sticker trước. Không còn chỗ thì BỎ phần tử và in cảnh báo (thà thiếu còn hơn che mặt).
- `--times 1.0,4.5,...` chụp khung thử (`test_*.png`, nền trong suốt). Ghép lên khung lớp nền bằng ffmpeg hoặc PIL để xem. LÀM BƯỚC NÀY trước khi chụp đủ.
- Khung đầy đủ: khung không có gì hiện dùng chung một PNG trong suốt (`blank.png`) nên chỉ chụp khung có nội dung. Đo thực tế: khoảng 17 khung/giây ở 1080x1920 (video 17s trong 29s).
- `overlay-boxes.json`: hộp bao của mọi phần tử đang hiện, cứ 5 khung một mẫu; audit dùng để kiểm chồng mặt và tràn khung.
- Phông và emoji gói sẵn trong `templates/fonts` và `templates/emoji`, chép vào thư mục lớp phủ nên không phụ thuộc phông hệ thống. Vẫn xem khung thử, đặc biệt dấu tiếng Việt, trước khi dựng đủ.
- Cutaway không phải `fullbleed` được `compose-base` bỏ qua (chỉ kiểm tệp tồn tại); `render-overlay` chép ảnh vào `overlay/assets/` (clip thì lấy một khung hình) rồi dựng vật thể có hiệu ứng vào, trôi, ra.

## E: `finalize.mjs`

- SFX tổng hợp bằng ffmpeg (`whoosh` nhiễu hồng quét, `pop` sin ngắn, `ding` cho thẻ số), đặt theo `sfx[].t` của kế hoạch cộng `overlay-summary.json` (SFX của emoji, vật thể và thẻ số do lớp phủ sinh).
- Nhạc nền (nếu có): hạ `level` dB, nén theo giọng (`sidechaincompress`), lặp để đủ dài. Chỉ dùng nhạc người dùng cung cấp.
- Chuẩn hóa độ to hai lượt (đo rồi áp dụng) về -14 LUFS, true peak -2 dBTP (chừa chỗ cho phần vượt đỉnh khi mã hóa AAC).
- Ghép PNG alpha lên `base.mp4`, mã hóa H.264 CRF 17, `+faststart`.
- Ghi `out.srt` (từ các lượt caption), `out.credits.txt`, `out.mix.json`.

## Hiệu năng (RTX 3050, video mẫu 17s dọc)

Phân tích 4s (small) đến 30s (large-v3 lần đầu); lớp nền 12s; lớp phủ 29s; ghép 11s; audit 16s. Video 60s: ước tính vài phút. Video dài hơn nhiều: chia theo chương rồi nối, hoặc giảm số khung chụp bằng cách chỉ chụp khung có nội dung (đã làm).
