# Ghi công và lời cảm ơn

[Tiếng Việt](CREDITS.md) | [English](CREDITS.en.md)

`narrated-video-edit` là phần keo dán và tay nghề đặt trên công sức rộng rãi của nhiều người khác. Gần như mọi khả năng của nó dựa vào các dự án mở miễn phí, phông chữ và emoji có giấy phép tự do, và các kho ảnh công khai. Trang này nêu tên từng nguồn, nói rõ nó được dùng vào việc gì và giấy phép nào áp dụng. Nếu bạn xây tiếp trên dự án này, xin giữ nguyên các ghi chú ở đây.

Nếu có chỗ sai, hoặc bạn là tác giả được dùng mà chưa có tên, hãy [mở issue](../../issues/new/choose). Chúng tôi sẽ sửa.

## 1. Lời cảm ơn

Xin cảm ơn những người duy trì và đóng góp cho **FFmpeg**, **OpenAI Whisper**, **faster-whisper và CTranslate2**, **OpenCV và OpenCV Zoo**, **MediaPipe**, **Playwright**, **GSAP**, **lottie-web**, **Noto Emoji**, **Fluent Emoji**, **Iconify**, các nhà thiết kế phông **Anton, Bangers, Be Vietnam Pro, Lora và Montserrat**, các chương trình truy cập mở của **Wikimedia, Openverse, NASA và Bảo tàng Nghệ thuật Cleveland**, và đặc tả **Agent Skills**. Các bạn đã trao đi công việc của nhiều năm, và dự án này tồn tại nhờ điều đó.

Xin cảm ơn **Nattalie Choprasert**, người có ba bài hướng dẫn công khai về dựng video với Claude mà chúng tôi đã học kỹ, và cảm ơn các nhà sáng tạo video khác có bài hướng dẫn công khai về dựng video với AI: nhịp dựng, thói quen làm caption và mức hoàn thiện mà skill này hướng tới đều học từ đó. Mục 6 nói rõ đã học gì và cố ý không chép gì.

## 2. Công cụ bạn tự cài (không kèm trong kho)

| Dự án | Vai trò | Giấy phép |
| --- | --- | --- |
| [FFmpeg](https://ffmpeg.org) | cắt, zoom, chèn B-roll, hiệu ứng, chuẩn hóa độ to, xuất bản cuối | LGPL-2.1+ hoặc GPL-2+ tùy bản bạn cài |
| [Node.js](https://nodejs.org) | chạy mọi script trong `scripts/` | MIT và giấy phép các thành phần đi kèm |
| [Google Chrome](https://www.google.com/chrome/) / Chromium | dựng lớp phủ trong suốt (caption, sticker, thẻ) | điều khoản dịch vụ Chrome / kiểu BSD (Chromium) |
| [Python](https://www.python.org) | `.venv` riêng cho phiên âm và dò mặt | PSF License |

## 3. Thư viện do `node setup.mjs` và `npm install` cài

| Dự án | Tác giả | Vai trò | Giấy phép |
| --- | --- | --- | --- |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | SYSTRAN | phiên âm cục bộ từng từ | MIT |
| [CTranslate2](https://github.com/OpenNMT/CTranslate2) | OpenNMT | bộ suy luận bên dưới faster-whisper (cài theo phụ thuộc) | MIT |
| [Trọng số Whisper `large-v3`](https://github.com/openai/whisper) | OpenAI (SYSTRAN chuyển sang CTranslate2) | mô hình nhận dạng giọng nói, tải từ Hugging Face ở lần chạy đầu | MIT |
| [opencv-python-headless](https://github.com/opencv/opencv-python) | nhóm OpenCV | đọc khung hình và chạy bộ dò mặt | Apache-2.0 (phần FFmpeg đi kèm theo LGPL-2.1) |
| [MediaPipe](https://github.com/google-ai-edge/mediapipe) (tùy chọn, `--with-segmentation`) | Google | tách người để đặt chữ phía sau người nói | Apache-2.0 |
| [playwright-core](https://github.com/microsoft/playwright) | Microsoft | điều khiển Chrome dựng khung lớp phủ | Apache-2.0 |
| [GSAP](https://gsap.com) (gói `gsap` trên npm) | GreenSock / Webflow | toàn bộ chuyển động lớp phủ | GSAP Standard License ([điều khoản](https://gsap.com/standard-license)) |

## 4. Tệp kèm theo trong kho này

| Mục | Vị trí | Tác giả | Giấy phép |
| --- | --- | --- | --- |
| GSAP 3.15.0 và DrawSVGPlugin 3.15.0 | `skills/narrated-video-edit/templates/vendor/` | Jack Doyle, GreenSock | GSAP Standard License. Đọc điều khoản trước khi phân phối lại GSAP cho mục đích thương mại |
| lottie-web | `templates/vendor/lottie.min.js`, `LICENSE-lottie-web.txt` | Bodymovin / những người đóng góp ở Airbnb | MIT |
| Bộ dò mặt YuNet (`face_detection_yunet_2023mar.onnx`) | `templates/models/`, `LICENSE-opencv-zoo-yunet.txt` | Shiqi Yu, từ [OpenCV Zoo](https://github.com/opencv/opencv_zoo) và [libfacedetection](https://github.com/ShiqiYu/libfacedetection) | MIT |
| Mô hình MediaPipe Selfie Segmentation (`selfie_segmenter*.tflite`) | `templates/models/`, `NOTICE-selfie-segmenter.txt`, `LICENSE-mediapipe-apache-2.0.txt` | Tingbo Hou, Siargey Pisarchyk, Karthik Raveendran (Google) | Apache-2.0. Theo thẻ mô hình, giám sát và nhận dạng danh tính nằm ngoài phạm vi dùng; dự án chỉ dùng để tách người khỏi nền khi dựng video |
| Fluent Emoji, 62 tệp PNG | `templates/emoji/`, `LICENSE-fluentui-emoji.txt` | Microsoft | MIT |
| Anton | `templates/fonts/`, `OFL-anton.txt` | Những tác giả dự án Anton | SIL Open Font License 1.1 |
| Bangers | `templates/fonts/`, `OFL-bangers.txt` | Những tác giả dự án Bangers | SIL Open Font License 1.1 |
| Be Vietnam Pro | `templates/fonts/`, `OFL-bevietnampro.txt` | Những tác giả dự án Be Vietnam Pro | SIL Open Font License 1.1 |
| Lora Italic | `templates/fonts/`, `OFL-lora.txt` | Những tác giả dự án Lora | SIL Open Font License 1.1 |
| Montserrat | `templates/fonts/`, `OFL-montserrat.txt` | Những tác giả dự án Montserrat | SIL Open Font License 1.1 |
| `fixtures/narration-en.wav` | `skills/narrated-video-edit/fixtures/` | sinh riêng cho dự án bằng eSpeak NG, chỉ dùng cho self-test | không chứa âm thanh của bên thứ ba |

Tệp phông giữ nguyên, không sửa. Phông theo OFL; OFL không cho phép bán riêng tệp phông.

## 5. Tải về khi chạy (không lưu trong kho)

| Nguồn | Dùng cho | Giấy phép |
| --- | --- | --- |
| [Animated Noto Emoji](https://googlefonts.github.io/noto-emoji-files/) | emoji động (Lottie) trên caption | CC BY 4.0, Google. Dòng ghi công tự vào `out.credits.txt` |
| API [Iconify](https://iconify.design) và các bộ icon nó phục vụ | sticker và icon; chỉ nhận bộ có giấy phép SPDX nằm trong danh sách trắng của `data/decor-sources.json` (MIT, ISC, Apache-2.0, CC0-1.0, Unlicense, CC-BY-4.0, BSD-3-Clause) | theo từng bộ icon. Logo thương hiệu lấy từ bộ `logos` và `simple-icons` (CC0); nhãn hiệu vẫn thuộc chủ sở hữu |
| [Wikimedia Commons](https://commons.wikimedia.org) | ảnh và clip B-roll | theo từng tệp; skill chỉ nhận CC0, miền công cộng và CC BY |
| [Openverse](https://openverse.org) | ảnh B-roll từ Flickr, bảo tàng, thư viện | theo từng tệp; lọc sẵn CC0, miền công cộng, CC BY |
| [NASA Image and Video Library](https://images.nasa.gov) | cảnh vũ trụ và Trái Đất | miền công cộng; không ngụ ý NASA bảo trợ, không dùng logo NASA |
| [Cleveland Museum of Art Open Access](https://openaccess-api.clevelandart.org) | ảnh tác phẩm nghệ thuật | CC0 |

`data/asset-sources.json` còn nêu Thư viện Quốc hội Mỹ ("Free to Use and Reuse"), Rijksmuseum và chương trình Smithsonian Open Access như nơi tác tử có thể tìm. Chúng không tải tự động, và từng tệp phải được xác minh trên chính trang của nó trước.

Mỗi tệp tải về có một dòng trong `assets/credits.json`. Nếu tệp là CC BY, video thành phẩm đi kèm `out.credits.txt` để dán vào mô tả video.

## 6. Ý tưởng và phương pháp

- **Nhịp dựng và độ hoàn thiện.** Băng caption nhấn từ đang nói, B-roll như vật thể thiết kế thay vì ảnh dán, quy tắc "giữ người nói, chỉ đè lớp lên trên" và thói quen kiểm toán trước khi giao đều học từ việc xem các bài hướng dẫn công khai của những người dựng video bằng AI (ba bài của Nattalie Choprasert và bốn reel của một creator người Việt) cùng thực hành chung của video ngắn. Chỉ đo và học cấu trúc, thời gian (ví dụ khoảng cách giữa từ được nói và hiệu ứng theo sau). Không có cảnh quay, chữ, thương hiệu, preset, LUT hay tệp âm thanh nào của họ nằm trong kho. Tên creator làm các reel không in ở đây vì tệp nguồn được nghiên cứu riêng; nếu đó là bạn và bạn muốn có dòng ghi công, hãy mở issue.
- **Quy tắc dựng.** Các quy tắc ngân sách hiệu ứng trong `references/12-effects.md` rút từ tài liệu dựng đã công bố rồi kiểm bằng thực nghiệm; bản thân các hiệu ứng là kỹ thuật chung viết riêng cho dự án, không chép preset, LUT hay tệp âm thanh có sẵn.
- **Định dạng skill** theo đặc tả mở [Agent Skills](https://agentskills.io/specification) và tài liệu [skill tùy chỉnh](https://claude.com/docs/skills/how-to) của Anthropic.
- **Cách phát triển.** Dự án được viết với sự trợ giúp của trợ lý lập trình AI (Claude Code và Antigravity CLI) rồi do người duy trì rà soát, thử và sửa. Không có gì trong kho được trình bày như công sức hoàn toàn của con người, và không có gì được bảo đảm đúng chỉ vì trợ lý đã viết; self-test và các công cụ kiểm toán tồn tại vì lý do đó.

## 7. Phương tiện trong `docs/media/`

| Mục | Ghi công |
| --- | --- |
| Nhạc nền video showreel và video hướng dẫn | "Music Promotion" của MiroMaxMusic, từ [Pixabay](https://pixabay.com/music/corporate-music-promotion-513944/), dùng theo [Pixabay Content License](https://pixabay.com/service/license-summary/). Bài nhạc không kèm riêng và không được phân phối lại riêng |
| Thiết kế video | vẽ bằng HTML và GSAP cho dự án này. Nhịp dựng được định hướng bởi một video giới thiệu sản phẩm ngắn do người duy trì cung cấp làm tham chiếu; không dùng lại cảnh quay, chữ hay tài sản thương hiệu nào của video đó |
| Claude, Anthropic và tên sản phẩm khác | nhãn hiệu của chủ sở hữu; video hướng dẫn vẽ lại giao diện đơn giản để dạy, không dùng logo chính thức, và không ngụ ý được Anthropic bảo trợ |

## 8. Về nhãn hiệu

Các tên như Claude, Anthropic, Google, Chrome, Microsoft, Playwright, OpenAI, NASA và GSAP thuộc về chủ sở hữu. Chúng chỉ được dùng để nói công cụ nào làm việc gì. Dự án này độc lập, không liên kết hay được bảo trợ bởi bất kỳ bên nào trong số đó.
