# Đóng góp (Contributing)

[Tiếng Việt](#tiếng-việt) | [English](#english)

## Tiếng Việt

Cảm ơn bạn đã giúp. Dự án này cố ý là **điểm khởi đầu để mỗi người tự tinh chỉnh**, nên đóng góp hữu ích nhất là những thứ giúp nó chạy trên nhiều máy và nhiều ngôn ngữ hơn.

Đóng góp đầu tay nên làm:

- **Bản dịch tiếng Anh** của `SKILL.md` và `skills/narrated-video-edit/references/` (hiện viết bằng tiếng Việt, ngôn ngữ mặc định của dự án).
- **Sửa lỗi cho macOS và Linux**. Mã chọn đường dẫn theo hệ điều hành nhưng mới chỉ chạy trên Windows 11.
- **Bảng từ khóa cho ngôn ngữ khác** trong `data/decor-keywords.json`.
- **Hiệu ứng mới** trong `data/effects/` và **nguồn tài nguyên giấy phép mở** trong `data/asset-sources.json`.
- Báo lỗi kèm kết quả của `node selftest.mjs`.

### Trước khi mở pull request

1. Fork, làm trên một nhánh riêng. Mỗi pull request một thay đổi.
2. Chạy từ thư mục gốc kho (kho không có CI tự động, nên bước này do bạn chạy):

   ```bash
   node tools/validate-skill.mjs
   cd skills/narrated-video-edit/scripts && npm install && node selftest.mjs
   ```

   Cả hai phải kết thúc sạch. Nếu đụng `data/effects/`, chạy thêm `node effects-selftest.mjs --id <hiệu-ứng-của-bạn> --sheet` và **xem bảng ảnh**: đạt phép đo chưa chắc đẹp.
3. Theo phong cách của mã và văn xung quanh. Mỗi script có một dòng chú thích đầu nói nó làm gì và chạy thế nào.
4. Thêm hoặc đổi tệp kèm theo (phông, mô hình, emoji, thư viện) thì đặt văn bản giấy phép cạnh nó và cập nhật `CREDITS.md`, `CREDITS.en.md`, `NOTICE`. Pull request thêm tài liệu không có giấy phép tự do rõ ràng sẽ không được nhận.
5. Không thêm cảnh quay, nhạc, preset, LUT hay ảnh mà bạn không có quyền phân phối lại. Không thêm thứ gì tải từ YouTube, TikTok, Instagram hay tương tự; skill từ chối việc đó có chủ ý.
6. Tài liệu có hai ngôn ngữ: tiếng Việt là bản mặc định (`X.md`), tiếng Anh là bản dịch đặt cạnh (`X.en.md`). Sửa một bản thì sửa cả bản kia, hoặc nói trong pull request rằng bản dịch còn cần làm.

### Các quy tắc phải giữ

Quy tắc cứng ở đầu `SKILL.md` (ba cổng người dùng, chỉ nhận giấy phép cho phép, không bịa chữ trên màn hình, riêng tư, kiểm toán độc lập) là cốt lõi của dự án. Thay đổi làm yếu chúng cần lý do viết rõ trong pull request.

### Phát hành (người duy trì, làm bằng tay)

Kho không dùng CI. Mỗi bản phát hành làm như sau:

1. Tăng `version` trong `package.json`, thêm mục mới vào `CHANGELOG.md` và `CHANGELOG.en.md`, cập nhật `RELEASE_NOTES.md`.
2. Chạy `node tools/validate-skill.mjs`, rồi `node skills/narrated-video-edit/scripts/selftest.mjs` từ một bản sao sạch.
3. Chạy `node tools/build-release.mjs`. Lệnh ghi `dist/narrated-video-edit-vX.Y.Z.zip` và tệp `.sha256` (cùng nội dung thì ra cùng mã băm).
4. Trên GitHub: *Releases*, *Draft a new release*, tạo thẻ `vX.Y.Z` trên `main`, dán `RELEASE_NOTES.md`, đính kèm hai tệp trong `dist/`, rồi *Publish*.

## English

Thanks for helping. This project is deliberately a **starting point that people tune**, so the most useful contributions are the ones that make it work on more machines and in more languages.

Good first contributions:

- An **English translation** of `SKILL.md` and `skills/narrated-video-edit/references/` (they are written in Vietnamese, the project's default language).
- **macOS and Linux fixes**. The code picks paths by platform but has only been run on Windows 11.
- **Keyword tables for other languages** in `data/decor-keywords.json`.
- **New effects** in `data/effects/` and **new open-license asset sources** in `data/asset-sources.json`.
- Bug reports with the output of `node selftest.mjs`.

### Before you open a pull request

1. Fork, then work on a branch. Keep one change per pull request.
2. Run, from the repository root (the repository has no automatic CI, so this is on you):

   ```bash
   node tools/validate-skill.mjs
   cd skills/narrated-video-edit/scripts && npm install && node selftest.mjs
   ```

   Both must finish clean. If you touched `data/effects/`, also run `node effects-selftest.mjs --id <your-effect> --sheet` and **look at the contact sheet**: passing the measurements does not mean it looks good.
3. Match the style of the surrounding code and prose. Scripts have a short header comment saying what they do and how to run them.
4. If you add or change a bundled file (font, model, emoji, library), put its license text next to it and update `CREDITS.md`, `CREDITS.en.md` and `NOTICE`. A pull request that adds material without a clear free license will not be merged.
5. Do not add footage, music, presets, LUTs or images you do not have the right to redistribute. Do not add anything that downloads from YouTube, TikTok, Instagram or similar; the skill refuses that on purpose.
6. Documentation exists in two languages: Vietnamese is the default (`X.md`), English is the translation beside it (`X.en.md`). If you change one, change the other, or say in the pull request that the translation is still needed.

### Rules that must keep holding

The hard rules at the top of `SKILL.md` (three user gates, accepted licenses only, nothing invented on screen, privacy, independent audit) are the heart of the project. Changes that weaken them need a written reason in the pull request.

### Releasing (maintainers, by hand)

The repository does not use CI. For each release:

1. Bump `version` in `package.json`, add an entry to `CHANGELOG.md` and `CHANGELOG.en.md`, update `RELEASE_NOTES.md`.
2. Run `node tools/validate-skill.mjs`, then `node skills/narrated-video-edit/scripts/selftest.mjs` from a clean copy.
3. Run `node tools/build-release.mjs`. It writes `dist/narrated-video-edit-vX.Y.Z.zip` and a `.sha256` file (same content gives the same hash).
4. On GitHub: *Releases*, *Draft a new release*, create tag `vX.Y.Z` on `main`, paste `RELEASE_NOTES.md`, attach both files from `dist/`, then *Publish*.
