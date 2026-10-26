// Khâu D2: dựng LỚP PHỦ trong suốt (caption, showcase tài nguyên, emoji, sticker, thẻ số liệu, lower third) bằng trình duyệt và GSAP, ra chuỗi PNG có alpha.
// Chạy: node render-overlay.mjs --mapped work/plan.mapped.json --out work/overlay [--times 1.0,4.5] [--analysis work/analysis]
// --times chỉ chụp vài khung thử (kiểm bằng mắt trước khi dựng đủ, CỔNG 3). Khung không có gì hiện dùng chung một PNG trong suốt.
// Ghi overlay/frames/f_00000.png..., overlay-boxes.json (hộp bao theo thời gian cho audit), overlay-data.js và overlay-summary.json (kèm SFX của lớp phủ).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FPS, args, ffmpeg, launchChrome, pad, probe, readJson, skillRoot, writeJson } from './common.mjs';
import { facesIn, loadStyle, mapFacesForLayout, norm, sizeOf, stackGeometry } from './plan-lib.mjs';
import { brandLogo, iconifyFind, notoLottie } from './decor-lib.mjs';

const { flags } = args();
if (!flags.mapped || !flags.out) { console.error('Dùng: node render-overlay.mjs --mapped work/plan.mapped.json --out work/overlay [--times 1.0,4.5]'); process.exit(2); }
const mappedFile = path.resolve(String(flags.mapped));
const planDir = path.dirname(mappedFile);
const mapped = readJson(mappedFile);
const style = loadStyle(mapped.style);
const { W, H } = sizeOf(mapped.orientation, mapped.size);
const U = Math.min(W, H);
const portrait = mapped.orientation === '9x16';
const out = path.resolve(String(flags.out));
const framesDir = path.join(out, 'frames');
fs.mkdirSync(framesDir, { recursive: true });
const warnings = [];
// Decor tải qua mạng (emoji động Noto, icon Iconify) lưu đệm ở ~/.cache; --offline bỏ qua mạng và dùng bản tĩnh. Giấy phép CC BY cần ghi công: gom vào credits
const offline = Boolean(flags.offline);
const credits = new Set();
const lottieData = {};
// Kế hoạch được ghi đè preset, vị trí và cỡ chữ phụ đề; mode "off" tắt phụ đề mới (video nguồn đã có phụ đề cứng người dùng muốn giữ)
const captionOverrides = Object.fromEntries(['yRatio', 'yRatioPortrait', 'sizeRatio'].filter((k) => Number.isFinite(mapped.captions?.[k])).map((k) => [k, mapped.captions[k]]));
const captionsOff = mapped.captions?.mode === 'off';
const captionCfg = { ...style.captions, ...(mapped.captions?.preset ? { preset: mapped.captions.preset } : {}), ...captionOverrides };

// ---- Chia caption thành các lượt ngắn: mọi từ đều có mặt, mỗi lượt hiện tối thiểu 0,7s nếu chỗ trống cho phép ----
const words = mapped.wordsOut;
const emphasis = new Set(mapped.captions?.emphasis ?? []);
const maxWords = mapped.captions?.maxWords ?? style.captions.maxWords;
const maxChars = portrait ? 22 : 34;
const chunks = [];
let cur = [];
words.forEach((w, k) => {
  cur.push(w);
  const next = words[k + 1];
  const gap = next ? next.oStart - w.oEnd : Infinity;
  const chars = cur.reduce((s, x) => s + x.text.length + 1, 0);
  if (!next || cur.length >= maxWords || chars >= maxChars || /[.!?,;:…]$/.test(w.text) || gap > 0.4) { chunks.push(cur); cur = []; }
});
const chunkObjs = chunks.map((ws, n) => ({ id: `k${n + 1}`, words: ws.map((w) => ({ i: w.i, text: mapped.captions?.overrides?.[w.i] ?? w.text, s: w.oStart, e: w.oEnd, emph: emphasis.has(w.i) })), s: Math.max(0, ws[0].oStart - 0.03), e: ws.at(-1).oEnd + 0.3 }));
// Whisper đôi khi gán cùng một mốc cho vài từ liền nhau: lượt đó có cửa sổ gần như bằng 0 (hoặc âm) và chữ sẽ kẹt trên màn hình. Gộp vào lượt kế tiếp.
for (let i = 0; i < chunkObjs.length - 1; i++) {
  const c = chunkObjs[i];
  const next = chunkObjs[i + 1];
  if (Math.min(c.e, next.s - 0.01) - c.s >= 0.12) continue;
  next.words = [...c.words, ...next.words];
  next.s = c.s;
  chunkObjs.splice(i, 1);
  i = Math.max(-1, i - 2);
}
const MIN_SHOW = 0.7;
chunkObjs.forEach((c, n) => {
  const next = chunkObjs[n + 1];
  const limit = next ? next.s - 0.01 : Infinity;
  c.e = Math.min(Math.max(c.e, c.s + MIN_SHOW), limit);
});

if (captionsOff) chunkObjs.length = 0;

// ---- Vị trí: tránh khung mặt THEO THỜI ĐIỂM, dải caption và các phần tử cùng lúc ----
// Video quay tay có mặt di chuyển nên không dùng một khung mặt cố định: mỗi phần tử tránh các hộp mặt trong chính cửa sổ thời gian của nó.
const analysisDir = flags.analysis ? path.resolve(String(flags.analysis)) : path.join(planDir, 'analysis');
const stack = stackGeometry(mapped);
const faces = mapFacesForLayout(fs.existsSync(path.join(analysisDir, 'faces.json')) ? readJson(path.join(analysisDir, 'faces.json')) : { samples: [] }, mapped);
const hasFaces = (faces.samples ?? []).some((x) => x.boxes.length);
const assumed = mapped.safeZone;
const lines = 2;
const bandH = (captionCfg.sizeRatio * U * 1.25 * lines) / H;
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const margin = 0.02;
const grow = (b) => ({ x: b.x - margin, y: b.y - margin, w: b.w + 2 * margin, h: b.h + 2 * margin });
// Bố cục stack: cả vùng video gốc là vùng cấm (decor chỉ ở phần trên); bố cục thường: tránh khung mặt theo thời điểm
const faceBoxesFor = (t0, t1) => (stack ? [stack.box] : hasFaces ? facesIn(faces, t0, t1).map(grow) : [grow(assumed)]);
// Vùng an toàn: video dọc chừa phần trên (thanh trạng thái) và phần dưới (giao diện TikTok, Reels), lề phải chừa cột nút
const zone = stack ? { x0: 0.05, x1: 0.95, y0: 0.06, y1: stack.box.y - 0.01 } : portrait ? { x0: 0.05, x1: 0.92, y0: 0.1, y1: 0.74 } : { x0: 0.04, x1: 0.96, y0: 0.06, y1: 0.94 };
// Dải caption đứng yên cả video: chọn vị trí ít đè mặt nhất trong các ứng viên (ưu tiên vị trí của phong cách)
const preferY = stack ? stack.box.y + stack.box.h - bandH - 0.03 : portrait ? captionCfg.yRatioPortrait ?? captionCfg.yRatio : captionCfg.yRatio;
const bandCandidates = (stack ? [preferY, preferY - 0.04, preferY - 0.08] : [preferY, 0.8, 0.88, 0.06, 0.66, 0.56]).filter((y, k, arr) => arr.indexOf(y) === k && y + bandH <= (portrait ? 0.75 : 0.98));
const bandOverlapShare = (y) => {
  if (stack) return 0;
  const band = { x: 0.04, y, w: 0.92, h: bandH };
  if (!hasFaces) return overlaps(band, grow(assumed)) ? 1 : 0;
  const withFace = faces.samples.filter((x) => x.boxes.length);
  return withFace.filter((x) => x.boxes.some(([bx, by, bw, bh]) => overlaps(band, { x: bx, y: by, w: bw, h: bh }))).length / (withFace.length || 1);
};
const scored = bandCandidates.map((y) => ({ y, share: bandOverlapShare(y) }));
const captionY = (scored.find((c) => c.share <= 0.05) ?? [...scored].sort((a, b) => a.share - b.share)[0]).y;
const bandShare = bandOverlapShare(captionY);
if (!captionsOff && captionY !== preferY) warnings.push(`dải caption dời tới y=${captionY.toFixed(2)} để ít đè mặt${hasFaces ? '' : ' (khung mặt giả định vì chưa dò được mặt)'}`);
if (!captionsOff && bandShare > 0.05) warnings.push(`caption vẫn đè mặt ở ${(bandShare * 100).toFixed(0)}% số mẫu có mặt (mặt chiếm vùng dưới của khung)`);
const capBand = captionsOff ? { x: 0, y: 0, w: 0, h: 0 } : { x: 0.04, y: captionY - 0.01, w: 0.92, h: bandH + 0.02 };
const placed = [];
const clash = (box, t0, t1, faceAvoid) => faceAvoid.some((f) => overlaps(box, f)) || overlaps(box, capBand) || placed.some((p) => p.s < t1 && p.e > t0 && overlaps(box, { x: p.x - 0.01, y: p.y - 0.01, w: p.w + 0.02, h: p.h + 0.02 }));
const placeBox = (wr, hr, prefer, t0, t1, srcT0, srcT1) => {
  const order = prefer === 'left' ? [0.05, 0.3, 0.55, 0.78] : prefer === 'right' ? [0.78, 0.55, 0.3, 0.05] : [0.3, 0.05, 0.55, 0.78];
  const faceAvoid = faceBoxesFor(srcT0, srcT1);
  for (let y = zone.y0; y <= zone.y1 - hr; y += 0.03) for (const x0 of order) {
    const box = { x: Math.max(zone.x0, Math.min(x0, zone.x1 - wr)), y, w: wr, h: hr };
    if (!clash(box, t0, t1, faceAvoid)) return box;
  }
  return null;
};

// ---- Chuỗi giá trị giả ngẫu nhiên có hạt giống: cùng kế hoạch cho cùng kết quả ----
let seed = Number(mapped.seed ?? flags.seed ?? 11);
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const between = (a, b) => a + rnd() * (b - a);

// ---- Showcase: cutaway không phủ kín khung được dựng như vật thể thiết kế trong lớp phủ ----
const assetsDir = path.join(out, 'assets');
const MODES = {
  card: { long: 0.7, aspect: [0.6, 1.8], rot: [2, 5] },
  polaroid: { long: 0.56, aspect: [0.75, 1.4], rot: [3, 6] },
  pip: { long: 0.5, aspect: [0.6, 1.8], rot: [0, 2] },
  sticker: { long: 0.4, aspect: [1, 1], rot: [5, 10] },
  peek: { long: 0.58, aspect: [0.8, 1.5], rot: [5, 9] },
  stack: { long: 0.62, aspect: [0.6, 1.8], rot: [1.5, 4] }
};
const ENTRANCE_OK = { card: ['pop', 'slide', 'drop', 'flip', 'mask'], polaroid: ['drop', 'flip', 'pop', 'mask'], pip: ['pop', 'slide', 'mask'], sticker: ['pop', 'drop'], peek: ['slide'], stack: ['pop', 'flip', 'slide'] };
const seq = style.showcase?.entrances ?? ['pop', 'slide', 'drop', 'flip', 'mask'];
const showcases = [];
let lastSide = 'right';
let lastAnchor = '';
let lastEntrance = '';
const showcaseItems = mapped.cutaways.filter((c) => c.presentation && c.presentation !== 'fullbleed');
fs.mkdirSync(assetsDir, { recursive: true });
showcaseItems.forEach((c, n) => {
  const cfg = MODES[c.presentation];
  if (!cfg) { warnings.push(`cutaway ${c.id}: presentation "${c.presentation}" không hợp lệ (có: fullbleed, ${Object.keys(MODES).join(', ')})`); return; }
  const srcFile = path.resolve(planDir, c.asset);
  if (!c.asset || !fs.existsSync(srcFile)) { warnings.push(`cutaway ${c.id} chưa có tài nguyên, bỏ showcase`); return; }
  const isVideo = c.kind === 'video' || /\.(mp4|webm|mov)$/i.test(srcFile);
  const dest = path.join(assetsDir, `${c.id}.${isVideo ? 'jpg' : (path.extname(srcFile).slice(1).toLowerCase() || 'jpg')}`);
  if (isVideo) ffmpeg(['-ss', '0.6', '-i', srcFile, '-frames:v', '1', '-q:v', '2', dest], `lấy khung ${c.id}`);
  else fs.copyFileSync(srcFile, dest);
  const dims = probe(dest);
  const imgAspect = (dims.width || 4) / (dims.height || 3);
  const aspect = Math.min(cfg.aspect[1], Math.max(cfg.aspect[0], imgAspect));
  const pick = (list) => list[(n + Math.floor(rnd() * list.length)) % list.length];
  const okEntrance = ENTRANCE_OK[c.presentation].filter((x) => x !== lastEntrance);
  const entrance = c.entrance ?? (okEntrance.find((x) => x === seq[n % seq.length]) ?? pick(okEntrance));
  const shape = (scale) => {
    const long = cfg.long * U * scale;
    if (c.presentation === 'stack') { const k = long * 0.88; return aspect >= 1 ? { wpx: k, hpx: k / aspect } : { wpx: k * aspect, hpx: k }; }
    if (c.presentation === 'polaroid') { const wpx = long; const padPx = wpx * 0.06; const inner = wpx - 2 * padPx; return { wpx, hpx: padPx + inner / aspect + padPx * 3.6 }; }
    return aspect >= 1 ? { wpx: long, hpx: long / aspect } : { wpx: long * aspect, hpx: long };
  };
  const wantSide = lastSide === 'right' ? 'left' : 'right';
  let placedBox = null;
  const side = wantSide;
  for (const scale of [1, 0.85, 0.7, 0.55]) {
    const { wpx, hpx } = shape(scale);
    const wr = wpx / W;
    const hr = hpx / H;
    const faceAvoid = faceBoxesFor(c.start, c.end);
    const slotsX = c.presentation === 'peek'
      ? (wantSide === 'left' ? [-wr * 0.42] : [1 - wr * 0.58])
      : (wantSide === 'left' ? [zone.x0, 0.22, 0.4] : [zone.x1 - wr, 0.74 - wr, 0.55 - wr / 2]);
    const cands = [];
    for (let y = zone.y0; y <= zone.y1 - hr + 1e-6; y += 0.03) for (const x of slotsX) {
      const box = { x, y, w: wr, h: hr };
      const visible = { x: Math.max(0, x), y, w: Math.min(1, x + wr) - Math.max(0, x), h: hr };
      if (clash(visible, c.oStart, c.oEnd, faceAvoid)) continue;
      const anchor = `${x < 0.35 ? 'L' : x > 0.55 ? 'R' : 'C'}${y < 0.3 ? 'T' : y < 0.55 ? 'M' : 'B'}`;
      const score = (anchor === lastAnchor ? -1 : 0) + (portrait ? -y * 1.2 : -Math.abs(y - 0.3)) + between(0, 0.5);
      cands.push({ box, score, anchor });
    }
    if (cands.length) { const best = cands.sort((a, b) => b.score - a.score)[0]; placedBox = { ...best, wpx, hpx }; break; }
  }
  if (!placedBox) {
    warnings.push(`cutaway ${c.id} (${c.presentation}) bỏ vì không còn chỗ trống ngoài mặt, caption và các phần tử cùng lúc`);
    return;
  }
  lastSide = side;
  lastAnchor = placedBox.anchor;
  lastEntrance = entrance;
  placed.push({ ...placedBox.box, x: Math.max(0, placedBox.box.x), w: Math.min(1, placedBox.box.x + placedBox.box.w) - Math.max(0, placedBox.box.x), s: c.oStart, e: c.oEnd });
  const dir = side === 'left' ? -1 : 1;
  showcases.push({ id: c.id, mode: c.presentation, src: `assets/${path.basename(dest)}`, x: placedBox.box.x, y: placedBox.box.y, w: placedBox.box.w, h: placedBox.box.h, rot: dir * between(...cfg.rot) * (rnd() < 0.2 ? -1 : 1), entrance, exit: entrance === 'slide' ? 'slide' : 'shrink', side, anchor: placedBox.anchor, label: c.label ?? '', s: c.oStart, e: c.oEnd });
});

// ---- Sticker và thẻ số liệu ----
const chunkOf = (wordIndex) => chunkObjs.find((c) => c.words.some((w) => w.i === wordIndex));
const ANCHORED = new Set(['underline', 'circle', 'arrow', 'sparkle', 'confetti']);
const decor = [];
const iconAssets = new Map();
for (const d of mapped.decor.filter((x) => x.type === 'icon')) {
  if (offline || !d.query) continue;
  const found = await iconifyFind(d.query);
  if (found) iconAssets.set(d.id, found);
}
mapped.decor.forEach((d, n) => {
  const side = n % 2 ? 1 : -1;
  if (d.type === 'icon') return;
  if (ANCHORED.has(d.type)) {
    const chunk = chunkOf(d.anchorWord);
    if (!chunk) { if (!captionsOff) warnings.push(`sticker ${d.id} (${d.type}) bỏ vì từ neo nằm ngoài caption`); return; }
    const w = chunk.words.find((x) => x.i === d.anchorWord);
    decor.push({ id: d.id, type: d.type, anchored: true, anchorWord: d.anchorWord, s: w.s, e: Math.min(d.oEnd, chunk.e), side });
    return;
  }
  const badge = d.type === 'badge';
  const sizePx = U * (badge ? 0.5 : 0.15);
  const box = placeBox(sizePx / W, (badge ? U * 0.1 : sizePx) / H, side === 1 ? 'right' : 'left', d.oStart, d.oEnd, d.start, d.end);
  if (!box) { warnings.push(`sticker ${d.id} bỏ vì không còn chỗ trống ngoài mặt và caption`); return; }
  placed.push({ ...box, s: d.oStart, e: d.oEnd });
  decor.push({ id: d.id, type: d.type, anchored: false, x: box.x, y: box.y, w: box.w, h: box.h, text: d.text ?? words.find((x) => x.i === d.anchorWord)?.text ?? '', s: d.oStart, e: d.oEnd, side });
});
// ---- Thẻ headline ở vùng trên: title (chữ lớn hai tầng), compare (thẻ so sánh hai cột), logos (chip thương hiệu khi lời nói nhắc) ----
// Mục của thẻ orbit và wall: chuỗi là nhãn chữ, đối tượng có thể có src (ảnh CỦA NGƯỜI DÙNG, đường dẫn tuyệt đối hoặc tương đối với thư mục kế hoạch) và label; ảnh được chép vào overlay/assets/cards
const cardItems = (c) => {
  const items = [];
  for (const [n, raw] of (c.items ?? []).entries()) {
    const it = typeof raw === 'string' ? { label: raw } : { ...raw };
    if (it.src) {
      const abs = path.resolve(planDir, String(it.src));
      if (!fs.existsSync(abs) || !/\.(jpe?g|png|webp|svg)$/i.test(abs)) { warnings.push(`thẻ ${c.id}: ảnh ${it.src} không tồn tại hoặc không phải ảnh, dùng nhãn chữ`); delete it.src; }
      else {
        fs.mkdirSync(path.join(assetsDir, 'cards'), { recursive: true });
        const name = `${c.id}-${n}${path.extname(abs).toLowerCase()}`;
        fs.copyFileSync(abs, path.join(assetsDir, 'cards', name));
        it.src = `assets/cards/${name}`;
      }
    }
    if (it.src || it.label) items.push({ src: it.src ?? null, label: it.label ? String(it.label) : '' });
  }
  return items;
};
const cardsOut = [];
for (const c of mapped.cards ?? []) {
  const base = { id: c.id, type: c.type, s: c.oStart, e: c.oEnd };
  const full = Math.min(W * 0.9, U * 1.15);
  let wpx;
  let hpx;
  let extra = {};
  if (c.type === 'bigtext') {
    // Chữ lớn sau người nói: căn giữa theo khung mặt (khung đã đổi theo bố cục), rộng 96% khung; không cần tránh mặt vì người đứng trên chữ
    const text = String(c.text ?? '').trim().toUpperCase();
    if (!text) { warnings.push(`thẻ ${c.id} (bigtext) bỏ vì thiếu chữ`); continue; }
    const ws = text.split(/\s+/);
    const lines = ws.length >= 2 && text.length > 12 ? [ws.slice(0, Math.ceil(ws.length / 2)).join(' '), ws.slice(Math.ceil(ws.length / 2)).join(' ')] : [text];
    const font = Math.min(U * 0.46, (W * 0.96) / (Math.max(...lines.map((l) => l.length)) * 0.64));
    const hr = (lines.length * font * 1.02) / H;
    const bs = facesIn(faces, c.start, c.end, 0.5);
    const biggest = bs.length ? bs.reduce((m, x) => (x.w * x.h > m.w * m.h ? x : m)) : null;
    const cy = Math.min(0.58, Math.max(0.14 + hr / 2, biggest ? biggest.y + biggest.h * 0.35 : 0.34));
    cardsOut.push({ ...base, type: 'bigtext', behind: c.behind !== false, lines, text, x: 0.02, y: Math.max(0.02, cy - hr / 2), w: 0.96, h: hr });
    continue;
  }
  if (c.type === 'wall' || c.type === 'orbit') {
    // Hai kiểu này nằm SAU người nói (cần mặt nạ người): wall phủ kín khung, orbit chạy vòng quanh mặt theo khung mặt trong cửa sổ của thẻ
    const items = cardItems(c);
    if (c.type === 'wall') {
      if (!items.length) { warnings.push(`thẻ ${c.id} (wall) bỏ vì không có mục nào (items: nhãn chữ hoặc ảnh)`); continue; }
      cardsOut.push({ ...base, behind: true, items, cols: Math.min(6, Math.max(2, Math.round(Number(c.cols)) || 4)), x: 0, y: 0, w: 1, h: 1 });
      continue;
    }
    if (items.length < 3) { warnings.push(`thẻ ${c.id} (orbit) bỏ vì cần ít nhất 3 mục (có ${items.length})`); continue; }
    const bs = facesIn(faces, c.start, c.end, 0.5);
    const biggest = bs.length ? bs.reduce((m, x) => (x.w * x.h > m.w * m.h ? x : m)) : null;
    const cx = biggest ? biggest.x + biggest.w / 2 : 0.5;
    const cy = biggest ? Math.min(0.72, biggest.y + biggest.h * 0.85) : 0.45;
    cardsOut.push({ ...base, behind: true, items: items.slice(0, 8), cx, cy, rx: Math.min(0.42, Math.max(0.24, biggest ? biggest.w * 1.7 : 0.34)), ry: 0.08, x: 0, y: 0, w: 1, h: 1 });
    continue;
  }
  if (c.type === 'title') { wpx = full; hpx = full * 0.22; extra = { text: c.text ?? '', sub: c.sub ?? '' }; }
  else if (c.type === 'compare') {
    wpx = Math.min(W * 0.92, U * 1.2);
    hpx = wpx * 0.4;
    extra = { left: { title: c.left?.title ?? '', sub: c.left?.sub ?? '' }, right: { title: c.right?.title ?? '', sub: c.right?.sub ?? '' } };
    for (const side of ['left', 'right']) {
      const q = c[side]?.icon;
      if (!q || offline) continue;
      const found = await iconifyFind(q);
      if (!found) { warnings.push(`thẻ ${c.id}: không tìm được icon "${q}"`); continue; }
      fs.mkdirSync(path.join(assetsDir, 'decor'), { recursive: true });
      fs.copyFileSync(found.file, path.join(assetsDir, 'decor', `${c.id}-${side}.svg`));
      extra[side].src = `assets/decor/${c.id}-${side}.svg`;
      if (found.credit) credits.add(found.credit);
    }
  } else if (c.type === 'logos') {
    const items = [];
    for (const id of c.brands ?? []) {
      if (offline) continue;
      const logo = await brandLogo(id);
      if (!logo) { warnings.push(`thẻ ${c.id}: không lấy được logo "${id}"`); continue; }
      fs.mkdirSync(path.join(assetsDir, 'decor'), { recursive: true });
      fs.copyFileSync(logo.file, path.join(assetsDir, 'decor', `${c.id}-${id}.svg`));
      items.push({ src: `assets/decor/${c.id}-${id}.svg`, label: logo.brand.label, color: logo.brand.color, mono: logo.set === 'simple-icons' });
    }
    if (!items.length) { warnings.push(`thẻ ${c.id} (logos) bỏ vì không có logo${offline ? ' (--offline)' : ''}`); continue; }
    const tile = U * 0.17;
    wpx = items.length * tile + (items.length - 1) * U * 0.12;
    hpx = tile * 1.5;
    extra = { items };
  } else if (c.type === 'comment') {
    const text = String(c.text ?? '').trim();
    if (!text) { warnings.push(`thẻ ${c.id} (comment) bỏ vì thiếu chữ`); continue; }
    wpx = Math.min(W * 0.88, U * 1.1);
    hpx = wpx * (c.reply ? 0.34 : 0.19);
    extra = { text, reply: String(c.reply ?? '').trim(), name: String(c.name ?? 'bạn'), ...(c.placeholder ? { placeholder: String(c.placeholder) } : {}) };
  } else if (c.type === 'actions') {
    wpx = Math.min(W * 0.62, U * 0.8);
    hpx = wpx * 0.2;
    extra = { active: ['like', 'comment', 'share', 'save'].includes(c.active) ? c.active : 'save' };
  } else if (c.type === 'counter') {
    const rows = (c.rows ?? []).filter((r) => r.label && Number.isFinite(Number(r.to))).slice(0, 3).map((r) => ({ label: String(r.label), from: Number(r.from ?? 0), to: Number(r.to) }));
    if (!rows.length) { warnings.push(`thẻ ${c.id} (counter) bỏ vì không có dòng số liệu hợp lệ (label và to)`); continue; }
    wpx = Math.min(W * 0.78, U * 1.0);
    hpx = wpx * (0.2 + rows.length * 0.12);
    extra = { title: String(c.title ?? ''), rows };
  } else { warnings.push(`thẻ ${c.id}: kiểu "${c.type}" không hợp lệ (title, compare, logos, bigtext, comment, actions, counter, orbit, wall)`); continue; }
  let placedBox = null;
  let scale = 1;
  for (scale of [1, 0.85, 0.7]) {
    placedBox = placeBox((wpx * scale) / W, (hpx * scale) / H, c.type === 'title' ? 'left' : 'center', c.oStart, c.oEnd, c.start, c.end);
    if (placedBox) break;
  }
  if (!placedBox) { warnings.push(`thẻ ${c.id} (${c.type}) bỏ vì không còn chỗ trống`); continue; }
  placed.push({ ...placedBox, s: c.oStart, e: c.oEnd });
  cardsOut.push({ ...base, ...extra, x: placedBox.x, y: placedBox.y, w: placedBox.w, h: placedBox.h });
}
const stats = [];
// Kiểu thẻ số luân phiên theo danh sách của phong cách (video ngắn cần đa dạng); --stat-variant hoặc statVariant trong kế hoạch ghim một kiểu
const STAT_VARIANTS = ['ring', 'sticker', 'capsule'];
const pinned = flags['stat-variant'] ?? mapped.statVariant;
const variantCycle = pinned ? [String(pinned)] : style.statVariants ?? ['capsule'];
if (!variantCycle.every((v) => STAT_VARIANTS.includes(v))) throw new Error(`Kiểu thẻ số không hợp lệ: ${variantCycle.join(', ')} (có: ${STAT_VARIANTS.join(', ')})`);
mapped.stats.forEach((s, n) => {
  const preferred = variantCycle[n % variantCycle.length];
  // Kích thước theo kiểu thẻ (đơn vị U = cạnh ngắn). Không còn chỗ cho kiểu ưu tiên thì thử cỡ nhỏ dần, rồi các kiểu khác (chữ co theo): chỗ trống cạnh mặt gần luôn hẹp
  const vlen = String(s.value).length;
  const llen = s.label?.length ?? 0;
  const dimsOf = { ring: [0.3 + 0.025 * Math.max(0, vlen - 3), 0.3 + 0.025 * Math.max(0, vlen - 3)], sticker: [Math.max(0.42, 0.085 * vlen + 0.2), 0.27], capsule: [0.15 + 0.066 * vlen + 0.03 * llen + 0.05, 0.17] };
  for (const statVariant of [preferred, ...STAT_VARIANTS.filter((v) => v !== preferred)]) {
    const dims = dimsOf[statVariant];
    for (const scale of [1, 0.8, 0.62]) {
      const wr = (U * dims[0] * scale) / W;
      const hr = (U * dims[1] * scale) / H;
      const box = placeBox(wr, hr, 'center', s.oStart, s.oEnd, s.start, s.end);
      if (!box) continue;
      placed.push({ ...box, s: s.oStart, e: s.oEnd });
      stats.push({ id: s.id, variant: statVariant, value: s.value, label: s.label, x: box.x, y: box.y, w: box.w, h: box.h, scale, s: s.oStart, e: s.oEnd });
      return;
    }
  }
  warnings.push(`thẻ số ${s.id} bỏ vì không còn chỗ trống`);
});
// Sticker icon đặt SAU thẻ số: thẻ số quan trọng hơn nên được giữ chỗ trước
mapped.decor.forEach((d, n) => {
  if (d.type !== 'icon') return;
  const side = n % 2 ? 1 : -1;
  const found = iconAssets.get(d.id);
  if (!found) { warnings.push(`sticker ${d.id} (icon "${d.query ?? ''}") bỏ vì không tìm được icon có giấy phép hợp lệ${offline ? ' (--offline)' : ''}`); return; }
  const sizePx = U * 0.2;
  const box = placeBox(sizePx / W, sizePx / H, side === 1 ? 'right' : 'left', d.oStart, d.oEnd, d.start, d.end);
  if (!box) { warnings.push(`sticker ${d.id} (icon) bỏ vì không còn chỗ trống ngoài mặt và caption`); return; }
  placed.push({ ...box, s: d.oStart, e: d.oEnd });
  fs.mkdirSync(path.join(assetsDir, 'decor'), { recursive: true });
  fs.copyFileSync(found.file, path.join(assetsDir, 'decor', `${d.id}.svg`));
  if (found.credit) credits.add(found.credit);
  decor.push({ id: d.id, type: 'icon', anchored: false, x: box.x, y: box.y, w: box.w, h: box.h, src: `assets/decor/${d.id}.svg`, s: d.oStart, e: d.oEnd, side, iconSet: `${found.set}:${found.name}`, license: found.license });
  return;
});
const lowerThirds = mapped.lowerThirds.map((l) => ({ title: l.title, sub: l.sub ?? '', y: Math.max(0.05, captionY - 0.16), s: l.oStart, e: l.oEnd }));

// ---- Emoji phản ứng: plan.emoji (tay) hoặc tự gợi ý từ data/emoji-map.json theo từ khóa ----
const emojiCfg = style.emoji ?? { perMinute: 0 };
const emojiMap = readJson(path.join(skillRoot, 'data', 'emoji-map.json')).map;
const emojiFiles = new Set(fs.readdirSync(path.join(skillRoot, 'templates', 'emoji')).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)));
const byWord = new Map();
const byPhrase = new Map();
emojiMap.forEach((m) => { m.any.forEach((k) => byWord.set(norm(k), m.id)); (m.phrases ?? []).forEach((k) => byPhrase.set(k.split(' ').map(norm).join(' '), m.id)); });
const emojiPicks = [];
if (Array.isArray(mapped.emoji)) {
  mapped.emoji.forEach((m) => {
    const w = words.find((x) => x.i === m.anchorWord);
    if (!w || !emojiFiles.has(m.id)) { warnings.push(`emoji ${m.id ?? '?'} bỏ vì thiếu từ neo hoặc tệp`); return; }
    emojiPicks.push({ id: m.id, word: w });
  });
} else {
  const budget = Math.floor((emojiCfg.perMinute * mapped.outDuration) / 60);
  let lastT = -Infinity;
  const lastUse = new Map();
  for (let k = 0; k < words.length && emojiPicks.length < budget; k++) {
    const w = words[k];
    const id = byPhrase.get(`${norm(w.text)} ${words[k + 1] ? norm(words[k + 1].text) : ''}`) ?? byWord.get(norm(w.text));
    if (!id || !emojiFiles.has(id) || w.oStart - lastT < emojiCfg.minGapSec || w.oStart - (lastUse.get(id) ?? -Infinity) < 25) continue;
    emojiPicks.push({ id, word: w });
    lastT = w.oStart;
    lastUse.set(id, w.oStart);
  }
}
// Emoji nằm cùng dòng caption (sau chữ cuối của lượt, không đổi bố cục) và bật lên đàn hồi tại từ khóa: không cần vùng trống riêng nên không đè mặt
const emojis = [];
const usedEmojiFiles = new Set();
// Emoji động Noto (Lottie) khi có bản và phong cách cho phép; không thì PNG tĩnh Fluent
const animateEmoji = async (id) => {
  if (offline || style.emoji?.animated === false) return false;
  if (!lottieData[id]) {
    const found = await notoLottie(id);
    if (!found) return false;
    lottieData[id] = found.data;
    credits.add(found.credit);
  }
  return true;
};
for (const m of emojiPicks) {
  const chunk = chunkOf(m.word.i);
  if (!chunk || chunk.emoji) continue;
  chunk.emoji = { file: m.id, s: m.word.oStart, animated: await animateEmoji(m.id) };
  emojis.push({ id: `e${emojis.length + 1}`, file: m.id, s: m.word.oStart });
  usedEmojiFiles.add(m.id);
}

// Biểu tượng cho thẻ số: theo đơn vị (data/emoji-map.json "units"), rồi theo từ khóa của nhãn, rồi theo dấu %; không có thì dùng sparkles
const unitMap = new Map();
(readJson(path.join(skillRoot, 'data', 'emoji-map.json')).units ?? []).forEach((u) => u.words.forEach((x) => unitMap.set(norm(x), u.id)));
for (const st of stats) {
  const src = mapped.stats.find((m) => m.id === st.id);
  const next = words.find((w) => w.i === src.anchorWord + 1);
  const id = unitMap.get(norm(st.label ?? '')) ?? (next && unitMap.get(norm(next.text))) ?? (/%/.test(st.value) ? 'chartup' : null) ?? byWord.get(norm(st.label ?? '')) ?? 'sparkles';
  if (emojiFiles.has(id)) { st.emoji = id; st.emojiAnim = await animateEmoji(id); usedEmojiFiles.add(id); }
}

// ---- Ghi dữ liệu và tài nguyên của trang ----
const data = { W, H, style: { id: style.id, colors: style.colors, fonts: style.fonts, captions: captionCfg, accents: style.accents ?? {} }, captionY, chunks: chunkObjs, decor, showcases, stats, lowerThirds, cards: cardsOut, lottie: lottieData };
fs.copyFileSync(path.join(skillRoot, 'templates', 'overlay.html'), path.join(out, 'overlay.html'));
fs.copyFileSync(path.join(skillRoot, 'templates', 'overlay.js'), path.join(out, 'overlay.js'));
fs.cpSync(path.join(skillRoot, 'templates', 'vendor'), path.join(out, 'vendor'), { recursive: true });
fs.cpSync(path.join(skillRoot, 'templates', 'fonts'), path.join(out, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(out, 'emoji'), { recursive: true });
usedEmojiFiles.forEach((f) => fs.copyFileSync(path.join(skillRoot, 'templates', 'emoji', `${f}.png`), path.join(out, 'emoji', `${f}.png`)));
fs.writeFileSync(path.join(out, 'overlay-data.js'), `window.OVERLAY = ${JSON.stringify(data)};\n`);

// SFX của lớp phủ (finalize gộp vào lúc trộn âm): pop cho emoji và vật thể nhỏ, whoosh cho thẻ trượt hoặc rơi vào, ding cho thẻ số
const overlaySfx = [];
if (style.sfx.pop) {
  emojis.forEach((m) => overlaySfx.push({ oT: m.s, type: 'pop' }));
  showcases.filter((x) => ['pop', 'mask', 'flip'].includes(x.entrance)).forEach((x) => overlaySfx.push({ oT: x.s, type: 'pop' }));
  stats.forEach((x) => overlaySfx.push({ oT: x.s + 0.1, type: 'ding' }));
}
if (style.sfx.whoosh) showcases.filter((x) => ['slide', 'drop'].includes(x.entrance)).forEach((x) => overlaySfx.push({ oT: x.s, type: 'whoosh' }));

// ---- Chụp khung ----
const total = Math.ceil(mapped.outDuration * FPS);
const windows = [...chunkObjs, ...decor, ...showcases, ...stats, ...lowerThirds, ...cardsOut].map((x) => [x.s - 0.02, x.e + 0.05]);
const behindCards = cardsOut.filter((x) => (x.type === 'bigtext' && x.behind) || x.type === 'orbit' || x.type === 'wall');
const behindWindows = behindCards.map((x) => [x.s - 0.02, x.e + 0.05]);
const activeBehind = (t) => behindWindows.some(([a, b]) => t >= a && t <= b);
const behindDir = path.join(out, 'behind');
if (behindCards.length) fs.mkdirSync(behindDir, { recursive: true });
const active = (t) => windows.some(([a, b]) => t >= a && t <= b);
const times = flags.times ? String(flags.times).split(',').map(Number) : null;
const browser = await launchChrome();
const boxes = [];
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { throw new Error(`Lỗi trong lớp phủ: ${e.message}`); });
  await page.goto(pathToFileURL(path.join(out, 'overlay.html')).href);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  await page.evaluate(() => { document.getElementById('stage').style.visibility = 'hidden'; });
  const blank = path.join(out, 'blank.png');
  await page.screenshot({ path: blank, omitBackground: true, type: 'png' });
  await page.evaluate(() => { document.getElementById('stage').style.visibility = 'visible'; });
  const shoot = async (t, file, layer = 'front') => { await page.evaluate(([x, l]) => { window.setLayer(l); window.seek(x); }, [t, layer]); await page.screenshot({ path: file, omitBackground: true, type: 'png' }); };
  if (times) {
    for (const t of times) {
      await shoot(t, path.join(out, `test_${pad(Math.round(t * 1000), 6)}.png`));
      if (behindCards.length) await shoot(t, path.join(out, `behind_test_${pad(Math.round(t * 1000), 6)}.png`), 'behind');
    }
    console.log(`Đã chụp ${times.length} khung thử vào ${out}`);
  } else {
    const started = Date.now();
    let shot = 0;
    for (let n = 0; n < total; n++) {
      const t = n / FPS;
      const file = path.join(framesDir, `f_${pad(n, 5)}.png`);
      if (behindCards.length) { const bf = path.join(behindDir, `f_${pad(n, 5)}.png`); if (activeBehind(t)) await shoot(t, bf, 'behind'); else fs.copyFileSync(blank, bf); }
      if (!active(t)) { fs.copyFileSync(blank, file); continue; }
      await shoot(t, file);
      shot++;
      if (n % 5 === 0) boxes.push({ t: Number(t.toFixed(3)), boxes: await page.evaluate(() => window.boxes()) });
    }
    writeJson(path.join(out, 'overlay-boxes.json'), { fps: FPS, samples: boxes });
    console.log(`Đã dựng ${total} khung (${shot} khung có nội dung) trong ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
} finally { await browser.close(); }
warnings.forEach((w) => console.log(`cảnh báo: ${w}`));
writeJson(path.join(out, 'overlay-summary.json'), {
  chunks: chunkObjs.length,
  captionWords: chunkObjs.reduce((s, c) => s + c.words.length, 0),
  sourceWords: words.length,
  preset: captionCfg.preset,
  decor: decor.length,
  showcases: showcases.map((x) => ({ id: x.id, mode: x.mode, entrance: x.entrance, anchor: x.anchor, side: x.side })),
  emojis: emojis.length,
  stats: stats.length,
  cards: cardsOut.map((x) => ({ id: x.id, type: x.type })),
  behindWindows: behindCards.map((x) => ({ id: x.id, text: x.text, s: Number(x.s.toFixed(3)), e: Number(x.e.toFixed(3)) })),
  layout: stack ? 'stack' : 'normal',
  lowerThirds: lowerThirds.length,
  captionY,
  animatedEmoji: Object.keys(lottieData),
  icons: decor.filter((x) => x.type === 'icon').map((x) => ({ id: x.id, icon: x.iconSet, license: x.license })),
  credits: [...credits],
  sfx: overlaySfx,
  warnings
});
