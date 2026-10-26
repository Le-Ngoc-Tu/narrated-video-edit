// Dựng video từ trang index.html: tua timeline GSAP từng khung, chụp bằng Chrome, ghép nhạc bằng ffmpeg.
// Chạy từ gốc kho:
//   node docs/video-src/render.mjs --video guide --lang en --out docs/media/install-guide-en.mp4 --music <nhạc.mp3>
//   node docs/video-src/render.mjs --video reel   --lang vi --out docs/media/showreel-vi.mp4 --music <nhạc.mp3>
//   node docs/video-src/render.mjs --video banner --out docs/media/banner.gif
//   thêm --stills 2,6,12 --outdir <thư mục> để chỉ chụp vài khung xem thử (không dựng video)
// Cần: Chrome (hoặc CHROME_PATH), ffmpeg, và `npm install` trong skills/narrated-video-edit/scripts (lấy playwright-core).
// Khung của skill (selftest-out.mp4, fx/*.mp4) được tách thành ảnh vào docs/video-src/.cache khi chạy lần đầu.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const video = opt('--video', 'guide');
const lang = opt('--lang', 'en');
const out = path.resolve(root, opt('--out', `docs/media/${video}-${lang}.mp4`));
const music = opt('--music', '');
const stills = opt('--stills', '');
const outdir = path.resolve(root, opt('--outdir', 'docs/video-src/.cache/stills'));
const fps = Number(opt('--fps', video === 'banner' ? 12 : 30));
const SIZES = { guide: [1920, 1080], reel: [1920, 1080], banner: [1200, 400] };
const [W, H] = SIZES[video];

const { chromium } = createRequire(path.join(root, 'skills/narrated-video-edit/scripts/package.json'))('playwright-core');

// 1. tách khung các clip thật của skill
const cache = path.join(here, '.cache');
const sources = { selftest: 'assets/selftest-out.mp4' };
for (const f of fs.readdirSync(path.join(here, 'assets/fx'))) sources[`fx-${f.replace('.mp4', '')}`] = `assets/fx/${f}`;
const counts = {};
for (const [name, rel] of Object.entries(sources)) {
  const dir = path.join(cache, name);
  if (!fs.existsSync(path.join(dir, 'f0001.jpg'))) {
    fs.mkdirSync(dir, { recursive: true });
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(here, rel), '-vf', 'fps=30', '-q:v', '3', path.join(dir, 'f%04d.jpg')], { encoding: 'utf8' });
    if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
  }
  counts[name] = fs.readdirSync(dir).filter((x) => x.endsWith('.jpg')).length;
}
fs.writeFileSync(path.join(cache, 'clips.json'), JSON.stringify(counts));

// 2. máy chủ tĩnh gốc kho (phông, GSAP, khung ảnh)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.ttf': 'font/ttf', '.mp4': 'video/mp4' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// 3. trình duyệt
const launch = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' };
const browser = await chromium.launch({ ...launch, args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`${base}/docs/video-src/index.html?video=${video}&lang=${lang}`);
const duration = await page.evaluate(() => window.ready);
console.log(`${video}/${lang}: ${duration.toFixed(2)} s, ${W}x${H}, ${fps} fps`);

if (stills) {
  fs.mkdirSync(outdir, { recursive: true });
  for (const t of stills.split(',').map(Number)) {
    await page.evaluate((x) => window.seek(x), t);
    const file = path.join(outdir, `${video}-${lang}-${String(t).replace('.', '_')}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
    console.log(file);
  }
  await browser.close(); server.close();
  process.exit(0);
}

// 4. ffmpeg nhận ảnh qua ống
fs.mkdirSync(path.dirname(out), { recursive: true });
const frames = Math.round(duration * fps);
const inArgs = ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];
let outArgs;
if (out.endsWith('.gif')) {
  outArgs = ['-vf', `fps=${fps},scale=1000:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=112:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5`, '-loop', '0', out];
} else {
  const d = (frames / fps).toFixed(3);
  const f = `[1:a]atrim=0:${d},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.4,afade=t=out:st=${(frames / fps - 2.4).toFixed(2)}:d=2.4,loudnorm=I=-16:TP=-1.5:LRA=7[a]`;
  outArgs = music
    ? ['-i', music, '-filter_complex', f, '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps), '-c:a', 'aac', '-b:a', '192k', '-t', d, '-movflags', '+faststart', out]
    : ['-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', out];
}
const ff = spawn('ffmpeg', [...inArgs, ...outArgs], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((r) => ff.on('close', r));
const started = Date.now();
for (let i = 0; i < frames; i += 1) {
  await page.evaluate((x) => window.seek(x), i / fps);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 60 === 0) console.log(`  ${i}/${frames} (${Math.round((Date.now() - started) / 1000)} s)`);
}
ff.stdin.end();
const code = await done;
await browser.close(); server.close();
if (code !== 0) { console.error('ffmpeg lỗi'); process.exit(1); }
console.log(`Đã ghi ${out} (${(fs.statSync(out).size / 1048576).toFixed(2)} MB)`);
