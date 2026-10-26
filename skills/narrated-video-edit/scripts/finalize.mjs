// Khâu E: ghép lớp phủ lên lớp nền, trộn âm (giọng, SFX, nhạc nền hạ khi có giọng), chuẩn hóa -14 LUFS hai lượt, ghi SRT và credits.
// Chạy: node finalize.mjs --base work/base.mp4 --overlay work/overlay --mapped work/plan.mapped.json --out work/out.mp4 [--no-sfx] [--crf 20]
import fs from 'node:fs';
import path from 'node:path';
import { FPS, args, ffmpeg, probe, readJson, run, writeJson } from './common.mjs';
import { audioRecipe, loadLibrary, makeCtx } from './fx-lib.mjs';

const { flags } = args();
if (!flags.base || !flags.overlay || !flags.mapped || !flags.out) { console.error('Dùng: node finalize.mjs --base work/base.mp4 --overlay work/overlay --mapped work/plan.mapped.json --out work/out.mp4 [--no-sfx]'); process.exit(2); }
const base = path.resolve(String(flags.base));
const overlay = path.resolve(String(flags.overlay));
const mapped = readJson(path.resolve(String(flags.mapped)));
const out = path.resolve(String(flags.out));
const work = path.dirname(base);
const tmp = path.join(work, '.tmp');
fs.mkdirSync(tmp, { recursive: true });
const info = probe(base);
const num = (n) => Number(n).toFixed(3);
// Lớp phủ phải dựng XONG và đủ khung trước khi ghép: thiếu khung thì ffmpeg giữ khung cuối (chữ đứng, thẻ mất) mà không báo lỗi
const framesDir = path.join(overlay, 'frames');
const overlayFrames = fs.existsSync(framesDir) ? fs.readdirSync(framesDir).filter((n) => /^f_\d{5}\.png$/.test(n)).length : 0;
const expectedFrames = Math.round(info.duration * FPS);
if (Math.abs(overlayFrames - expectedFrames) > 1) throw new Error(`Lớp phủ có ${overlayFrames} khung, cần ${expectedFrames}: render-overlay chưa chạy xong hoặc dựng cho kế hoạch khác. Chờ render-overlay kết thúc (và nếu đã sửa kế hoạch thì chạy lại compose-base, render-overlay) rồi mới chạy finalize.`);
// TP -2: chừa chỗ cho phần vượt đỉnh khi mã hóa AAC (đo thực tế vượt tới 0,7 dB ở vlog nhiều tiếng động) để true peak thành phẩm vẫn dưới -1 dBTP
const TARGET = { I: -14, TP: -2, LRA: 11 };

// ---- SFX tổng hợp từ thư viện data/effects/audio.json (công thức ffmpeg lavfi, không dùng mẫu âm thanh ngoài); type là id hiệu ứng tiếng ----
const sfxLib = loadLibrary();
const sfxSpec = (type) => {
  const e = sfxLib.byId.get(type);
  if (!e || e.engine !== 'audio') throw new Error(`SFX "${type}" không có trong data/effects/audio.json (node fx-apply.mjs list --family audio)`);
  return e;
};
const sfxFile = (type) => {
  const f = path.join(tmp, `${type}.wav`);
  if (fs.existsSync(f)) return f;
  const r = audioRecipe(sfxSpec(type), { params: {}, ctx: makeCtx({ W: 1080, H: 1920 }) }, sfxLib.dsl);
  ffmpeg(['-f', 'lavfi', '-i', r.input, ...(r.post ? ['-af', r.post] : []), '-ar', '48000', '-ac', '2', '-t', String(r.dur), f], `tạo SFX ${type}`);
  return f;
};

// ---- Trộn âm ----
const overlaySfx = (() => { try { return JSON.parse(fs.readFileSync(path.join(path.resolve(String(flags.overlay)), 'overlay-summary.json'), 'utf8')).sfx ?? []; } catch { return []; } })();
const sfxItems = flags['no-sfx'] ? [] : [...mapped.sfx, ...overlaySfx].filter((s) => s.oT !== null && s.oT < info.duration - 0.1);
const music = mapped.music?.file ? path.resolve(path.dirname(String(flags.mapped)), mapped.music.file) : null;
const inputs = ['-i', base];
const g = [];
const labels = ['[voice]'];
g.push(music ? '[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=2[voice][side]' : '[0:a]aformat=sample_rates=48000:channel_layouts=stereo[voice]');
let idx = 1;
sfxItems.forEach((s, k) => {
  inputs.push('-i', sfxFile(s.type));
  const gain = sfxSpec(s.type).gainDb ?? -14;
  g.push(`[${idx}:a]adelay=${Math.round(s.oT * 1000)}|${Math.round(s.oT * 1000)},volume=${gain}dB[x${k}]`);
  labels.push(`[x${k}]`);
  idx++;
});
if (music) {
  inputs.push('-stream_loop', '-1', '-i', music);
  g.push(`[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${mapped.music.level ?? -22}dB[m]`);
  g.push('[m][side]sidechaincompress=threshold=0.04:ratio=8:attack=20:release=350[md]');
  labels.push('[md]');
}
g.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=first,atrim=0:${num(info.duration)}[mix]`);
const mixWav = path.join(tmp, 'mix.wav');
ffmpeg([...inputs, '-filter_complex', g.join(';'), '-map', '[mix]', '-ar', '48000', mixWav], 'trộn âm');

// Chuẩn hóa độ to hai lượt (đo rồi áp dụng) để đạt đúng -14 LUFS
const pass1 = run('ffmpeg', ['-hide_banner', '-i', mixWav, '-af', `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:print_format=json`, '-f', 'null', '-']);
const m = JSON.parse(pass1.stderr.match(/\{[\s\S]*?\}/g).pop());
const finalWav = path.join(tmp, 'final.wav');
ffmpeg(['-i', mixWav, '-af', `loudnorm=I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`, '-ar', '48000', finalWav], 'chuẩn hóa độ to');

// ---- Ghép hình ----
// CRF theo độ dài: video ngắn giữ chất lượng cao; video dài (vlog 13 phút ở CRF 17 nặng 927 MB so với bản gốc 178 MB) dùng CRF cao hơn. --crf ghi đè.
const crf = String(flags.crf ?? (info.duration > 240 ? 23 : info.duration > 90 ? 20 : 17));
fs.mkdirSync(path.dirname(out), { recursive: true });
// Chữ đặt SAU người nói (bigtext): lớp behind (PNG alpha) nằm dưới, người (base ghép mặt nạ) đè lên, rồi mới tới lớp phủ phía trước
const behindDir = path.join(overlay, 'behind');
const maskFile = path.join(overlay, 'mask.mkv');
const hasBehind = fs.existsSync(behindDir);
if (hasBehind && !fs.existsSync(maskFile)) throw new Error('Có thẻ đặt sau người nói (bigtext, orbit, wall; overlay/behind) nhưng chưa có mặt nạ người: chạy segment-person.mjs trước (cần node setup.mjs --with-segmentation)');
const maskInputs = hasBehind ? ['-framerate', String(FPS), '-i', path.join(behindDir, 'f_%05d.png'), '-i', maskFile] : [];
const filter = hasBehind
  ? '[0:v][2:v]overlay=0:0:format=auto[t];[0:v]format=yuva420p[bv];[3:v]format=gray[mk];[bv][mk]alphamerge[person];[t][person]overlay=0:0:format=auto[b];[b][1:v]overlay=0:0:format=auto,format=yuv420p[v]'
  : '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]';
ffmpeg(['-i', base, '-framerate', String(FPS), '-i', path.join(overlay, 'frames', 'f_%05d.png'), ...maskInputs, '-i', finalWav,
  '-filter_complex', filter,
  '-map', '[v]', '-map', `${hasBehind ? 4 : 2}:a`, '-c:v', 'libx264', '-crf', crf, '-preset', 'medium', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', num(info.duration), out], 'ghép lớp phủ');

// ---- SRT và credits ----
const data = JSON.parse(fs.readFileSync(path.join(overlay, 'overlay-data.js'), 'utf8').replace('window.OVERLAY = ', '').replace(/;\s*$/, ''));
const ts = (t) => { const ms = Math.round(t * 1000); const p = (n, w) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600000), 2)}:${p(Math.floor(ms / 60000) % 60, 2)}:${p(Math.floor(ms / 1000) % 60, 2)},${p(ms % 1000, 3)}`; };
fs.writeFileSync(out.replace(/\.mp4$/, '.srt'), data.chunks.map((c, n) => `${n + 1}\n${ts(c.s)} --> ${ts(c.e)}\n${c.words.map((w) => w.text).join(' ')}\n`).join('\n'));
const creditsTxt = path.join(work, 'assets', 'credits.txt');
// Chỉ ghi công những tài nguyên còn nằm trong kế hoạch (tệp đã tải rồi bị bỏ khỏi kế hoạch không được liệt kê)
if (fs.existsSync(creditsTxt)) {
  const used = new Set(mapped.cutaways.filter((c) => c.asset).map((c) => path.basename(c.asset)));
  const lines = fs.readFileSync(creditsTxt, 'utf8').split('\n').filter((l) => !l.trim() || used.has(l.split(':')[0]));
  fs.writeFileSync(out.replace(/\.mp4$/, '.credits.txt'), `${lines.join('\n').trim()}\n`);
}
// Decor tải về (emoji động Noto, icon CC BY): lớp phủ ghi dòng ghi công vào overlay-summary.json, gộp vào credits của video
const decorCredits = (() => { try { return JSON.parse(fs.readFileSync(path.join(path.resolve(String(flags.overlay)), 'overlay-summary.json'), 'utf8')).credits ?? []; } catch { return []; } })();
if (decorCredits.length) {
  const creditsFile = out.replace(/\.mp4$/, '.credits.txt');
  fs.appendFileSync(creditsFile, `${fs.existsSync(creditsFile) ? '\n' : ''}Decor:\n${decorCredits.map((c) => `- ${c}`).join('\n')}\n`);
}
const done = probe(out);
writeJson(out.replace(/\.mp4$/, '.mix.json'), { measuredInput: { I: Number(m.input_i), TP: Number(m.input_tp), LRA: Number(m.input_lra) }, target: TARGET, sfx: sfxItems.length, music: Boolean(music) });
console.log(`Đã ghi ${out}: ${done.width}x${done.height} ${done.duration.toFixed(2)}s; trộn ${sfxItems.length} SFX${music ? ' và nhạc nền (hạ khi có giọng)' : ''}; độ to đầu vào ${m.input_i} LUFS chuẩn hóa về ${TARGET.I}`);
if (!flags.keep) fs.rmSync(tmp, { recursive: true, force: true });
