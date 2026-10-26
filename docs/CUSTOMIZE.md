# Customize the skill

[English](CUSTOMIZE.md) | [Tiếng Việt](CUSTOMIZE.vi.md)

The skill was shaped around one maintainer's footage, language and taste. Yours will differ, so expect to tune it. Almost everything you would want to change is **data**, not code, and the instructions are plain Markdown. This page is a map of the knobs, from the cheapest change to the deepest.

Golden rule: **change one thing, then run `node selftest.mjs`** (and `node effects-selftest.mjs` if you touched effects). If the self-test still ends with every line `ok`, the change is safe to keep.

Work on a copy. After you unzip the skill, either edit it in place and keep your own git history, or point the skill at your own files with environment variables (`NVE_STYLES`, `NVE_EFFECTS`) so that updating the skill never overwrites your edits.

## 1. Per video, no file edits at all

The plan file `work/edit-plan.json` overrides almost everything for a single video: the caption preset (`captions.preset`), size and vertical position (`sizeRatio`, `yRatio`), cutaway presentation and queries, stickers, cards, effects (`effects`, or `--look id,id` on `plan-skeleton`), lower thirds. Ask your assistant to change the plan, or open `node edit-plan-ui.mjs --work work`, a local page for editing captions, images, stickers and cards directly, with a preview frame.

## 2. Look and feel: `data/styles.json`

Three styles (`hype`, `explainer`, `documentary`). Each defines:

| Field | What it controls |
| --- | --- |
| `colors` (`ink`, `stroke`, `accent`, `accent2`, `panel`) | caption, sticker and card colors. Keep text-to-background contrast at 4.5:1 or better; the audit checks it |
| `fonts` | font stacks. Only fonts installed on the render machine or bundled in `templates/fonts` work |
| `captions` | preset (`bold`, `kinetic`, `pill`, `marker`, `minimal`, `editorial`), `maxWords` per line, `sizeRatio`, `uppercase`, `yRatio` |
| `minPauseToCut`, `maxPauseToCut`, `punch`, `brollMaxShare` | how aggressively pauses are trimmed, zoom on emphasis, how much of the video B-roll may cover |
| `cutaway`, `showcase.sequence`, `showcase.entrances` | B-roll length and the rotation of card, polaroid, pip, stack, sticker, peek |
| `decor`, `emoji`, `transitions`, `sfx` | density and allowed kinds of stickers and emoji, transitions, sound effects |
| `banned` | rules that `plan-lint` and `audit-edit` enforce. Add your own house rules here |

To add a style, copy one block, rename it, and use it with `plan-skeleton.mjs --style yourname`. To keep your edits outside the skill folder: copy `styles.json` somewhere and set `NVE_STYLES` to its path.

New caption look: presets live in `templates/overlay.js` (`PRESETS`). Add an entry, give it a font that is bundled, set the style's `captions.preset` to it, and view the result with `render-overlay.mjs --times 1,4`.

## 3. Brand colors and fonts

Edit `colors` and `fonts` in your style (section 2). To add a font, put the `.ttf` in `templates/fonts/` **together with its license text**, reference it from `templates/overlay.html` or `overlay.js`, and add a line to `CREDITS.md` if you redistribute. Prefer open-licensed fonts with the Vietnamese character set if you caption Vietnamese.

## 4. Effects: `data/effects/*.json`

190 effects in 11 families: `camera`, `transition`, `time`, `color`, `retro`, `glitch`, `text`, `graphic`, `layout`, `subject` and `audio` (17 sound effects). An effect is a JSON entry with an FFmpeg recipe that has named blanks; the small language is described in `data/effects/_dsl.json`. The effect budget per style (how many per minute, how many strong ones, minimum gap) is `data/effects-rules.json`.

To add one: write the entry, then run

```bash
node effects-selftest.mjs --id your-effect --sheet
```

It runs the effect for real and measures it (frames outside the window stay identical, frames inside change, no black corners, flicker under three per second) and builds a contact sheet. **Passing the measurement does not mean it looks good: always open the sheet and look.** Pitfalls collected the hard way are in `references/12-effects.md`. Set `NVE_EFFECTS` to use your own effects folder.

## 5. Decor and word triggers: `data/decor-keywords.json`

Maps spoken words to icons, sparkles, confetti and to the English scene concept used to search images. It is how the skill decides that someone saying "growth" gets an upward-arrow icon. **This table is the main thing to extend for another language**: add the words people say in your language under `concepts` (word to English scene description) and `icons`.

`data/emoji-map.json` maps words to the bundled emoji; `data/noto-lottie.json` maps those to animated Noto Emoji; `data/brands.json` lists the 26 brand logos shown when a brand is named (only when spoken).

## 6. Where images come from

- **Your own folder first:** `resolve-assets.mjs --user-assets <dir>`. Files named after a cutaway id (`c03.jpg`) or containing its words are used before any search.
- **Add a public source without code:** add a `jsonApi` entry to `data/asset-sources.json` (URL with `{query}`, a path to the result array, a field map, optional fixed license). Test with `--sources your-id --dry` and check `candidates.json`. Details: `references/04-assets-licenses.md`.
- **Licenses accepted:** CC0, public domain and CC BY. Do not widen this list unless you have read the terms; the skill refuses NC, ND, BY-SA and unknown licenses on purpose, because they can contaminate or forbid your video.

## 7. The instructions themselves

`SKILL.md` is the entry point the assistant reads; `references/*.md` are loaded when a step calls for them. They are written in **Vietnamese**. To change behavior (which questions are asked, which gates exist, how the report reads) edit these files. Keep `SKILL.md` under 500 lines and the front-matter `description` short and specific (under 400 characters keeps it visible to Antigravity CLI). If you translate them to English, please send a pull request.

The three user gates and the hard rules at the top of `SKILL.md` exist so the assistant cannot silently download unlicensed material or invent text. Loosen them only if you accept those risks.

## 8. Pipeline code

`scripts/*.mjs` and the Python helpers are ordinary, commented code. `common.mjs` holds shared helpers, `plan-lib.mjs` the plan schema and rules, `fx-lib.mjs` the effects interpreter, `compose-base.mjs` and `render-overlay.mjs` the two layers. When you change code, extend `selftest.mjs` with a check that fails before your change and passes after.

## Before you share your fork

Keep the license texts that sit next to bundled files, keep `CREDITS.md` and `NOTICE` accurate for anything you add, and remember that the skill's rules about image licenses are there to protect the people who use your videos.
