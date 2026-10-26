// Khâu F: kiểm toán video thành phẩm bằng phép đo độc lập, không tin báo cáo của khâu dựng.
// Chạy: node audit-edit.mjs --video work/out.mp4 --work work [--analysis work/analysis] [--no-asr] [--sheet work/out-sheet.png]
// Kiểm: thông số tệp, độ to, khung đen và khung đứng, lệch caption so với phiên âm LẠI âm thanh thành phẩm, chồng mặt và lề,
// độ tương phản chữ, mật độ sự kiện hình, giấy phép và ghi công, số liệu có nguồn. Mã thoát 1 nếu có hạng mục FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { FPS, args, ffmpeg, makeTimeMap, probe, pythonPath, readJson, run, writeJson, here } from './common.mjs';
import { flashesPerSecond } from './fx-lib.mjs';
import { facesIn, loadAnalysis, loadStyle, mapFacesForLayout, norm, sizeOf, speechGap, stackGeometry } from './plan-lib.mjs';

const { flags } = args();
if (!flags.video || !flags.work) { console.error('Dùng: node audit-edit.mjs --video work/out.mp4 --work work [--analysis work/analysis] [--no-asr]'); process.exit(2); }
const video = path.resolve(String(flags.video));
const work = path.resolve(String(flags.work));
const A = loadAnalysis(String(flags.analysis ?? path.join(work, 'analysis')));
const plan = readJson(path.join(work, 'edit-plan.json'));
const mapped = readJson(path.join(work, 'plan.mapped.json'));
const style = loadStyle(plan.style);
const overlayData = JSON.parse(fs.readFileSync(path.join(work, 'overlay', 'overlay-data.js'), 'utf8').replace('window.OVERLAY = ', '').replace(/;\s*$/, ''));
const boxes = fs.existsSync(path.join(work, 'overlay', 'overlay-boxes.json')) ? readJson(path.join(work, 'overlay', 'overlay-boxes.json')).samples : [];
const { W, H } = sizeOf(plan.orientation, plan.size);
const U = Math.min(W, H);
const results = [];
const add = (level, name, detail = '') => results.push({ level, name, detail });
const pass = (n, d) => add('PASS', n, d);
const fail = (n, d) => add('FAIL', n, d);
const warn = (n, d) => add('WARN', n, d);
const info = probe(video);

// 1. Thông số tệp
info.width === W && info.height === H ? pass('kích thước đúng chuẩn', `${W}x${H}`) : fail('kích thước đúng chuẩn', `${info.width}x${info.height}, cần ${W}x${H}`);
Math.abs(info.fps - FPS) < 0.1 ? pass('30 khung/giây') : fail('30 khung/giây', `${info.fps}`);
info.hasAudio ? pass('có luồng âm thanh') : fail('có luồng âm thanh');
Math.abs(info.duration - mapped.outDuration) <= 0.15 ? pass('độ dài khớp kế hoạch', `${info.duration.toFixed(2)}s so với ${mapped.outDuration.toFixed(2)}s`) : fail('độ dài khớp kế hoạch', `${info.duration.toFixed(2)}s so với ${mapped.outDuration.toFixed(2)}s`);

// 2. Độ to
const loud = run('ffmpeg', ['-hide_banner', '-i', video, '-vn', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']);
const lm = JSON.parse(loud.stderr.match(/\{[\s\S]*?\}/g).pop());
Math.abs(Number(lm.input_i) + 14) <= 1.2 ? pass('độ to -14 LUFS', `${lm.input_i} LUFS`) : fail('độ to -14 LUFS', `${lm.input_i} LUFS`);
Number(lm.input_tp) <= -1 ? pass('true peak không vượt -1 dBTP', `${lm.input_tp} dBTP`) : fail('true peak không vượt -1 dBTP', `${lm.input_tp} dBTP`);

// 3. Khung đen và khung đứng
const bd = run('ffmpeg', ['-hide_banner', '-i', video, '-vf', 'blackdetect=d=0.2:pic_th=0.98:pix_th=0.04', '-an', '-f', 'null', '-']);
const blacks = [...bd.stderr.matchAll(/black_start:([\d.]+)/g)].length;
blacks ? fail('không có đoạn đen giữa video', `${blacks} đoạn`) : pass('không có đoạn đen giữa video');
const fz = run('ffmpeg', ['-hide_banner', '-i', video, '-vf', 'freezedetect=n=0.003:d=2.5', '-an', '-f', 'null', '-']);
const freezes = [...fz.stderr.matchAll(/freeze_start: ([\d.]+)/g)].length;
freezes ? warn('không có đoạn hình đứng trên 2,5s', `${freezes} đoạn (video người nói tĩnh có thể bình thường)`) : pass('không có đoạn hình đứng trên 2,5s');

// 3b. Hiệu ứng thư viện (plan.effects): đo độc lập tần số chớp sáng trên chính video thành phẩm trong từng cửa sổ; WCAG 2.3.1 đòi dưới 3 lần mỗi giây
const fxWindows = (mapped.effects ?? []).filter((x) => !x.look);
if (fxWindows.length) {
  let worstFlash = 0;
  for (const x of fxWindows) {
    const t0 = Math.max(0, x.oStart - 0.1);
    const r = run('ffmpeg', ['-v', 'error', '-ss', t0.toFixed(2), '-t', (x.oEnd - x.oStart + 0.2).toFixed(2), '-i', video, '-an', '-vf', 'scale=160:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-']);
    const luma = [...r.stdout.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
    worstFlash = Math.max(worstFlash, flashesPerSecond(luma, FPS));
  }
  worstFlash > 3 ? fail('chớp sáng dưới 3 lần mỗi giây trong các hiệu ứng', `đo được ${worstFlash.toFixed(1)}/giây`) : pass('chớp sáng dưới 3 lần mỗi giây trong các hiệu ứng', `${fxWindows.length} cửa sổ, tối đa ${worstFlash.toFixed(1)}/giây`);
}

// 3c. Thành phẩm có ĐÚNG lớp phủ đã dựng: so khung thành phẩm với (nền + khung lớp phủ) tại mỗi sự kiện và các mốc rải đều, kể cả cuối video.
// Bắt lỗi ghép khi lớp phủ chưa dựng xong hoặc ghép từ lớp phủ cũ (chữ đứng, thẻ biến mất) mà các phép đo theo kế hoạch không thấy.
const baseFile = path.join(work, 'base.mp4');
const ovFramesDir = path.join(work, 'overlay', 'frames');
if (fs.existsSync(baseFile) && fs.existsSync(ovFramesDir)) {
  const summaryFile = path.join(work, 'overlay', 'overlay-summary.json');
  const behind = (fs.existsSync(summaryFile) ? readJson(summaryFile).behindWindows ?? [] : []).map((w) => [w.s ?? w.start ?? w.oStart ?? 0, w.e ?? w.end ?? w.oEnd ?? 0]);
  const marks = new Set();
  for (const e of [...(mapped.cutaways ?? []), ...(mapped.cards ?? []), ...(mapped.stats ?? []), ...(mapped.decor ?? [])]) if (Number.isFinite(e.oStart) && Number.isFinite(e.oEnd)) marks.add((e.oStart + e.oEnd) / 2);
  for (let i = 1; i <= 8; i++) marks.add((info.duration * i) / 9);
  marks.add(info.duration - 0.5);
  const frameOf = (t) => Math.min(Math.round(info.duration * FPS) - 1, Math.max(0, Math.round(t * FPS)));
  const samples = [...new Set([...marks].map(frameOf))].filter((k) => !behind.some(([s, e]) => k / FPS >= s - 0.1 && k / FPS <= e + 0.1)).sort((a, b) => a - b).slice(0, 24);
  const bad = [];
  let minPsnr = Infinity;
  // Khung chuyển tiếp (từ đang nói đổi trạng thái nhấn) có thể lệch một khung khi tua: lấy khung lớp phủ khớp nhất trong k-1, k, k+1; lỗi thật (lớp phủ cũ, thiếu) lệch hàng chục khung nên vẫn bị bắt
  const psnrAt = (k, off) => {
    const ss = Math.max(0, k / FPS - 0.0005).toFixed(4);
    const ovFile = path.join(ovFramesDir, `f_${String(Math.max(1, k + 1 + off)).padStart(5, '0')}.png`);
    if (!fs.existsSync(ovFile)) return null;
    const r = run('ffmpeg', ['-hide_banner', '-ss', ss, '-i', video, '-ss', ss, '-i', baseFile, '-i', ovFile, '-filter_complex', '[1:v][2:v]overlay=0:0:format=auto,format=yuv420p,scale=360:-2[e];[0:v]scale=360:-2[a];[a][e]psnr', '-frames:v', '1', '-f', 'null', '-']);
    const m = r.stderr.match(/average:([\d.]+|inf)/);
    return !m ? 0 : m[1] === 'inf' ? 100 : Number(m[1]);
  };
  for (const k of samples) {
    let best = psnrAt(k, 0);
    if (best === null) { bad.push(`${(k / FPS).toFixed(1)}s (thiếu khung lớp phủ)`); continue; }
    for (const off of [-1, 1]) if (best < 26) best = Math.max(best, psnrAt(k, off) ?? 0);
    minPsnr = Math.min(minPsnr, best);
    if (best < 26) bad.push(`${(k / FPS).toFixed(1)}s (${best.toFixed(1)} dB)`);
  }
  bad.length
    ? fail('thành phẩm khớp nền cộng lớp phủ tại các mốc mẫu', `${bad.length}/${samples.length} mốc lệch: ${bad.slice(0, 6).join(', ')}; có thể finalize chạy khi render-overlay chưa xong hoặc ghép từ lớp phủ cũ: dựng lại lớp phủ cho xong rồi finalize lại`)
    : pass('thành phẩm khớp nền cộng lớp phủ tại các mốc mẫu', `${samples.length} mốc, PSNR thấp nhất ${Number.isFinite(minPsnr) ? minPsnr.toFixed(1) : '-'} dB`);
} else warn('thành phẩm khớp nền cộng lớp phủ tại các mốc mẫu', 'thiếu base.mp4 hoặc overlay/frames: không đối chiếu được');

// 4. Đồng bộ caption: (a) mốc đã ánh xạ khớp bản đồ thời gian tính lại; (b) phiên âm LẠI âm thanh thành phẩm
const tmap = makeTimeMap(plan.cuts);
const capWords = overlayData.chunks.flatMap((c) => c.words);
const byIndex = new Map(A.words.map((w) => [w.i, w]));
const drift = capWords.map((w) => { const src = byIndex.get(w.i); const expect = src ? tmap.toOut(src.start) : null; return expect === null ? 0 : Math.abs(expect - w.s); });
const worstMap = Math.max(0, ...drift);
worstMap <= 1 / FPS + 0.001 ? pass('mốc caption khớp bản đồ thời gian tính lại', `lệch tối đa ${(worstMap * 1000).toFixed(0)} ms`) : fail('mốc caption khớp bản đồ thời gian tính lại', `lệch tối đa ${(worstMap * 1000).toFixed(0)} ms`);
if (!capWords.length) pass('caption: kế hoạch không thêm phụ đề mới (captions.mode off)', 'giữ phụ đề của video nguồn');
else if (!flags['no-asr']) {
  const wav = path.join(work, '.audit-audio.wav');
  const json = path.join(work, '.audit-words.json');
  ffmpeg(['-i', video, '-vn', '-ac', '1', '-ar', '16000', wav], 'trích âm thanh thành phẩm');
  const r = run(pythonPath(), [path.join(here, 'transcribe.py'), wav, '--out', json, '--model', String(flags['asr-model'] ?? 'small'), ...(A.language ? ['--lang', A.language] : [])], { env: { ...process.env, PYTHONUTF8: '1' } });
  if (r.status !== 0) warn('lệch caption so với phiên âm lại', `không chạy được phiên âm: ${(r.stderr || r.stdout).trim().split('\n').pop()}`);
  else {
    const re = readJson(json).words.map((w) => ({ t: norm(w.text), s: w.start }));
    const deltas = [];
    for (const w of capWords) {
      const cand = re.filter((x) => x.t === norm(w.text)).sort((a, b) => Math.abs(a.s - w.s) - Math.abs(b.s - w.s))[0];
      if (cand && Math.abs(cand.s - w.s) < 1.5) deltas.push(Math.abs(cand.s - w.s));
    }
    const matched = deltas.length / capWords.length;
    const median = deltas.length ? [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)] : Infinity;
    if (matched < 0.6) warn('lệch caption so với phiên âm lại', `chỉ khớp ${(matched * 100).toFixed(0)}% từ (giọng khó nhận hoặc ngôn ngữ chưa đúng); bỏ qua phép đo`);
    else median <= 0.2 ? pass('lệch caption so với phiên âm lại', `trung vị ${(median * 1000).toFixed(0)} ms trên ${deltas.length} từ (${(matched * 100).toFixed(0)}% khớp)`) : fail('lệch caption so với phiên âm lại', `trung vị ${(median * 1000).toFixed(0)} ms`);
    fs.rmSync(wav, { force: true });
    fs.rmSync(json, { force: true });
  }
} else warn('lệch caption so với phiên âm lại', 'bỏ qua theo --no-asr');

// 5. Chồng mặt và lề an toàn: so với các hộp mặt quanh đúng thời điểm đó (đổi giờ thành phẩm về giờ gốc), không dùng một khung cố định
const hit = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const stackGeo = stackGeometry(plan);
const facesM = mapFacesForLayout(A.faces, plan);
const hasFaces = (facesM.samples ?? []).some((x) => x.boxes.length);
const zonesAt = (outT) => { const src = tmap.toSrc(outT); return stackGeo ? [stackGeo.box] : hasFaces ? facesIn(facesM, src - 0.25, src + 0.25, 0.5) : [plan.safeZone]; };
let faceHits = 0;
let overlayShots = 0;
let outOfBounds = 0;
let capOnFace = 0;
const firstSeen = new Map();
for (const s of boxes) for (const b of s.boxes) {
  if (!firstSeen.has(b.id)) firstSeen.set(b.id, s.t);
  if (b.kind === 'backdrop') continue; // thẻ orbit và wall nằm sau hoặc quanh người nói theo thiết kế, không tính chồng mặt
  const frac = Math.max(0, ...zonesAt(s.t).map((z) => hit(b, z) / (b.w * b.h || 1)));
  if (b.kind !== 'caption') overlayShots++;
  if (b.kind === 'caption') { if (!stackGeo && frac > 0.2) capOnFace++; } else if (frac > 0.15) faceHits++;
  // Thẻ tên trượt vào từ ngoài mép và thẻ số nảy ra: khi đang chuyển động hộp bao tạm thời vượt khung, không phải lỗi bố cục
  // Hộp đã cắt theo khung; offscreen là phần diện tích nằm ngoài khung. Bỏ qua 0,65s đầu của mỗi phần tử (đang trượt hoặc rơi vào) và vật thể "peek" cố ý ló ra từ mép
  if (b.kind !== 'lowerthird' && b.mode !== 'peek' && b.offscreen > 0.02 && s.t - firstSeen.get(b.id) > 0.65) outOfBounds++;
}
const tag = hasFaces || stackGeo ? '' : ' (khung mặt GIẢ ĐỊNH, chưa dò được mặt thật)';
// Dò mặt chỉ nhận mặt nhìn thẳng nên không thể bằng không tuyệt đối ở video quay tay: chồng mặt trên 3% số mẫu của sticker và thẻ là lỗi, dưới đó là cảnh báo
const faceShare = overlayShots ? faceHits / overlayShots : 0;
(faceShare > 0.03 ? fail : faceHits ? warn : pass)('sticker và thẻ không che mặt người nói', `${faceHits}/${overlayShots} mẫu (${(faceShare * 100).toFixed(1)}%) chồng khung mặt${tag}`);
capOnFace ? warn('caption không đè mặt', `${capOnFace}/${boxes.length} mẫu${tag}`) : pass('caption không đè mặt');
outOfBounds ? fail('phần tử nằm trong khung hình', `${outOfBounds} mẫu tràn ra ngoài`) : pass('phần tử nằm trong khung hình');
stackGeo ? pass('bố cục stack: decor chỉ ở vùng trên, không che video gốc', 'vùng video là vùng cấm của mọi phần tử') : !hasFaces ? warn('khung mặt', 'dùng vùng an toàn mặc định vì faces.json không có mặt: kiểm bằng mắt trên ảnh duyệt') : pass('khung mặt dò được', `coverage ${A.faces.coverage} (nơi dò hụt dùng mẫu gần nhất hoặc hộp trung vị)`);

// 6. Chữ đọc được
const capPx = style.captions.sizeRatio * U;
capPx / U >= 0.045 ? pass('cỡ caption đủ lớn', `${capPx.toFixed(0)}px (${((capPx / U) * 100).toFixed(1)}% cạnh ngắn)`) : fail('cỡ caption đủ lớn', `${capPx.toFixed(0)}px dưới 4,5% cạnh ngắn`);
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
ratio(style.colors.ink, style.colors.stroke) >= 4.5 ? pass('tương phản chữ và viền', `${ratio(style.colors.ink, style.colors.stroke).toFixed(1)}:1`) : fail('tương phản chữ và viền', `${ratio(style.colors.ink, style.colors.stroke).toFixed(1)}:1`);
ratio(style.colors[style.captions.activeColor] ?? style.colors.accent, style.colors.stroke) >= 3 ? pass('tương phản màu nhấn và viền') : warn('tương phản màu nhấn và viền');

// 6b. Caption đầy đủ, đa dạng trình bày, vùng an toàn của video dọc
const summary = fs.existsSync(path.join(work, 'overlay', 'overlay-summary.json')) ? readJson(path.join(work, 'overlay', 'overlay-summary.json')) : null;
if (summary) {
  plan.captions?.mode === 'off' ? pass('caption đủ 100% số từ: bỏ qua vì captions.mode off', 'giữ phụ đề của video nguồn') : summary.captionWords === summary.sourceWords ? pass('caption đủ 100% số từ', `${summary.captionWords}/${summary.sourceWords} từ`) : fail('caption đủ 100% số từ', `${summary.captionWords}/${summary.sourceWords} từ`);
  const shows = summary.showcases ?? [];
  const planned = mapped.cutaways.filter((c) => c.presentation && c.presentation !== 'fullbleed').length;
  planned > shows.length ? warn('showcase đã lên kế hoạch đều được dựng', `${shows.length}/${planned} (phần còn lại bị bỏ vì hết chỗ trống: xem cảnh báo của render-overlay)`) : pass('showcase đã lên kế hoạch đều được dựng', `${shows.length}/${planned}`);
  if (shows.length >= 3) {
    const modes = new Set(shows.map((x) => x.mode));
    const anchors = new Set(shows.map((x) => x.anchor));
    const entrances = new Set(shows.map((x) => x.entrance));
    const sameRun = shows.filter((x, i) => i && x.mode === shows[i - 1].mode && x.anchor === shows[i - 1].anchor).length;
    modes.size >= 2 && anchors.size >= 2 && entrances.size >= 2 && !sameRun ? pass('showcase đa dạng kiểu, vị trí, hiệu ứng vào', `${modes.size} kiểu, ${anchors.size} vị trí, ${entrances.size} hiệu ứng`) : warn('showcase đa dạng kiểu, vị trí, hiệu ứng vào', `${modes.size} kiểu, ${anchors.size} vị trí, ${entrances.size} hiệu ứng, ${sameRun} cặp liên tiếp trùng`);
  }
}
if (summary?.behindWindows?.length) {
  const statsFile = path.join(work, 'overlay', 'mask-stats.json');
  if (!fs.existsSync(statsFile)) fail('chữ sau người nói có mặt nạ người', 'thiếu overlay/mask-stats.json (chạy segment-person.mjs)');
  else {
    const ms = readJson(statsFile).ranges;
    const odd = ms.filter((x) => (x.coverage ?? 0) < 0.03 || x.coverage > 0.97);
    odd.length ? warn('mặt nạ người hợp lý trong các khoảng chữ sau người', `${odd.length}/${ms.length} khoảng bất thường (không có người hoặc người chiếm gần hết khung): xem ảnh duyệt`) : pass('mặt nạ người hợp lý trong các khoảng chữ sau người', ms.map((x) => `${(x.coverage * 100).toFixed(0)}%`).join(', '));
  }
}
if (plan.orientation === '9x16') {
  const low = boxes.flatMap((s) => s.boxes).filter((b) => ['caption', 'showcase', 'stat', 'emoji'].includes(b.kind) && b.mode !== 'peek' && b.y + b.h > 0.78).length;
  const total = boxes.flatMap((s) => s.boxes).filter((b) => ['caption', 'showcase', 'stat', 'emoji'].includes(b.kind)).length || 1;
  low / total > 0.03 ? fail('video dọc: không chiếm 22% dưới khung (giao diện TikTok, Reels)', `${low}/${total} mẫu`) : pass('video dọc: không chiếm 22% dưới khung (giao diện TikTok, Reels)');
}

// 7. Mật độ sự kiện hình (theo giờ thành phẩm)
const eventTimes = [...[...mapped.cutaways, ...mapped.punches, ...mapped.stats, ...mapped.decor, ...mapped.lowerThirds].map((x) => x.oStart), ...A.shotCuts.map((t) => tmap.toOut(t)).filter((t) => t !== null), ...plan.cuts.filter((c) => c.end < plan.duration).map((c) => tmap.toOut(c.end)).filter((t) => t !== null)].sort((a, b) => a - b);
let gap = eventTimes.length ? speechGap(0, eventTimes[0], mapped.wordsOut, 'oStart', 'oEnd') : mapped.outDuration;
let gapAt = 0;
eventTimes.forEach((t, i) => { const g = speechGap(t, eventTimes[i + 1] ?? mapped.outDuration, mapped.wordsOut, 'oStart', 'oEnd'); if (g > gap) { gap = g; gapAt = t; } });
const gapLimit = style.maxEventGap ?? 6;
// Các số là mốc hiệu chuẩn: chỉ báo lỗi khi vượt trần 25%, giữa trần và đó là cảnh báo
gap > gapLimit * 1.25 ? fail('khoảng trống sự kiện hình', `${gap.toFixed(1)}s từ giây ${gapAt.toFixed(1)} (trần ${gapLimit}s)`) : gap > gapLimit * 0.6 ? warn('khoảng trống sự kiện hình', `${gap.toFixed(1)}s từ giây ${gapAt.toFixed(1)} (trần ${gapLimit}s)`) : pass('khoảng trống sự kiện hình', `tối đa ${gap.toFixed(1)}s`);
const share = mapped.cutaways.filter((c) => !c.presentation || c.presentation === 'fullbleed').reduce((s, c) => s + (c.oEnd - c.oStart), 0) / mapped.outDuration;
share <= style.brollMaxShare + 0.05 ? pass('tỉ lệ rời mặt người nói', `${(share * 100).toFixed(0)}%`) : fail('tỉ lệ rời mặt người nói', `${(share * 100).toFixed(0)}% > ${(style.brollMaxShare * 100).toFixed(0)}%`);

// 8. Giấy phép và ghi công
const credits = fs.existsSync(path.join(work, 'assets', 'credits.json')) ? readJson(path.join(work, 'assets', 'credits.json')) : [];
const need = mapped.cutaways.filter((c) => !c.userProvided);
const lacking = need.filter((c) => !credits.some((x) => path.basename(c.asset) === x.file));
lacking.length ? fail('mọi tài nguyên tải về có ghi công', lacking.map((c) => c.id).join(', ')) : pass('mọi tài nguyên tải về có ghi công', `${need.length} tài nguyên, ${mapped.cutaways.length - need.length} của người dùng`);
const badLicense = credits.filter((x) => !['cc0', 'pd', 'by'].includes(x.license));
badLicense.length ? fail('giấy phép nằm trong danh sách trắng (CC0, PD, CC BY)', badLicense.map((x) => `${x.file}:${x.license}`).join(', ')) : pass('giấy phép nằm trong danh sách trắng (CC0, PD, CC BY)');
const needsAttribution = credits.filter((x) => x.license === 'by');
const creditsOut = video.replace(/\.mp4$/, '.credits.txt');
needsAttribution.length && !fs.existsSync(creditsOut) ? fail('có tệp ghi công đi kèm video', 'thiếu .credits.txt') : pass('tệp ghi công đi kèm video', needsAttribution.length ? `${needsAttribution.length} tài nguyên CC BY cần ghi công trong mô tả video` : 'không có tài nguyên cần ghi công bắt buộc');

// 8b. Decor tải về (emoji động, icon): giấy phép trong danh sách trắng và đã ghi công
if (summary && (summary.credits?.length || summary.icons?.length || summary.animatedEmoji?.length)) {
  const decorSources = readJson(path.join(here, '..', 'data', 'decor-sources.json'));
  const badIcons = (summary.icons ?? []).filter((x) => !decorSources.allow.includes(x.license));
  badIcons.length ? fail('icon decor có giấy phép trong danh sách trắng', badIcons.map((x) => `${x.icon}:${x.license}`).join(', ')) : pass('icon decor có giấy phép trong danh sách trắng', `${(summary.icons ?? []).length} icon, ${(summary.animatedEmoji ?? []).length} emoji động (CC BY 4.0)`);
  const creditsFile = video.replace(/\.mp4$/, '.credits.txt');
  const creditsText = fs.existsSync(creditsFile) ? fs.readFileSync(creditsFile, 'utf8') : '';
  const missingCredit = (summary.credits ?? []).filter((c) => !creditsText.includes(c));
  missingCredit.length ? fail('decor CC BY có ghi công trong .credits.txt', missingCredit.join(' | ')) : pass('decor CC BY có ghi công trong .credits.txt', `${(summary.credits ?? []).length} dòng`);
}

// 9. Số liệu trên màn hình có nguồn
const spoken = new Set();
A.words.forEach((_, i) => { let acc = ''; for (let k = 0; k < 3 && A.words[i + k]; k++) { acc += A.words[i + k].text.replace(/[^\d]/g, ''); if (acc) spoken.add(acc); } });
const userSource = (plan.userSource ?? []).join(' ');
const screenNumbers = [...overlayData.stats.map((s) => s.value), ...overlayData.decor.map((d) => d.text ?? '')].filter((v) => /\d/.test(v));
const unsourced = screenNumbers.filter((v) => !spoken.has(String(v).replace(/[^\d]/g, '')) && !userSource.includes(String(v)));
unsourced.length ? fail('số liệu trên màn hình có trong lời nói', unsourced.join(', ')) : pass('số liệu trên màn hình có trong lời nói', `${screenNumbers.length} giá trị`);

// 10. Ảnh duyệt hình (người phải đọc bằng mắt)
const sheet = path.resolve(String(flags.sheet ?? path.join(work, 'out-sheet.png')));
const picks = [...new Set([0.3, ...mapped.cutaways.map((c) => (c.oStart + c.oEnd) / 2), ...mapped.stats.map((s) => s.oStart + 0.4), ...mapped.decor.slice(0, 3).map((d) => d.oStart + 0.4), mapped.outDuration * 0.5, mapped.outDuration - 0.5].map((t) => Number(Math.min(Math.max(t, 0), mapped.outDuration - 0.05).toFixed(2))))].sort((a, b) => a - b).slice(0, 12);
const expr = picks.map((t) => `lt(abs(t-${t}),0.017)`).join('+');
const cols = Math.min(6, picks.length);
const sheetRun = run('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `select='${expr}',scale=${plan.orientation === '9x16' ? 270 : 480}:-2,tile=${cols}x${Math.ceil(picks.length / cols)}`, '-frames:v', '1', sheet]);
sheetRun.status === 0 ? pass('ảnh duyệt hình', `${path.relative(process.cwd(), sheet)} (${picks.length} khung): NGƯỜI PHẢI ĐỌC bằng mắt`) : warn('ảnh duyệt hình', sheetRun.stderr.trim().split('\n').pop());

for (const r of results) console.log(`${r.level.padEnd(4)} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
const failed = results.filter((r) => r.level === 'FAIL').length;
writeJson(path.join(work, 'audit-edit.json'), { video, failed, warnings: results.filter((r) => r.level === 'WARN').length, results });
console.log(failed ? `\nTRƯỢT ${failed} hạng mục` : `\nĐẠT các hạng mục tự động${results.some((r) => r.level === 'WARN') ? ' (có cảnh báo)' : ''}. Vẫn phải xem ảnh duyệt hình bằng mắt trước khi giao.`);
process.exit(failed ? 1 : 0);
