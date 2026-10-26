# 04. Tài nguyên và giấy phép (khâu C)

`node resolve-assets.mjs --plan work/edit-plan.json [--user-assets dir] [--sources commons,openverse,nasa] [--allow cc0,pd,by] [--kind image|video] [--limit 6] [--dry] [--only c01,c02]`

## Thứ tự tìm

1. **Tài nguyên của người dùng** (`--user-assets`): tệp tên đúng id cutaway (`c03.jpg`) hoặc có từ của truy vấn trong tên tệp. Đánh dấu `userProvided`, không cần ghi công. Luôn ưu tiên: đó là hình thật của họ.
2. **Nguồn công khai không cần khóa API:**
   - Wikimedia Commons: ảnh (kèm bản 1920px) và video (bản dịch webm/mp4 từ 640 đến 1920 px). Giấy phép đọc từ metadata từng tệp.
   - Openverse: một chỉ mục chung của Flickr, Wikimedia, bảo tàng, thư viện; lọc sẵn CC0, miền công cộng, CC BY, không nội dung người lớn.
   - NASA Image and Video Library: ảnh và clip về Trái Đất, vũ trụ, máy bay; miền công cộng với điều kiện không ngụ ý NASA bảo trợ và không dùng logo NASA.
3. **Không có kết quả:** đổi truy vấn (một cụm 2 đến 4 từ, tiếng Anh, vật thể cụ thể), thử `--kind video`, rồi bỏ cutaway hoặc xin người dùng ảnh. KHÔNG nới giấy phép để có kết quả.

Chất lượng: kho công khai không có chất lượng stock thương mại. Video Wikimedia thường 480p và thưa; ảnh thì ổn. Nói thẳng với người dùng: muốn clip stock đẹp thì dùng thư mục của họ hoặc nguồn có khóa API của họ (xem "Thêm nguồn").

## Giấy phép

| Loại | Dùng được | Điều kiện |
| --- | --- | --- |
| CC0, miền công cộng (PD) | có | không bắt buộc ghi công (vẫn ghi) |
| CC BY | có | PHẢI ghi công: tên tác phẩm, tác giả, giấy phép, nguồn; dán nội dung `out.credits.txt` vào mô tả video |
| CC BY-SA | KHÔNG (mặc định) | buộc chia sẻ tương tự và có thể kéo cả video vào cùng giấy phép |
| BY-NC, BY-ND, không rõ | KHÔNG | không dùng được cho video thương mại hoặc dựng lại |

`--allow` có từ chối cứng NC, ND, không rõ. Có `--allow by-sa` thì công cụ cảnh báo; chỉ dùng khi người dùng hiểu rõ.

## Đầu ra

- `assets/<id>.<đuôi>`: tệp đã tải (kèm `sha256`).
- `assets/credits.json`: mỗi dòng gồm `file, cutaway, query, title, creator, license, licenseName, licenseUrl, source, page, credit, bytes, sha256`.
- `assets/credits.txt`, sau đó `finalize.mjs` chép thành `out.credits.txt`.
- `candidates.json`: top 5 ứng viên cho mỗi cutaway (để đổi lựa chọn bằng tay).
- `assets-sheet.png`: ảnh duyệt cho CỔNG 2.

Chấm điểm ứng viên (`score`): độ khớp chữ giữa truy vấn và tiêu đề cộng mô tả (trọng số lớn nhất), độ phân giải, đúng hướng khung (dọc hay ngang), giấy phép. Điểm cao chưa chắc đúng ngữ cảnh: LUÔN xem ảnh.

## Quyền riêng tư

Truy vấn là từ khóa rút từ lời nói và được gửi tới API công cộng (các địa chỉ trong `data/asset-sources.json`: commons.wikimedia.org, api.openverse.org, images-api.nasa.gov, openaccess-api.clevelandart.org). Báo người dùng ở CỔNG 1. Không gửi video, âm thanh hay tên người dùng. Tiêu đề `User-Agent` phải là ASCII (chữ có dấu làm `fetch` lỗi).

## Nguồn nằm trong dữ liệu, không nằm trong mã

`data/asset-sources.json` giữ: danh sách nguồn tự động (đường dẫn API, giới hạn, ánh xạ trường), quy tắc nhận giấy phép (`licenseRules`, thử lần lượt), giấy phép bị cấm, mặc định (nguồn, giới hạn, thời gian chờ), và `manualCandidates` (nguồn để tác tử tự tìm). Nguồn tự động hiện có: Wikimedia Commons, Openverse, NASA, Cleveland Museum of Art Open Access.

**Thêm một nguồn JSON đơn giản (không sửa mã).** Thêm một mục `type: "jsonApi"` vào `sources`: `url` có `{query}` và `{pageSize}`, `results` là đường tới mảng kết quả, `fields` ánh xạ `id title description url thumb width height page creator license licenseVersion licenseUrl` bằng đường dẫn chấm (`a.b`, `a[0].b`, `a[].b`), `const` cho giá trị cố định (nguồn chỉ có một giấy phép, như CC0), `where` để lọc kết quả theo trường. Chạy `node resolve-assets.mjs --plan ... --sources <id> --dry` và kiểm `candidates.json`: giấy phép phải ra `cc0`, `pd` hoặc `by`. API hai bước (tìm rồi mới hỏi chi tiết) cần mã riêng như `commons` và `nasa`.

Nguồn cần khóa API (Pexels, Pixabay, Unsplash) có giấy phép riêng, không phải CC0 hay CC BY: mặc định không dùng. Người dùng có khóa riêng thì khóa nằm trong biến môi trường của họ, không bao giờ ghi hay in khóa, và phải đọc điều khoản trước khi cho vào danh sách trắng.

## Tìm ngoài danh sách (cho tác tử)

Khi ba bốn nguồn tự động không có hình đúng (hoặc cần ảnh cụ thể), tác tử được tìm thêm theo cách sau, KHÔNG nới giấy phép:
1. **Chọn nơi tìm** từ `manualCandidates` (bảo tàng và thư viện công khai) hoặc dùng WebSearch với truy vấn kèm tên giấy phép ("public domain", "CC0", "open access") và tên vật thể cụ thể. Bỏ qua kho ảnh thương mại, mạng xã hội, Google Images, Pinterest.
2. **Xác minh giấy phép trên chính trang của tệp** (WebFetch hoặc mở trình duyệt), không tin trang trung gian hay kết quả tìm kiếm. Phải thấy nhãn CC0, miền công cộng hoặc CC BY (kèm đường dẫn giấy phép). Không thấy rõ thì bỏ.
3. **Tải bằng đường dẫn tệp gốc** (curl với User-Agent ASCII) vào thư mục tạm; xem ảnh để kiểm ngữ cảnh và không có người xác định được.
4. **Đăng ký**: `node resolve-assets.mjs --plan work/edit-plan.json --register <tệp> --cutaway c03 --license cc0|pd|by|"CC BY 4.0" --title "..." --creator "..." --page <trang đã xác minh> [--license-url <văn bản giấy phép> --license-name "CC BY 4.0"]`. Công cụ từ chối giấy phép ngoài danh sách trắng, thiếu tác giả, trang nguồn hoặc (với CC BY) đường dẫn giấy phép; ghi `sha256`, dòng trong `credits.json` (`source: manual`) và dựng lại `assets-sheet.png` cho CỔNG 2.
5. **Báo người dùng** nguồn nào đã dùng ngoài danh sách tự động để họ biết truy vấn đã đi đâu.

Nguồn mới tìm thấy và đáng dùng lại: thêm vào `manualCandidates` (id, nhãn, url, giấy phép, cách xác minh, status) để lần sau không phải tìm lại.

## Trang trí (decor)

Sticker (gạch chân, vòng tròn, mũi tên, vụ nổ, dấu kiểm, dấu hỏi, dấu chấm than, huy hiệu chữ) do mã vẽ trong `templates/overlay.js`, tô bằng màu của phong cách; không tải từ ngoài, nên không có vấn đề giấy phép. Muốn thêm hình riêng: thêm một hàm vào `SHAPES` và tên loại vào `allowed` của phong cách.
