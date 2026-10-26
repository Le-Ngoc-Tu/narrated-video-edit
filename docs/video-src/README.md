# Mã nguồn video

[Tiếng Việt](README.md) | [English](README.en.md)

Banner, showreel và video hướng dẫn trong `docs/media/` được dựng từ thư mục này. Dùng skill không cần đến nó; nó được giữ lại để dựng lại, dịch hoặc đổi phong cách các video.

## Phần nào thật, phần nào vẽ

- **Thật:** clip điện thoại trong showreel và banner (`assets/selftest-out.mp4`) là video thành phẩm do chính `selftest.mjs` của skill dựng trên một người nói giả lập. Sáu ô hiệu ứng (`assets/fx/*.mp4`) được tạo bằng cách chạy `fx-apply.mjs apply` trên clip đó. Ba hình thu nhỏ của các cổng duyệt (`plan-board.jpg`, `assets-sheet.jpg`, `out-sheet.jpg`) là storyboard, bảng ảnh và bảng kết quả thật của skill trong cùng lần chạy.
- **Vẽ:** mọi thứ còn lại là motion graphic viết bằng HTML, CSS và GSAP cho dự án này: tiêu đề chuyển động, bản đồ tuyến đường, vòng tiến độ, bộ đếm, biểu tượng. Video hướng dẫn không chiếu màn hình hay logo của sản phẩm nào; các bước trong Claude được kể bằng biểu tượng trừu tượng và đúng nhãn người dùng sẽ thấy.

## Các tệp

| Tệp | Vai trò |
| --- | --- |
| `index.html`, `style.css` | sân khấu và diện mạo (xanh pastel, Be Vietnam Pro lấy từ phông kèm theo skill) |
| `i18n.js` | toàn bộ chữ trên màn hình bằng tiếng Việt và tiếng Anh |
| `scenes.js` | hàm dùng chung, cảnh mở đầu, cảnh kết, showreel (`reel`) và banner |
| `guide.js` | video hướng dẫn (`guide`): tải zip, đi tới Skills, thả và quét, Claude Code, yêu cầu đầu tiên, bộ đếm chuẩn bị máy |
| `render.mjs` | tua timeline từng khung, chụp bằng Chrome, đẩy khung vào FFmpeg, trộn và chuẩn hóa nhạc |
| `assets/` | các clip và bảng ảnh thật nói ở trên |

Điểm đổi cảnh nằm trên lưới nhịp của bài nhạc (118 BPM, một nhịp dài 0,509 s) và được che bằng một tấm màu quét ngang.

## Dựng lại

Từ thư mục gốc kho, sau khi chạy `npm install` trong `skills/narrated-video-edit/scripts` (cung cấp `playwright-core`) và đã cài Chrome, FFmpeg:

```bash
MUSIC=/đường/dẫn/miromaxmusic-music-promotion-513944.mp3

node docs/video-src/render.mjs --video banner --out docs/media/banner.gif
node docs/video-src/render.mjs --video guide --lang vi --music "$MUSIC" --out docs/media/install-guide-vi.mp4
node docs/video-src/render.mjs --video guide --lang en --music "$MUSIC" --out docs/media/install-guide-en.mp4
node docs/video-src/render.mjs --video reel  --lang vi --music "$MUSIC" --out docs/media/showreel-vi.mp4
node docs/video-src/render.mjs --video reel  --lang en --music "$MUSIC" --out docs/media/showreel-en.mp4

# xem thử vài khung, không dựng video
node docs/video-src/render.mjs --video guide --lang vi --stills 2.6,14.5,36
```

Tệp nhạc không nằm trong kho. Tải "Music Promotion" của MiroMaxMusic ở [Pixabay](https://pixabay.com/music/corporate-music-promotion-513944/) (Pixabay Content License) hoặc dùng bài khác bạn được phép dùng; thời điểm các cảnh giả định 118 BPM.

Khung ảnh được tách vào `.cache/` ở lần chạy đầu (git bỏ qua). Việc dựng có tính xác định: cùng đầu vào cho cùng khung hình.

## Tạo lại các clip thật

```bash
cd skills/narrated-video-edit/scripts
node selftest.mjs                       # ghi .selftest/run/out.mp4, plan-board, assets-sheet, out-sheet
node fx-apply.mjs apply --in clip.mp4 --effect crash-zoom --at 0.6 --dur 1.2 --out crash-zoom.mp4
```

Thu `out.mp4` về 540x960 để thành `assets/selftest-out.mp4`, và mã hóa lại các clip hiệu ứng theo cách tương tự.
