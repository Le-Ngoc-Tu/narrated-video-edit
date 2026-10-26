# 11. Bố cục reels: video giữ nguyên, thẻ decor ở nửa trên, sửa kế hoạch trực tiếp

Rút từ việc xem 4 reel dựng bằng AI của một creator người Việt (đọc hình và chữ trên màn hình, không có lời thoại): video người nói luôn chạy liên tục, decor chỉ đè lên, nửa trên khung dành cho thẻ minh họa, và điểm bán chính là "sửa trực tiếp thay vì nhắn AI sửa". Phần này là cách skill làm theo hướng đó. Không sao chép hình hay chữ của reel nào.

## Khuôn mặt làm nền cho mọi quyết định

`analyze.mjs` dò mặt bằng YuNet (`faces.json`: hộp, 5 điểm mốc, điểm tin cậy; chỉ phát hiện, không nhận dạng). Từ đó:

- decor tránh mặt theo từng thời điểm (như trước, nhưng thấy mặt ở nhiều khung hơn);
- zoom nhấn NEO vào mặt người nói: mặt đứng yên trên màn hình khi khung phóng to (không còn phóng vào giữa khung);
- `plan-skeleton --layout auto` chọn bố cục dọc: `follow` khi mặt có ở ít nhất 40% mẫu và rộng từ 8% khung, ngược lại `stack`.

## Bố cục `follow` (khung cắt 9:16 bám mặt)

`plan-skeleton ... --layout follow` cắt từ video ngang một khung 9:16 đi theo mặt người nói: mặt lớn nhất làm mục tiêu, vùng chết 2% chiều rộng, giới hạn tốc độ 0,25 chiều rộng mỗi giây, mất mặt thì giữ vị trí cũ tối đa 3s rồi trôi về giữa. Đường đi lưu trong `plan.follow` (rút gọn Douglas-Peucker); `compose-base` dựng bằng `crop` có biểu thức theo thời gian. Khung mặt được đổi sang khung dọc nên decor, caption và audit dùng đúng hệ toạ độ. Video gốc 720p cắt còn khoảng 405x720 rồi phóng lên: nên xuất 720x1280 (mặc định khi gốc thấp hơn 1080p).

## Chữ lớn sau người nói (`bigtext`)

Thẻ `{ "type": "bigtext", "text": "..." }` dựng chữ cực lớn (gradient, hai dòng khi dài) ở lớp `behind`, căn theo khung mặt. `segment-person.mjs` tách người bằng MediaPipe Selfie Segmentation (Google, Apache-2.0; hai mô hình 250 KB gói sẵn, giấy phép và nguồn ở `templates/models`; chỉ tách người khỏi nền, không nhận dạng) ra `overlay/mask.mkv`, và `finalize.mjs` ghép: nền, rồi chữ, rồi người (video gốc nhân mặt nạ), rồi lớp phủ phía trước.

```
node setup.mjs --with-segmentation          # một lần: tạo .venv-seg riêng (mediapipe, khoảng 300 MB)
node render-overlay.mjs ...                 # ghi overlay/frames và overlay/behind
node segment-person.mjs --base work/base.mp4 --overlay work/overlay
node finalize.mjs ...                       # chưa có mask.mkv thì dừng và báo cách làm
```

Hiệu quả nhất ở cảnh trung cận (người chiếm dưới khoảng 60% khung) để chữ lộ ra hai bên đầu và vai. Cận mặt gần kín khung thì chữ bị che gần hết: audit cảnh báo khi diện tích người trên 97% hoặc dưới 3%. Mặt nạ có thể sót phần viền tóc và tay; xem ảnh duyệt.

## Bố cục `stack` (video ngang sang dọc 9:16)

`plan-skeleton.mjs ... --layout stack --size 1080x1920` đổi video ngang thành khung dọc:

- Video gốc nằm gọn giữa khung (vừa chiều ngang, từ khoảng 38% chiều cao), nền là bản mờ tối của chính nó. Không cắt xén hình gốc.
- Nửa trên (khoảng 6% đến 36% chiều cao) là vùng decor: ảnh minh họa, sticker, thẻ headline. Cả vùng video gốc là vùng cấm: mọi phần tử decor tránh nó (audit kiểm).
- Caption đè lên đáy video, không vào 26% dưới khung (giao diện nền tảng).
- Kế hoạch ghi `layout: "stack"`, `layoutY`, `srcSize`; `compose-base` dựng nền mờ cộng video bằng ffmpeg (`gblur`, `overlay`); khung mặt của `faces.json` được đổi sang khung dọc.
- Video gốc đã là dọc thì không dùng stack (người nói đã chiếm cả khung; decor chỉ nên đè lên vùng trống như thường lệ).

## Thẻ headline (`cards` trong `edit-plan.json`)

| Kiểu | Hình thức | Trường |
| --- | --- | --- |
| `title` | chữ lớn hai tầng ở vùng trên, lộ dần, có sparkle | `text`, `sub` |
| `compare` | hai thẻ so sánh có icon, dấu × ở giữa | `left` và `right`: `title`, `sub`, `icon` (truy vấn tiếng Anh cho Iconify) |
| `logos` | chip thương hiệu nối nhau bằng nét đứt, nhãn dưới | `brands`: danh sách mã trong `data/brands.json` |

Thẻ cũng có `start` và `end` (giây trong video gốc). Chữ trên thẻ có số phải có trong lời nói hoặc `userSource` (lint kiểm). `plan-skeleton` tự gợi ý thẻ `logos` khi lời nói nhắc thương hiệu trong `data/brands.json`; `title` và `compare` do tác tử viết theo nội dung (đừng bịa số liệu).

Logo lấy từ bộ `logos` và `simple-icons` của Iconify (CC0). CC0 là giấy phép của hình vẽ; nhãn hiệu vẫn thuộc chủ sở hữu, nên chỉ dùng chip logo khi lời nói nhắc đúng thương hiệu đó, không dùng để ngụ ý hợp tác hay tài trợ.

## Sửa trực tiếp (`edit-plan-ui.mjs`)

```
node edit-plan-ui.mjs --work work [--analysis work/analysis] [--port 8765]
```

Mở trang `http://127.0.0.1:8765` (chỉ lắng nghe trên máy bạn). Sửa được:

- phụ đề: từng từ (ghi vào `captions.overrides`, giữ nguyên mốc giờ; sửa lỗi phiên âm như "pds" thành "pdf");
- ảnh minh họa: kiểu trình bày, truy vấn, chú thích, mốc giờ;
- sticker và icon, thẻ headline, thẻ số liệu, emoji (tự gợi ý hoặc tự chọn).

"Lưu" ghi đè `edit-plan.json` (bản cũ ở `edit-plan.bak.json`). "Xem" lưu rồi dựng khung thử tại một giây của video gốc, ghép lên `work/base.mp4`. Đổi kiểu trình bày sang hoặc từ `fullbleed`, đổi cắt, hoặc đổi tài nguyên: chạy lại `resolve-assets` (với mục mới) và `compose-base`; còn lại chỉ cần `render-overlay` và `finalize`. Đây là thay cho việc nhắn AI sửa lặp đi lặp lại: AI dựng bản đầu, người sửa các chi tiết bằng tay.

## Giới hạn đã biết

- Bố cục stack đã thử trên video bài giảng có lời thuyết minh (hình slide, không có mặt); follow và chữ sau người nói đã thử trên vlog quay tay (một người nói, cảnh selfie). Chưa thử nhiều người nói trong khung.
- Chọn mục tiêu bám mặt hiện là mặt lớn nhất; chưa có nhận diện người đang nói khi có nhiều mặt.
- Nửa dưới khung (dưới video gốc) hiện để trống; chưa có phần tử nào dùng vùng đó.
- Ảnh minh họa chung chung ở vùng trên vẫn cần mắt người xác nhận ngữ cảnh ở CỔNG 2; tránh ảnh có người xác định được hoặc hồ sơ tài liệu có chữ ký.
- Icon tìm theo tên emoji tiếng Anh: truy vấn trừu tượng ít kết quả, nên chọn vật thể cụ thể (robot, gear, factory).
