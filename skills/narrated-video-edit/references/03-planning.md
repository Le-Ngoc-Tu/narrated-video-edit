# 03. Lập kế hoạch dựng (khâu B)

`plan-skeleton.mjs` sinh bộ khung theo quy tắc xác định (cùng đầu vào cho cùng kết quả; `--seed` đổi các lựa chọn ngẫu nhiên). Bộ khung chỉ là điểm xuất phát: bạn đọc, sửa, rồi `plan-lint.mjs` chặn lỗi. Số trong tài liệu này là mốc hiệu chuẩn; sàn chống cẩu thả (ranh giới từ, số liệu có nguồn, giấy phép) thì cứng.

## Việc của từng thành phần

| Thành phần | Việc | Quy tắc |
| --- | --- | --- |
| `cuts` | bỏ khoảng ngắt dài | chỉ theo phong cách; không cắt giữa câu đang nói |
| `beats` | chia lời nói thành nhịp (câu hoặc mệnh đề) | vai: `hook` ở nhịp đầu, `cta` ở nhịp cuối; sửa `role` nếu rõ hơn (ví dụ `claim`, `example`, `number`) |
| `cutaways` | hình minh họa 1,2 đến 5s; `presentation` quyết định hình thức: mặc định là vật thể đè lên video gốc (`card`, `polaroid`, `pip`, `stack`; thêm `sticker`, `peek` khi cần), video gốc chạy liên tục; `fullbleed` phủ kín khung chỉ khi người dùng yêu cầu hoặc video không có hình đáng xem | bắt đầu ở ĐẦU một từ, kết thúc ở CUỐI một từ; hình phải minh họa đúng cái đang nói; sửa `presentation` TRƯỚC khi chạy `compose-base` |
| `punches` | zoom nhấn vào người nói | tại từ quan trọng, không trùng cutaway, cách nhau theo phong cách |
| `stats` | thẻ số liệu | giá trị lấy từ từ nguồn; không số nào ngoài lời nói |
| `decor` | sticker | gắn vào TỪ cụ thể; `underline` (thanh nhấn), `circle` (khung nền sau chữ), `arrow`, `sparkle` (lấp lánh), `confetti` bám chữ trong caption; `icon` (sticker Iconify cắt viền trắng, cần `query` tiếng Anh) đặt ở vùng trống; `burst`, `check`, `question`, `exclaim`, `badge` đặt ở vùng trống |
| `cards` | thẻ headline ở vùng trên: `title` (chữ lớn hai tầng), `compare` (hai cột), `logos` (chip thương hiệu khi lời nói nhắc) | xem `11-reels-layout.md`; số trên thẻ phải có trong lời nói |
| `emoji` | emoji phản ứng nằm cuối dòng caption |
| `cards` kiểu `bigtext` | chữ cực lớn đặt SAU người nói (người đè lên chữ nhờ mặt nạ tách người) | `text`; `behind: false` để chữ nằm phía trước; cần `node setup.mjs --with-segmentation` rồi `segment-person.mjs`; `plan-skeleton --behind-text` tự gợi ý ở nhịp mở đầu | không khai thì tự gợi ý theo `data/emoji-map.json`; khai mảng `[{ "id": "fire", "anchorWord": 12 }]` để chọn tay, mảng rỗng để tắt |
| `lowerThirds` | thẻ tên | chỉ tên và chức danh người dùng cung cấp |
| `sfx` | whoosh khi vào và ra cutaway, pop khi sticker hiện | chỉ nếu phong cách cho phép |
| `music` | nhạc nền | `file` là tệp người dùng được phép dùng; tự hạ khi có giọng |

## Decor tự gợi ý và quy trình chọn asset

`plan-skeleton` tự gợi ý icon (theo chủ đề), sparkle (lời khen), confetti (lời cảm ơn, kết) và lấp khoảng trống sự kiện hình bằng zoom nhấn, dựa vào `data/decor-keywords.json` và ngân sách `decor.auto` của phong cách trong `data/styles.json`. Muốn thêm từ khóa hay đổi mật độ: sửa hai tệp dữ liệu này, không sửa mã. Tác tử chỉ duyệt và chỉnh kết quả theo các nguyên tắc ở mục dưới.

## Viết truy vấn cutaway (quan trọng nhất)

Bộ khung điền `query` bằng các từ khóa dài nhất của nhịp ("roast minutes"). Đó chỉ là gợi ý. Viết lại mỗi truy vấn thành KHÁI NIỆM CẢNH bằng tiếng Anh (các kho ảnh quốc tế chủ yếu có nhãn tiếng Anh):

| Lời nói | Truy vấn kém | Truy vấn tốt |
| --- | --- | --- |
| "Roasting turns green seeds into brown beans" | `roasting green` | `coffee roasting machine` hoặc `green and roasted coffee beans` |
| "Đổ nước từ từ" | `water slowly` | `pour over coffee kettle` |
| "Thị trường sụt giảm" | `market decline` (có thể ra ảnh người thật vô danh) | `stock exchange trading floor` hoặc `red downward arrow chart` |

- Một cụm 2 đến 4 từ: vật thể cộng bối cảnh. Tránh tên riêng người, thương hiệu, địa danh nhỏ (kho công khai ít ảnh).
- Tránh truy vấn dễ ra ảnh người thật: ảnh chân dung gắn vào câu nói chung chung gây hiểu nhầm đó là người được nhắc. Dùng vật thể, cảnh, biểu đồ, bản đồ.
- Kiểm "đúng giờ nhưng sai hình": một ảnh trùng từ khóa nhưng sai ngữ cảnh (từ "red dot" ra đồ chơi laser cho mèo trong cảnh căng thẳng). Xem `assets-sheet.png` và đối chiếu câu đang nói.
- Không có tài nguyên tốt thì bỏ cutaway đó: nhịp vẫn có caption, zoom và sticker. Đừng nhét ảnh sai cho đủ chỉ tiêu.

## Vlog và video quay thật (khác video người nói tĩnh)

- Hình của vlog đã là nội dung: cutaway chỉ để minh họa thứ được NHẮC TỚI mà KHÔNG có trong cảnh quay (nơi chốn, món ăn, vật dụng nói tới nhưng không quay). Phủ ảnh lên chính thứ đang quay là dựng sai.
- Khoảng lặng dài thường là cảnh quay không lời: không cắt (`maxPauseToCut`).
- Thẻ số liệu chỉ cho con số nói rõ; nếu người nói chỉ đoán thì ghi "(đoán)" trong nhãn.
- `--size` đặt kích thước ra bằng kích thước gốc khi video nhỏ hơn 1080p.

## Bản highlight của video dài

Video dài (vlog vài chục phút) thường không cần dựng đủ. Chạy `pick-highlights.mjs --analysis work/analysis --out work/highlights.json --target 75` để chọn 5 đến 8 đoạn quan trọng (mỗi đoạn 7 đến 15s), rồi `plan-skeleton.mjs ... --keep work/highlights.json` (hoặc `--keep "44-61,175-185"` bằng giây). Phần ngoài các đoạn bị cắt, KHÔNG cắt khoảng lặng bên trong đoạn (giữ nguyên nhịp), mỗi chỗ nối có một tiếng whoosh. Gửi người dùng danh sách đoạn (mốc giờ và lời nói) ở CỔNG 1. Dựng mất vài phút thay vì hàng chục phút. Bộ chọn chỉ là gợi ý theo điểm số: người dùng có thể thay bằng mốc của họ.

## Mật độ và nhịp (mốc hiệu chuẩn, đã gắn vào `plan-lint`)

- Thời gian rời mặt người nói (chỉ tính cutaway `fullbleed`) không quá `brollMaxShare` của phong cách (hype 50%, explainer 45%, documentary 55%). Các kiểu `presentation` khác không che người nói nên không tính, nhưng không lặp liên tiếp cùng một kiểu.
- Không quá 2 cutaway liên tiếp cùng kiểu chuyển động; xen kẽ `push-in` và `drift`.
- Khoảng trống sự kiện hình (cutaway, zoom, sticker, thẻ, cắt) không quá 3,5s (khuyến nghị), 6s là lỗi. Video từ 12s trở lên cần ít nhất một zoom, một sticker, một cutaway (sàn chống slideshow).
- Sticker: không quá `maxPerMinute` của phong cách, mỗi cái sống 0,8 đến 2,6s tùy phong cách. Sticker không phải để lấp chỗ trống: gắn vào từ nhấn, câu hỏi, câu cảm thán, con số.
- Caption tối đa 2 dòng; mỗi lượt 1 đến 4 từ (hype) hoặc nhiều hơn (documentary).

## Lược đồ `edit-plan.json` (rút gọn)

```json
{
  "version": 1, "style": "hype", "source": "<đường dẫn video>", "orientation": "9x16", "duration": 19.9, "language": "en",
  "safeZone": { "x": 0.18, "y": 0.14, "w": 0.64, "h": 0.34, "assumed": true },
  "userSource": ["chuỗi người dùng nói: dùng khi thẻ có số không nằm trong lời nói"],
  "cuts": [{ "start": 3.5, "end": 4.47, "reason": "ngắt 0.97s" }],
  "beats": [{ "id": "b01", "startWord": 0, "endWord": 1, "start": 0, "end": 0.7, "role": "hook", "text": "..." }],
  "cutaways": [{ "id": "c01", "start": 1.0, "end": 2.3, "anchorWord": 2, "query": "coffee roasting machine", "kind": "auto|image|video", "presentation": "fullbleed|card|polaroid|pip|sticker|peek|stack", "label": "chú thích tùy chọn", "fit": "fill", "zoom": "push-in|drift", "asset": null, "status": "pending" }],
  "punches": [{ "id": "p1", "start": 0, "end": 0.9, "scale": 1.14, "anchorWord": 0 }],
  "stats": [{ "id": "s1", "anchorWord": 21, "value": "12", "label": "minutes", "start": 9.89, "end": 11.6 }],
  "decor": [{ "id": "d1", "type": "underline", "anchorWord": 8, "start": 2.96, "end": 4.3 }],
  "lowerThirds": [{ "title": "Tên người nói", "sub": "Chức danh", "start": 0.5, "end": 3.5 }],
  "captions": { "mode": "words|off", "preset": "bold|kinetic|pill|marker|minimal|editorial", "maxWords": 3, "emphasis": [2, 8], "yRatio": 0.8, "sizeRatio": 0.06 },
  "emoji": [{ "id": "fire", "anchorWord": 12 }],
  "cards": [{ "id": "k1", "type": "title|compare|logos|bigtext|comment|actions|counter|orbit|wall", "text": "...", "sub": "...", "start": 0.4, "end": 4.6 }],
  "layout": "stack", "layoutY": 0.38, "srcSize": { "w": 1280, "h": 720 },
  "sfx": [{ "t": 1.0, "type": "whoosh" }],
  "music": { "file": null, "duckDb": -12, "level": -22 }
}
```

Mọi mốc là giây trong video GỐC. `compose-base.mjs` đổi sang giờ sau khi cắt và ghi `plan.mapped.json` (thêm `oStart`, `oEnd`).

## Thẻ quanh và sau người nói (orbit, wall)

Hai kiểu "dấu ấn" dùng mặt nạ người nên cần `node setup.mjs --with-segmentation` (`plan-lint` báo FAIL nếu chưa cài). Cả hai nằm ở lớp SAU người nói (như `bigtext`), nên chạy `segment-person.mjs` giữa `render-overlay` và `finalize`.

- `orbit`: 3 đến 8 thẻ khung dọc chạy vòng quanh người nói; nửa sau của quỹ đạo nằm sau người, nửa trước nằm trước người. `{ "type": "orbit", "items": [{ "src": "reels/a.png" }, { "label": "Reel mới" }, ...], "start": 3.0, "end": 8.0 }`. Quỹ đạo canh theo khung mặt trong cửa sổ của thẻ.
- `wall`: nền video được thay bằng tường lưới thẻ xếp so le (couch wall), người nói đứng trước tường. `{ "type": "wall", "cols": 4, "items": [...], "start": 9.0, "end": 12.0 }` (`cols` từ 2 đến 6, mặc định 4).
- `items`: chuỗi (nhãn chữ) hoặc `{ "src": "ảnh", "label": "nhãn" }`. `src` là ảnh CỦA CHÍNH NGƯỜI DÙNG (đường dẫn tuyệt đối hoặc tương đối với thư mục kế hoạch; jpg, png, webp, svg) và được chép vào `overlay/assets/cards`; không lấy ảnh người lạ. Không có `src` thì thẻ là nhãn chữ trên nền màu của phong cách. Nhãn có số phải có nguồn trong `userSource` hoặc lời nói, như mọi thẻ khác.
- Giới hạn đã đo: `wall` phủ kín nền gốc, nên chỗ nào trong cửa sổ không có người thì tường hiện kín khung; chỉ dùng khi người nói ở trong khung suốt cửa sổ (kiểm bằng ảnh duyệt và cảnh báo "mặt nạ người hợp lý" của audit). Mặt nạ MediaPipe có viền hơi thô ở tóc. Mỗi video một thẻ mỗi kiểu, 3 đến 5 giây.
- Audit bỏ qua hai thẻ này khi đo chồng mặt (chúng nằm quanh hoặc sau người theo thiết kế).

## Video nguồn đã có phụ đề cứng (chữ in sẵn vào hình)

Hay gặp ở vlog đã được người quay tự thêm chữ. Phụ đề mới của skill nằm CHỒNG lên vùng chữ cũ nên hiện hai lớp chữ cùng lúc. Nhìn ảnh khung gốc (`plan-board.png`) để phát hiện; skill không tự phát hiện chữ cứng.

- Việc đầu tiên: HỎI người dùng muốn gì với chữ cũ (cắt bỏ phần đáy khung, giữ chữ cũ và không thêm phụ đề mới, hay chấp nhận hai lớp). Đây là quyết định của họ về nội dung, không tự chọn.
- Preset `pill` (viên nền tối) chỉ che MỘT PHẦN chữ cũ: đo trên vlog thật, chữ cũ vẫn lộ quanh và dưới viên chữ mới. Đừng báo "đã che hoàn toàn" nếu chưa xem khung thật.
- Người dùng muốn GIỮ chữ cũ: đặt `captions.mode` là `off` (không dựng phụ đề mới; sticker gắn vào chữ của phụ đề sẽ không hiện, thẻ và cutaway vẫn dựng bình thường, kiểm toán bỏ qua phép đo caption). Đo trên vlog thật: bản `off` chỉ còn một lớp chữ, sạch hơn nhiều so với hai lớp chồng.
- Muốn giữ cả hai nhưng tránh chồng: ghi đè `captions.yRatio` (vị trí dọc của dải phụ đề, 0 là mép trên) và `captions.sizeRatio` (cỡ chữ theo cạnh ngắn của khung) trong kế hoạch.
- Bố cục `stack` đặt video ở giữa khung dọc: phụ đề mới nằm trong vùng video nên chồng lên chữ cũ. Nếu muốn tránh chồng, đặt phụ đề ra vùng nền mờ phía dưới video hoặc cắt bỏ phần đáy của video nguồn trước khi dựng.

## Thẻ CTA và bằng chứng (comment, actions, counter)

Dùng cho video mạng xã hội khi người nói thật sự kêu gọi hành động hoặc đưa con số. Giao diện chung, màu theo phong cách; không dùng logo hay giao diện sao chép của nền tảng nào.

- `comment`: ô bình luận gõ từng chữ rồi đăng, tim đầy, phản hồi tùy chọn. `{ "type": "comment", "text": "EDIT", "reply": "Đã gửi, kiểm tra tin nhắn nhé.", "start": 40.2, "end": 44.8 }`. Đặt đúng lúc người nói kêu gọi bình luận (thường ở cuối video); cần 2,5 giây trở lên, 4 giây nếu có `reply`. `reply` chỉ viết khi người dùng thật sự có việc đó (gửi tài liệu, nhắn tin lại).
- `actions`: thanh tim, bình luận, chia sẻ, lưu; biểu tượng `active` (like, comment, share, save) đầy màu và nảy lên. `{ "type": "actions", "active": "save", "start": 9.0, "end": 11.2 }`. Đặt đúng lúc người nói từ tương ứng (save, share).
- `counter`: tiêu đề và 1 đến 3 dòng số đếm lên. `{ "type": "counter", "title": "Video trước", "rows": [{ "label": "lượt xem", "from": 86000, "to": 100000 }], "start": 2.5, "end": 6 }`. Số là số liệu THẬT của người dùng: `plan-lint` bắt buộc chữ trên thẻ có nguồn trong `userSource` (ví dụ `"100000 lượt xem"`) hoặc có trong lời nói. Không có số thật thì không dùng.

## Công thức hook cho khung dọc 9:16 (mốc tham khảo)

Đo từ ba video hướng dẫn edit của một tác giả (ghi trong skill đồng hành `beat-synced-video-edit` của kho Motion Atlas, không kèm theo gói này); dùng làm mốc so sánh, không phải luật.

- Chữ có mặt từ khung đầu, không đợi người nói mở miệng: một tiêu đề 3 đến 6 từ ở vùng trên của khung (khoảng 3 đến 25% chiều cao) cộng một viên "lời hứa" ngắn. Mặt người ở khoảng 20 đến 60% chiều cao nên chữ đầu không che mặt.
- Phụ đề bắt đầu khi có lời đầu tiên, không phủ sẵn lên khung đầu. Phụ đề nằm khoảng 62 đến 78% chiều cao, 1 đến 4 từ mỗi cụm.
- Có số thật thì đưa bằng chứng sớm (thẻ `counter`) thay vì khẳng định suông.
- Chuyển chương trong video hướng dẫn: hiệu ứng `iris-color` (đĩa màu nhấn đóng khoảng 0,2 giây, giữ 0,2 đến 0,3 giây, mở 0,1 đến 0,2 giây) đặt điểm cắt vào lúc giữ màu và ở đầu một từ; không lạm dụng, mỗi chương một lần.

## Storyboard gửi người dùng (CỔNG 1)

8 đến 12 dòng, mỗi dòng: mốc giờ gốc, câu nói (cắt gọn), xử lý. Ví dụ: `0:03 "Roasting turns green seeds into brown beans" → cutaway: máy rang cà phê (push-in), caption nhấn "ROASTING"`. Kèm: phong cách, tổng thời gian cắt, truy vấn sẽ gửi tới kho ảnh công khai, giả định. Rồi dừng.

Kèm ảnh: `node scripts/plan-board.mjs --plan work/edit-plan.json --analysis work/analysis` ra `work/plan-board.png` (mỗi sự kiện của kế hoạch một hàng: khung hình gốc tại lúc bắt đầu, mốc giờ, câu đang nói, xử lý, âm thanh) và `plan-board.md`. Ảnh cho người dùng thấy vị trí mặt trong khung tại từng điểm có thẻ hoặc cutaway, nên họ chốt hoặc đổi trước khi tải tài nguyên.
