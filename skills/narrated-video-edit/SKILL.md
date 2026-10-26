---
name: narrated-video-edit
description: >-
  Edit a talking-head, podcast or voice-over clip into a designer-style social video: local word-by-word transcription, licensed B-roll, per-word captions, stickers, effects library, loudness normalisation, with approval gates. Use for "edit video theo giọng nói", TikTok, Reels, Shorts from spoken clips. Not for music-beat edits.
compatibility: Needs Node 20+, ffmpeg and ffprobe in PATH, Google Chrome, Python 3.11+ (an isolated .venv is created by setup.mjs with faster-whisper and opencv). Run "npm install" in scripts/ then "node setup.mjs". A GPU speeds transcription but is optional. Network only for the asset search and the first model download.
---

# Dựng video theo giọng nói (narrated-video-edit)

Biến một video có người nói hoặc giọng đọc thành video đã dựng kiểu social do editor thiết kế: caption đầy đủ có nhấn từ đang nói, B-roll đúng nội dung câu đang nói hiện như vật thể thiết kế (thẻ, polaroid, sticker, PiP...) với nhiều hiệu ứng và vị trí, emoji phản ứng, thẻ số liệu, zoom nhấn, SFX, độ to chuẩn hóa. Chi tiết thiết kế ở `references/09-social-edit-design.md`. Chạy hoàn toàn cục bộ trừ bước tìm tài nguyên. Quy trình có ba cổng người dùng và một bộ kiểm toán đo độc lập.

## Quy tắc cứng (đọc trước)

1. **Ba cổng là bắt buộc.** CỔNG 1: gửi người dùng bản tóm tắt kế hoạch có mốc giờ (storyboard) rồi dừng. CỔNG 2: gửi ảnh `assets-sheet.png` các tài nguyên đã chọn để người dùng duyệt tất cả, một phần hoặc không. CỔNG 3: đọc `out-sheet.png` bằng mắt trước khi giao. Cổng nghĩa là kết thúc lượt bằng câu hỏi, không chạy tiếp; chỉ khi người dùng nói rõ "nhanh" hoặc "tự chọn giúp tôi" mới được đi tiếp và phải ghi vào Giả định.
2. **Chỉ dùng tài nguyên có giấy phép.** Nguồn: thư mục của người dùng, rồi các nguồn khai báo ở `data/asset-sources.json` (Wikimedia Commons, Openverse, NASA, Cleveland Museum of Art; thêm nguồn là thêm dữ liệu), rồi nguồn tác tử tự tìm và xác minh trên chính trang tệp rồi đăng ký bằng `resolve-assets --register` (`references/04-assets-licenses.md`). Chỉ nhận CC0, miền công cộng và CC BY (danh sách trắng). Cấm BY-SA, NC, ND, giấy phép không rõ. KHÔNG tải từ YouTube, TikTok, Instagram, Google Images hay trang tải clip không rõ nguồn, kể cả khi người dùng bảo "tìm nhanh". Mọi tệp tải về phải có dòng trong `assets/credits.json`; CC BY phải ghi công trong mô tả video (`out.credits.txt`).
3. **Không bịa.** Chữ trên màn hình chỉ lấy từ lời nói (`words.json`) hoặc từ nguồn người dùng đưa (`userSource` trong kế hoạch). Số liệu trên thẻ phải có trong lời nói. Không dùng ảnh người thật để minh họa "một người nào đó" khi lời nói không nhắc đúng người ấy; không dùng logo hay nhãn hiệu khi lời nói không nhắc.
4. **Riêng tư.** Phiên âm chạy cục bộ; video và âm thanh không gửi đi đâu. Truy vấn tìm tài nguyên là từ khóa rút từ lời nói và được gửi tới API công cộng: nói điều này với người dùng ở cổng 1. Dùng API phiên âm hoặc TTS trả phí chỉ khi người dùng đồng ý sau khi nghe nhà cung cấp, dữ liệu gửi đi và chi phí. Không nhập hay in khóa API; khóa nằm trong biến môi trường của người dùng.
5. **Không giao khi audit trượt** hoặc khi chưa đọc ảnh duyệt hình. `audit-edit.mjs` phải thoát mã 0. Đo bằng số rồi mới nhìn, và nhìn thật.
6. **Không push, không đăng, không đổi cấu hình hệ thống** khi người dùng chưa đồng ý. Không sửa video gốc: mọi thứ ghi vào thư mục làm việc.
7. Trên Windows luôn đặt `PYTHONUTF8=1` khi chạy Python trực tiếp (các script đã tự đặt cho chính chúng).

## Công cụ (chạy bằng `node`, trong `scripts/`)

| Lệnh | Việc |
| --- | --- |
| `setup.mjs` | kiểm Node, ffmpeg, Chrome; tạo `.venv` với faster-whisper và opencv (một lần) |
| `analyze.mjs <video> --out work/analysis [--lang vi] [--prompt "tên riêng"]` | khâu A: âm thanh, `words.json` (từng từ có mốc giờ), `pauses.json`, `faces.json`, `shots.json`, độ to |
| `pick-highlights.mjs --analysis work/analysis --out work/highlights.json [--target 75]` | khâu B0 (video dài): chọn các đoạn quan trọng (số liệu, câu hỏi, từ khóa, đổi cảnh, có người nói), trải đều câu chuyện, ranh giới giữa hai từ |
| `segment-person.mjs --base work/base.mp4 --overlay work/overlay` | khâu D3 (chỉ khi có thẻ `bigtext`, chữ lớn sau người nói): tách người bằng MediaPipe ra `overlay/mask.mkv` (cần `node setup.mjs --with-segmentation`) |
| `edit-plan-ui.mjs --work work` | trang cục bộ để sửa trực tiếp phụ đề, ảnh minh họa, sticker, thẻ, emoji và xem khung thử (thay cho việc nhắn AI sửa nhiều lần) |
| `plan-skeleton.mjs --analysis work/analysis --style hype --out work/edit-plan.json [--keep work/highlights.json] [--layout auto|stack|follow] [--behind-text]` | khâu B: bộ khung kế hoạch (nhịp, cắt khoảng ngắt, cutaway, zoom, sticker, thẻ số, SFX) |
| `plan-lint.mjs --plan work/edit-plan.json --analysis work/analysis [--stage assets]` | kiểm kế hoạch: ranh giới từ, mật độ, số liệu có nguồn, chống slideshow |
| `plan-board.mjs --plan work/edit-plan.json --analysis work/analysis` | storyboard bằng ảnh cho CỔNG 1: mỗi sự kiện một hàng gồm khung hình gốc, mốc giờ, câu đang nói, xử lý, âm thanh (ra `plan-board.png`, `plan-board.md`) |
| `style-menu.mjs --out work/style-menu.html [--demos <thư mục demo>]` | trang HTML ngoại tuyến để người dùng CHỌN và TRỘN hiệu ứng (mã TRA-07...), rồi Copy prompt dán cho tác tử; mẫu và ba ràng buộc cố định ở `data/style-menu.json`. Người dùng đưa video tham chiếu thì dùng `scripts/reference-study.mjs --words` của skill đồng hành `beat-synced-video-edit` (kho Motion Atlas, không kèm theo gói này) (truyền `words.json` của `analyze.mjs`) |
| `resolve-assets.mjs --plan work/edit-plan.json [--user-assets dir] [--dry] [--register tệp --cutaway c03 --license ... --title ... --creator ... --page ...]` | khâu C: tìm và tải tài nguyên có giấy phép, `credits.json`, `assets-sheet.png` |
| `compose-base.mjs --plan ... --analysis ... --out work/base.mp4` | khâu D1: cắt, zoom nhấn, chèn cutaway bằng ffmpeg; ghi `plan.mapped.json` |
| `render-overlay.mjs --mapped work/plan.mapped.json --out work/overlay [--times 1,4]` | khâu D2: lớp phủ trong suốt (caption, showcase tài nguyên, emoji, sticker, thẻ, lower third); `--times` chụp khung thử |
| `finalize.mjs --base ... --overlay ... --mapped ... --out work/out.mp4` | khâu E: ghép, trộn SFX và nhạc nền, chuẩn hóa -14 LUFS, SRT, credits |
| `audit-edit.mjs --video work/out.mp4 --work work` | khâu F: kiểm toán độc lập, `out-sheet.png` |
| `sync-skill.mjs --to <thư mục>` | đồng bộ skill sang nơi khác (agy), bỏ .venv và node_modules |
| `fx-apply.mjs list|show|validate|apply|sound|catalog` | thư viện hiệu ứng `data/effects`: tra cứu, áp một hiệu ứng lên clip bất kỳ, sinh tiếng, sinh mục lục (xem `references/12-effects.md`) |
| `effects-selftest.mjs [--family f] [--id x] [--sheet] [--source video]` | chạy TỪNG hiệu ứng thật và đo (khung ngoài cửa sổ giữ nguyên, trong cửa sổ đổi rõ, không lộ góc đen, chớp sáng dưới 3 lần mỗi giây); `--sheet` dựng bảng ảnh duyệt |
| `selftest.mjs [--online]` | thử cả đường ống bằng dữ liệu tổng hợp (khoảng 80 giây) |

Dữ liệu: `data/brands.json` (thương hiệu và logo CC0), `data/decor-sources.json` (nguồn decor và danh sách trắng), `data/styles.json` (3 phong cách: `hype`, `explainer`, `documentary`, mỗi phong cách có màu, caption preset, mật độ, chuỗi kiểu trình bày `showcase`, `emoji`, `banned`), `data/emoji-map.json`, `data/effects/*.json` (thư viện hiệu ứng, 11 họ) và `data/effects-rules.json` (ngân sách và pool hiệu ứng theo phong cách). Mẫu: `templates/overlay.html`, `overlay.js`; gói sẵn `templates/fonts` và `templates/emoji`.

## Quy trình

**Bước 0 (một lần).** `cd scripts && npm install && node setup.mjs`. Thiếu gì thì sửa theo thông báo. Chạy `node selftest.mjs` khi nghi ngờ máy.

**Giai đoạn 1: HỎI VÀ PHÂN TÍCH**
1. Đọc `references/01-intake.md`. Hỏi tối đa bốn câu (video ở đâu, ngôn ngữ, định dạng và nền tảng, phong cách), kèm mặc định. Có nhiều ý mơ hồ thì hỏi trong một lượt.
2. Tạo thư mục làm việc ngoài thư mục skill: `work/`. Chạy `analyze.mjs`. Đọc `words.json`: có đúng ngôn ngữ, tên riêng, số không (`references/02-analysis.md`). Sai thì chạy lại với `--lang` và `--prompt`.

**Giai đoạn 2: LẬP KẾ HOẠCH (CỔNG 1)**
3. `plan-skeleton.mjs` với phong cách đã chọn. Đọc `references/03-planning.md`, rồi sửa `edit-plan.json`: viết lại từng `cutaways[].query` thành KHÁI NIỆM CẢNH bằng tiếng Anh (không chỉ danh từ), bỏ hoặc thêm mục, thêm `lowerThirds` nếu cần. Chạy `plan-lint.mjs` đến khi không còn FAIL.
4. Chạy `plan-board.mjs` rồi gửi người dùng `plan-board.png` kèm storyboard 8 đến 12 dòng: mốc giờ, lời nói, xử lý (cutaway gì, zoom, sticker, thẻ số), phong cách, cắt bao nhiêu giây khoảng ngắt, giả định. Nhắc điều ở quy tắc 4 về truy vấn. DỪNG.

**Giai đoạn 3: TÀI NGUYÊN (CỔNG 2)**
5. Sau khi người dùng đồng ý: `resolve-assets.mjs` (thêm `--user-assets` nếu họ có thư mục riêng). Xem `assets-sheet.png`: hình có đúng NGỮ CẢNH câu đang nói không (bài kiểm "đúng giờ nhưng sai hình"). Sai thì đổi truy vấn và chạy lại với `--only c03`. Không kết quả thì bỏ cutaway đó hoặc xin người dùng ảnh. Gửi `assets-sheet.png` cho người dùng duyệt. DỪNG.

**Giai đoạn 4: DỰNG**
6. `plan-lint.mjs --stage assets`, `compose-base.mjs`, rồi `render-overlay.mjs --times <5 mốc>` và đọc các khung thử ghép lên lớp nền (xem `references/05-compose-render.md`). Sửa đến khi sạch, rồi `render-overlay.mjs` đầy đủ và `finalize.mjs`. CHẠY TUẦN TỰ: chỉ chạy `finalize.mjs` SAU KHI `render-overlay.mjs` đầy đủ đã kết thúc (in dòng cuối và có `overlay-summary.json`); không chạy song song hai lệnh. `finalize.mjs` từ chối khi lớp phủ thiếu khung, và `audit-edit.mjs` so thành phẩm với nền cộng lớp phủ tại các mốc mẫu để bắt lỗi ghép từ lớp phủ cũ hoặc thiếu (chữ đứng, thẻ biến mất).

**Giai đoạn 5: KIỂM TOÁN VÀ GIAO (CỔNG 3)**
7. `audit-edit.mjs`. Mọi FAIL phải sửa (bảng nguyên nhân trong `references/06-audit.md`), tối đa ba vòng. Mở `out-sheet.png` và đọc bằng mắt: chữ có đè mặt, có sai ngữ cảnh hình, có cắt giữa câu.
8. Báo cáo: đường dẫn `out.mp4`, `out.srt`, `out.credits.txt` (nội dung cần dán vào mô tả video), phong cách, giả định, WARN còn lại, tài nguyên nào là minh họa chung chung. Hỏi trước khi push hoặc đăng.

## Chọn hiệu ứng dựng (thư viện `data/effects`)

`plan-skeleton` tự gợi ý chuyển cảnh ở chỗ nối, nhấn ở thẻ số và nhịp mở đầu theo `data/effects-rules.json` (`--no-effects` để tắt, `--look id,id` để phủ tông cho cả video). Bạn duyệt và sửa `effects` trong `edit-plan.json` theo nguyên tắc: mỗi hiệu ứng phục vụ một việc (nhấn ý, chuyển ý, đổi không khí, giữ chân), đổi hình mỗi 3 đến 7 giây là đủ, cú mạnh chạm cả khung hình ít thôi, chớp sáng dưới 3 lần mỗi giây. Muốn hiệu ứng chưa có: thêm một mục JSON vào `data/effects/<họ>.json` (cách viết, kiểm và xem ảnh duyệt ở `references/12-effects.md`), đừng viết bộ lọc ffmpeg rải rác trong kịch bản tạm; hiệu ứng là kỹ thuật chung tự viết, không chép preset, LUT hay tệp âm thanh của người khác.

## Chọn asset và decor (tác tử tự quyết theo nguyên tắc, không có danh sách cứng)

`plan-skeleton` đã gợi ý theo `data/decor-keywords.json`; việc của bạn là duyệt và sửa theo các nguyên tắc sau (mở rộng bảng dữ liệu khi gặp từ khóa mới, đừng viết danh sách riêng trong kịch bản tạm):
1. **Video gốc là nội dung.** Giữ nguyên và chạy liên tục; ảnh minh họa chỉ để diễn tả thứ được NHẮC TỚI mà KHÔNG có trong cảnh quay. Cảnh quay đã cho thấy thứ đó thì dùng icon, emoji, sparkle thay vì ảnh trùng lặp.
2. **Ưu tiên decor nhẹ.** Mỗi vài giây một sự kiện nhỏ (underline, icon, sparkle, zoom) tốt hơn vài ảnh lớn; ảnh chỉ khi lời nói nhắc vật thể cụ thể, chọn 1 ảnh cho mỗi ý.
3. **Truy vấn là cảnh cụ thể bằng tiếng Anh**; bỏ cutaway nếu kho công khai không có ảnh đúng (đừng nhét ảnh sai cho đủ chỉ tiêu).
4. **Loại ảnh có người xác định được** (chân dung, nhóm người, tài liệu có tên hay chữ ký) khi lời nói không nhắc đúng người đó. Loại ảnh gợi sự kiện nhạy cảm không liên quan (tai nạn, thảm họa).
5. **Logo chỉ khi lời nói nhắc thương hiệu** (`data/brands.json`); không dùng để ngụ ý hợp tác.
6. **Tránh mặt**: thẻ lớn không có chỗ cạnh mặt to thì chấp nhận bỏ (cảnh báo của `render-overlay`) thay vì che người nói.
7. **Số liệu và chữ trên màn hình chỉ từ lời nói** hoặc `userSource`.

## Điều kiện hoàn thành

- [ ] `words.json` đúng ngôn ngữ và tên riêng; đã báo người dùng về truy vấn gửi ra ngoài
- [ ] Người dùng đã duyệt storyboard (CỔNG 1) và tài nguyên (CỔNG 2), hoặc nói "nhanh"
- [ ] `plan-lint` không FAIL ở cả hai giai đoạn
- [ ] Mọi tài nguyên tải về có dòng trong `credits.json`, giấy phép nằm trong danh sách trắng
- [ ] `audit-edit.mjs` thoát mã 0; đã đọc `out-sheet.png` bằng mắt
- [ ] Báo cáo giao nêu giả định, WARN và những gì chưa kiểm chứng (khung mặt giả định, tiếng Việt chưa thử với giọng thật...)

## Tài liệu

| Tệp | Nội dung |
| --- | --- |
| `references/01-intake.md` | câu hỏi đầu vào, mặc định, ba phong cách, chế độ nhanh |
| `references/02-analysis.md` | phiên âm, mô hình, tiếng Việt, số và tên riêng, dò mặt, khoảng ngắt |
| `references/03-planning.md` | quy tắc dựng, viết truy vấn tốt, sticker, thẻ số, lower third, lược đồ `edit-plan.json` |
| `references/04-assets-licenses.md` | nguồn, giấy phép, ghi công, khi không có kết quả, cách thêm nguồn |
| `references/05-compose-render.md` | hai lớp, khung thử, hiệu năng, giới hạn đã biết |
| `references/06-audit.md` | từng hạng mục audit và cách sửa |
| `references/07-pitfalls.md` | bẫy đã gặp |
| `references/09-social-edit-design.md` | preset caption, kiểu trình bày cutaway, emoji, vùng an toàn video dọc, cách mở rộng |
| `references/11-reels-layout.md` | bố cục stack (video ngang sang dọc, decor ở nửa trên), thẻ title, compare, logos, trang sửa trực tiếp |
| `references/10-decor-assets.md` | nguồn decor đã xác minh giấy phép (emoji động Noto, icon Iconify), sparkle, confetti, 3 kiểu thẻ số, ghi công |
| `references/12-effects.md` | thư viện hiệu ứng: họ và engine, cách chọn, dùng trong kế hoạch, thêm hiệu ứng mới, bẫy ffmpeg |
| `references/12-effects-catalog.md` | mục lục tự sinh của toàn bộ hiệu ứng |
| `references/08-agy-delegation.md` | giao cho agy, bài thi |
