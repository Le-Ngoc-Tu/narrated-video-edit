# 12. Thư viện hiệu ứng dựng (data/effects)

Hơn 180 hiệu ứng editor chuyên nghiệp dùng nhiều trong video viral, mô tả bằng dữ liệu: mỗi hiệu ứng là một mục JSON có công thức ffmpeg chạy được, thông số có khoảng hợp lệ, chức năng kể chuyện, phong cách hợp, lỗi hay gặp. Danh mục đầy đủ (tự sinh, đừng sửa tay): `12-effects-catalog.md`. Mọi công thức tự viết bằng bộ lọc ffmpeg và mã; không có LUT, light leak, preset hay mẫu âm thanh của bên thứ ba. Tên CapCut, Premiere, DaVinci chỉ là bí danh (`aliases`) để dễ tra, không có nghĩa dùng tài nguyên của họ.

## Họ và engine

| Họ | Nội dung | Engine chính |
| --- | --- | --- |
| `camera` | punch-in, crash zoom, đẩy máy, rung, nghiêng, lia | video |
| `transition` | whip pan, roll, flash, glitch, dip, iris, flip + 20 kiểu `xfade` | video, xfade |
| `time` | freeze, stutter, echo, strobe; slow-mo, tua nhanh, reverse, speed ramp, hyperlapse | video, retime |
| `color` | teal-orange, bleach bypass, đen trắng, sepia, matte, bloom, vignette, color pop... | video |
| `retro` | film grain, VHS, CRT, camcorder REC, date stamp, light leak, film burn, halation... | video |
| `glitch` | RGB split, block glitch, mosaic, edge neon, mirror, kaleidoscope, solarize... | video |
| `text` | đếm ngược, tiêu đề, lower third, ticker; 5 preset caption và 4 loại thẻ (đã có trong lớp phủ) | video, overlay |
| `graphic` | spotlight, light sweep, progress bar, focus ring, khung nhấn; ký hiệu decor, thẻ số, emoji, 7 kiểu showcase (đã có) | video, overlay |
| `layout` | chia đôi, lưới 2x2, thẻ trên nền mờ, PiP, quét đổi tông; stack và follow (đã có) | video, overlay |
| `subject` | xoá phông, tối nền, viền người, thay nền, pop-out, nền pixel | mask |
| `audio` | whoosh, pop, ding, impact, riser, sub boom, glitch, shutter, record stop... (tổng hợp bằng lavfi) | audio |

Engine `video` và `mask` áp trong một cửa sổ thời gian lên luồng hình. `xfade` chuyển cảnh thật giữa hai clip (cutaway). `retime` đổi độ dài nên chưa nối vào `compose-base` (dùng độc lập bằng `fx-apply`). `overlay` chỉ trỏ tới kiểu đã cài trong lớp phủ. `audio` do `finalize` dùng cho `plan.sfx`.

## Chọn hiệu ứng: theo mục đích, không theo "đẹp"

Quy tắc rút từ tài liệu dựng và thực nghiệm (xem cả `references/11-editing-research.md` của skill đồng hành `beat-synced-video-edit` trong kho Motion Atlas, không kèm theo gói này):
1. **Mỗi hiệu ứng phục vụ một việc**: nhấn ý (`emphasis`), chuyển ý (`transition`), đổi không khí (`mood`), giữ chân (`retention`), lộ ra (`reveal`), nhịp (`rhythm`), rõ nghĩa (`clarity`), nhận diện (`brand`), hài (`humor`). Không có việc thì bỏ.
2. **Đổi hình mỗi 3 đến 7 giây** là đủ; mỗi câu một hiệu ứng thì chính hiệu ứng thành mẫu lặp. Ngân sách theo phong cách nằm ở `data/effects-rules.json`, `plan-lint` kiểm.
3. **Cú mạnh (intensity 3) chạm cả khung hình: ít thôi.** Mặc định hype 2 cú mỗi phút, explainer gần như không, documentary không. Ghép hiệu ứng với tiếng (`sfx`) và với nhịp từ (`beat`).
4. **Che chỗ cắt bằng chuyển cảnh trong một luồng**: cửa sổ cân hai bên điểm nối, đỉnh hiệu ứng trùng điểm nối. Chọn `atCut` trong kế hoạch.
5. **An toàn**: hiệu ứng chớp sáng khai `flash` (số lần mỗi giây); tổng trong 1 giây không quá 3 (WCAG 2.3.1). `plan-lint` kiểm theo khai báo, `audit-edit` đo lại trên video thành phẩm. Hiệu ứng không `faceSafe` làm méo hoặc che mặt: chỉ cho điểm cắt và cảnh phụ.
6. **Hợp phong cách**: `styles.hype|explainer|documentary` là `use`, `sparing` hoặc `avoid`. `avoid` bị cảnh báo.

## Dùng trong kế hoạch (`edit-plan.json`)

`plan-skeleton` tự gợi ý theo `data/effects-rules.json` (tắt bằng `--no-effects`, phủ tông cho cả video bằng `--look matte-fade,film-grain`). Sửa tay mục `effects`:

```json
"effects": [
  { "id": "e1", "effect": "whip-pan", "atCut": 3, "dur": 0.4 },
  { "id": "e2", "effect": "crash-zoom", "start": 12.4, "end": 13.3, "params": { "amount": 0.4 } },
  { "id": "e3", "effect": "matte-fade", "start": 0, "end": 60, "look": true }
]
```

`atCut` là chỉ số lần cắt (theo giờ) trong `cuts`; cửa sổ cân hai bên chỗ nối, độ dài `dur`. `start`, `end` là giây trong video gốc. Tâm phóng của hiệu ứng zoom bám mặt từ `faces.json`. Mã `plan.sfx[].type` là id hiệu ứng `audio`; `oT` (giờ thành phẩm) được chấp nhận thay cho `t`.

Dùng riêng một hiệu ứng lên clip bất kỳ: `node scripts/fx-apply.mjs apply --in clip.mp4 --effect crash-zoom --at 1.0 --out out.mp4`; xem `list`, `show <id>`, `sound`, `catalog`, `validate`.

## Thêm hiệu ứng mới (không sửa mã)

1. **Tìm**: gọi tên hiệu ứng như editor gọi (bảng Effects của Premiere, DaVinci, CapCut; tài liệu bộ lọc ffmpeg `ffmpeg -h filter=<tên>`). Hiệu ứng là kỹ thuật chung; KHÔNG chép preset, LUT, overlay hay tệp âm thanh của người khác, kể cả loại "miễn phí" nếu giấy phép không rõ.
2. **Viết**: thêm một mục vào `data/effects/<họ>.json` theo `_dsl.json`. Công thức dùng `{tên}` (thông số, `let`, ngữ cảnh `W H fps dur fx fy`, macro `p bell eo ei eio trap zoomcrop zoomctr shakecrop`), thời gian cục bộ `t` (bộ lọc) hoặc `T` (blend), bắt đầu từ 0 ở đầu cửa sổ. Biểu thức có dấu phẩy đặt trong nháy đơn. `{=biểu thức số}` tính trước (cho thông số ffmpeg không nhận biểu thức).
3. **Kiểm**: `node scripts/fx-apply.mjs validate`, rồi `node scripts/effects-selftest.mjs --id <id> --sheet`. Bộ kiểm chạy hiệu ứng thật trên video mẫu dọc và ngang và đo: số khung và kích thước giữ nguyên, khung NGOÀI cửa sổ giống hệt bản gốc, khung TRONG cửa sổ khác rõ rệt (thông số mặc định phải thấy được), không lộ góc đen (trừ khi khai `blackEdges`), không đen suốt cửa sổ, chớp sáng không quá 3 lần mỗi giây. Rồi MỞ bảng ảnh trong `.selftest/effects/sheets` và nhìn: đạt kiểm chưa chắc đẹp.
4. **Xem trên video thật**: `--source <video> --ss <giây> [--portrait] [--mask mask.mkv] --out ../.selftest/real` dựng bảng ảnh trên cảnh thật (mặt người, chữ), nơi lộ ra hiệu ứng quá gắt hoặc sai màu.
5. **Cho tự gợi ý** (tùy chọn): thêm id vào pool của phong cách trong `data/effects-rules.json`.

## Bẫy đã gặp khi viết công thức ffmpeg (đã sửa trong thư viện)

- `scale eval=frame` kèm `crop` dùng `iw` lệch một khung khi cỡ đổi nhanh: tính độ lệch crop từ chính biểu thức zoom (macro `zoomcrop`, `zoomctr`).
- Mép cửa sổ: `trim` so khung theo điểm giữa thời lượng khung, nên đặt mép đúng ranh giới `n/fps`; nguồn `color` hoặc `gradients` phải cắt bằng `trim=end_frame={frames}` (làm tròn thời lượng thừa hoặc thiếu một khung).
- Phép trộn phụ thuộc toạ độ (vignette, tilt-shift, thanh) hoặc phi tuyến (screen) phải chạy trên `format=gbrp`; trên YUV, kênh màu có toạ độ và giá trị khác nên lệch màu. `maskedmerge` cũng vậy: đổi cả ba đầu vào sang `gbrp`.
- `drawbox` dùng `iw`, `ih` (không phải `w`, `h`: đó là cỡ hộp); `drawtext` đổi `fontsize` theo thời gian làm ffmpeg 2025-09 treo: dùng cỡ cố định, đổi `alpha` hoặc vị trí.
- `framestep` đặt tốc độ khung đầu ra thấp: thêm `fps={fps}` sau `setpts` hoặc bộ mã hóa bỏ khung.
- Âm thanh: `afade` không nhận biểu thức, dùng `{=...}`; `aevalsrc` có `random(0)` cho nhiễu, `sgn(x)` cho sóng vuông.

## Giới hạn đã biết

- Mới nối vào quy trình tự động các hiệu ứng engine `video` (áp lên lớp nền trong `compose-base`) và `audio` (SFX trong `finalize`). `mask` (cần mặt nạ người) dùng qua `fx-apply apply --mask`; `retime` và `xfade` dùng độc lập.
- Hiệu ứng áp lên lớp nền (video và cutaway phủ kín), TRƯỚC lớp phủ: caption, thẻ và sticker không bị méo bởi hiệu ứng.
- Công thức tối ưu cho ffmpeg 2025-09 bản đầy đủ (gyan.dev, có `swaprect`, `pixelize`, `colorhold`, `gradients`). Bản ffmpeg cũ hơn có thể thiếu bộ lọc: `fx-apply validate` không kiểm bộ lọc, `effects-selftest` thì có.
- Chưa có phát hiện nhịp trong skill này để đặt hiệu ứng lên beat; `beat` chỉ là gợi ý. Với video có nhạc nền, dùng skill đồng hành `beat-synced-video-edit` (kho Motion Atlas, không kèm theo gói này).
