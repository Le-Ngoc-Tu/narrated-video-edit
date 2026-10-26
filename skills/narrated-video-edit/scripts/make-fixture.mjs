// Tạo video mẫu tổng hợp cho selftest: giọng đọc tiếng Anh (eSpeak NG) có khoảng ngắt, nền dọc 1080x1920 có một "người nói" vẽ bằng hình.
// Chạy: node make-fixture.mjs --out dir
// Có sẵn fixtures/narration-en.wav để máy không cài eSpeak vẫn chạy được selftest.
import fs from 'node:fs';
import path from 'node:path';
import { args, ffmpeg, run, skillRoot } from './common.mjs';

const { flags } = args();
const out = path.resolve(String(flags.out ?? path.join(skillRoot, '.selftest', 'fixture')));
fs.mkdirSync(out, { recursive: true });

export const SENTENCES = [
  ['Hello everyone. Today I want to talk about coffee.', 0.9],
  ['Roasting turns green seeds into brown beans.', 0.4],
  ['A good roast takes about twelve minutes.', 0.9],
  ['Then the beans rest, and the flavor opens up.', 0.4],
  ['Pour the water slowly, and enjoy the first cup.', 0.2]
];

const bundled = path.join(skillRoot, 'fixtures', 'narration-en.wav');
const wav = path.join(out, 'narration.wav');
const espeak = [process.env.ESPEAK, 'C:\\Program Files\\eSpeak NG\\espeak-ng.exe', 'espeak-ng', 'espeak'].filter(Boolean).find((c) => run(c, ['--version']).status === 0);
if (espeak && !flags['use-bundled']) {
  const parts = [];
  SENTENCES.forEach(([text, gap], i) => {
    const part = path.join(out, `s${i}.wav`);
    const r = run(espeak, ['-v', 'en-us', '-s', '150', '-w', part, text]);
    if (r.status !== 0) throw new Error(`eSpeak lỗi: ${r.stderr}`);
    const padded = path.join(out, `p${i}.wav`);
    ffmpeg(['-i', part, '-af', `apad=pad_dur=${gap}`, '-ar', '16000', '-ac', '1', padded], 'đệm khoảng lặng');
    parts.push(padded);
  });
  const list = path.join(out, 'list.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-ar', '16000', '-ac', '1', wav], 'nối giọng');
  if (flags['save-bundled']) fs.copyFileSync(wav, bundled);
} else fs.copyFileSync(bundled, wav);

const dur = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav]).stdout.trim());
const video = path.join(out, 'talk.mp4');
// Nền tối chuyển màu, "người nói" là hình tròn đầu và thân; vùng đầu ở khoảng 30 đến 40 phần trăm chiều cao
ffmpeg([
  '-f', 'lavfi', '-i', `color=c=0x1d2433:s=1080x1920:r=30:d=${dur.toFixed(2)}`,
  '-i', wav,
  '-vf', "drawbox=x=300:y=900:w=480:h=900:color=0x3b4a6b@1:t=fill,drawbox=x=380:y=520:w=320:h=380:color=0xd9a77a@1:t=fill,drawbox=x=0:y=0:w=1080:h=120:color=0x000000@0.2:t=fill",
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', video
], 'dựng video mẫu');
console.log(`Đã tạo ${video} (${dur.toFixed(1)}s)`);
