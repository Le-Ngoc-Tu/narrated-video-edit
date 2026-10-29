# 07. Bẫy đã gặp

| Bẫy | Nguyên nhân | Cách tránh hoặc sửa |
| --- | --- | --- |
| `UnicodeEncodeError cp1252` khi Python in tiếng Việt | console Windows | `PYTHONUTF8=1`; mọi script Python đều tự `reconfigure` stdout |
| `faces.py` lỗi `CascadeClassifier` | OpenCV 5 bỏ lớp này | ghim `opencv-python-headless<5` (setup.mjs đã làm và kiểm) |
| `fetch` lỗi "Cannot convert argument to a ByteString" | `User-Agent` có chữ có dấu | tiêu đề HTTP phải ASCII |
| Caption của lượt trước còn hiện sau khi lượt đã ẩn | từ con đặt `visibility` riêng, đè lên `visibility` của lượt cha | từ con chỉ dùng `opacity`; để lượt cha quản `visibility` |
| Hai từ chồng lên nhau khi pop | khoảng cách giữa từ nhỏ, từ phóng 1,18 lần | `margin` 0,24em giữa các từ |
| Sticker `underline` không hiện | từ neo không nằm trong lượt caption nào (bị cắt) | `render-overlay` bỏ và cảnh báo; chọn từ khác |
| Mốc kết thúc rơi vào đoạn đã cắt cho giá trị rỗng | `toOut` trả null | `mapPlan` dùng mốc bắt đầu cộng thời lượng ngắn thay vì bỏ |
| Thẻ số liệu bị bỏ "không còn chỗ trống" | khung mặt giả định cộng dải caption chiếm gần hết khung dọc | thẻ cao khoảng 0,22 cạnh ngắn; hoặc dò mặt thật để thu nhỏ khung mặt |
| `Filter 'asplit' has output unconnected` | tách đường chỉ để chạy chuỗi nén khi không có nhạc | chỉ `asplit` khi có nhạc nền |
| "twelve" thành "12" | Whisper tự chuẩn hóa số | dùng chữ số của từ nguồn cho thẻ; kiểm lại bằng tai khi số quan trọng |
| Phiên âm tiếng Việt từ giọng tổng hợp sai nặng | eSpeak tiếng Việt khó nghe | không dùng TTS để kiểm tiếng Việt; dùng giọng người thật |
| Chuỗi `-filter_complex` dài lỗi vì dấu phẩy | shell và ffmpeg cùng xử lý ký tự | ghi tệp và dùng `-/filter_complex <tệp>` qua `ffmpeg()` của `common.mjs` (FFmpeg 9 bỏ `-filter_complex_script`, FFmpeg 6.x chưa có `-/`; hàm tự lùi về cú pháp cũ) |
| Ảnh tải về nhỏ, mờ khi phủ kín khung dọc | ảnh ngang bị cắt và phóng to | ưu tiên ảnh từ 1600 px; chấm điểm đã tính; hoặc dùng chiều ngang với `fit` khác (chưa hỗ trợ) |
| Kết quả tìm ảnh không đúng ngữ cảnh | khớp từ khóa nhưng sai nghĩa | đọc `assets-sheet.png`, đổi truy vấn, `--only` |
| `NODE_TLS_REJECT_UNAUTHORIZED=0` trong môi trường | cấu hình cũ của người dùng | tắt xác minh chứng chỉ cho mọi tiến trình Node; báo người dùng, không tự sửa |
| Bản dựng khác nhau giữa các lần | `--seed` khác hoặc mô hình phiên âm khác | ghi `seed` và `model` vào báo cáo |

## Bài học từ vlog thật 13 phút (tiếng Việt, 720p, quay tay)

| Phát hiện | Cách skill xử lý |
| --- | --- |
| Whisper large-v3 tiếng Việt: 2385 từ, độ tin cậy trung bình 0,92, 129s trên RTX 3050; sai tên riêng và từ mượn ("Hố Chí Minh", "Wingway") | đọc `words.json`, khai tên riêng bằng `--terms` hoặc `work/glossary.json` (từ điển áp sau phiên âm, `--prompt` một mình không đủ: "Claude" vẫn thành "Cloud" 6 lần trên 9); caption lấy chữ từ đây |
| Whisper không đặt dấu câu khi giọng kể liền mạch: nhịp dài tới 60s | `plan-skeleton` cắt nhịp khi quá 6s tại chỗ nghỉ nhỏ và bắt buộc ở 10s |
| Mặt chỉ dò thấy ở 30% mẫu (quay nghiêng, tóc giả, cầm máy tay) và hộp bao của mọi mặt phủ gần cả khung | không dùng một khung mặt cố định: sticker và thẻ tránh các hộp mặt trong chính cửa sổ thời gian của chúng (`facesIn`); dải caption chọn vị trí ít đè mặt nhất; audit kiểm theo từng thời điểm |
| Khoảng lặng dài (10 đến 40s) trong vlog là cảnh quay không lời (đang cho xem đồ, chơi bài), cắt đi là mất nội dung | `maxPauseToCut` của phong cách (mặc định 3s, hype 4s): khoảng lặng dài hơn không bị cắt |
| Người nói gần như không dừng nhưng hình vẫn đổi liên tục; luật "không quá 6s không có sự kiện" báo lỗi sai | khoảng trống sự kiện chỉ tính thời gian CÓ lời nói (`speechGap`), cộng cả các lần cắt cảnh có sẵn của video gốc, và ngưỡng theo phong cách (`maxEventGap`: hype 6, explainer 9, documentary 12) |
| Whisper tách số: "500" và ".000" là hai từ | kiểm số liệu ghép chữ số của tối đa 3 từ liền kề |
| Vài từ cùng mốc thời gian làm lượt caption có cửa sổ âm, chữ kẹt trên màn hình | `render-overlay` gộp lượt có cửa sổ dưới 0,12s vào lượt kế tiếp; selftest có phép thử |
| Từ khóa tự động cho tiếng Việt kém ("người", "nghìn" thành truy vấn) | bộ khung chỉ là gợi ý: tác tử PHẢI viết lại cutaway thành khái niệm cảnh tiếng Anh, và với vlog chỉ giữ cutaway cho thứ được nhắc mà KHÔNG nằm trong cảnh quay |
| Kho công khai trả logo (logo Hatsune Miku) và ảnh sai nghĩa (ống kính máy ảnh cho "đèn trợ sáng") | đọc `assets-sheet.png` và loại tay; không dùng logo hay nhãn hiệu khi lời nói không đòi hỏi |
| Video gốc 720p: dựng 1080p chỉ phóng to, tốn gấp đôi thời gian | `plan-skeleton --size 1280x720` (hoặc kích thước gốc) |
| Video dài: lớp nền trung gian CRF 14 nặng 1,25 GB cho 13 phút, tổng dựng khoảng 40 phút | cần ổ trống vài GB; chạy nền và theo dõi; chia chương nếu dài hơn nữa |
| Caption cũ dùng viền dày và chỉ hiện từng từ nên trông thô, người xem thấy câu thiếu | băng chữ đầy đủ, bóng mềm, nhấn từ đang nói (`09-social-edit-design.md`); audit đòi đủ 100% từ |
| Cutaway chỉ phủ kín giữa khung, vị trí đơn điệu | `presentation` đa dạng; vật thể trong lớp phủ có đặt chỗ tránh mặt và caption |
| Vật thể rộng không còn chỗ cạnh khuôn mặt to ở video dọc, bị bỏ | cảnh báo của `render-overlay`; đổi sang `sticker` hoặc `pip`, hoặc `fullbleed` |
| Caption chữ trắng trên nền pastel của cảnh `demo` gần như không đọc được | `render-overlay` ghi `demoLight` cho cảnh demo có nền sáng; caption trong cửa sổ đó dùng chữ tối có quầng sáng (kiểu `pill` có sẵn tấm nền nên giữ nguyên) |
| Video ngắn (9 đến 12 giây) bị `plan-lint` chặn vì một sticker thành 5 đến 6 sticker mỗi phút | trần mật độ tính theo số sticker, tối thiểu 1, khớp với sàn chống slideshow |
| `clip-path` cắt mất bóng đổ của thẻ | áp `clip-path` cho phần ảnh bên trong, không áp cho khung có bóng |
| Vòng thu nhỏ chữ theo `scrollWidth` làm caption co nhỏ vì emoji tràn khỏi dòng | chỉ đo chiều cao và độ rộng từng từ |

## Việc chưa kiểm chứng (nói thẳng trong báo cáo khi liên quan)

- Tiếng Việt: đã thử trên một vlog thật 13 phút (xem bảng trên), chưa thử nhiều giọng khác nhau hay nhiễu nền lớn; selftest vẫn dùng giọng tổng hợp tiếng Anh.
- Dò mặt: đã thử trên vlog thật; YuNet cho 50% mẫu có mặt so với 30% của Haar. Cảnh quay không có mặt (phong cảnh, đồ vật) vẫn không có hộp mặt: bố cục tự giữ vị trí cũ hoặc về giữa khung.
- Chất lượng khớp hình với lời nói trên kho công khai ngoài vài truy vấn thử.
- Video dài trên vài phút; nhiều người nói; video quay ngang chuyển sang dọc.
