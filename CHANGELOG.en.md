# Changelog

[Tiếng Việt](CHANGELOG.md) | [English](CHANGELOG.en.md)

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-10-27

Adds editing for tool-tutorial videos of the kind "speaker, then a screen recording", drawn from comparing the skill against a real Vietnamese reel (plan 51 in the Motion Atlas repository).

### Added

- **A glossary for proper names** (`data/glossary.json`, `work/glossary.json`, `glossary-apply.mjs`): corrects spelling AFTER transcription, because Whisper hears "Claude" as "Cloud" even with `--prompt`. Variants that are ordinary words are replaced only once the user has declared the term; `plan-board` asks at the first gate; the original is kept in `words.raw.json` and every replacement in `glossary-report.json`; `plan-lint` and `audit-edit` check independently of the recogniser.
- **Clips that really play inside cutaways** (`clipStart`, `clipSpeed`, `clipFit`) on the base layer and inside overlay cards; a user's clip plays once and then holds its last frame.
- **The `demo` presentation**: a self-drawn patterned background, a rounded frame with border and shadow, zoom into an area (`focus`), circle, arrow and underline marks in clip coordinates (`marks`) that follow the target while zooming, themes in `data/demo-themes.json` (`pastel`, `night`), and its own cap `demoMaxShare`.
- **New cards**: `chips`, `headline`, `textspam` (flag `coverFace`), and `title` gains `kicker`, `highlight`, `plate`. Their text must appear in the speech around the anchor.
- **The `creator` style**, `plan-skeleton --user-footage` (reads `footage.json`), a quality gate for stock-image queries (`abstractQuery`), and `plan-lint` now rejects two large objects sharing a window.

### Fixed

Bugs found while building 104 vertical videos (9 to 18 seconds each) from one 13-minute landscape vlog:

- `plan-skeleton --keep` crashed or produced a near-empty plan when the kept range sat inside one continuous beat: the `--keep` edges are now always beat boundaries.
- `plan-lint` wrongly blocked a single sticker in a short video (per-minute density cap): the cap is now counted in stickers, minimum 1.
- Vietnamese speech got almost no stickers because keywords needed 5 letters: the threshold now depends on the language (`keywordMinLength` in `data/decor-keywords.json`, 4 for Vietnamese).
- A wide showcase card could be pushed outside the frame when the first two slots were taken by the face.
- White captions on the pastel demo background were nearly unreadable: they now switch to dark text with a light halo.

### Verified

- `node selftest.mjs` passes 118 of 118 from the copy in this repository (Windows 11); `effects-selftest.mjs` passes 190 of 190.
- On the real transcript of the sample reel: 9 of 9 "Cloud" become "Claude" once the term is declared; 7 junk image queries are dropped; mark positions are within 1.2 px of a marker in the real frame.

### Known limits

- The demo frame has been tried on a real landscape vlog (104 vertical videos, all 104 pass the audit) but not on a real screen recording. In a vertical frame the 16:9 clip takes only about a third of the height. The two background themes are first suggestions.
- Scene boundaries from `--user-footage` follow beat boundaries (7 to 10 seconds): adjust `start` and `end` to the exact words.
- Tested on Windows 11 only.

## [1.0.0] - 2026-10-26

First public release, split out of the Motion Atlas repository so that the skill can be installed on its own.

### Added

- The `narrated-video-edit` agent skill: local word-by-word transcription (faster-whisper), face detection (YuNet), optional person segmentation (MediaPipe), per-word captions in six presets, B-roll from licensed sources (Wikimedia Commons, Openverse, NASA, Cleveland Museum of Art) shown as designed objects, stickers, animated emoji, number cards, lower thirds, 190 measured effects in 11 families, loudness normalisation to -14 LUFS, an independent audit, three mandatory user gates.
- `tools/validate-skill.mjs` (frontmatter, referenced files, JSON, syntax, secrets, license files) and `tools/build-release.mjs` (reproducible zip with the `narrated-video-edit/` folder at the top, as Claude requires).
- Bilingual documentation, Vietnamese by default: README, installation, customisation, credits.
- A showreel, a tutorial video on adding the skill to Claude, and an animated banner, in Vietnamese and English.
- Community files: contributing guide, security policy, code of conduct, issue and pull request templates. The repository deliberately has no CI; the manual release steps are in `CONTRIBUTING.md`.

### Verified

- `node selftest.mjs` passes 68 of 68 checks from a clean copy of `skills/narrated-video-edit` on Windows 11; `effects-selftest.mjs` passes 190 of 190.

### Known limits

- Tested on Windows 11 only. Vietnamese tried on a real 13-minute vlog, English on synthetic narration.
- The skill's instructions are written in Vietnamese; there is no English version yet.
- Whether the tools can run inside a plain claude.ai chat sandbox has not been tested.

[1.1.0]: https://github.com/Le-Ngoc-Tu/narrated-video-edit/releases/tag/v1.1.0
[1.0.0]: https://github.com/Le-Ngoc-Tu/narrated-video-edit/releases/tag/v1.0.0
