// Tự kiểm thư viện hiệu ứng: chạy TỪNG hiệu ứng thật bằng ffmpeg trên video mẫu tổng hợp rồi đo, không tin mắt.
// Chạy: node effects-selftest.mjs [--family camera] [--id crash-zoom] [--sheet] [--keep] [--out dir]
// Kiểm cho hiệu ứng hình (video, mask): ffmpeg thoát 0; số khung và kích thước giữ nguyên; khung NGOÀI cửa sổ giống hệt bản gốc (PSNR vô hạn);
// ít nhất một khung TRONG cửa sổ khác bản gốc rõ rệt (PSNR < 40 dB: thông số mặc định phải nhìn thấy được); không đen suốt cửa sổ; số lần chớp sáng mỗi giây không vượt 3 (hoặc hiệu ứng khai báo photosensitive).
// Hiệu ứng tiếng: có tiếng, không im lặng, không vỡ đỉnh. xfade: độ dài đúng, khung giữa khác cả hai cảnh. retime: độ dài đúng công thức. overlay: kiểu được trỏ tới có trong mã lớp phủ.
// --sheet ghi bảng ảnh duyệt mỗi họ (khung trước, trong và sau cửa sổ) vào <out>/sheets để người xem bằng mắt.
import fs from 'node:fs';
import path from 'node:path';
import { args, ffmpeg, here, probe, run, skillRoot } from './common.mjs';
import { audioRecipe, flashesPerSecond, loadLibrary, makeCtx, retimeRecipe, validateEffect } from './fx-lib.mjs';

const { flags } = args();
const lib = loadLibrary();
const out = path.resolve(String(flags.out ?? path.join(skillRoot, '.selftest', 'effects')));
fs.mkdirSync(out, { recursive: true });
const FPS = 30;
const SECONDS = 4;
// --source clip.mp4 [--ss 60]: dùng 4 giây của video thật (một cỡ 960x540) thay cho nguồn tổng hợp, để bảng ảnh duyệt có mặt người thật
const sizes = flags.source ? { custom: flags.portrait ? [540, 960] : [960, 540] } : { portrait: [540, 960], landscape: [960, 540] };
const results = [];
const note = (id, level, msg) => results.push({ id, level, msg });

// ---- Nguồn mẫu: testsrc2 (có chuyển động và chi tiết) và mặt nạ người giả (hình elip) ----
const src = {};
for (const [name, [W, H]] of Object.entries(sizes)) {
  const file = path.join(out, `src-${name}.mp4`);
  if (flags.source) ffmpeg(['-ss', String(flags.ss ?? 0), '-i', path.resolve(String(flags.source)), '-t', String(SECONDS), '-vf', `fps=${FPS},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`, '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'yuv420p', '-c:a', 'aac', file], 'nguồn thật');
  else if (!fs.existsSync(file)) ffmpeg(['-f', 'lavfi', '-i', `testsrc2=s=${W}x${H}:r=${FPS}:d=${SECONDS}`, '-f', 'lavfi', '-i', `sine=f=300:d=${SECONDS}`, '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file], `nguồn ${name}`);
  const maskPng = path.join(out, `mask-${name}.png`);
  if (!fs.existsSync(maskPng)) ffmpeg(['-f', 'lavfi', '-i', `color=black:s=${W}x${H},format=gray,geq=lum='if(lt(hypot((X-W*0.5)/(W*0.22),(Y-H*0.5)/(H*0.3)),1),255,0)'`, '-frames:v', '1', maskPng], `mặt nạ ${name}`);
  const maskVid = path.join(out, `mask-${name}.mkv`);
  if (!fs.existsSync(maskVid)) ffmpeg(['-loop', '1', '-framerate', String(FPS), '-i', maskPng, '-t', String(SECONDS), '-c:v', 'ffv1', '-pix_fmt', 'gray', maskVid], `video mặt nạ ${name}`);
  src[name] = { file, W, H, mask: flags.mask ? path.resolve(String(flags.mask)) : maskVid };
}

const frames = (file) => Number(run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', file]).stdout.trim());
function psnrPerFrame(a, b) {
  const dir = path.dirname(a);
  const stats = '.psnr.txt';
  const r = run('ffmpeg', ['-v', 'error', '-i', a, '-i', b, '-lavfi', `[0:v]settb=1/${FPS},setpts=N,format=yuv420p[a];[1:v]settb=1/${FPS},setpts=N,format=yuv420p[b];[a][b]psnr=stats_file=${stats}`, '-f', 'null', '-'], { cwd: dir });
  if (r.status !== 0) throw new Error(`psnr lỗi: ${r.stderr.slice(-300)}`);
  return fs.readFileSync(path.join(dir, stats), 'utf8').trim().split('\n').map((l) => { const v = l.match(/psnr_avg:(\S+)/)[1]; return v === 'inf' ? 999 : Number(v); });
}
function lumaPerFrame(file) {
  const dir = path.dirname(file);
  run('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=.yavg.txt', '-f', 'null', '-'], { cwd: dir });
  return [...fs.readFileSync(path.join(dir, '.yavg.txt'), 'utf8').matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
}
/** Độ sáng trung bình của ô góc 8x8 theo khung: phát hiện góc đen lộ ra do phóng thiếu khi xoay hoặc lia. */
function cornerLuma(file, x, y) {
  const dir = path.dirname(file);
  run('ffmpeg', ['-v', 'error', '-i', file, '-vf', `crop=8:8:${x}:${y},signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=.corner.txt`, '-f', 'null', '-'], { cwd: dir });
  return [...fs.readFileSync(path.join(dir, '.corner.txt'), 'utf8').matchAll(/YAVG=([d.]+)/g)].map((m) => Number(m[1]));
}

function testVideo(e, orient) {
  const s = src[orient];
  const dur = Math.min(e.dur.default, 2.4);
  const at = 1;
  const dir = path.join(out, 'run');
  fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, `${e.id}-${orient}.mkv`);
  const cli = ['fx-apply.mjs', 'apply', '--in', s.file, '--effect', e.id, '--at', String(at), '--dur', String(dur), '--out', outFile, '--lossless', ...(e.engine === 'mask' ? ['--mask', s.mask] : [])];
  const r = run(process.execPath, cli, { cwd: here });
  if (r.status !== 0) return `ffmpeg lỗi: ${(r.stderr || r.stdout).split('\n').filter(Boolean).slice(-3).join(' | ')}`;
  const n0 = at * FPS;
  const n1 = Math.round((at + dur) * FPS);
  const info = probe(outFile);
  if (info.width !== s.W || info.height !== s.H) return `kích thước ${info.width}x${info.height} khác ${s.W}x${s.H}`;
  const total = SECONDS * FPS;
  const got = frames(outFile);
  if (got !== total) return `số khung ${got} khác ${total}`;
  const ps = psnrPerFrame(outFile, s.file);
  const outside = ps.filter((_, i) => i < n0 || i >= n1);
  const worstOutside = Math.min(...outside);
  if (worstOutside < 90) return `khung ngoài cửa sổ bị đổi (PSNR thấp nhất ${worstOutside.toFixed(1)} dB)`;
  const minIn = Math.min(...ps.slice(n0, n1));
  if (minIn >= 40) return `không thấy thay đổi trong cửa sổ (PSNR thấp nhất ${minIn.toFixed(1)} dB, cần dưới 40)`;
  if (!e.blackEdges) {
    const corners = [[0, 0], [s.W - 8, 0], [0, s.H - 8], [s.W - 8, s.H - 8]];
    for (const [cx, cy] of corners) {
      const o = cornerLuma(outFile, cx, cy);
      const r = cornerLuma(s.file, cx, cy);
      const lost = o.findIndex((v, i) => i >= n0 && i < n1 && v < 8 && r[i] > 40);
      if (lost >= 0) return `góc đen lộ ra ở khung ${lost} (tăng phóng dự phòng hoặc khai blackEdges nếu cố ý)`;
    }
  }
  const luma = lumaPerFrame(outFile);
  const dark = luma.slice(n0, n1).filter((v) => v < 3).length / (n1 - n0);
  if (dark > 0.7) return `${(dark * 100).toFixed(0)}% khung trong cửa sổ đen`;
  const fl = flashesPerSecond(luma.slice(Math.max(0, n0 - 1), n1 + 1), FPS);
  if (fl > 3 && !e.photosensitive) return `chớp ${fl.toFixed(1)} lần mỗi giây vượt 3 mà chưa khai photosensitive`;
  return { minIn, fl, n0, n1, outFile };
}

function testAudio(e) {
  const r = audioRecipe(e, { params: {}, ctx: makeCtx({ W: 1080, H: 1920 }) }, lib.dsl);
  const file = path.join(out, 'run', `${e.id}.wav`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  ffmpeg(['-f', 'lavfi', '-i', r.input, ...(r.post ? ['-af', r.post] : []), '-ar', '48000', '-ac', '2', '-t', String(r.dur), file], `tiếng ${e.id}`);
  const d = probe(file).duration;
  if (Math.abs(d - r.dur) > 0.06) return `độ dài ${d.toFixed(2)}s khác ${r.dur}s`;
  const v = run('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']).stderr;
  const max = Number(v.match(/max_volume: (-?[\d.]+) dB/)?.[1]);
  const mean = Number(v.match(/mean_volume: (-?[\d.]+) dB/)?.[1]);
  if (!(mean > -60)) return `gần như im lặng (trung bình ${mean} dB)`;
  if (max > -0.3) return `vỡ đỉnh (${max} dB)`;
  return { max, mean };
}

function testXfade(e) {
  const dir = path.join(out, 'run');
  fs.mkdirSync(dir, { recursive: true });
  const [W, H] = sizes.portrait;
  const D = e.dur.default;
  const clip = (name, source) => { const f = path.join(dir, `${name}.mkv`); if (!fs.existsSync(f)) ffmpeg(['-f', 'lavfi', '-i', `${source}=s=${W}x${H}:r=${FPS}:d=2`, '-c:v', 'ffv1', '-pix_fmt', 'yuv420p', f], name); return f; };
  const a = clip('xa', 'testsrc2');
  const b = clip('xb', 'rgbtestsrc');
  const ctx = makeCtx({ W, H });
  const vars = { ...ctx, dur: D, offset: 2 - D };
  const filter = `[0:v][1:v]${e.xfade.replace(/\{dur\}/g, String(D)).replace(/\{offset\}/g, String(2 - D))}[v]`;
  void vars;
  const outFile = path.join(dir, `${e.id}.mkv`);
  ffmpeg(['-i', a, '-i', b, '-filter_complex', filter, '-map', '[v]', '-c:v', 'ffv1', '-pix_fmt', 'yuv420p', outFile], `xfade ${e.id}`);
  const info = probe(outFile);
  const expect = 4 - D;
  if (Math.abs(info.duration - expect) > 0.1) return `độ dài ${info.duration.toFixed(2)}s khác ${expect.toFixed(2)}s`;
  return { outFile };
}

function testRetime(e) {
  const dir = path.join(out, 'run');
  const s = src.portrait;
  const r = retimeRecipe(e, { params: {}, ctx: makeCtx({ W: s.W, H: s.H }), dur: SECONDS }, lib.dsl);
  const outFile = path.join(dir, `${e.id}.mp4`);
  fs.mkdirSync(dir, { recursive: true });
  ffmpeg(['-i', s.file, '-filter_complex', `[0:v]${r.video}[v]${r.audio ? `;[0:a]${r.audio}[a]` : ''}`, '-map', '[v]', ...(r.audio ? ['-map', '[a]', '-c:a', 'aac'] : []), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', outFile], `retime ${e.id}`);
  const info = probe(outFile);
  if (Math.abs(info.duration - r.outDur) > 0.2) return `độ dài ${info.duration.toFixed(2)}s khác dự kiến ${r.outDur.toFixed(2)}s`;
  return { outFile };
}

const overlaySources = ['render-overlay.mjs', path.join('..', 'templates', 'overlay.js'), path.join('..', 'data', 'styles.json'), 'plan-lint.mjs', 'plan-skeleton.mjs', 'plan-lib.mjs'].map((f) => fs.readFileSync(path.join(here, f), 'utf8')).join('\n');
function testOverlay(e) {
  const types = [e.ref.type, ...(e.ref.alsoTypes ?? [])].filter(Boolean);
  const missing = types.filter((t) => !new RegExp(`['"\`]${t}['"\`]|\\b${t}\\s*:`).test(overlaySources));
  return missing.length ? `kiểu ${missing.join(', ')} không có trong mã lớp phủ` : {};
}

// ---- Chạy ----
const wanted = lib.effects.filter((e) => (!flags.family || e.family === flags.family) && (!flags.id || e.id === flags.id));
if (!wanted.length) { console.error('Không có hiệu ứng khớp bộ lọc.'); process.exit(2); }
const sheetFrames = {};
for (const e of wanted) {
  const schema = validateEffect(e, lib);
  if (schema.length) { note(e.id, 'FAIL', `lược đồ: ${schema.join('; ')}`); continue; }
  try {
    let r;
    if (e.engine === 'video' || e.engine === 'mask') {
      for (const orient of Object.keys(sizes)) {
        r = testVideo(e, orient);
        if (typeof r === 'string') { r = `${orient}: ${r}`; break; }
        if (orient === 'portrait' || flags.source) sheetFrames[e.id] = r;
        if (r.fl > 3) note(e.id, 'WARN', `chớp ${r.fl.toFixed(1)}/s (đã khai photosensitive)`);
      }
    } else if (e.engine === 'audio') r = testAudio(e);
    else if (e.engine === 'xfade') r = testXfade(e);
    else if (e.engine === 'retime') r = testRetime(e);
    else r = testOverlay(e);
    typeof r === 'string' ? note(e.id, 'FAIL', r) : note(e.id, 'PASS', '');
  } catch (err) { note(e.id, 'FAIL', String(err.message).split('\n').slice(0, 3).join(' | ')); }
}

// ---- Bảng ảnh duyệt ----
if (flags.sheet) {
  const sheetDir = path.join(out, 'sheets');
  fs.mkdirSync(sheetDir, { recursive: true });
  const families = [...new Set(wanted.map((e) => e.family))];
  for (const fam of families) {
    const strips = [];
    for (const e of wanted.filter((x) => x.family === fam && sheetFrames[x.id])) {
      const { outFile, n0, n1 } = sheetFrames[e.id];
      const pick = [n0 - 2, n0 + Math.round((n1 - n0) * 0.25), n0 + Math.round((n1 - n0) * 0.5), n0 + Math.round((n1 - n0) * 0.75), n1 + 1];
      const png = path.join(sheetDir, `.strip-${e.id}.png`);
      const sel = pick.map((n) => `eq(n\\,${n})`).join('+');
      run('ffmpeg', ['-v', 'error', '-y', '-i', outFile, '-vf', `select='${sel}',scale=-2:300,tile=5x1:padding=4:color=black,drawtext=fontfile='${makeCtx({ W: 1, H: 1 }).fontBold}':text='${e.id}':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.7`, '-frames:v', '1', png]);
      if (fs.existsSync(png)) strips.push(png);
    }
    if (!strips.length) continue;
    const cols = 2;
    const rows = Math.ceil(strips.length / cols);
    const sheet = path.join(sheetDir, `${flags.id ?? fam}.png`);
    if (strips.length === 1) fs.copyFileSync(strips[0], sheet);
    else ffmpeg([...strips.flatMap((s) => ['-i', s]), '-filter_complex', `${strips.map((_, i) => `[${i}:v]`).join('')}xstack=inputs=${strips.length}:layout=${strips.map((_, i) => `${(i % cols) ? 'w0' : '0'}_${Array.from({ length: Math.floor(i / cols) }, () => 'h0').join('+') || '0'}`).join('|')}:fill=black[v]`, '-map', '[v]', '-frames:v', '1', sheet], `bảng ${fam}`);
    void rows;
    strips.forEach((s) => fs.rmSync(s, { force: true }));
    console.log(`Bảng ảnh: ${sheet}`);
  }
}

for (const r of results) if (r.level !== 'PASS') console.log(`${r.level.padEnd(4)} ${r.id}: ${r.msg}`);
const fails = results.filter((r) => r.level === 'FAIL').length;
const passes = results.filter((r) => r.level === 'PASS').length;
const byFamily = [...new Set(wanted.map((e) => e.family))].map((f) => { const xs = wanted.filter((e) => e.family === f); return `${f} ${xs.filter((x) => results.find((r) => r.id === x.id && r.level === 'PASS')).length}/${xs.length}`; }).join(', ');
console.log(`\n${passes}/${wanted.length} hiệu ứng đạt (${byFamily})`);
console.log(fails ? `TRƯỢT ${fails} hiệu ứng` : 'Tất cả hiệu ứng đạt');
if (!flags.keep) fs.rmSync(path.join(out, 'run'), { recursive: true, force: true });
process.exit(fails ? 1 : 0);
