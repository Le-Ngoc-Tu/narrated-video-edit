# 10. Decor có hình: emoji động, icon, hiệu ứng, thẻ số

Phần này là kết quả nghiên cứu nguồn decor công khai (xác minh giấy phép ngày 2026-10-22, chi tiết trong `data/decor-sources.json`) và cách skill dùng chúng. Nguyên tắc như tài nguyên minh họa: chỉ dùng giấy phép trong danh sách trắng, mọi tệp tải về có ghi công khi cần, có chế độ offline.

## Nguồn đã xác minh

| Nguồn | Giấy phép | Dùng cho | Trạng thái |
| --- | --- | --- | --- |
| Fluent Emoji 3D (Microsoft) | MIT | emoji tĩnh, dự phòng | gói sẵn trong `templates/emoji` |
| Noto animated emoji (Google) | CC BY 4.0 (trang chính thức ghi rõ), truy cập không cần khóa | emoji động Lottie trong caption và thẻ số | tải theo yêu cầu, 47/62 emoji của skill có bản động; CẦN ghi công |
| Iconify (api.iconify.design) | tùy bộ, có SPDX cho từng bộ trong `collections.json` | sticker icon màu theo từ khóa tiếng Anh (bộ `fluent-emoji-flat` MIT, `noto` Apache-2.0, `fxemoji` Apache-2.0, `twemoji` và `streamline-emojis` CC BY 4.0) | tải theo yêu cầu, ưu tiên bộ không cần ghi công |
| lottie-web (Airbnb) | MIT | phát Lottie trong lớp phủ | gói sẵn `templates/vendor/lottie.min.js` |
| Hiệu ứng sinh bằng mã | không có | sparkle, confetti, nhãn dán, vòng vẽ dần | trong `overlay.js` |

Logo thương hiệu: bộ `logos` và `simple-icons` của Iconify (đều CC0, danh sách ở `data/brands.json`); nhãn hiệu vẫn thuộc chủ sở hữu, chỉ dùng khi lời nói nhắc đúng thương hiệu.

Đã loại: unDraw (giấy phép riêng cấm phân phối theo gói và cấm dùng để huấn luyện mô hình AI), LottieFiles (giấy phép Lottie Simple License khác nhau theo tệp, bản sửa phải giữ cùng giấy phép, không có API không khóa), OpenMoji (CC BY-SA: SA không nằm trong danh sách trắng). Open Peeps (CC0) và Kenney (CC0) hợp lệ nhưng chưa dùng: không cần cho decor của video nói.

Danh sách trắng SPDX: MIT, ISC, Apache-2.0, CC0-1.0, Unlicense, CC-BY-4.0, BSD-3-Clause. Cần ghi công: CC-BY.

## Cách hoạt động

- **Emoji động.** Khi `style.emoji.animated` bật (mặc định `hype` và `explainer`), `render-overlay` thử lấy Lottie Noto cho emoji được chọn (bảng `data/noto-lottie.json`: id emoji của skill sang mã điểm Unicode). Có thì nhúng vào `overlay-data.js` và phát bằng `lottie-web`; mỗi khung gọi `goToAndStop` theo giờ lớp phủ nên kết quả xác định (đã thử: tua lại cho ảnh giống hệt từng bit). Không có hoặc mất mạng thì dùng PNG tĩnh. Cũng áp cho biểu tượng trong thẻ số.
- **Icon Iconify (`decor.type = "icon"`).** Đặt trong `edit-plan.json`: `{ "id": "d5", "type": "icon", "query": "shopping bags", "anchorWord": 31, "start": 12.3, "end": 14.1 }`. `query` là khái niệm tiếng Anh (cùng quy tắc viết truy vấn cutaway). `render-overlay` tìm trong các bộ màu trong danh sách trắng, lấy SVG, dựng thành sticker cắt viền trắng và đặt vào vùng trống tránh mặt. Không tìm được thì bỏ và in cảnh báo.
- **Hiệu ứng mã (`sparkle`, `confetti`).** Gắn vào một từ (`anchorWord`): sparkle là các ngôi sao bốn cánh nhấp nháy quanh từ, confetti là các mảnh màu bắn lên rồi rơi. Vị trí hạt là hàm của chỉ số, không dùng số ngẫu nhiên, nên dựng lại cho cùng kết quả.
- **Thẻ số liệu.** Ba kiểu luân phiên theo `style.statVariants`: `sticker` (nhãn vàng nghiêng viền trắng), `ring` (huy chương tròn, vòng vẽ dần), `capsule` (viên thuốc có biểu tượng tròn, vệt sáng quét). Số đếm lên tới giá trị được nói; biểu tượng đi kèm chọn theo đơn vị ngay sau con số (`data/emoji-map.json`, mục `units`); `accents.statSparkle` thêm lấp lánh quanh thẻ khi hiện. Ghim một kiểu bằng `--stat-variant` hoặc `statVariant` trong kế hoạch.

## Mạng, bộ nhớ đệm, ghi công

- Từ khóa tìm icon gửi tới `api.iconify.design` và Lottie lấy từ `fonts.gstatic.com`: nói điều này với người dùng ở CỔNG 1 cùng truy vấn tài nguyên minh họa.
- Bộ nhớ đệm ở `~/.cache/narrated-video-edit` (đổi bằng `NVE_CACHE`). `render-overlay --offline` bỏ qua mạng hoàn toàn.
- Giấy phép cần ghi công được gom vào `overlay-summary.json` (`credits`), `finalize` thêm mục "Decor:" vào `out.credits.txt` và `audit-edit` kiểm đã có. Với emoji động Noto dòng ghi công là: Animated Noto Emoji, Google, CC BY 4.0.

## Thêm nguồn mới

1. Xác minh giấy phép từ trang chính thức, ghi vào `data/decor-sources.json` (kèm cách xác minh).
2. Thêm hàm tải vào `scripts/decor-lib.mjs` theo hợp đồng: trả `{ file, credit }` hoặc `null`, có bộ nhớ đệm, không ném lỗi khi mất mạng.
3. Nối vào `render-overlay.mjs` và thử bằng bảng khung thử trên một khung video thật trước khi dựng đủ.

## Giới hạn đã biết

- Noto chỉ có bản động cho một phần emoji (thiếu: tiền mặt, lịch, điện thoại, thẻ, bánh, áo, nhạc, tàu, nhà cao tầng...). Các emoji đó dùng PNG tĩnh.
- Lottie dùng expression có thể nhấp nháy khi tua (cảnh báo của Remotion); các tệp Noto đã thử không bị.
- Icon Iconify tìm theo tên tiếng Anh của emoji nên khái niệm trừu tượng ít kết quả; truy vấn nên là vật thể cụ thể.
- Thời gian dựng tăng nhẹ: mỗi Lottie đang hiện tốn khoảng 9 ms mỗi khung.
