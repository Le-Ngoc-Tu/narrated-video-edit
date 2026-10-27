# Installation

[Tiếng Việt](INSTALL.md) | [English](INSTALL.en.md)

Two things have to happen, and they are independent:

1. **Give your assistant the skill** (the instructions). Section 2.
2. **Prepare the machine** that will do the work (FFmpeg, Chrome, Python, the models). Sections 1 and 3.

The skill is only the recipe. FFmpeg, Chrome and the speech model run on your computer; the skill cannot install them for you from inside a chat sandbox.

> Developed and tested on **Windows 11**. The scripts choose `Scripts/python.exe` or `bin/python` by platform, so macOS and Linux may work, but they have not been tried. Commands for them below are the usual ones, not verified here.

## 1. What your machine needs

| Tool | Version | Check | Install (typical) |
| --- | --- | --- | --- |
| Node.js | 20 or newer | `node -v` | [nodejs.org](https://nodejs.org) |
| FFmpeg and ffprobe | a recent full build | `ffmpeg -version` | Windows: `winget install Gyan.FFmpeg`. macOS: `brew install ffmpeg`. Linux: your package manager |
| Google Chrome | any current | opens normally | [google.com/chrome](https://www.google.com/chrome/). Or set `CHROME_PATH` to a Chromium executable |
| Python | 3.11 or newer, or `uv` | `python --version` | [python.org](https://www.python.org) or [uv](https://docs.astral.sh/uv/) |
| Disk | about 1 GB for the self-test, about 3 GB more for the `large-v3` model on the first real run | | |

`ffmpeg` and `ffprobe` must be on `PATH`. Open a **new** terminal after installing them.

## 2. Give your assistant the skill

Download **`narrated-video-edit-v1.1.0.zip`** from the [Releases page](../../../releases/latest). The zip contains one folder, `narrated-video-edit/`, with `SKILL.md` inside it. That layout is what Claude requires: a zip with `SKILL.md` loose at the top is not recognised.

### A. Claude on the web or in the desktop app

1. Click your account name or avatar (bottom left), then **Settings**. In some versions the same place is called **Customize**, then **Skills**.
2. Open **Skills**. Click **Add**, then **Upload skill**.
3. Drag the zip into the dashed box, or browse for it. A security scan runs on upload.
4. Click **Upload**, then turn the skill **on**.

Skills require code execution to be enabled in your account; see Anthropic's [help article](https://support.claude.com/en/articles/12512198). Watch the [45-second tutorial](media/install-guide-en.mp4) if you prefer to see it.

> Reminder: uploading makes the skill *known* to Claude. Whether its scripts can run depends on the environment. See "Where it can run" in the [README](../README.en.md#install).

### B. Claude Code

Personal install, available in every project:

```bash
# macOS, Linux
mkdir -p ~/.claude/skills
unzip narrated-video-edit-v1.1.0.zip -d ~/.claude/skills
```

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
Expand-Archive .\narrated-video-edit-v1.1.0.zip -DestinationPath "$HOME\.claude\skills"
```

Check that `~/.claude/skills/narrated-video-edit/SKILL.md` exists. For one project only, use `<project>/.claude/skills/` instead. Start `claude` and either describe the task or type `/narrated-video-edit`.

### C. Antigravity CLI

Copy the `narrated-video-edit` folder into `~/.gemini/antigravity-cli/skills/`. If you restrict skills with `include_only` in `~/.gemini/config/skills.json`, add `narrated-video-edit` there. Keep the skill `description` short (this one is 329 characters): Antigravity CLI skips skills with a long description.

### D. Any other Agent Skills client

The folder follows the open [Agent Skills specification](https://agentskills.io/specification). Put `narrated-video-edit/` where your client reads skills from.

### Or from a clone, without the zip

```bash
git clone https://github.com/Le-Ngoc-Tu/narrated-video-edit.git
cp -r narrated-video-edit/skills/narrated-video-edit ~/.claude/skills/
```

## 3. Prepare the tools (once)

Run this in the **installed skill folder**, for example `~/.claude/skills/narrated-video-edit`:

```bash
cd scripts
npm install
node setup.mjs
node selftest.mjs
```

- `node setup.mjs` checks Node, FFmpeg and Chrome and creates an isolated `.venv` with `faster-whisper` and `opencv-python-headless`. It never touches your system Python. Flags: `--skip-python` (you provide Python yourself, set `NVE_PYTHON` to its path), `--with-segmentation` (adds MediaPipe, about 300 MB, only needed for text placed behind the speaker).
- `node selftest.mjs` runs the whole pipeline on a bundled synthetic narration with the Whisper `small` model (downloaded on first use, roughly half a gigabyte). Add `--online` to include one real image search. A healthy run ends with every line `ok`. Please include the output when you open an issue.
- Real editing uses Whisper `large-v3` by default; it downloads once on the first real clip.

Environment variables you may want: `CHROME_PATH` (browser executable), `NVE_PYTHON` (Python with faster-whisper and OpenCV), `NVE_SEG_PYTHON`, `NVE_CACHE` (download cache), `NVE_STYLES` and `NVE_EFFECTS` (use your own copy of the style table or effects folder, see [CUSTOMIZE.en.md](CUSTOMIZE.en.md)). On Windows, set `PYTHONUTF8=1` if you run the Python helpers by hand.

## 4. First run

Tell the assistant where the skill is if it does not find it (for example, "the skill is in `~/.claude/skills/narrated-video-edit`"), then:

> Use narrated-video-edit on `~/Videos/talk.mp4`. English, vertical for Reels, explainer style.

What you should see, in order:

1. A short list of questions with defaults (video, language, platform, style).
2. A **storyboard image** with timestamps and a list of what will be added. The assistant stops. Reply to approve or change.
3. A **contact sheet of the chosen images**. The assistant stops again. Remove any that are wrong.
4. A built video, `out.mp4`, with `out.srt` and `out.credits.txt`, plus an audit report. Paste `out.credits.txt` into the video description.

Work files go to a `work/` folder outside the skill. Your original video is never modified.

## 5. Update and uninstall

- **Update:** download the new zip and replace the folder. Keep your `.venv` and `node_modules` if you want to skip reinstalling (they are not part of the zip). If you edited `data/`, merge your changes first.
- **Uninstall:** delete the `narrated-video-edit` folder. In Claude: *Skills*, open the skill, remove it.

## 6. Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Claude rejects the zip, or says there is no `SKILL.md` | The zip was made from the folder's contents instead of the folder. Use the release zip, or zip the `narrated-video-edit` folder itself so entries start with `narrated-video-edit/` |
| The skill does not trigger | Turn it on under Skills; or call it by name (`/narrated-video-edit` in Claude Code); or mention what you want in the words of its description (edit a talking video into a social video) |
| `setup.mjs`: ffmpeg or ffprobe not found | Install FFmpeg, open a new terminal, check `ffmpeg -version` |
| `setup.mjs`: no Chrome | Install Chrome or set `CHROME_PATH` to a Chromium or Edge executable |
| Python errors or `faster-whisper` missing | Run `node setup.mjs` again; or set `NVE_PYTHON` to a Python that has `faster-whisper` and `opencv-python-headless<5` |
| Garbled text or `UnicodeEncodeError` on Windows | Set `PYTHONUTF8=1` |
| The first transcription seems stuck | The model is downloading (`small` is roughly 0.5 GB, `large-v3` roughly 3 GB). Check your network and disk space |
| `NODE_TLS_REJECT_UNAUTHORIZED` warning on every Node run | An environment variable on your machine turns off certificate checking for every Node program. Remove it from your environment |
| The audit fails | Read `references/06-audit.md`, which lists each check and its fix. Up to three repair rounds are expected |
| Few or poor B-roll results | Public image sources are limited; the skill drops slots it cannot fill. You can pass your own folder with `--user-assets` |
| Works in Claude Code but not in claude.ai chat | See "Where it can run" in the README: the chat sandbox may lack Chrome, FFmpeg or network access |

Still stuck? [Open an issue](../../../issues/new/choose) with your OS, Node version, the failing command and its output.
