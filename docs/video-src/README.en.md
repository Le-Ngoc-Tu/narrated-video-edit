# Video sources

[Tiếng Việt](README.md) | [English](README.en.md)

The banner, the showreel and the tutorial video in `docs/media/` are built from this folder. Nothing here is needed to use the skill; it is kept so the videos can be rebuilt, translated or restyled.

## What is real and what is drawn

- **Real:** the phone clip in the showreel and banner (`assets/selftest-out.mp4`) is the finished video produced by the skill's own `selftest.mjs` on a synthetic speaker. The six effect tiles (`assets/fx/*.mp4`) were made by running `fx-apply.mjs apply` on that clip. The three gate thumbnails (`plan-board.jpg`, `assets-sheet.jpg`, `out-sheet.jpg`) are the skill's real storyboard, image sheet and result sheet from the same run.
- **Drawn:** everything else is motion graphics written in HTML, CSS and GSAP for this project: kinetic titles, route maps, progress rings, counters, icons. The tutorial shows no screen or logo of any product; the steps in Claude are told with abstract icons and the labels a user will see.

## Files

| File | Role |
| --- | --- |
| `index.html`, `style.css` | the stage and its look (pastel blue, Be Vietnam Pro from the skill's bundled fonts) |
| `i18n.js` | all on-screen text in Vietnamese and English |
| `scenes.js` | shared helpers, the opening scene, the closing scene, the showreel (`reel`) and the banner |
| `guide.js` | the tutorial (`guide`): download, route to Skills, drop and scan, Claude Code, first request, setup counter |
| `render.mjs` | seeks the timeline frame by frame, screenshots it with Chrome, pipes the frames to FFmpeg, mixes and normalises the music |
| `assets/` | the real clips and sheets described above |

Scene cuts sit on the beat grid of the music (118 BPM, one beat is 0.509 s) and are covered by a colored wipe.

## Rebuild

From the repository root, after `npm install` in `skills/narrated-video-edit/scripts` (it provides `playwright-core`) with Chrome and FFmpeg installed:

```bash
MUSIC=/path/to/miromaxmusic-music-promotion-513944.mp3

node docs/video-src/render.mjs --video banner --out docs/media/banner.gif
node docs/video-src/render.mjs --video guide --lang vi --music "$MUSIC" --out docs/media/install-guide-vi.mp4
node docs/video-src/render.mjs --video guide --lang en --music "$MUSIC" --out docs/media/install-guide-en.mp4
node docs/video-src/render.mjs --video reel  --lang vi --music "$MUSIC" --out docs/media/showreel-vi.mp4
node docs/video-src/render.mjs --video reel  --lang en --music "$MUSIC" --out docs/media/showreel-en.mp4

# preview a few frames without encoding
node docs/video-src/render.mjs --video guide --lang vi --stills 2.6,14.5,36
```

The music is not in this repository. Download "Music Promotion" by MiroMaxMusic from [Pixabay](https://pixabay.com/music/corporate-music-promotion-513944/) (Pixabay Content License) or pass any track you may use; the scene timing assumes 118 BPM.

Frames are extracted to `.cache/` on the first run (ignored by git). Rendering is deterministic: the same inputs give the same frames.

## Regenerating the real clips

```bash
cd skills/narrated-video-edit/scripts
node selftest.mjs                       # writes .selftest/run/out.mp4, plan-board, assets-sheet, out-sheet
node fx-apply.mjs apply --in clip.mp4 --effect crash-zoom --at 0.6 --dur 1.2 --out crash-zoom.mp4
```

Scale `out.mp4` to 540x960 for `assets/selftest-out.mp4`, and re-encode the effect clips the same way.
