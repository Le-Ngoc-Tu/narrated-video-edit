// Khâu D1: dựng LỚP NỀN bằng ffmpeg: cắt khoảng ngắt, zoom nhấn, chèn cutaway (ảnh Ken Burns hoặc clip). Giữ nguyên giọng gốc.
// Chạy: node compose-base.mjs --plan work/edit-plan.json --analysis work/analysis --out work/base.mp4
// Ghi thêm work/plan.mapped.json (mọi mốc đã đổi sang giờ sau khi cắt) cho lớp phủ, âm thanh và audit.
import fs from 'node:fs';
import path from 'node:path';
import { FPS, args, ffmpeg, makeTimeMap, probe, readJson, writeJson } from './common.mjs';
import { demoLayout, demoTheme, buildPlate, focusFilters, focusList } from './demo-lib.mjs';
import { loadLibrary, makeCtx, snapWindow, videoStage } from './fx-lib.mjs';
import { clipPlan, facesIn, followLeftAt, loadAnalysis, loadStyle, mapFacesForLayout, mapPlan, sizeOf, stackGeometry } from './plan-lib.mjs';

const { flags } = args();
if (!flags.plan || !flags.analysis || !flags.out) { console.error('Dùng: node compose-base.mjs --plan work/edit-plan.json --analysis work/analysis --out work/base.mp4'); process.exit(2); }
const planFile = path.resolve(String(flags.plan));
const base = path.dirname(planFile);
const plan = readJson(planFile);
const A = loadAnalysis(String(flags.analysis));
const style = loadStyle(plan.style);
const { W, H } = sizeOf(plan.orientation, plan.size);
const timeMap = makeTimeMap(plan.cuts);
const mapped = mapPlan(plan, A.words, timeMap);
const out = path.resolve(String(flags.out));
const tmp = path.join(base, '.tmp');
fs.mkdirSync(tmp, { recursive: true });
const num = (n) => Number(n).toFixed(3);

// ---- Giai đoạn 1: cắt khoảng ngắt và chuẩn hóa kích thước, tốc độ khung, âm thanh ----
const keep = timeMap.keep.map(([a, b]) => [a, Math.min(b, plan.duration)]).filter(([a, b]) => b - a > 0.05);
const fade = 0.015;
const g1 = [];
// Bố cục stack: giữ nguyên độ phân giải gốc khi cắt, rồi dựng khung dọc sau khi nối (nền mờ + video vừa chiều ngang)
const stack = stackGeometry(plan);
keep.forEach(([a, b], i) => {
  const follow = plan.layout === 'follow' ? plan.follow : null;
  const fit = stack || follow ? 'setsar=1' : `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
  g1.push(`[0:v]trim=start=${num(a)}:end=${num(b)},setpts=PTS-STARTPTS,fps=${FPS},${fit}[v${i}]`);
  g1.push(`[0:a]atrim=start=${num(a)}:end=${num(b)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:d=${fade},afade=t=out:st=${num(Math.max(0, b - a - fade))}:d=${fade}[a${i}]`);
});
g1.push(`${keep.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${keep.length}:v=1:a=1[${stack || plan.layout === 'follow' ? 'vc' : 'v'}][a]`);
if (plan.layout === 'follow') {
  // Khung cắt 9:16 bám mặt: mép trái là hàm tuyến tính từng đoạn theo giờ thành phẩm (dựng từ các điểm của plan.follow, mỗi đoạn giữ được có điểm đầu và cuối riêng để chỗ nối là cú cắt dứt khoát)
  if (!plan.follow || !plan.srcSize) throw new Error('layout follow cần plan.follow và plan.srcSize (plan-skeleton --layout follow)');
  const cropW = Math.round((plan.follow.wNorm * plan.srcSize.w) / 2) * 2;
  const pieces = [];
  let cursor = 0;
  keep.forEach(([a, b]) => {
    const pts = [[a, followLeftAt(plan.follow, a)], ...plan.follow.knots.filter(([t]) => t > a && t < b), [b, followLeftAt(plan.follow, b)]];
    for (let i = 1; i < pts.length; i++) pieces.push([cursor + pts[i - 1][0] - a, cursor + pts[i][0] - a, pts[i - 1][1], pts[i][1]]);
    cursor += b - a;
  });
  const lin = ([t0, t1, v0, v1]) => `${num(v0)}+(${num(v1 - v0)})*(t-${num(t0)})/${num(Math.max(1e-3, t1 - t0))}`;
  const xExpr = pieces.reduceRight((acc, p, i) => (i === pieces.length - 1 ? `if(lt(t,${num(p[1])}),${lin(p)},${num(p[3])})` : `if(lt(t,${num(p[1])}),${lin(p)},${acc})`), '0');
  g1.push(`[vc]crop=w=${cropW}:h=ih:x='(${xExpr})*${plan.srcSize.w}':y=0,scale=${W}:${H}:flags=lanczos,setsar=1[v]`);
}
if (stack) {
  g1.push('[vc]split=2[bgsrc][fgsrc]');
  g1.push(`[bgsrc]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=40,eq=brightness=-0.22:saturation=1.1[bgb]`);
  g1.push(`[fgsrc]scale=${W}:${stack.fgH},setsar=1[fgs]`);
  g1.push(`[bgb][fgs]overlay=0:${stack.y},setsar=1[v]`);
}
const g1File = path.join(tmp, 'stage1.txt');
fs.writeFileSync(g1File, g1.join(';\n'));
const cutVideo = path.join(tmp, 'cut.mp4');
ffmpeg(['-i', plan.source, '-filter_complex_script', g1File, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '14', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', cutVideo], 'giai đoạn cắt');
const cutInfo = probe(cutVideo);

// ---- Giai đoạn 2: zoom nhấn và cutaway ----
const facesL = mapFacesForLayout(A.faces, plan);
const focal = (p) => { const bs = facesIn(facesL, p.start, p.end, 0.5); if (!bs.length) return { fx: 0.5, fy: 0.35 }; const b = bs.reduce((m, x) => (x.w * x.h > m.w * m.h ? x : m)); return { fx: Math.min(0.9, Math.max(0.1, b.x + b.w / 2)), fy: Math.min(0.8, Math.max(0.15, b.y + b.h / 2)) }; };
const bump = (p) => `max(0,min(1,(t-${num(p.oStart)})/0.12))*max(0,min(1,(${num(p.oEnd)}-t)/0.25))`;
const punchTerms = mapped.punches.map((p) => `(${num(p.scale - 1)}*${bump(p)})`);
const zoomExpr = punchTerms.length ? `1+${punchTerms.join('+')}` : '1';
const fxExpr = mapped.punches.map((p) => `${bump(p)}*${num(focal(p).fx - 0.5)}`).join('+') || '0';
const fyExpr = mapped.punches.map((p) => `${bump(p)}*${num(focal(p).fy - 0.35)}`).join('+') || '0';
const fadeDur = { hype: 0.05, explainer: 0.2, documentary: 0.3, creator: 0.15 }[style.id] ?? 0.1;
const inputs = ['-i', cutVideo];
const g2 = [];
g2.push(punchTerms.length
  ? `[0:v]scale=eval=frame:w='trunc(${W}*(${zoomExpr})/2)*2':h='trunc(${H}*(${zoomExpr})/2)*2',crop=${W}:${H}:x='(trunc(${W}*(${zoomExpr})/2)*2-${W})*max(0,min(1,0.5+${fxExpr}))':y='(trunc(${H}*(${zoomExpr})/2)*2-${H})*max(0,min(1,0.35+${fyExpr}))',setsar=1[bg]`
  : '[0:v]null[bg]');
let last = 'bg';
const isFullbleed = (c) => !c.presentation || c.presentation === 'fullbleed';
// Cutaway dựng ở lớp nền: phủ kín khung (fullbleed) hoặc cảnh demo (nền hoa văn, khung quanh clip, zoom vùng); các kiểu còn lại là vật thể của lớp phủ
const isBaseCutaway = (c) => isFullbleed(c) || c.presentation === 'demo';
const baseCutaways = mapped.cutaways.filter(isBaseCutaway);
mapped.cutaways.filter((c) => !isBaseCutaway(c)).forEach((c) => { if (!c.asset) throw new Error(`Cutaway ${c.id} chưa có tài nguyên (chạy resolve-assets).`); });
let nIn = 1;
const addInput = (opts, file) => { inputs.push(...opts, '-i', file); return nIn++; };
baseCutaways.forEach((c, k) => {
  if (!c.asset) throw new Error(`Cutaway ${c.id} chưa có tài nguyên (chạy resolve-assets).`);
  const file = path.resolve(base, c.asset);
  if (!fs.existsSync(file)) throw new Error(`Không thấy ${file}`);
  const dur = c.oEnd - c.oStart;
  const isVideo = c.kind === 'video' || /.(mp4|webm|mov)$/i.test(file);
  const f = Math.min(fadeDur, dur / 4);
  const tail = `format=rgba,fade=t=in:st=0:d=${num(f)}:alpha=1,fade=t=out:st=${num(dur - f)}:d=${num(f)}:alpha=1,setpts=PTS-STARTPTS+${num(c.oStart)}/TB[c${k}]`;
  const clip = clipPlan(c);
  const clipIn = () => addInput(isVideo ? [...(clip.once ? ['-ss', num(clip.start)] : ['-stream_loop', '-1']), '-t', num(dur * clip.speed)] : ['-loop', '1', '-framerate', String(FPS), '-t', num(dur)], file);
  const timing = `${clip.speed !== 1 ? `setpts=PTS/${clip.speed},` : ''}fps=${FPS}`;
  if (c.presentation === 'demo') {
    const info = probe(file);
    const theme = demoTheme(c.theme);
    const layout = demoLayout({ W, H, theme, clipW: info.width, clipH: info.height });
    const { plate, mask } = buildPlate({ theme, W, H, rect: layout, dir: path.join(tmp, `demo-${c.id}`) });
    const still = ['-loop', '1', '-framerate', String(FPS), '-t', num(dur)];
    const p = addInput(still, plate);
    const m = addInput(still, mask);
    const q = clipIn();
    g2.push(`[${q}:v]${timing},${isVideo && clip.once ? `tpad=stop_mode=clone:stop_duration=${num(dur)},` : ''}${focusFilters(focusList(c), layout)}[dc${k}]`);
    g2.push(`[${m}:v]format=gray[dm${k}]`);
    g2.push(`[dc${k}][dm${k}]alphamerge[dr${k}]`);
    g2.push(`[${p}:v][dr${k}]overlay=${layout.x}:${layout.y}:shortest=1,${tail}`);
  } else if (isVideo) {
    const idx = clipIn();
    const fit = clip.fit === 'contain' ? `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black` : `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
    g2.push(`[${idx}:v]${timing},${fit},setsar=1,${clip.once ? `tpad=stop_mode=clone:stop_duration=${num(dur)},` : ''}${tail}`);
  } else {
    const info = probe(file);
    const cover = Math.max(W / info.width, H / info.height);
    const cw = Math.ceil((info.width * cover) / 2) * 2;
    const ch = Math.ceil((info.height * cover) / 2) * 2;
    const idx = clipIn();
    const kb = c.zoom === 'drift'
      ? `scale=${Math.ceil(cw * 1.15 / 2) * 2}:${Math.ceil(ch * 1.15 / 2) * 2},crop=${W}:${H}:x='(iw-ow)*t/${num(dur)}':y='(ih-oh)/2'`
      : `scale=eval=frame:w='trunc(${cw}*(1+0.14*t/${num(dur)})/2)*2':h='trunc(${ch}*(1+0.14*t/${num(dur)})/2)*2',crop=${W}:${H}`;
    g2.push(`[${idx}:v]scale=${cw}:${ch},${kb},setsar=1,${tail}`);
  }
  g2.push(`[${last}][c${k}]overlay=eof_action=pass:enable='between(t,${num(c.oStart)},${num(c.oEnd)})'[o${k}]`);
  last = `o${k}`;
});
// Hiệu ứng của thư viện (data/effects, kế hoạch plan.effects): áp lên lớp nền theo giờ thành phẩm, lần lượt từng hiệu ứng
const fxLib = (mapped.effects ?? []).length ? loadLibrary() : null;
const totalFrames = Math.round(cutInfo.duration * FPS);
let fxLast = last;
(mapped.effects ?? []).forEach((fx, k) => {
  const e = fxLib.byId.get(fx.effect);
  if (!e) throw new Error(`Hiệu ứng "${fx.effect}" (${fx.id}) không có trong data/effects (node fx-apply.mjs list)`);
  if (e.engine !== 'video') throw new Error(`Hiệu ứng ${fx.id} (${e.id}) thuộc engine ${e.engine}: compose-base chỉ áp engine video. Mask người: dùng node fx-apply.mjs apply --mask; âm thanh: plan.sfx; overlay: khai ở mục tương ứng.`);
  const win = snapWindow(fx.oStart, fx.oEnd, FPS, totalFrames);
  const { fx: fxx, fy: fyy } = focal({ start: fx.start ?? 0, end: fx.end ?? 1 });
  const lines = videoStage(e, { params: fx.params, ctx: makeCtx({ W, H, fps: FPS, fx: fxx, fy: fyy }), n0: win.n0, n1: win.n1, totalFrames, fps: FPS, tag: `fx${k}`, input: fxLast, output: `fxo${k}` }, fxLib.dsl);
  g2.push(...lines);
  fxLast = `fxo${k}`;
});
g2.push(`[${fxLast}]format=yuv420p[vout]`);
const g2File = path.join(tmp, 'stage2.txt');
fs.writeFileSync(g2File, g2.join(';\n'));
fs.mkdirSync(path.dirname(out), { recursive: true });
ffmpeg([...inputs, '-filter_complex_script', g2File, '-map', '[vout]', '-map', '0:a', '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-r', String(FPS), '-t', num(cutInfo.duration), out], 'giai đoạn lớp nền');

writeJson(path.join(base, 'plan.mapped.json'), { ...mapped, wordsOut: mapped.wordsOut.map(({ i, text, oStart, oEnd, confidence }) => ({ i, text, oStart, oEnd, confidence })) });
const info = probe(out);
console.log(`Đã ghi ${out}: ${info.width}x${info.height} ${info.duration.toFixed(2)}s (gốc ${plan.duration.toFixed(2)}s, ${plan.cuts.length} đoạn cắt, ${baseCutaways.length} cutaway phủ kín, ${mapped.cutaways.length - baseCutaways.length} showcase, ${mapped.punches.length} zoom, ${(mapped.effects ?? []).length} hiệu ứng)`);
if (!flags.keep) fs.rmSync(tmp, { recursive: true, force: true });
