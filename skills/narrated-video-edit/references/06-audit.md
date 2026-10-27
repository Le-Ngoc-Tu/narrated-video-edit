# 06. Kiểm toán (khâu F)

`node audit-edit.mjs --video work/out.mp4 --work work [--analysis work/analysis] [--no-asr] [--asr-model small]`

Mã thoát 0 khi không có FAIL. WARN cần giải thích trong báo cáo. Ghi `audit-edit.json` và `out-sheet.png`. Các phép đo độc lập với khâu dựng: audit không đọc kết quả khâu dựng mà đo lại trên tệp thành phẩm.

| Hạng mục | Cách đo | FAIL khi | Cách sửa |
| --- | --- | --- | --- |
| kích thước, 30 fps, có âm thanh, độ dài | ffprobe | khác chuẩn hoặc lệch kế hoạch quá 0,15s | dựng lại `compose-base` và `finalize` |
| độ to -14 LUFS, true peak | loudnorm đo | lệch quá 1,2 LU hoặc peak trên -1 dBTP | chạy lại `finalize`; kiểm nhạc nền quá to |
| khung đen | blackdetect | có đoạn đen trên 0,2s | thường do cutaway thiếu hoặc `-t` sai |
| khung đứng (WARN) | freezedetect | chỉ cảnh báo | người nói tĩnh trước nền tĩnh là bình thường; thêm zoom hoặc sticker nếu quá nhiều |
| mốc caption khớp bản đồ thời gian | tính lại từ `words.json` và `cuts` | lệch quá 1 khung | không tự sửa mốc trong `overlay-data.js`; sửa kế hoạch và dựng lại |
| lệch caption so với phiên âm lại | phiên âm LẠI âm thanh của `out.mp4`, so từng từ caption với từ cùng chữ gần nhất | trung vị trên 0,2s | cắt sai mốc hoặc trộn lệch; chạy lại từ `compose-base`. Khớp dưới 60% từ thì bỏ qua phép đo (WARN) |
| sticker, thẻ không che mặt | hộp bao so với khung mặt | trên 15% diện tích hộp | dời hoặc bỏ sticker; kiểm `faces.json` |
| caption đủ 100% số từ | từ trong lượt caption so với từ sau khi cắt | thiếu từ nào | lỗi nghiêm trọng: kiểm gộp lượt trong `render-overlay` |
| showcase đa dạng, đã dựng đủ; video dọc không chiếm 22% dưới khung | `overlay-summary.json` và hộp bao | không đủ chỗ, trùng kiểu liên tiếp, lấn vùng giao diện | đổi `presentation` hoặc cỡ, xem cảnh báo của `render-overlay` |
| caption không đè mặt (WARN) | hộp bao | trên 20% | caption tự dời; xem ảnh |
| phần tử trong khung | hộp bao | tràn ra ngoài | rút ngắn chữ thẻ hoặc đổi phông |
| khung mặt (WARN) | `safeZone.assumed` | chỉ cảnh báo | dò mặt không ra: đọc ảnh duyệt hình kỹ |
| cỡ caption, tương phản | tính từ phong cách | dưới 4,5% cạnh ngắn; chữ và viền dưới 4,5:1 | đổi phong cách hoặc màu |
| khoảng trống sự kiện | giờ thành phẩm của cutaway, zoom, sticker, thẻ | trên 6s (WARN trên 3,5s) | thêm một sự kiện gắn với từ nhấn |
| tỉ lệ rời mặt người nói | tổng cutaway chia thời lượng | vượt trần phong cách quá 5 điểm phần trăm | bỏ bớt cutaway |
| ghi công | `credits.json` | tệp tải về thiếu dòng | chạy lại `resolve-assets` |
| giấy phép trong danh sách trắng | `credits.json` | không phải cc0, pd, by | thay tài nguyên |
| có `out.credits.txt` khi có CC BY | tệp | thiếu | chạy lại `finalize` |
| số liệu trên màn hình có trong lời nói | so với `words.json` và `userSource` | có số không nguồn | sửa thẻ hoặc bỏ |
| caption viết đúng tên riêng theo từ điển | so caption với `glossary-report.json`, KHÔNG qua phiên âm lại (phiên âm lại nghe sai cùng chiều nên không bắt được "Cloud" thay vì "Claude") | từ đã thay không hiện đúng, hoặc còn dạng sai | sửa `work/glossary.json`, chạy `glossary-apply.mjs`, dựng lại |
| tên riêng mơ hồ đã được người dùng xác nhận | `glossary-report.json` | WARN khi còn biến thể chờ xác nhận | hỏi người dùng, khai `--terms` |
| tỉ lệ cảnh demo (người nói vắng mặt) | tổng thời lượng cutaway `demo` so với `demoMaxShare` của phong cách | vượt trần thêm 0,05 | rút ngắn cảnh demo hoặc cho người nói xuất hiện xen kẽ |
| caption không đè khung clip của cảnh demo | `overlay-boxes.json` so với khung demo trong `overlay-summary.json` | caption chồng khung trên 5% | dựng lại lớp phủ (caption tự dời xuống dưới khung); chỉnh `areaPortrait` của chủ đề nếu khung quá thấp |
| ảnh duyệt hình | tile 12 khung | không bao giờ FAIL | NGƯỜI phải đọc |

## Đọc `out-sheet.png`

Tám câu hỏi: (1) mặt người nói có bị che ở khung nào không; (2) caption đọc được trên mọi nền, kể cả trên ảnh cutaway sáng; (3) hình cutaway có đúng ngữ cảnh câu đang nói; (4) có chữ bị cắt hoặc tràn; (5) sticker có gắn vào từ đang nói hay trôi nổi vô nghĩa; (6) thẻ số liệu có đúng như người nói; (7) nhịp: có đoạn dài chỉ có mặt và caption mà không có gì xảy ra; (8) có chữ nào là tiếng Anh lẫn trong video tiếng Việt do tài nguyên mang chữ riêng (ảnh có biển hiệu). Ghi nhận xét cụ thể kèm mốc giờ vào báo cáo.

## Vòng sửa

Tối đa ba vòng. Sửa kế hoạch (`edit-plan.json`), không sửa trực tiếp tệp sinh ra. Sau mỗi sửa: `plan-lint` rồi dựng lại từ khâu bị ảnh hưởng. Cùng một FAIL sau hai vòng: dừng, báo người dùng nguyên nhân nghi ngờ.
