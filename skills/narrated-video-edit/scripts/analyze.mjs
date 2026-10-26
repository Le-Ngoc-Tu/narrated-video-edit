// Khâu A: phân tích video có giọng nói. Ghi vào thư mục --out: meta.json, audio.wav, words.json, pauses.json, faces.json, shots.json, loudness.json.
// Chạy: node analyze.mjs <video> --out work/analysis [--lang vi] [--model large-v3] [--prompt "tên riêng"] [--words words.json] [--no-faces]
// Phiên âm chạy cục bộ (faster-whisper), không gửi video hay âm thanh đi đâu. --words dùng lại một words.json có sẵn thay cho phiên âm.
import fs from 'node:fs';
import path from 'node:path';
import { args, ffmpeg, here, probe, pythonPath, readJson, run, writeJson } from './common.mjs';

const { flags, positional } = args();
if (!positional[0] || !flags.out) { console.error('Dùng: node analyze.mjs <video> --out work/analysis [--lang vi] [--model large-v3] [--words words.json] [--no-faces]'); process.exit(2); }
const video = path.resolve(positional[0]);
const out = path.resolve(String(flags.out));
fs.mkdirSync(out, { recursive: true });
const env = { ...process.env, PYTHONUTF8: '1' };

const meta = probe(video);
if (!meta.hasAudio) throw new Error('Video không có luồng âm thanh: không có giọng nói để phiên âm.');
const turned = Math.abs(meta.rotation) === 90 || Math.abs(meta.rotation) === 270;
const width = turned ? meta.height : meta.width;
const height = turned ? meta.width : meta.height;
writeJson(path.join(out, 'meta.json'), { source: video, duration: meta.duration, width, height, fps: meta.fps, orientation: height > width ? '9x16' : '16x9' });
console.log(`video ${width}x${height} ${meta.fps.toFixed(2)}fps ${meta.duration.toFixed(1)}s`);

const wav = path.join(out, 'audio.wav');
ffmpeg(['-i', video, '-vn', '-ac', '1', '-ar', '16000', wav], 'trích âm thanh');

// Độ to của giọng gốc (để chuẩn hóa và so sánh sau này); đo trên âm thanh gốc, không đo trên bản mono 16 kHz vì BS.1770 đo bản mono thấp hơn nguồn stereo khoảng 3 LU
const loud = run('ffmpeg', ['-hide_banner', '-i', video, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
const loudJson = loud.stderr.match(/\{[\s\S]*?\}/g)?.pop();
if (loudJson) writeJson(path.join(out, 'loudness.json'), JSON.parse(loudJson));

const wordsFile = path.join(out, 'words.json');
if (flags.words) fs.copyFileSync(path.resolve(String(flags.words)), wordsFile);
else {
  const cmd = [path.join(here, 'transcribe.py'), wav, '--out', wordsFile, '--model', String(flags.model ?? 'large-v3')];
  if (flags.lang) cmd.push('--lang', String(flags.lang));
  if (flags.prompt) cmd.push('--prompt', String(flags.prompt));
  const r = run(pythonPath(), cmd, { env });
  if (r.status !== 0) throw new Error(`Phiên âm lỗi: ${(r.stderr || r.stdout).trim().split('\n').slice(-5).join('\n')}\nChạy "node setup.mjs" để chuẩn bị môi trường Python.`);
  console.log(r.stdout.trim());
}
const words = readJson(wordsFile);

// Khoảng ngắt giữa các từ: ứng viên để cắt (chỉ đề xuất; kế hoạch quyết định)
const MIN_GAP = 0.5;
const KEEP = 0.18;
const pauses = [];
const list = words.words;
if (list.length && list[0].start > MIN_GAP) pauses.push({ start: 0, end: Number((list[0].start - KEEP).toFixed(3)), kind: 'head' });
for (let i = 0; i + 1 < list.length; i++) {
  const gap = list[i + 1].start - list[i].end;
  if (gap >= MIN_GAP) pauses.push({ start: Number((list[i].end + KEEP).toFixed(3)), end: Number((list[i + 1].start - KEEP).toFixed(3)), kind: 'gap', afterWord: i });
}
const last = list.at(-1);
if (last && meta.duration - last.end > MIN_GAP) pauses.push({ start: Number((last.end + KEEP).toFixed(3)), end: Number(meta.duration.toFixed(3)), kind: 'tail' });
const spoken = list.length ? list.at(-1).end - list[0].start : 0;
writeJson(path.join(out, 'pauses.json'), { minGap: MIN_GAP, keep: KEEP, wordsPerSecond: spoken ? Number((list.length / spoken).toFixed(2)) : 0, pauses });
console.log(`${list.length} từ, ${pauses.length} khoảng ngắt đủ dài để cắt, ${spoken ? (list.length / spoken).toFixed(1) : 0} từ/giây`);

// Ranh giới cảnh quay có sẵn trong video gốc
const scene = run('ffmpeg', ['-hide_banner', '-i', video, '-vf', "select='gt(scene,0.35)',showinfo", '-an', '-f', 'null', '-']);
const cuts = [...scene.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
writeJson(path.join(out, 'shots.json'), { cuts });

if (flags['no-faces']) writeJson(path.join(out, 'faces.json'), { width, height, samples: [], coverage: 0, skipped: true });
else {
  const r = run(pythonPath(), [path.join(here, 'faces.py'), video, '--out', path.join(out, 'faces.json')], { env });
  if (r.status !== 0) { console.log(`cảnh báo: dò mặt lỗi (${r.stderr.trim().split('\n').pop()}), dùng vùng an toàn mặc định`); writeJson(path.join(out, 'faces.json'), { width, height, samples: [], coverage: 0, failed: true }); } else console.log(r.stdout.trim());
}
console.log(`Đã ghi ${out}`);
