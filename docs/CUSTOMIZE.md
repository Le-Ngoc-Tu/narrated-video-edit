# Tinh chỉnh skill

[Tiếng Việt](CUSTOMIZE.md) | [English](CUSTOMIZE.en.md)

Skill được nặn theo cảnh quay, ngôn ngữ và gu của một người duy trì. Của bạn sẽ khác, nên hãy chuẩn bị tinh chỉnh. Gần như mọi thứ bạn muốn đổi là **dữ liệu**, không phải mã, và hướng dẫn là Markdown thường. Trang này là bản đồ các núm vặn, từ thay đổi rẻ nhất đến sâu nhất.

Quy tắc vàng: **đổi một thứ, rồi chạy `node selftest.mjs`** (và `node effects-selftest.mjs` nếu đụng hiệu ứng). Nếu self-test vẫn kết thúc với mọi dòng `ok`, thay đổi đó giữ được.

Hãy làm trên bản sao. Sau khi giải nén skill, bạn có thể sửa trực tiếp và giữ lịch sử git riêng, hoặc trỏ skill tới tệp của bạn bằng biến môi trường (`NVE_STYLES`, `NVE_EFFECTS`) để cập nhật skill không bao giờ ghi đè bản sửa của bạn.

## 1. Theo từng video, không cần sửa tệp nào

Tệp kế hoạch `work/edit-plan.json` ghi đè gần như mọi thứ cho một video: preset caption (`captions.preset`), cỡ và vị trí dọc (`sizeRatio`, `yRatio`), kiểu trình bày và truy vấn cutaway, sticker, thẻ, hiệu ứng (`effects`, hoặc `--look id,id` ở `plan-skeleton`), lower third. Nhờ trợ lý sửa kế hoạch, hoặc mở `node edit-plan-ui.mjs --work work`: trang cục bộ để sửa trực tiếp caption, ảnh, sticker, thẻ kèm khung xem thử.

## 2. Diện mạo: `data/styles.json`

Bốn phong cách (`hype`, `explainer`, `documentary`, `creator`). Mỗi phong cách định nghĩa:

| Trường | Điều khiển |
| --- | --- |
| `colors` (`ink`, `stroke`, `accent`, `accent2`, `panel`) | màu caption, sticker, thẻ. Giữ tương phản chữ và nền từ 4,5:1; bước kiểm toán có đo |
| `fonts` | chuỗi phông. Chỉ phông cài trên máy dựng hoặc kèm trong `templates/fonts` mới dùng được |
| `captions` | preset (`bold`, `kinetic`, `pill`, `marker`, `minimal`, `editorial`), `maxWords` mỗi dòng, `sizeRatio`, `uppercase`, `yRatio` |
| `minPauseToCut`, `maxPauseToCut`, `punch`, `brollMaxShare` | mức cắt khoảng ngắt, zoom nhấn, phần video tối đa B-roll được phủ |
| `cutaway`, `showcase.sequence`, `showcase.entrances` | độ dài B-roll và vòng luân phiên card, polaroid, pip, stack, sticker, peek |
| `decor`, `emoji`, `transitions`, `sfx` | mật độ và loại sticker, emoji được phép, chuyển cảnh, hiệu ứng âm thanh |
| `banned` | quy tắc `plan-lint` và `audit-edit` thực thi. Thêm luật riêng của bạn ở đây |

Muốn thêm phong cách: chép một khối, đổi tên, dùng với `plan-skeleton.mjs --style tênbạn`. Muốn giữ bản sửa ngoài thư mục skill: chép `styles.json` ra nơi khác và đặt `NVE_STYLES` tới đường dẫn đó.

Kiểu caption mới: các preset nằm ở `templates/overlay.js` (`PRESETS`). Thêm một mục, cho nó một phông đã kèm sẵn, đặt `captions.preset` của phong cách thành tên đó, rồi xem kết quả bằng `render-overlay.mjs --times 1,4`.

## 3. Màu và phông thương hiệu

Sửa `colors` và `fonts` trong phong cách của bạn (mục 2). Thêm phông: đặt tệp `.ttf` vào `templates/fonts/` **cùng văn bản giấy phép của nó**, tham chiếu từ `templates/overlay.html` hoặc `overlay.js`, và thêm một dòng vào `CREDITS.md` nếu bạn phân phối lại. Ưu tiên phông giấy phép mở có bộ ký tự tiếng Việt nếu bạn làm caption tiếng Việt.

## 4. Hiệu ứng: `data/effects/*.json`

190 hiệu ứng, 11 họ: `camera`, `transition`, `time`, `color`, `retro`, `glitch`, `text`, `graphic`, `layout`, `subject` và `audio` (17 hiệu ứng âm thanh). Một hiệu ứng là một mục JSON chứa công thức FFmpeg có chỗ trống đặt tên; ngôn ngữ nhỏ này mô tả ở `data/effects/_dsl.json`. Ngân sách hiệu ứng cho từng phong cách (bao nhiêu cái mỗi phút, bao nhiêu cái mạnh, khoảng cách tối thiểu) nằm ở `data/effects-rules.json`.

Thêm một hiệu ứng: viết mục JSON, rồi chạy

```bash
node effects-selftest.mjs --id hieu-ung-cua-ban --sheet
```

Lệnh chạy hiệu ứng thật và đo (khung ngoài cửa sổ giữ nguyên, khung trong đổi, không lộ góc đen, chớp sáng dưới ba lần mỗi giây) rồi dựng bảng ảnh. **Đạt phép đo chưa chắc đẹp: luôn mở bảng ảnh ra xem.** Các bẫy đã gặp nằm ở `references/12-effects.md`. Đặt `NVE_EFFECTS` để dùng thư mục hiệu ứng riêng.

## 5. Decor và từ khóa: `data/decor-keywords.json`

Ánh xạ từ được nói sang icon, lấp lánh, pháo giấy, và sang khái niệm cảnh tiếng Anh dùng để tìm ảnh. Đó là cách skill quyết định người nói "tăng trưởng" thì hiện icon mũi tên đi lên. **Bảng này là thứ chính cần mở rộng khi dùng ngôn ngữ khác**: thêm các từ người ta nói bằng ngôn ngữ của bạn vào `concepts` (từ sang mô tả cảnh tiếng Anh) và `icons`.

`data/emoji-map.json` ánh xạ từ sang emoji kèm sẵn; `data/noto-lottie.json` ánh xạ chúng sang Noto Emoji động; `data/brands.json` liệt kê 26 logo thương hiệu hiện khi thương hiệu được nhắc tên (chỉ khi được nói ra).

## 6. Ảnh lấy từ đâu

- **Thư mục của bạn trước:** `resolve-assets.mjs --user-assets <thư mục>`. Tệp đặt tên theo id cutaway (`c03.jpg`) hoặc chứa từ của nó được dùng trước mọi lượt tìm.
- **Thêm nguồn công khai không cần mã:** thêm mục `jsonApi` vào `data/asset-sources.json` (URL có `{query}`, đường tới mảng kết quả, bản đồ trường, giấy phép cố định nếu có). Thử bằng `--sources id-của-bạn --dry` và xem `candidates.json`. Chi tiết: `references/04-assets-licenses.md`.
- **Giấy phép được nhận:** CC0, miền công cộng và CC BY. Đừng nới danh sách này khi chưa đọc điều khoản; skill từ chối NC, ND, BY-SA và giấy phép không rõ có chủ ý, vì chúng có thể lây sang hoặc cấm video của bạn.

## 7. Bản thân hướng dẫn

`SKILL.md` là điểm vào trợ lý đọc; `references/*.md` được nạp khi một bước cần. Chúng viết bằng **tiếng Việt**. Muốn đổi hành vi (hỏi câu nào, có những cổng nào, báo cáo viết ra sao) hãy sửa các tệp này. Giữ `SKILL.md` dưới 500 dòng và `description` trong frontmatter ngắn, cụ thể (dưới 400 ký tự để Antigravity CLI còn thấy). Nếu bạn dịch sang tiếng Anh, xin gửi pull request.

Ba cổng người dùng và các quy tắc cứng ở đầu `SKILL.md` tồn tại để trợ lý không thể lặng lẽ tải tài nguyên không phép hay bịa chữ. Chỉ nới khi bạn chấp nhận các rủi ro đó.

## 8. Mã đường ống

`scripts/*.mjs` và các trợ giúp Python là mã bình thường, có chú thích. `common.mjs` giữ các hàm dùng chung, `plan-lib.mjs` giữ lược đồ và quy tắc kế hoạch, `fx-lib.mjs` là bộ thông dịch hiệu ứng, `compose-base.mjs` và `render-overlay.mjs` là hai lớp. Khi đổi mã, hãy thêm vào `selftest.mjs` một phép kiểm trượt trước thay đổi và đạt sau thay đổi.

## Trước khi chia sẻ bản fork

Giữ nguyên các văn bản giấy phép nằm cạnh tệp kèm theo, giữ `CREDITS.md` và `NOTICE` chính xác cho mọi thứ bạn thêm, và nhớ rằng quy tắc về giấy phép ảnh của skill có đó để bảo vệ những người dùng video của bạn.
