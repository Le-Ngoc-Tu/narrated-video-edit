# Credits and thanks

[Tiếng Việt](CREDITS.md) | [English](CREDITS.en.md)

`narrated-video-edit` is glue and craft on top of other people's generous work. Almost every capability in it rests on free, open projects, free-licensed fonts and emoji, and public collections of images. This page names them, says exactly what each one is used for, and states the license that applies. If you build on this project, please keep these notices.

If something here is wrong, or you are an author who is used but missing, [open an issue](../../issues/new/choose). It will be fixed.

## 1. Thank you

To the maintainers and contributors of **FFmpeg**, **OpenAI Whisper**, **faster-whisper and CTranslate2**, **OpenCV and OpenCV Zoo**, **MediaPipe**, **Playwright**, **GSAP**, **lottie-web**, **Noto Emoji**, **Fluent Emoji**, **Iconify**, the font designers behind **Anton, Bangers, Be Vietnam Pro, Lora and Montserrat**, the **Wikimedia, Openverse, NASA and Cleveland Museum of Art** open-access programs, and the **Agent Skills** specification. You gave away work that took years, and this project exists because you did.

To **Nattalie Choprasert**, whose three public tutorials on editing videos with Claude we studied closely, and to the other video creators whose public tutorials on editing with AI taught the pacing, the caption habits and the level of polish this skill aims for. Section 6 explains exactly what was learned and what was deliberately not copied.

## 2. Tools you install yourself (not bundled)

| Project | Role here | License |
| --- | --- | --- |
| [FFmpeg](https://ffmpeg.org) | cutting, zoom, B-roll insertion, effects, loudness normalisation, final encode | LGPL-2.1+ or GPL-2+ depending on the build you install |
| [Node.js](https://nodejs.org) | runs every script in `scripts/` | MIT and bundled third-party licenses |
| [Google Chrome](https://www.google.com/chrome/) / Chromium | renders the transparent overlay layer (captions, stickers, cards) | Chrome terms of service / BSD-style (Chromium) |
| [Python](https://www.python.org) | isolated `.venv` for transcription and face detection | PSF License |

## 3. Libraries installed by `node setup.mjs` and `npm install`

| Project | Authors | Role here | License |
| --- | --- | --- | --- |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | SYSTRAN | local word-by-word transcription | MIT |
| [CTranslate2](https://github.com/OpenNMT/CTranslate2) | OpenNMT | inference engine under faster-whisper (installed as its dependency) | MIT |
| [Whisper `large-v3` weights](https://github.com/openai/whisper) | OpenAI (converted for CTranslate2 by SYSTRAN) | speech recognition model, downloaded from Hugging Face on first run | MIT |
| [opencv-python-headless](https://github.com/opencv/opencv-python) | OpenCV team | video frames and the face detector runtime | Apache-2.0 (bundled FFmpeg parts LGPL-2.1) |
| [MediaPipe](https://github.com/google-ai-edge/mediapipe) (optional, `--with-segmentation`) | Google | person segmentation for text placed behind the speaker | Apache-2.0 |
| [playwright-core](https://github.com/microsoft/playwright) | Microsoft | drives Chrome to render overlay frames | Apache-2.0 |
| [GSAP](https://gsap.com) (`gsap` on npm) | GreenSock / Webflow | all overlay motion | GSAP Standard License ([terms](https://gsap.com/standard-license)) |

## 4. Files bundled in this repository

| Item | Where | Author | License |
| --- | --- | --- | --- |
| GSAP 3.15.0 and DrawSVGPlugin 3.15.0 | `skills/narrated-video-edit/templates/vendor/` | Jack Doyle, GreenSock | GSAP Standard License. Read the terms before commercial redistribution of GSAP itself |
| lottie-web | `templates/vendor/lottie.min.js`, `LICENSE-lottie-web.txt` | Bodymovin / Airbnb contributors | MIT |
| YuNet face detector (`face_detection_yunet_2023mar.onnx`) | `templates/models/`, `LICENSE-opencv-zoo-yunet.txt` | Shiqi Yu, from [OpenCV Zoo](https://github.com/opencv/opencv_zoo) and [libfacedetection](https://github.com/ShiqiYu/libfacedetection) | MIT |
| MediaPipe Selfie Segmentation models (`selfie_segmenter*.tflite`) | `templates/models/`, `NOTICE-selfie-segmenter.txt`, `LICENSE-mediapipe-apache-2.0.txt` | Tingbo Hou, Siargey Pisarchyk, Karthik Raveendran (Google) | Apache-2.0. Per the model card, surveillance and identity recognition are out of scope; this project uses the models only to separate a person from the background when editing video |
| Fluent Emoji, 62 PNG files | `templates/emoji/`, `LICENSE-fluentui-emoji.txt` | Microsoft | MIT |
| Anton | `templates/fonts/`, `OFL-anton.txt` | The Anton Project Authors | SIL Open Font License 1.1 |
| Bangers | `templates/fonts/`, `OFL-bangers.txt` | The Bangers Project Authors | SIL Open Font License 1.1 |
| Be Vietnam Pro | `templates/fonts/`, `OFL-bevietnampro.txt` | The Be Vietnam Pro Project Authors | SIL Open Font License 1.1 |
| Lora Italic | `templates/fonts/`, `OFL-lora.txt` | The Lora Project Authors | SIL Open Font License 1.1 |
| Montserrat | `templates/fonts/`, `OFL-montserrat.txt` | The Montserrat Project Authors | SIL Open Font License 1.1 |
| `fixtures/narration-en.wav` | `skills/narrated-video-edit/fixtures/` | generated for this project with eSpeak NG, used only by the self-test | no third-party audio |

Font files are included unmodified. The fonts are licensed under the OFL; the OFL does not allow selling the font files on their own.

## 5. Fetched at run time (never stored in this repo)

| Source | Used for | License |
| --- | --- | --- |
| [Animated Noto Emoji](https://googlefonts.github.io/noto-emoji-files/) | animated emoji (Lottie) on captions | CC BY 4.0, Google. Credit is added to the generated `out.credits.txt` |
| [Iconify](https://iconify.design) API and the icon sets it serves | stickers and icons; only sets whose SPDX license is in the allow-list of `data/decor-sources.json` (MIT, ISC, Apache-2.0, CC0-1.0, Unlicense, CC-BY-4.0, BSD-3-Clause) | per icon set. Brand logos come from the `logos` and `simple-icons` sets (CC0); trademarks still belong to their owners |
| [Wikimedia Commons](https://commons.wikimedia.org) | B-roll images and clips | per file; the skill accepts CC0, public domain and CC BY only |
| [Openverse](https://openverse.org) | B-roll images across Flickr, museums and libraries | per file; filtered to CC0, public domain and CC BY |
| [NASA Image and Video Library](https://images.nasa.gov) | space and Earth footage | public domain; do not imply NASA endorsement, do not use NASA logos |
| [Cleveland Museum of Art Open Access](https://openaccess-api.clevelandart.org) | artwork images | CC0 |

`data/asset-sources.json` also lists the Library of Congress "Free to Use and Reuse", the Rijksmuseum and the Smithsonian Open Access program as places an agent may look. They are not fetched automatically, and each file must be verified on its own page first.

Every downloaded file gets a line in `assets/credits.json`. When a file is CC BY, the finished video comes with an `out.credits.txt` to paste into the video description.

## 6. Ideas and methods

- **Pacing and polish.** The caption bands with a highlighted spoken word, B-roll treated as designed objects instead of pasted pictures, the "keep the speaker, only layer on top" rule and the audit-before-delivery habit come from watching public tutorials by video creators who edit with AI (three tutorials by Nattalie Choprasert, and four reels by a Vietnamese creator), plus general practice in short-form video. Only structure and timing were measured and learned (for example the spacing between a spoken word and the effect that follows it). No footage, text, brand, preset, LUT or audio file from any of them is included. The reel creator's name is not printed here because the files were studied privately; if that is you and you want a credit line, open an issue.
- **Editing rules.** The effect-budget rules in `references/12-effects.md` were drawn from published editing documentation and then tested by experiment; the effects themselves are generic techniques written for this project, not copied presets, LUTs or sound files.
- **The skill format** follows the open [Agent Skills specification](https://agentskills.io/specification) and Anthropic's documentation for [custom skills](https://claude.com/docs/skills/how-to).
- **Development.** The project was written with the help of AI coding assistants (Claude Code and Antigravity CLI) and then reviewed, tested and corrected by the maintainer. Nothing in the repository is presented as a human-only effort, and nothing is guaranteed correct because an assistant wrote it; the self-test and the audit tools exist for that reason.

## 7. Media in `docs/media/`

| Item | Credit |
| --- | --- |
| Background music in the showreel and tutorial videos | "Music Promotion" by MiroMaxMusic, from [Pixabay](https://pixabay.com/music/corporate-music-promotion-513944/), used under the [Pixabay Content License](https://pixabay.com/service/license-summary/). The track is not included on its own and may not be redistributed on its own |
| Video design | drawn in HTML and GSAP for this project. The pacing was guided by a short product-explainer video the maintainer supplied as a reference; no footage, text or brand assets from it were reused |
| Claude, Anthropic and other product names | trademarks of their owners; the tutorial shows only abstract icons and motion graphics, never a screen or logo of any product, and implies no endorsement by Anthropic |

## 8. A note on trademarks

Names such as Claude, Anthropic, Google, Chrome, Microsoft, Playwright, OpenAI, NASA and GSAP belong to their owners. They are used only to say which tool does what. This project is independent and is not affiliated with or endorsed by any of them.
