# Changelog

All notable changes are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-26

First public release, split out of the Motion Atlas repository so that the skill can be installed on its own.

### Added

- The `narrated-video-edit` agent skill: local word-by-word transcription (faster-whisper), face detection (YuNet), optional person segmentation (MediaPipe), per-word captions in six presets, B-roll from licensed sources (Wikimedia Commons, Openverse, NASA, Cleveland Museum of Art) shown as designed objects, stickers, animated emoji, number cards, lower thirds, 190 measured effects in 11 families, loudness normalisation to -14 LUFS, an independent audit, three mandatory user gates.
- `tools/validate-skill.mjs` (frontmatter, references, JSON, syntax, secrets, license files) and `tools/build-release.mjs` (reproducible zip with the `narrated-video-edit/` folder at the top, as Claude requires).
- English and Vietnamese documentation: README, installation, customisation, credits.
- A showreel and a three-step tutorial video in English and Vietnamese, and an animated banner.
- Community files: contributing guide, security policy, code of conduct, issue and pull request templates, CI.

### Verified

- `node selftest.mjs` passes 68 of 68 checks from a clean copy of `skills/narrated-video-edit` on Windows 11.

### Known limits

- Tested on Windows 11 only. Vietnamese tried on a real 13-minute vlog, English on synthetic narration.
- Skill instructions are written in Vietnamese. An English translation is welcome.
- Whether the tools can run inside a plain claude.ai chat sandbox has not been tested.

[1.0.0]: https://github.com/Le-Ngoc-Tu/narrated-video-edit/releases/tag/v1.0.0
