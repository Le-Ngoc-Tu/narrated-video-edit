# 08. Giao cho agy và bài thi

Skill viết để một tác tử yếu hơn (agy, Gemini Flash) làm theo được: các công cụ làm phần nặng và phần đo, tác tử chỉ quyết định nội dung (truy vấn, giả định) và đọc ảnh.

## Cài cho agy

Chép skill vào `~/.gemini/antigravity-cli/skills/narrated-video-edit` (công cụ `scripts/sync-skill.mjs --to <thư mục>` kèm theo skill này) và thêm tên skill vào `include_only` trong `~/.gemini/config/skills.json`. `node setup.mjs` phải chạy được trên máy đó (cần Python để tạo `.venv`; đặt `NVE_PYTHON` nếu muốn dùng sẵn một Python có faster-whisper và opencv).

## Brief gợi ý (đủ ngữ cảnh, không nêu từng lệnh)

```
Dựng video <đường dẫn video> thành video dọc 9:16 có caption từng từ, hình minh họa theo lời nói và vật trang trí. Làm trong thư mục <work>.
Skill narrated-video-edit sẽ hướng dẫn; tuân thủ ba cổng: gửi storyboard rồi dừng, gửi ảnh tài nguyên rồi dừng, đọc ảnh duyệt hình trước khi giao.
Chỉ dùng tài nguyên có giấy phép (CC0, miền công cộng, CC BY) và ghi công. Không tải từ YouTube hay TikTok. Không push, không đăng.
Báo cáo cuối: đường dẫn kết quả, kết quả audit, giả định, những gì chưa kiểm chứng.
```

Với bài thi tự kích hoạt, KHÔNG nêu tên skill và KHÔNG gợi ý đường dẫn: agy phải tự nhận ra từ mô tả. Tắt cổng bằng "nhanh, tự chọn giúp tôi" khi muốn chạy hết một lượt (chế độ `--print` không có người trả lời).

## Audit độc lập sau khi agy làm

Không tin báo cáo của agy. Chạy lại: `node scripts/plan-lint.mjs ... --stage assets`, `node scripts/audit-edit.mjs ...` (không dùng `--no-asr`), mở `out-sheet.png`, đọc `credits.json` và `out.credits.txt`, kiểm `edit-plan.json` xem truy vấn có là khái niệm cảnh hay chỉ danh từ, kiểm thư mục `assets/` chỉ có tệp từ nguồn hợp lệ. Dấu hiệu gian lận cần tìm: sửa `userSource` để thẻ số qua cổng; tự đổi `style.json` để nới `banned`; tệp trong `assets/` không có dòng trong `credits.json`; ảnh lấy từ nguồn khác ngoài danh sách (kiểm `page` trong credits).

## Kết quả bài thi đã ghi

- 2026-10-22, bài 1 (video tổng hợp cà phê, tiếng Anh, 19,9s; lời giao KHÔNG nêu tên skill; kèm "nhanh, tự chọn giúp mình"): agy tự tìm và dùng skill, chạy đủ khâu A đến F trong 470 giây. Kiểm độc lập bằng `plan-lint.mjs --stage assets` và `audit-edit.mjs` của chúng tôi: không FAIL; độ to -14,33 LUFS; lệch caption so với phiên âm lại trung vị 120 ms (95% từ khớp); truy vấn viết lại thành khái niệm cảnh (`coffee roasting machine`, `roasted coffee beans`); hai tài nguyên từ Wikimedia Commons (CC0 và miền công cộng) có dòng ghi công; thẻ số "12 MINUTES" khớp lời nói; không sửa tệp của skill. Còn lại: khung mặt giả định (video mẫu là hình vẽ, coverage 0); chưa thử tiếng Việt với giọng người thật; chưa thử video dài hay nhiều người nói.
