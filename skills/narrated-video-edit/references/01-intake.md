# 01. Cổng đầu vào

Mục tiêu: biết người dùng có gì, muốn gì, trước khi tốn thời gian phiên âm và dựng. Hỏi tối đa bốn câu, gom trong một lượt, mỗi câu có mặc định để người dùng chỉ cần gõ một dòng ("1b 2a 3a 4=hype").

## Câu hỏi

1. **Video nào?** Đường dẫn tệp. Nếu chưa có: dừng và xin. Không có người nói hoặc giọng đọc thì skill này không dùng được (nếu chỉ có nhạc, dùng skill đồng hành `beat-synced-video-edit` của kho Motion Atlas, không kèm theo gói này).
2. **Ngôn ngữ nói?** a) tự nhận [mặc định] b) tiếng Việt c) tiếng Anh d) khác. Tiếng Việt: nêu tên riêng, thuật ngữ và tên sản phẩm sẽ xuất hiện để đưa vào `--prompt` (nhận đúng chính tả).
3. **Đăng ở đâu và khung nào?** a) dọc 9:16 cho TikTok, Reels, Shorts [mặc định nếu video gốc dọc] b) ngang 16:9 cho YouTube c) giữ khung gốc. Khung ra theo hướng của video gốc; nếu người dùng muốn đổi hướng, báo trước là sẽ cắt (crop) để lấp đầy.
4. **Phong cách?** Mô tả ba lựa chọn, đề xuất một theo nội dung:

| Phong cách | Hợp với | Đặc trưng | Cấm |
| --- | --- | --- | --- |
| `hype` | clip ngắn 15 đến 60s, mẹo, review, tin nhanh | chữ to từng từ, zoom nhấn theo nhịp nói, sticker, SFX whoosh và pop, cắt hết khoảng ngắt từ 0,45s | caption trên 4 từ, sticker che mặt, nhạc to hơn giọng |
| `explainer` | hướng dẫn, kiến thức, giới thiệu sản phẩm, 30 đến 120s | caption sạch, B-roll Ken Burns, thẻ số liệu, mũi tên và gạch chân, cắt khoảng ngắt từ 0,7s | rung camera, neon, số liệu không có trong lời |
| `documentary` | câu chuyện, phỏng vấn, review dài, 60 đến 180s | caption nhỏ, B-roll dài, chuyển mờ mềm, không cắt nhịp thở | sticker hoạt hình, caption kiểu hype, chuyển cảnh dưới 0,5s |

Chi tiết số trong `data/styles.json`.

## Hỏi thêm khi thật sự cần (không bắt buộc)

- Nhạc nền: có tệp nhạc được phép dùng không? Không có thì không thêm nhạc (không tự lấy nhạc từ internet; giấy phép nhạc phức tạp hơn ảnh).
- Thư mục ảnh hoặc clip của riêng họ: nếu có, dùng trước (`--user-assets`).
- Thương hiệu: màu và phông riêng. Bản này chưa nhận màu hay phông từ kế hoạch: nếu họ có, sao chép `data/styles.json` ra ngoài thư mục skill, sửa `colors` và `fonts` của phong cách được chọn (giữ độ tương phản chữ và viền từ 4,5:1, audit sẽ kiểm) rồi đặt biến môi trường `NVE_STYLES` trỏ tới tệp đó khi chạy mọi lệnh.
- Thẻ tên (lower third): tên và chức danh người nói, nếu muốn. Chỉ ghi những gì họ cung cấp.

## Chế độ nhanh

Khi người dùng nói "nhanh", "làm luôn", "tự chọn giúp tôi": dùng mặc định cho mọi câu, đi tiếp qua các cổng, và ghi rõ từng giả định đã dùng trong báo cáo cuối (ngôn ngữ nhận tự động, phong cách `hype` hay `explainer` theo độ dài, không nhạc, tài nguyên chỉ từ nguồn công khai). Chế độ nhanh KHÔNG nới quy tắc giấy phép và trung thực.

## Mẫu tin nhắn gửi người dùng

```
Mình cần chốt vài điều trước khi dựng (gõ một dòng cũng được, mặc định in đậm):
1. Video: <đường dẫn>? 
2. Ngôn ngữ nói: **a) tự nhận** b) tiếng Việt c) tiếng Anh. Tên riêng cần nhận đúng: ...
3. Khung: **a) dọc 9:16** b) ngang 16:9
4. Phong cách: **hype** (nhanh, chữ to, sticker) / explainer (sạch, thẻ số liệu) / documentary (chậm, kể chuyện). Mình đề xuất <...> vì <...>.
Lưu ý: phiên âm chạy trên máy bạn; từ khóa lấy từ lời nói sẽ được gửi tới các kho ảnh công khai (Wikimedia, Openverse, NASA) để tìm tài nguyên.
```
