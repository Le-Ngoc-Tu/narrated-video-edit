# 12. Danh mục hiệu ứng (tự sinh từ data/effects, đừng sửa tay)

Tạo bằng: node scripts/fx-apply.mjs catalog --out references/12-effects-catalog.md. Tổng 190 hiệu ứng. Cách chọn và dùng: xem 12-effects.md.

## camera: máy quay và zoom: nhấn, đẩy, rung, nghiêng (13)

| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `punch-in` | Zoom nhấn (punch-in) | video | emphasis | use | use | sparing | amount=0.14x, rise=0.12s, fall=0.25s | phóng quá 1,25x thì ảnh 720p bị vỡ hạt |
| `jump-punch` | Cắt phóng cứng (jump punch) | video | retention | use | use | avoid | amount=0.12x | luân phiên mức phóng 1,0 rồi 1,12 rồi 1,0 mới tạo nhịp; cùng một mức mãi thì như không có gì |
| `crash-zoom` | Crash zoom | video | emphasis | use | sparing | avoid | amount=0.3x, rise=0.1s, fall=0.3s, blur=12px | tối đa vài lần mỗi video; dùng liên tục thì mất tác dụng |
| `slow-push` | Đẩy máy chậm (slow push) | video | mood | sparing | use | use | amount=0.1x | đoạn quá ngắn thì thấy giật cục thay vì trượt êm |
| `pull-out` | Lùi máy tiết lộ (pull-out) | video | reveal | use | use | use | amount=0.16x | đặt ngay sau một cú crash-zoom thì thành nhịp hít thở tự nhiên |
| `zoom-pulse` | Zoom nhịp (pulse) | video | rhythm | use | avoid | avoid | amount=0.06x, beats=2lần | mỗi nhịp là một cú chạm cả khung hình: giữ amount nhỏ và dưới vài lần mỗi video |
| `bounce-zoom` | Zoom nảy (bounce) | video | emphasis | use | sparing | avoid | amount=0.12x | độ nảy đầu có thể vượt amount tới gần 1,6 lần: giữ amount dưới 0,2 với video 720p |
| `handheld` | Rung tay (handheld) | video | mood | sparing | avoid | use | amp=6px, margin=1.06x | video quay tay thật đã rung sẵn: không chồng thêm |
| `impact-shake` | Rung va chạm (impact shake) | video | emphasis | use | avoid | avoid | amp=22px, decay=71/s, margin=1.1x | là cú chạm cả khung hình: tối đa 3 lần mỗi video |
| `rumble` | Rung liên tục (rumble) | video | mood | sparing | avoid | avoid | amp=8px, margin=1.08x | dùng kèm riser hoặc tiếng trầm thì mới thuyết phục; im lặng thì trông như lỗi máy |
| `dutch-tilt` | Nghiêng khung (dutch angle) | video | mood | sparing | avoid | avoid | deg=5độ, margin=1.18x | góc dưới margin tương ứng sẽ lộ viền đen ở góc: tăng margin khi tăng deg |
| `drift-pan` | Lia ngang chậm (drift pan) | video | mood | sparing | use | use | travel=36px, dir=1, margin=1.1x | quãng trượt phải nhỏ hơn nửa phần phóng dư ((margin-1)*W/2) để không lộ mép |
| `tilt-reveal` | Hất máy lên (tilt reveal) | video | reveal | use | sparing | sparing | travel=90px, margin=1.2x | lệch tâm mặt khi quãng trượt lớn: kết thúc đúng vị trí cũ (travel*(1-eo) về 0) |

## transition: chuyển cảnh tại điểm cắt hoặc giữa hai cảnh (35)

| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `whip-pan` | Quét ngang (whip pan) | video | transition | use | sparing | avoid | dir=1, travel=0.12W, blur=28px, margin=1.3x | đỉnh nhoè phải trùng điểm cắt: đặt cửa sổ đối xứng quanh nó |
| `whip-tilt` | Quét dọc (whip tilt) | video | transition | use | sparing | avoid | dir=1, travel=0.1H, blur=28px, margin=1.25x | đổi chiều quét giữa các lần dùng (xen lên, xuống) để khỏi lặp |
| `zoom-blur-through` | Lao qua zoom nhoè | video | transition | use | avoid | avoid | amount=0.5x, blur=20px | là cú chạm cả khung hình: tính vào hạn 3 cú mạnh mỗi video |
| `roll-swing` | Lắc xoay (roll swing) | video | transition | use | avoid | avoid | deg=14độ | tâm xoay là giữa khung; góc lớn kéo theo phóng lớn (30 độ cần 1,7x trên khung dọc): giữ dưới 20 độ với video 720p |
| `flash-white` | Chớp trắng (flash) | video | transition | use | sparing | avoid | peak=0.85, sharp=2 | chớp trắng liên tiếp trên 3 lần mỗi giây là nguy cơ co giật nhạy sáng |
| `dip-black` | Tối dần rồi sáng (dip to black) | video | transition | sparing | use | use | sharp=1.5 | đỉnh tối trùng điểm cắt; nếu lệch thì thấy cú cắt trước khi tối |
| `flash-color` | Chớp màu | video | transition | use | sparing | avoid | tint, peak=0.7, sharp=2 | màu phải trong bảng màu của video; cam và hồng hợp phong cách hype |
| `glitch-cut` | Cắt glitch (slice glitch) | video | transition | use | avoid | avoid | amp=60px, margin=1.3x | các dải làm méo mặt trong chớp mắt: chỉ dùng ở điểm cắt, không kéo dài trên mặt người |
| `pixel-dissolve` | Vỡ pixel | video | transition | use | sparing | avoid | block=48px | ô lớn hơn 25% khung thì mất hẳn mặt: giữ block dưới W/8 |
| `card-flip` | Lật thẻ (flip) | video | transition | use | use | avoid | - | mặt bị co hẹp trong nửa giây: không dùng khi người nói đang nhấn mạnh |
| `iris-dip` | Iris đóng mở | video | transition | sparing | sparing | sparing | soft=10 | tâm vòng là giữa khung, không theo mặt |
| `iris-color` | Iris một màu (chuyển chương) | video | transition | sparing | use | avoid | tint, hold=0.3, soft=10 | một mảng màu sáng lấp kín khung: tối đa vài lần mỗi video, mỗi lần một chương |
| `blinds-close` | Rèm cuốn (blinds) | video | transition | sparing | use | sparing | bar=60px | thanh quá mảnh (dưới 20px) sẽ thấy răng cưa khi nén |
| `strobe-cut` | Nháy sáng gấp (strobe) | video | transition | sparing | avoid | avoid | amt=0.5, period=12khung | giữ period từ 10 khung trở lên: dưới 10 khung ở 30 fps nháy trên 3 lần mỗi giây, nguy cơ co giật nhạy sáng |
| `blur-through` | Nhoè mờ rồi nét (defocus) | video | transition | sparing | use | use | blur=30px | nhoè kéo quá 1 giây trên người đang nói gây khó chịu |
| `xfade-fade` | Hòa tan (dissolve) | xfade | transition | sparing | use | use | - | đặt chỗ nối là cảnh khác nhau; giữa hai khung cùng một người nói thì dùng cắt thẳng |
| `xfade-dissolve-grain` | Tan hạt (grain dissolve) | xfade | transition | sparing | sparing | use | - | hạt thấy rõ ở video độ phân giải thấp: dùng ở video 1080p trở lên |
| `xfade-wipe-left` | Quét xóa sang trái (wipe) | xfade | transition | use | use | avoid | - | đổi hướng quét giữa các lần dùng; cùng một hướng liên tục trông máy móc |
| `xfade-slide-left` | Trượt đẩy (slide) | xfade | transition | use | use | sparing | - | hợp 9:16 khi trượt dọc (slideup) hơn trượt ngang |
| `xfade-slide-up` | Trượt lên (slide up) | xfade | transition | use | use | avoid | - | người xem có thể tưởng video kết thúc: dùng giữa các ý, không ở cuối câu chốt |
| `xfade-circle-open` | Mở vòng tròn (circle open) | xfade | reveal | use | use | sparing | - | tâm luôn ở giữa khung: nội dung quan trọng của cảnh sau nên ở giữa |
| `xfade-circle-close` | Đóng vòng tròn (circle close) | xfade | transition | sparing | sparing | sparing | - | ít dùng hơn circle open; không dùng hai lần liên tiếp |
| `xfade-radial` | Quét tròn (radial wipe) | xfade | transition | sparing | use | use | - | dùng khi có ý về thời gian, tránh dùng như trang trí |
| `xfade-pixelize` | Chuyển pixel | xfade | transition | use | sparing | avoid | - | ô to che mất chữ trong cảnh: không dùng khi cảnh có chữ quan trọng |
| `xfade-zoomin` | Phóng vào (zoom in) | xfade | transition | use | sparing | avoid | - | cảnh trước phải đủ nét khi phóng; ảnh thấp phân giải sẽ vỡ |
| `xfade-squeeze` | Ép co (squeeze) | xfade | transition | use | avoid | avoid | - | méo hình rõ: không dùng trên cảnh có mặt người to |
| `xfade-hblur` | Nhoè ngang chuyển cảnh | xfade | transition | use | use | sparing | - | nhoè nhẹ tay: kéo dài trên 1 giây thì mờ cả hai cảnh |
| `xfade-diag` | Quét chéo (diagonal) | xfade | transition | use | sparing | avoid | - | đổi góc xuất phát giữa các lần dùng |
| `xfade-slice` | Lát dải (slice) | xfade | transition | use | use | avoid | - | các dải lệch pha dễ thấy ở độ phân giải thấp |
| `xfade-cover` | Phủ lên (cover) | xfade | transition | use | use | sparing | - | đi cặp với reveal để có cặp mở và đóng |
| `xfade-reveal` | Lộ ra (reveal) | xfade | reveal | use | use | sparing | - | nội dung quan trọng của cảnh sau nên ở phía sẽ lộ ra sớm nhất |
| `xfade-smooth` | Quét mềm (smooth wipe) | xfade | transition | sparing | use | use | - | mép mờ rộng làm hai cảnh chồng nhau lâu: giữ dưới 1 giây |
| `xfade-dip-black` | Hòa qua đen (fade black) | xfade | transition | avoid | use | use | - | với video ngắn dưới 60 giây, một lần đen là đủ |
| `xfade-dip-white` | Hòa qua trắng (fade white) | xfade | transition | sparing | sparing | sparing | - | không dùng trên cảnh sáng sẵn: đỉnh trắng không còn khác biệt |
| `xfade-wind` | Gió thổi (wind) | xfade | transition | use | avoid | avoid | - | vệt kéo che chi tiết: dùng ở cảnh ít chữ |

## time: thời gian: đóng băng, tua, lặp, tốc độ (11)

| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `freeze-frame` | Đóng băng khung (freeze frame) | video | emphasis | use | sparing | sparing | - | hình dừng mà miệng vẫn có tiếng nói là cố ý hài; nếu không muốn thế, chỉ đóng băng khi người nói im |
| `stutter-step` | Giật khung (stop-motion stutter) | video | mood | use | avoid | sparing | step=8fps | miệng nhép mất đồng bộ với tiếng khi step dưới 6 |
| `echo-trail` | Vệt mờ chuyển động (echo trail) | video | mood | use | avoid | sparing | decay=0.92 | mặt nhoè thành vệt khi người nói cử động: dùng khi người nói đứng yên hoặc cho cảnh cutaway |
| `ghost-blend` | Nhòe thời gian (ghost blend) | video | mood | sparing | avoid | use | frames_mix=5khung | giảm độ nét chữ trong cảnh: không dùng khi có chữ cần đọc |
| `strobe-gate` | Chớp đen theo nhịp (strobe gate) | video | rhythm | sparing | avoid | avoid | period=15khung, gate=2khung | giữ chu kỳ từ 10 khung trở lên để dưới 3 lần chớp mỗi giây (nguy cơ co giật nhạy sáng) |
| `slow-mo` | Quay chậm (slow motion) | retime | emphasis | use | sparing | use | speed=0.5x | video 30 fps làm chậm dưới 0,5 sẽ giật: cần nội suy khung (minterpolate) hoặc quay 60 fps |
| `fast-forward` | Tua nhanh (fast forward) | retime | rhythm | use | use | sparing | speed=2x | giọng nói tua nhanh trên 1,3 lần khó nghe: dùng cho đoạn không lời |
| `reverse-play` | Chiếu ngược (reverse) | retime | humor | use | avoid | avoid | - | reverse nạp cả đoạn vào bộ nhớ: giữ dưới 10 giây |
| `speed-ramp-dip` | Chậm gấp rồi trả (speed ramp) | retime | emphasis | use | avoid | sparing | at=1s, len=0.8s, speed=0.25x | video 30 fps chậm dưới 0,3 sẽ giật: quay 60 fps hoặc nội suy khung |
| `freeze-hold-end` | Giữ hình cuối (hold last frame) | retime | reveal | sparing | use | use | hold=1s | tiếng phải được bù thêm khoảng im tương ứng (apad) để không lệch |
| `hyperlapse` | Tua cực nhanh (hyperlapse) | retime | rhythm | use | use | use | step=8khung | giữ chân máy ổn định, nếu không rung sẽ khó xem |

## color: màu và phong cách (grade): tông, tương phản, ánh sáng (28)

| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `teal-orange` | Tông xanh ngọc cam (teal and orange) | video | mood | use | sparing | use | amount=1, sat=1.08x, fade=0.2s | áp cả video thì tông phải nhất quán giữa các cảnh; áp từng đoạn sẽ thấy nhảy tông |
| `bleach-bypass` | Bạc màu mạnh tương phản (bleach bypass) | video | mood | sparing | avoid | use | sat=0.45x, fade=0.2s | da người trông nhợt: không dùng cho nội dung vui, làm đẹp |
| `mono-bw` | Đen trắng | video | mood | sparing | sparing | use | fade=0.3s | nội dung có chữ màu để phân biệt sẽ mất nghĩa khi bỏ màu |
| `noir-contrast` | Đen trắng tương phản cao (noir) | video | mood | sparing | avoid | use | contrast=1.55x, fade=0.25s | tương phản trên 1,8 làm mất chi tiết vùng tối trên mặt |
| `sepia` | Nâu cổ điển (sepia) | video | mood | sparing | sparing | use | fade=0.3s | hay dùng thành cliché 'ngày xưa'; kèm hạt phim và vignette mới thuyết phục |
| `cold-steel` | Tông lạnh thép | video | mood | use | use | use | kelvin=9500K, fade=0.25s | da xám xịt khi lạnh quá: giữ kelvin dưới 12000 cho cảnh có người |
| `warm-glow` | Tông ấm | video | mood | use | use | use | kelvin=5200K, fade=0.25s | ngả cam quá thì mất cân bằng trắng: dùng kelvin trên 3500 |
| `golden-hour` | Giờ vàng (golden hour) | video | mood | use | sparing | use | fade=0.3s | trông giả nếu cảnh quay trong nhà ánh sáng trắng |
| `night-blue` | Đêm xanh (day for night) | video | mood | sparing | sparing | use | fade=0.4s | tối quá làm mặt người nói không còn thấy: giữ brightness trên -0,2 |
| `matte-fade` | Đen nhạt kiểu phim (matte) | video | mood | use | sparing | use | fade=0.25s | chữ trắng trên nền matte mất tương phản: kiểm lại độ đọc được |
| `vibrant-pop` | Màu rực (vibrance pop) | video | emphasis | use | use | sparing | vib=0.5, fade=0.2s | đẩy quá làm da cam gắt và nhiễu màu: giữ vib dưới 0,9 |
| `pastel-soft` | Pastel dịu | video | mood | use | use | avoid | fade=0.25s | mất độ sâu khi nền sáng sẵn |
| `cross-process` | Màu lệch kênh (cross process) | video | mood | use | avoid | avoid | fade=0.2s | da người ngả xanh lá: chỉ dùng như phong cách rõ ràng, không trộn với cảnh bình thường |
| `duotone` | Hai tông màu (duotone) | video | brand | use | sparing | avoid | fade=0.2s | mất màu da hoàn toàn: dùng cho cảnh phụ, không cho người nói chính |
| `cyber-neon` | Neon công nghệ (cyber) | video | mood | use | sparing | avoid | fade=0.2s | da người hồng tím quá khi bão hòa cao |
| `invert-flash` | Đảo màu (invert) | video | emphasis | sparing | avoid | avoid | fade=0.05s | đảo màu nhấp nháy nhiều lần là nguy cơ co giật nhạy sáng; một lần ngắn là đủ |
| `posterize` | Phân mảng màu (posterize) | video | mood | use | avoid | avoid | step=48bậc, fade=0.2s | mặt thành mảng phẳng khi step trên 64 |
| `thermal-map` | Bản đồ nhiệt (thermal) | video | humor | use | avoid | avoid | fade=0.15s | màu rất gắt; chỉ cho khoảnh khắc ngắn |
| `bloom-glow` | Quầng sáng (bloom) | video | mood | use | sparing | sparing | sigma=20px, amount=0.5, fade=0.25s | làm ảnh sáng hơn: giảm exposure hoặc amount nếu nền đã sáng |
| `dreamy-soft` | Mơ màng mềm (dreamy) | video | mood | sparing | avoid | use | sigma=12px, mix=0.45, fade=0.3s | chữ và chi tiết mờ: không dùng khi cảnh có chữ phải đọc |
| `vignette-dark` | Tối góc (vignette) | video | clarity | use | sparing | use | amount=0.8, start=0.35, fade=0.3s | tối góc lên chữ ở góc (watermark, caption) làm giảm độ đọc |
| `letterbox-cinema` | Khung điện ảnh (letterbox) | video | mood | sparing | avoid | use | bar=0.1H, fade=0.4s | che caption ở cạnh dưới: nâng caption lên khỏi dải |
| `color-pop` | Giữ một màu (color pop) | video | emphasis | use | sparing | sparing | tint, sim=0.3, fade=0.25s | màu da cũng có thể bị giữ khi chọn đỏ hoặc cam: chọn màu xa tông da |
| `color-tint` | Phủ một màu (tint) | video | mood | use | sparing | sparing | hue=25độ, mix=0.35, fade=0.3s | trùng màu thương hiệu thì dùng làm nhận diện; không thì dùng tiết kiệm |
| `lowfi-wash` | Phai màu lo-fi | video | mood | use | avoid | use | fade=0.25s | kết hợp film-grain mới thuyết phục |
| `high-key` | Sáng trong (high key) | video | mood | use | use | sparing | fade=0.3s | vùng sáng cháy mất chi tiết: kiểm trên da và áo trắng |
| `low-key` | Tối sâu (low key) | video | mood | use | avoid | use | fade=0.3s | mặt người nói tối quá khi quay thiếu sáng sẵn |
| `hdr-punch` | Nét và rực kiểu HDR | video | emphasis | use | sparing | avoid | fade=0.2s | làm lộ nhiễu và lỗ chân lông trên mặt: không dùng trên cận mặt |

## retro: hoài cổ và ống kính: hạt phim, VHS, camcorder, rò sáng (14)

| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `film-grain` | Hạt phim (film grain) | video | mood | sparing | avoid | use | amount=14 | nén video mạng xã hội ăn mất hạt mịn: để amount từ 12 trở lên nếu muốn còn thấy sau khi tải lên |
| `vhs-look` | Băng VHS | video | mood | use | avoid | sparing | speed=240px/s, band=36px | làm mờ chữ nhỏ: không áp lên cảnh có chữ phải đọc |
| `crt-scanlines` | Màn hình CRT (scanlines) | video | mood | use | avoid | avoid | pitch=4px, dark=0.35 | vạch mảnh gây hiện tượng nhiễu moiré khi nén: đặt pitch từ 4 trở lên |
| `camcorder-rec` | Máy quay cầm tay (REC) | video | mood | use | avoid | sparing | - | chiếm góc trên trái: tránh cùng lúc với sticker hoặc thẻ ở góc đó |
| `date-stamp` | Dấu ngày máy ảnh số | video | mood | use | avoid | sparing | stamp | ngày hiển thị là chữ do người dùng đặt: dùng ngày thật của clip, không bịa |
| `viewfinder-frame` | Khung ngắm máy ảnh | video | clarity | use | sparing | sparing | - | các góc nằm trong vùng an toàn 7% mép: giữ cách mép để không bị nền tảng che |
| `light-leak` | Rò sáng (light leak) | video | mood | use | avoid | sparing | amount=0.55 | dùng ở điểm chuyển cảnh thì đỉnh sáng nên trùng điểm cắt |
| `film-burn` | Cháy phim (film burn) | video | transition | use | avoid | sparing | amount=0.85 | chớp lớn: tối đa vài lần mỗi video |
| `projector-weave` | Máy chiếu phim (gate weave) | video | mood | sparing | avoid | use | amp=3px, flick=0.025, margin=1.05x | rung và nhấp nháy dễ gây khó chịu nếu kéo dài: dùng đoạn ngắn dưới 10 giây |
| `halation-glow` | Quầng đỏ phim (halation) | video | mood | use | avoid | use | sigma=18px, amount=0.9, fade=0.25s | chỉ thấy rõ khi cảnh có vùng sáng mạnh; cảnh tối đều thì không có tác dụng |
| `chromatic-aberration` | Lệch sắc (chromatic aberration) | video | mood | use | avoid | sparing | px=4px | trên 8px thành hiệu ứng glitch, mất vẻ tinh tế |
| `fisheye-lens` | Mắt cá (fisheye) | video | humor | use | avoid | avoid | k=0.3, k2=0.05 | mặt ở giữa bị phình ra: chỉ hợp cảnh hài, không dùng cận mặt nghiêm túc |
| `tilt-shift` | Tilt-shift mô hình | video | mood | sparing | sparing | sparing | sigma=14px, cy=0.5H, band=0.15H, soft=4 | đặt dải nét trùng vị trí mặt (cy theo fy) kẻo mặt bị nhoè |
| `anamorphic-streak` | Vệt sáng ngang (anamorphic) | video | mood | use | avoid | sparing | len=70px, amount=1.2, fade=0.25s | chỉ thấy khi cảnh có đèn hoặc phản chiếu rất sáng |

## glitch: glitch và biến dạng: tách kênh, khối, pixel, gương (9)

| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `rgb-split-hit` | Tách kênh RGB (RGB split) | video | emphasis | use | avoid | avoid | px=14px, py=4px | kéo dài trên 1 giây thì thành lỗi màu, không còn là điểm nhấn |
| `block-glitch` | Khối lỗi (block glitch) | video | emphasis | use | avoid | avoid | bw=160px, bh=60px | khối đổi vị trí che mặt trong khoảnh khắc: giữ ngắn |
| `censor-mosaic` | Che mosaic vùng (censor) | video | clarity | use | use | use | rx=0.3W, ry=0.3H, rw=0.4W, rh=0.2H, cell=20px | vùng che là tĩnh: nếu vật cần che di chuyển, đặt nhiều cửa sổ ngắn hoặc nới vùng che |
| `edge-neon` | Viền neon (edge glow) | video | mood | use | avoid | avoid | tr=0.15, tg=0.9, tb=1, dim=0.3, glow=1.4x, fade=0.2s | viền nhiễu ở video nén mạnh; dùng nguồn sạch |
| `mirror-split` | Phản chiếu đôi (mirror) | video | humor | use | avoid | avoid | - | mặt bị cắt đôi nếu người nói ở giữa khung; hợp người nói lệch trái |
| `kaleido-quad` | Vạn hoa bốn góc (kaleidoscope) | video | mood | sparing | avoid | avoid | - | lấy góc trên trái làm gốc nên không thấy người nói; chỉ cho cảnh phụ hoặc cutaway |
| `tv-static-burst` | Nhiễu tivi (static burst) | video | transition | use | avoid | avoid | - | nhiễu mạnh làm tăng dung lượng video |
| `solarize-flash` | Cháy sáng đảo tông (solarize) | video | emphasis | sparing | avoid | avoid | knee=128, fade=0.1s | đổi tông mặt đột ngột: giữ ngắn |
| `digital-jitter` | Giật số (digital jitter) | video | emphasis | use | avoid | avoid | amp=14px, margin=1.1x | là cú chạm cả khung hình: tối đa 3 lần mỗi video |

## text: chữ và phụ đề (17)

| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `countdown-321` | Đếm ngược 3 2 1 | video | retention | use | use | avoid | from=3, step=0.8s | số che mặt ở giữa khung: dùng khi người nói im hoặc ở cảnh chuyển |
| `title-pop` | Tiêu đề bật (title pop) | video | clarity | use | use | sparing | title, ypos=0.18H | chữ có số phải có trong lời nói: plan-lint kiểm với thẻ headline, với hiệu ứng này người viết tự chịu trách nhiệm |
| `lower-third-bar` | Thanh tên trượt vào (lower third) | video | brand | sparing | use | use | name, role, ypos=0.72H | tên và chức danh phải là thật; không bịa |
| `ticker-scroll` | Dải tin chạy ngang (ticker) | video | retention | use | sparing | avoid | msg, speed=260px/s, ypos=0.76H | chữ chạy khó đọc: nội dung ngắn dưới 25 ký tự |
| `caption-bold` | Phụ đề đậm theo từ (bold) | overlay | retention | use | sparing | avoid | - | phụ đề dài hơn 4 từ một lượt bị lint chặn |
| `caption-kinetic` | Phụ đề kinetic (nghiêng, phóng) | overlay | emphasis | use | avoid | avoid | - | nghiêng và phóng làm khó đọc câu dài: dùng cho câu ngắn |
| `caption-pill` | Phụ đề trên viên nền (pill) | overlay | clarity | use | use | sparing | - | viên nền che một phần hình: nâng vị trí dải caption nếu cần |
| `caption-marker` | Phụ đề bút dạ (marker) | overlay | emphasis | use | use | avoid | - | nét bút màu nhấn phải đủ tương phản với chữ trắng |
| `caption-editorial` | Phụ đề biên tập (editorial) | overlay | retention | sparing | use | use | - | không có từ nhấn thì trông như phụ đề thường: khai captions.emphasis (2 đến 4 từ mỗi 10 giây) |
| `caption-minimal` | Phụ đề tối giản (minimal) | overlay | clarity | avoid | sparing | use | - | chữ nhỏ trên video dọc dễ khó đọc: kiểm kích thước tối thiểu 5% chiều cao khung |
| `lower-third-card` | Thẻ tên người nói (lowerThirds) | overlay | brand | sparing | use | use | - | chữ có số phải có trong lời nói hoặc userSource |
| `card-title` | Thẻ tiêu đề hai tầng | overlay | clarity | use | use | sparing | - | tiêu đề đừng bịa số liệu |
| `card-compare` | Thẻ so sánh hai bên | overlay | clarity | use | use | sparing | - | icon tìm theo tên tiếng Anh cụ thể (robot, gear): truy vấn trừu tượng ít kết quả |
| `card-logos` | Thẻ logo thương hiệu | overlay | brand | use | use | sparing | - | chỉ dùng khi lời nói nhắc đúng thương hiệu đó, không ngụ ý hợp tác hay tài trợ |
| `card-bigtext` | Chữ lớn sau người nói (bigtext) | overlay | emphasis | use | sparing | avoid | - | cận mặt gần kín khung thì chữ bị che gần hết; kiểm diện tích người dưới 60% khung |
| `card-orbit` | Thẻ chạy vòng quanh người (orbit) | overlay | reveal | use | sparing | avoid | - | chỉ dùng ảnh của chính người dùng (các video khác của họ, ảnh sản phẩm của họ); không dùng ảnh người lạ |
| `card-wall` | Tường ghép sau người (couch wall) | overlay | brand | use | sparing | avoid | - | tường phủ kín nền gốc: cần mặt nạ người tốt, kiểm khung thử có viền người sạch không |

## graphic: đồ họa phủ: sticker, thẻ, ký hiệu (30)

| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `spotlight-dim` | Đèn rọi vào mặt (spotlight) | video | emphasis | use | use | use | dim=0.5, radius=0.55W, fade=0.3s | tâm rọi là một điểm cố định: người di chuyển nhiều thì mặt ra khỏi vùng sáng |
| `light-sweep` | Vệt sáng quét (light sweep) | video | brand | use | sparing | sparing | amount=0.45, width=0.12W | quét qua mặt người nói làm cháy sáng: dùng khi mặt không ở giữa vệt |
| `progress-bar` | Thanh tiến độ (progress bar) | video | retention | use | use | avoid | bar=12px, tint | giữ trong vùng an toàn: thanh sát mép trên bị nền tảng che ở video dọc |
| `focus-ring` | Vòng nhấn quanh mặt (focus ring) | video | emphasis | use | use | sparing | r=0.22W, th=6px, fade=0.25s | vòng cố định: nếu mặt di chuyển thì dùng cửa sổ ngắn |
| `highlight-box` | Khung nhấn chữ nhật (call-out box) | video | clarity | use | use | avoid | rx=0.2W, ry=0.35H, rw=0.5W, rh=0.2H, tint, th=6px | vùng là tĩnh: vật thể di chuyển thì khung lệch |
| `decor-arrow` | Mũi tên chỉ | overlay | clarity | use | use | avoid | - | mũi tên phải chỉ vào vật có thật trong khung |
| `decor-circle` | Khoanh tròn | overlay | emphasis | use | use | sparing | - | không dùng trên mặt người |
| `decor-underline` | Gạch chân nhấn | overlay | emphasis | use | use | use | - | gắn với từ có trong caption để gạch đúng chỗ |
| `decor-burst` | Tia nổ (burst) | overlay | emphasis | use | avoid | avoid | - | lấn vùng mặt nếu đặt không đúng: plan-skeleton tự tránh mặt |
| `decor-check` | Dấu tích xanh | overlay | clarity | use | use | avoid | - | dùng đúng nghĩa 'đúng, xong'; dấu tích cho ý chưa xác nhận gây hiểu nhầm |
| `decor-question` | Dấu hỏi | overlay | humor | use | use | avoid | - | gắn với câu hỏi thật trong lời nói |
| `decor-exclaim` | Dấu chấm than | overlay | emphasis | use | sparing | avoid | - | dùng ít, nếu không sẽ như cảnh báo giả |
| `decor-badge` | Huy hiệu chữ (badge) | overlay | brand | use | use | avoid | - | chữ trên huy hiệu phải có trong lời nói hoặc nguồn người dùng |
| `decor-sparkle` | Lấp lánh (sparkle) | overlay | mood | use | sparing | avoid | - | gắn với khoảnh khắc đẹp hoặc kết quả tốt, không gắn ngẫu nhiên |
| `decor-confetti` | Pháo giấy (confetti) | overlay | mood | use | sparing | avoid | - | chỉ khi có thành tích hoặc tin vui thật |
| `decor-icon` | Icon minh họa (sticker) | overlay | clarity | use | use | sparing | - | truy vấn trừu tượng ít kết quả: dùng vật thể cụ thể |
| `stat-sticker` | Thẻ số kiểu nhãn dán | overlay | clarity | use | use | avoid | - | số phải có trong lời nói hoặc userSource; plan-lint kiểm |
| `stat-ring` | Thẻ số vòng tròn | overlay | clarity | use | use | sparing | - | vòng đầy theo giá trị: giá trị trên 100 không có nghĩa phần trăm |
| `stat-capsule` | Thẻ số viên nang | overlay | clarity | use | use | use | - | nhãn ngắn dưới 18 ký tự để không tràn viên nang |
| `emoji-react` | Emoji phản ứng | overlay | humor | use | sparing | avoid | - | cùng emoji không lặp trong 25 giây |
| `showcase-card` | Thẻ ảnh minh họa (card) | overlay | reveal | use | use | sparing | - | ảnh phải đúng ngữ cảnh: duyệt ở CỔNG 2 |
| `showcase-polaroid` | Ảnh polaroid | overlay | reveal | use | sparing | use | - | không dùng ảnh có người xác định được |
| `showcase-pip` | Khung ảnh tròn nhỏ (pip) | overlay | reveal | use | use | sparing | - | ảnh nhỏ khó đọc chi tiết: chọn ảnh một vật thể rõ |
| `showcase-stack` | Chồng thẻ (stack) | overlay | reveal | use | use | sparing | - | chiếm diện tích lớn hơn card: kiểm chỗ trống bên cạnh mặt |
| `showcase-sticker` | Ảnh cắt viền nhãn dán | overlay | humor | use | sparing | avoid | - | chỉ hợp ảnh một vật thể gọn |
| `showcase-peek` | Thẻ ló từ mép (peek) | overlay | reveal | sparing | avoid | avoid | - | một nửa ảnh bị khuất: chọn ảnh có nội dung ở nửa còn thấy |
| `showcase-fullbleed` | Ảnh phủ kín khung (fullbleed) | overlay | retention | sparing | sparing | use | - | tính vào brollMaxShare: phong cách hype tối đa 50% thời lượng |
| `cta-comment` | Ô bình luận gõ từ khóa | overlay | retention | use | use | avoid | - | chỉ dùng cho lời kêu gọi người nói thật sự nói ra; không tự thêm lời hứa gửi tài liệu mà người dùng không có |
| `cta-actions` | Thanh tim, bình luận, chia sẻ, lưu | overlay | retention | use | sparing | avoid | - | đặt đúng lúc nói từ tương ứng (save, share); đặt lệch sẽ thành đồ trang trí vô nghĩa |
| `proof-counter` | Thẻ số liệu đếm lên (bằng chứng) | overlay | clarity | use | use | sparing | - | không có số thật của người dùng thì không dùng; điền userSource đúng chữ trên thẻ |

## layout: bố cục khung hình (7)

| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `double-take-split` | Chia đôi hai cỡ cảnh (double take) | video | retention | use | sparing | avoid | zoom=1.6x | nửa trên cắt dải giữa nên mặt có thể bị cắt: kiểm bằng khung xem thử |
| `pop-art-grid` | Lưới 2x2 màu khác nhau (pop art) | video | humor | use | avoid | avoid | - | mặt thu còn một phần tư diện tích: chỉ dùng ở khoảnh khắc ngắn |
| `frame-card` | Khung thẻ trên nền mờ (card frame) | video | brand | use | use | sparing | fit=0.82x, border=10px, bgblur=30px | khung hơi nhảy ở đầu và cuối cửa sổ (không có chuyển động vào ra): đặt cửa sổ trùng chỗ cắt |
| `corner-pip` | Khung nhỏ góc (picture in picture) | video | retention | use | sparing | avoid | zoom=1.5x, size=0.32x | khung nhỏ có thể che nền: đặt ở góc xa người nói |
| `grade-wipe` | Quét đổi tông (grade wipe) | video | reveal | use | use | sparing | - | đường quét kéo qua mặt người nói: dùng ở lúc người nói im hoặc ở cutaway |
| `layout-stack` | Xếp dọc nền mờ (stack) | overlay | brand | use | use | sparing | - | chỉ dùng cho video ngang đổi sang dọc; video gốc đã dọc thì không cần |
| `layout-follow` | Cắt dọc bám mặt (follow) | overlay | brand | use | use | sparing | - | cần dò mặt đủ (từ 40% mẫu) và gốc từ 1080p để rõ nét |

## subject: chủ thể và mặt nạ người (9)

| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bg-blur-portrait` | Xoá phông (bokeh nền) | mask | clarity | use | use | use | sigma=16px | viền tóc và tay có thể sót nền nhoè hoặc cắt lẹm: xem ảnh duyệt |
| `bg-spotlight-dim` | Tối nền, rọi người (spotlight) | mask | emphasis | use | use | use | dim=0.35 | nền tối đột ngột ở đầu cửa sổ: đặt vào lúc có từ nhấn |
| `bg-mono-pop` | Nền đen trắng, người có màu | mask | emphasis | use | sparing | sparing | - | mặt nạ sót nền sẽ thấy viền màu quanh người |
| `person-outline` | Viền quanh người (outline stroke) | mask | brand | use | sparing | avoid | width=5px, tint | mặt nạ nhiễu làm viền răng cưa: làm mượt mặt nạ trước |
| `person-silhouette` | Bóng đổ phẳng (silhouette) | mask | mood | use | avoid | sparing | tint | mất hết biểu cảm: chỉ cho khoảnh khắc ngắn |
| `bg-solid-cutout` | Thay nền một màu | mask | brand | use | use | sparing | tint | viền tóc lộ nền cũ nếu mặt nạ không mịn: đặt màu nền gần tông nền gốc |
| `bg-gradient-cutout` | Thay nền chuyển sắc | mask | brand | use | sparing | avoid | - | đổi toàn bộ không khí cảnh: không đặt giữa hai cảnh cùng nền |
| `person-pop-scale` | Người phóng lên khỏi nền (pop out) | mask | emphasis | use | avoid | avoid | amount=0.12x | viền mặt nạ lộ khi phóng: giữ amount dưới 0,2 |
| `bg-pixelate` | Nền vỡ pixel | mask | clarity | use | sparing | avoid | cell=28px | viền người có thể hơi lẫn ô: dùng cell vừa phải |

## audio: âm thanh và hiệu ứng tiếng (17)

| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `whoosh` | Vút (whoosh) | audio | transition | use | sparing | avoid | - | đặt đỉnh tiếng vào đúng điểm cắt hoặc ngay trước đó vài khung |
| `pop` | Bụp (pop) | audio | emphasis | use | use | avoid | - | pop trên mọi sticker thì nghe như trò chơi trẻ em: bỏ bớt ở sticker phụ |
| `ding` | Đing (ding) | audio | emphasis | use | use | sparing | - | gắn với thẻ số liệu, không gắn mọi thẻ |
| `impact` | Va đập (impact) | audio | emphasis | use | avoid | avoid | - | tiếng trầm ăn vào giọng: hạ âm lượng hoặc ghép với ducking khi người nói đang nói |
| `riser` | Tiếng dâng (riser) | audio | rhythm | use | avoid | avoid | sweep=1800Hz | riser phải kết thúc đúng ở điểm nhấn: tính ngược từ điểm đó (bắt đầu = điểm nhấn - độ dài) |
| `sub-boom` | Trầm sâu (sub boom) | audio | emphasis | use | avoid | sparing | - | loa điện thoại không phát xuống 55 Hz: kèm impact để vẫn có cú nhấn |
| `glitch` | Tiếng glitch (zap) | audio | emphasis | use | avoid | avoid | rate=90rad/s | chói tai ở tần số cao: giữ âm lượng thấp hơn giọng ít nhất 18 dB |
| `click-tick` | Tách (click) | audio | clarity | sparing | use | sparing | - | quá ngắn thì nghe như lỗi âm thanh: giữ từ 0,02 giây |
| `camera-shutter` | Màn trập máy ảnh (shutter) | audio | emphasis | use | sparing | sparing | - | gắn với khung hình dừng hoặc ảnh polaroid, không gắn ngẫu nhiên |
| `record-stop` | Dừng đĩa (record stop) | audio | humor | use | avoid | avoid | - | đặt cùng lúc đóng băng hình, không trễ |
| `rewind` | Tua lại (rewind) | audio | humor | use | avoid | avoid | - | chói; giữ âm lượng thấp |
| `heartbeat` | Nhịp tim | audio | mood | sparing | avoid | use | - | lặp theo chu kỳ 1 giây để ra nhịp tim thật; một lần đơn lẻ nghe như hai tiếng gõ |
| `chime` | Chuông báo (chime) | audio | clarity | use | use | avoid | - | nghe giống âm báo thật: tránh khi người xem có thể tưởng điện thoại mình rung |
| `swoosh-soft` | Vút nhẹ (soft swoosh) | audio | transition | sparing | use | use | - | trầm nên dễ che giọng nam: hạ âm lượng khi trùng lời nói |
| `sparkle-chime` | Lấp lánh (sparkle) | audio | emphasis | use | sparing | avoid | - | ngọt gắt khi lặp nhiều: tối đa vài lần mỗi video |
| `error-buzz` | Tiếng sai (buzz) | audio | humor | use | sparing | avoid | - | âm vuông thô: hạ âm lượng |
| `keyboard-typing` | Gõ phím (typing) | audio | clarity | sparing | use | avoid | - | nhịp đều 85 ms: dùng khi chữ hiện cũng đều; nếu lệch nhịp sẽ thấy giả |

