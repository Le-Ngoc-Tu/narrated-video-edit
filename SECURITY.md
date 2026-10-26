# Security policy

## What to report

This skill runs commands on your machine: it launches FFmpeg and Chrome, runs Python and Node scripts, and downloads images and a speech model. Please report anything that could let a malicious input (a crafted video, subtitle text, an image-source response, a plan file) run unintended commands, read or write files outside the working folder, leak your video or audio, or bypass the license allow-list so that restricted material is accepted.

Not security issues: a bad caption, a poor image match, an effect that looks ugly. Use a normal issue for those.

## How to report

Use GitHub's **private vulnerability reporting**: open the repository's *Security* tab, then *Report a vulnerability*. Please do not post exploit details in a public issue. Include the version (release tag or commit), your OS, and the smallest steps that reproduce the problem.

You can expect an acknowledgement within about a week. This is a volunteer project, so fixes follow on a best-effort basis; critical problems come first. Reporters who want credit are named in the release notes.

## Supported versions

Only the latest release receives fixes.

## Things the skill does on purpose

- Transcription runs locally. Your video and audio are not uploaded.
- Image search sends short English keywords drawn from your speech to public APIs listed in `data/asset-sources.json` and `data/decor-sources.json`. The skill tells the user before doing it.
- No API key is read, printed or stored by the skill.
- Downloads are limited to the accepted licenses and each one is recorded in `credits.json`.

If you change these properties in a fork, say so clearly in your own documentation.
