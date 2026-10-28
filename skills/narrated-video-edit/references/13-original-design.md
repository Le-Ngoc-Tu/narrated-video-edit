# 13. Diện mạo gốc theo DNA (không bị khóa vào bốn phong cách)

Dùng khi người dùng muốn video có diện mạo riêng, khác video trước, hoặc bốn phong cách (`hype`, `explainer`, `documentary`, `creator`) và hai chủ đề demo (`pastel`, `night`) đều không hợp. Mặc định vẫn là phong cách có sẵn; nhánh này chỉ mở khi người dùng yêu cầu. Công cụ đến từ lõi sáng tạo dùng chung (`style-ledger.mjs`, `concept-board.mjs`, `fontpack.mjs`, `templates/creative-seeds.json`, `templates/design-dna.template.json`), đồng bộ từ `ai_skills_package/_creative-core` của repo Motion Atlas; đừng sửa các tệp đó trong skill.

## 1. Cái gì đổi, cái gì giữ

| Phần | Theo DNA | Giữ theo phong cách và rào chắn |
| --- | --- | --- |
| Màu nhấn (từ đang nói, thẻ chữ, sticker) | `palette.accent`, `palette.accent2` | |
| Preset caption | `video.captionPreset` (bold, kinetic, pill, marker, minimal, editorial) | mật độ chữ, số từ mỗi lượt |
| Nền và màu chú thích của cảnh demo | chủ đề `dna`: nền từ `palette.bg` pha `accent2`, nét chú thích `accent` | vùng đặt clip, khung, trần thời lượng demo |
| Màu chữ caption, viền, tấm nền caption | | theo phong cách: chữ phải đọc được trên MỌI khung hình của video, không theo màu nền của DNA |
| Phông | | phông đi kèm skill (`templates/fonts`, đã kiểm tiếng Việt, dựng ngoại tuyến); phông Fontsource của DNA chưa được nạp vào lớp phủ |
| Nhịp cắt, trần sticker, chữ chỉ từ lời nói, audit | | giữ nguyên |

## 2. Quy trình
1. Đọc chủ đề video, `node style-ledger.mjs seed --subject "..." --n 3` (sổ ở `~/.narrated-video-edit/`), viết ba DNA theo `templates/design-dna.template.json` cộng khối `"video": { "captionPreset": "..." }`, `node style-ledger.mjs check dna.json` cho từng ý.
2. `node concept-board.mjs a.json b.json c.json --title "..." --out concepts.png`, gửi người dùng chọn, DỪNG.
3. `node plan-skeleton.mjs ... --design dna.json`: kế hoạch có `design` (đường dẫn tương đối tới DNA), preset caption theo DNA, cảnh demo từ `--user-footage` mặc định chủ đề `dna`.
4. `plan-lint.mjs` kiểm DNA: đủ `palette.bg`, `ink`, `accent` (mã `#rrggbb`), `mode`, preset hợp lệ, và màu nhấn phải đạt 3:1 với tấm nền caption của phong cách (nếu không, từ đang nói chìm). Trượt thì sửa DNA, không hạ ngưỡng.
5. Dựng, kiểm toán như thường; xem khung bằng mắt (audit không đo gu thẩm mỹ). Ghi sổ `style-ledger.mjs add dna.json` sau khi người dùng nhận video.

Lần chạy thật đầu tiên (28/10/2026, kế hoạch 54): đoạn vlog dọc 22 giây, DNA "Thẻ bài nhà rắn" (nền xanh lục đậm, nhấn xanh bạc hà, preset editorial), bố cục stack, một cảnh demo chủ đề `dna`; `plan-lint` và `audit-edit` đạt, khung hình đúng màu DNA, caption trắng đọc được.
