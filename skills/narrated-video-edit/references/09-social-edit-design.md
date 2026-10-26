# 09. Thiết kế dựng kiểu social (caption, showcase, emoji)

Phần này mô tả cách lớp phủ trông và vận hành như một editor thiết kế dựng, không như "chữ cộng ảnh dán". Nguồn gốc các quy tắc: cách làm phổ biến của video dọc TikTok, Reels, Shorts (caption đa từ có nhấn từ đang nói, B-roll vào ra có chuyển động, emoji phản ứng, vùng an toàn giao diện) và các lỗi rút ra từ video thật (xem `07-pitfalls.md`).

## Nguyên tắc

1. **Caption là băng chữ đầy đủ.** Cả lượt chữ hiện cùng lúc, từ đang nói được nhấn (màu, nhấp nhô hoặc khung nền). Không bao giờ bỏ từ: audit đòi caption đủ 100% số từ, mỗi lượt hiện tối thiểu 0,7s nếu chỗ trống cho phép.
2. **Đổ bóng mềm, không viền dày.** Chữ dùng bóng nhiều lớp (`text-shadow`) hoặc nền mờ phía sau; viền stroke dày trông thô và ăn vào dấu tiếng Việt.
3. **Tài nguyên là vật thể thiết kế, không phải hình dán.** Thẻ bo góc có bóng nhiều lớp và ánh kính, polaroid có băng dính, sticker cắt viền trắng, PiP, thẻ ló ra từ mép, chồng thẻ. Mỗi vật thể có hiệu ứng vào, trôi nhẹ khi ở lại, hiệu ứng ra.
4. **Đa dạng có kiểm soát.** Kiểu trình bày, vị trí, hiệu ứng vào luân phiên; hai mục liên tiếp không trùng kiểu và vị trí.
5. **Giữ nguyên video gốc, chỉ đè decor lên.** Editor chuyên nghiệp không chuyển sang cảnh ảnh khác rồi mới quay lại video: cảnh gốc chạy liên tục, tài nguyên minh họa hiện như vật thể đè lên và đủ hình (không bị cắt hay ló ngoài khung). Vì vậy chuỗi `showcase.sequence` mặc định không có `fullbleed` và `peek`; hai kiểu này chỉ dùng khi người dùng yêu cầu hoặc khi video gốc không có hình đáng xem (voice-over thuần). Ảnh giữ gần đúng tỉ lệ gốc (cắt tối thiểu).
6. **Giữ nguyên người nói.** Vật thể chỉ chiếm vùng trống: tránh khung mặt theo thời điểm, dải caption và các vật thể cùng lúc. Hết chỗ thì bỏ mục đó và in cảnh báo.
7. **Vùng an toàn của video dọc (9:16).** Chừa khoảng 10% phía trên, 25 đến 26% phía dưới (giao diện nền tảng) và lề phải cho cột nút. Caption dọc nằm ở khoảng 60% chiều cao (`yRatioPortrait`), vật thể nằm trong vùng 10% đến 74%.

## Preset caption (`captions.preset`)

| Preset | Phông (đã gói sẵn, có tiếng Việt) | Cách nhấn từ đang nói | Hợp với |
| --- | --- | --- | --- |
| `bold` | Montserrat 900, chữ hoa | đổi sang màu nhấn, nhấp nhô nhẹ | hype, clip kể chuyện nhanh |
| `kinetic` | Anton, chữ hoa | từ phóng to, nghiêng xen kẽ | câu khẩu hiệu, tiêu đề |
| `pill` | Be Vietnam Pro 800 trên viên nền tối bo tròn | khung nền màu nhấn bo tròn sau từ | giải thích, hướng dẫn |
| `marker` | Be Vietnam Pro 900, chữ hoa | khung bút dạ nghiêng sau từ | review, mẹo |
| `minimal` | Be Vietnam Pro 600 | đổi màu nhấn | phim tài liệu nhẹ |
| `editorial` | Be Vietnam Pro 600, từ nhấn Lora nghiêng | không nảy, không đổi màu từng từ; chỉ từ nhấn là serif nghiêng màu nhấn | video hướng dẫn, kể chuyện |

Mặc định theo phong cách: `hype` là `bold`, `explainer` là `pill`, `documentary` là `minimal`. Đổi bằng `captions.preset` trong `edit-plan.json` (ghi đè phong cách) hoặc trong `data/styles.json`.

Từ nhấn (`captions.emphasis`) có màu thứ hai ở các preset đổi màu. Với `bold`, `kinetic`, `minimal` từ gắn sticker `underline` có thanh nhấn mảnh dưới chân chữ, `circle` có khung nền màu thứ hai sau chữ.

## Kiểu trình bày cutaway (`cutaways[].presentation`)

| Giá trị | Hình thức | Nằm ở lớp |
| --- | --- | --- |
| `fullbleed` | phủ kín khung, Ken Burns, rời mặt người nói; KHÔNG nằm trong chuỗi mặc định (xem nguyên tắc 5) | nền (`compose-base`) |
| `card` | thẻ bo góc, bóng nhiều lớp, ánh kính, nghiêng nhẹ | phủ |
| `polaroid` | khung ảnh giấy, băng dính, có thể có chú thích (`label`) | phủ |
| `pip` | khung ảnh nhỏ bo tròn lớn, thêm nhãn `label` nếu có | phủ |
| `sticker` | cắt tròn hoặc bo lớn, viền trắng như nhãn dán | phủ |
| `peek` | thẻ ló một nửa từ mép khung, trượt vào (một nửa ảnh bị khuất nên không nằm trong chuỗi mặc định) | phủ |
| `stack` | thẻ chính chồng hai thẻ nền lệch góc | phủ |

`plan-skeleton` gán `presentation` luân phiên theo `showcase.sequence` của phong cách. Chỉ `fullbleed` tính vào tỉ lệ rời mặt người nói (`brollMaxShare`) vì các kiểu còn lại không che người nói. Sửa tay `presentation` trong `edit-plan.json` trước khi chạy `compose-base`: lớp nền phải biết cutaway nào phủ kín.

Hiệu ứng vào (`entrance`, tự chọn luân phiên, ghi đè được bằng `cutaways[].entrance`): `pop` (nảy từ nhỏ, xoay), `slide` (trượt ngang kèm nghiêng), `flip` (lật 3D), `drop` (rơi và nảy), `mask` (lộ dần bằng mặt nạ). Mỗi kiểu có tập hiệu ứng hợp lệ (ví dụ `peek` chỉ `slide`, `sticker` chỉ `pop` hoặc `drop`). Khi ở lại, vật thể trôi nhẹ và ảnh bên trong phóng chậm; ra bằng thu nhỏ mờ dần hoặc trượt ra.

Thứ tự đặt chỗ: thử cỡ 100%, 82%, 66%; mỗi cỡ quét các vị trí hợp lệ, chấm điểm (tránh vị trí trùng mục trước, ưu tiên phần trên với video dọc, cộng ngẫu nhiên có hạt giống) và luân phiên trái phải. Phần ló của `peek` không tính là tràn khung.

Tài nguyên là clip: lấy một khung hình làm ảnh cho vật thể. Muốn clip chạy thật thì để `fullbleed`.

## Emoji phản ứng

Emoji (bản động Noto Lottie, CC BY 4.0, khi có; không thì Microsoft Fluent Emoji 3D, MIT, `templates/emoji/`) nằm ngay sau chữ cuối của lượt caption chứa từ khóa và bật đàn hồi tại từ đó; vì cùng dòng với caption nên không cần vùng trống riêng và không đè mặt. Bảng từ khóa: `data/emoji-map.json` (`any` là âm tiết hoặc từ đơn rõ nghĩa, `phrases` là cụm). Mật độ theo phong cách (`emoji.perMinute`, `minGapSec`; `documentary` mặc định tắt). Cùng emoji không lặp trong 25s.

Chọn tay: đặt `emoji` trong `edit-plan.json` là mảng `[{ "id": "fire", "anchorWord": 12 }]` (mảng rỗng để tắt hẳn). Có `emoji` thì bảng tự gợi ý không chạy. `id` là tên tệp trong `templates/emoji` (không đuôi).

## Thẻ số liệu và lower third

Thẻ số có 3 kiểu luân phiên (`sticker`, `ring`, `capsule`; xem `10-decor-assets.md`), số đếm lên tới giá trị nói trong video (chỉ số nguyên hoặc có dấu ngăn nghìn, dạng khác hiện nguyên), biểu tượng đi kèm theo đơn vị. Lower third là thanh nền tối bo góc, vạch nhấn bên trái, trượt vào từ mép. Mọi chữ vẫn phải có nguồn trong lời nói hoặc `userSource`.

## SFX

`pop` cho emoji và vật thể vào bằng `pop`, `mask`, `flip`; `whoosh` cho vật thể vào bằng `slide`, `drop`; `ding` cho thẻ số. Phong cách không cho phép (`sfx.pop`, `sfx.whoosh`) thì không phát. `render-overlay` ghi vào `overlay-summary.json` và `finalize` gộp vào lúc trộn âm.

## Phông và tài nguyên gói sẵn

`templates/fonts/` (Montserrat, Be Vietnam Pro, Anton, Bangers; giấy phép OFL kèm) và `templates/emoji/` được chép vào thư mục lớp phủ khi render, nên kết quả giống nhau trên mọi máy, không phụ thuộc phông hệ thống. Cả bốn họ phông đều có đủ dấu tiếng Việt. Thêm phông mới: chép tệp `.ttf`, khai `@font-face` trong `templates/overlay.html`, thêm một mục vào `PRESETS` trong `templates/overlay.js`.

## Audit bổ sung

`audit-edit.mjs` kiểm: caption đủ 100% từ; mọi showcase đã lên kế hoạch được dựng; đa dạng kiểu, vị trí, hiệu ứng vào (từ 3 vật thể trở lên); video dọc không chiếm 22% dưới khung; không tràn khung ngoài cửa sổ vào 0,65s đầu của mỗi phần tử. Các kiểm tra mặt, độ to, giấy phép giữ nguyên.

## Giới hạn đã biết

- Video dọc có khuôn mặt to ở giữa khung hầu như không còn chỗ cạnh bên: vật thể rộng sẽ bị bỏ và in cảnh báo. Giải pháp: dùng `sticker` hoặc `pip` nhỏ, đặt ở phần trống trên và dưới khuôn mặt, hoặc để `fullbleed`.
- Dò mặt chỉ nhận mặt nhìn thẳng nên có thể hụt ở video quay tay; vật thể có thể che mặt nghiêng. Xem ảnh duyệt hình (CỔNG 3).
- Ảnh minh họa chung chung (thẻ "wizard" cho một câu về phim) vẫn cần mắt người xác nhận ngữ cảnh ở CỔNG 2.
