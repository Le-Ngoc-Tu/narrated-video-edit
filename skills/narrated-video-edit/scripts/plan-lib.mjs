// Dùng chung cho plan-skeleton, plan-lint, resolve-assets, compose, overlay, audit: nạp phân tích, phong cách, chuẩn hóa từ.
import path from 'node:path';
import { readJson, skillRoot } from './common.mjs';

export const STOP = new Set((
  'the a an and or but of to in on at for with from by as is are was were be been being it its this that these those i you he she we they me my your our their '
  + 'so then than too very can will just about into over after before up down out not no yes do does did have has had if when while what which who how why there here '
  + 'hello hi hey everyone everybody today really also first good great well way thing things much many more most some any every each other another still even ever never always '
  + 'và của những một các cho trong được với là này khi nếu thì để cũng đã đang sẽ rất không có từ ra vào lên xuống như nhưng hay hoặc mà thế vì nên bị bởi tại đó đây ấy nào gì ai sao bao nhiêu'
).split(' '));

export const norm = (text) => String(text).toLowerCase().normalize('NFC').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
export const hasDigit = (text) => /\d/.test(text);

export function loadStyle(id) {
  const styles = readJson(process.env.NVE_STYLES ? path.resolve(process.env.NVE_STYLES) : path.join(skillRoot, 'data', 'styles.json')).styles;
  if (!styles[id]) throw new Error(`Không có phong cách "${id}". Có: ${Object.keys(styles).join(', ')}`);
  return { id, ...styles[id] };
}

export function loadAnalysis(dir) {
  const d = path.resolve(dir);
  const words = readJson(path.join(d, 'words.json'));
  return {
    dir: d,
    meta: readJson(path.join(d, 'meta.json')),
    words: words.words,
    language: words.language,
    pauses: readJson(path.join(d, 'pauses.json')),
    faces: (() => { try { return readJson(path.join(d, 'faces.json')); } catch { return { samples: [], coverage: 0 }; } })(),
    // Các lần cắt cảnh có sẵn trong video gốc cũng là sự kiện hình: vlog nhiều cảnh quay thì người xem luôn thấy hình đổi
    shotCuts: (() => { try { return readJson(path.join(d, 'shots.json')).cuts ?? []; } catch { return []; } })()
  };
}

/** Khung mặt hợp nhất theo tỉ lệ 0..1 (lấy hộp bao của mọi mẫu), hoặc vùng an toàn mặc định khi không dò được mặt. */
export function faceZone(faces, orientation) {
  const boxes = (faces.samples ?? []).flatMap((s) => s.boxes);
  if (!boxes.length) return { x: orientation === '9x16' ? 0.18 : 0.3, y: orientation === '9x16' ? 0.14 : 0.1, w: orientation === '9x16' ? 0.64 : 0.4, h: orientation === '9x16' ? 0.34 : 0.55, assumed: true };
  const x0 = Math.min(...boxes.map((b) => b[0]));
  const y0 = Math.min(...boxes.map((b) => b[1]));
  const x1 = Math.max(...boxes.map((b) => b[0] + b[2]));
  const y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, assumed: false };
}

/** Kích thước khung ra theo hướng. */
export const sizeOf = (orientation, size) => {
  if (/^\d+x\d+$/.test(size ?? '')) { const [W, H] = size.split('x').map(Number); return { W, H }; }
  return orientation === '9x16' ? { W: 1080, H: 1920 } : { W: 1920, H: 1080 };
};

/**
 * Khung mặt quanh một cửa sổ thời gian GỐC [t0, t1] (giây). Video quay tay có mặt di chuyển nên không dùng một khung cố định:
 * lấy các hộp của mẫu trong cửa sổ (đệm pad giây); nếu không có thì lấy mẫu có mặt gần nhất trong 2,5 giây; xa hơn thì coi như không có mặt.
 */
export function facesIn(faces, t0, t1, pad = 0.75) {
  const samples = faces.samples ?? [];
  const inside = samples.filter((s) => s.t >= t0 - pad && s.t <= t1 + pad).flatMap((s) => s.boxes);
  if (inside.length) return inside.map(([x, y, w, h]) => ({ x, y, w, h }));
  // Dò hụt trong cửa sổ: dùng mẫu có mặt gần nhất trong 2,5s (người vẫn ở gần chỗ cũ); xa hơn thì coi như không có mặt (cảnh khác, không còn người)
  const mid = (t0 + t1) / 2;
  const near = samples.filter((s) => s.boxes.length && Math.abs(s.t - mid) <= 2.5).sort((a, b) => Math.abs(a.t - mid) - Math.abs(b.t - mid)).slice(0, 2).flatMap((s) => s.boxes);
  return near.map(([x, y, w, h]) => ({ x, y, w, h }));
}

/**
 * Đổi mọi mốc của kế hoạch (giây trong video gốc) sang giờ trong video đã cắt: thêm oStart/oEnd cho từng mục,
 * và wordsOut (các từ còn lại sau khi cắt, kèm giờ mới). Lớp nền, lớp phủ, âm thanh và audit dùng chung kết quả này.
 */
export function mapPlan(plan, words, timeMap) {
  const out = (t) => timeMap.toOut(t);
  const end = (t) => { const v = timeMap.toOut(t - 0.001); return v === null ? null : v + 0.001; };
  const mapItem = (x) => { const oStart = out(x.start); return { ...x, oStart, oEnd: end(x.end) ?? (oStart === null ? null : oStart + Math.min(x.end - x.start, 1)) }; };
  const wordsOut = words.map((w) => ({ ...w, oStart: out(w.start), oEnd: end(w.end) })).filter((w) => w.oStart !== null && w.oEnd !== null);
  // Hiệu ứng của thư viện data/effects: theo giờ gốc (start, end) hoặc, cho chuyển cảnh, cân hai bên chỗ nối sau lần cắt thứ atCut (cuts sắp theo giờ), độ dài dur giây
  const sortedCuts = [...(plan.cuts ?? [])].sort((a, b) => a.start - b.start);
  const outTotal = timeMap.outDuration(plan.duration);
  const mapEffect = (x) => {
    if (x.atCut === undefined) { const m = mapItem(x); return m.oStart === null ? null : m; }
    const join = sortedCuts[x.atCut] ? out(sortedCuts[x.atCut].end) : null;
    if (join === null) return null;
    const dur = x.dur ?? 0.4;
    return { ...x, start: sortedCuts[x.atCut].end, end: sortedCuts[x.atCut].end + dur, oStart: Math.max(0, join - dur / 2), oEnd: Math.min(outTotal, join + dur / 2) };
  };
  return {
    ...plan,
    outDuration: timeMap.outDuration(plan.duration),
    cutaways: plan.cutaways.map(mapItem).filter((x) => x.oStart !== null),
    punches: plan.punches.map(mapItem).filter((x) => x.oStart !== null),
    stats: plan.stats.map(mapItem).filter((x) => x.oStart !== null),
    decor: plan.decor.map(mapItem).filter((x) => x.oStart !== null),
    lowerThirds: (plan.lowerThirds ?? []).map(mapItem).filter((x) => x.oStart !== null),
    cards: (plan.cards ?? []).map(mapItem).filter((x) => x.oStart !== null),
    effects: (plan.effects ?? []).map(mapEffect).filter(Boolean).sort((p, q) => p.oStart - q.oStart),
    sfx: (plan.sfx ?? []).map((s) => ({ ...s, oT: s.oT ?? out(s.t) })).filter((s) => s.oT !== null),
    wordsOut
  };
}

/**
 * Độ dài đoạn [t0, t1] chỉ tính thời gian CÓ LỜI NÓI: trừ các khoảng giữa hai từ liền kề dài từ 1,5s (cảnh quay không lời, người dùng đang cho xem thứ gì đó).
 * Dùng cho phép kiểm "khoảng trống sự kiện hình": khoảng lặng dài của vlog không phải thời gian chết.
 */
export function speechGap(t0, t1, words, key = 'start', endKey = 'end', minSilence = 1.5) {
  let silent = 0;
  for (let i = 0; i + 1 < words.length; i++) {
    const a = words[i][endKey];
    const b = words[i + 1][key];
    if (b - a >= minSilence) silent += Math.max(0, Math.min(b, t1) - Math.max(a, t0));
  }
  return Math.max(0, t1 - t0 - silent);
}

/**
 * Bố cục "stack" cho video ngang đổi sang dọc 9:16: video gốc nằm gọn ở phần giữa khung (vừa chiều ngang), nền là bản mờ của chính nó,
 * phần phía trên dành cho thẻ decor, caption đè lên đáy video. plan.layout = 'stack', plan.srcSize = { w, h } của video gốc, plan.layoutY = vị trí trên của video (tỉ lệ chiều cao, mặc định 0,38).
 * Trả { W, H, fgH, y, box } (box là vùng video theo tỉ lệ 0..1) hoặc null.
 */
export function stackGeometry(plan) {
  if (plan.layout !== 'stack' || !plan.srcSize) return null;
  const { W, H } = sizeOf(plan.orientation, plan.size);
  const fgH = Math.round((W * plan.srcSize.h) / plan.srcSize.w / 2) * 2;
  const y = Math.round((H * (plan.layoutY ?? 0.38)) / 2) * 2;
  return { W, H, fgH, y, box: { x: 0, y: y / H, w: 1, h: fgH / H } };
}

/** Đổi hộp mặt (tỉ lệ theo video gốc) sang tỉ lệ theo khung dọc của bố cục stack. */
export function mapFacesToStack(faces, geo) {
  if (!geo) return faces;
  return { ...faces, samples: (faces.samples ?? []).map((sm) => ({ ...sm, boxes: sm.boxes.map(([x, y, w, h]) => [x, (geo.y + y * geo.fgH) / geo.H, w, (h * geo.fgH) / geo.H]) })) };
}

/**
 * Khung cắt 9:16 bám mặt người nói (bố cục "follow", video ngang sang dọc): trả { wNorm, knots: [[t, left]] } trong giờ GỐC,
 * wNorm là bề rộng khung cắt theo tỉ lệ chiều rộng gốc, left là mép trái (0..1-wNorm). Mặt mục tiêu là mặt lớn nhất; mất mặt thì giữ
 * vị trí cũ tối đa 3s rồi trôi dần về giữa; vùng chết 2% và giới hạn tốc độ để khung không giật.
 */
export function followPath(faces, srcSize, duration) {
  const wNorm = Math.min(1, (srcSize.h * 9) / 16 / srcSize.w);
  const centre = (1 - wNorm) / 2;
  const clampLeft = (v) => Math.min(1 - wNorm, Math.max(0, v));
  const samples = (faces.samples ?? []).slice().sort((a, b) => a.t - b.t);
  const grid = [];
  for (let t = 0; t <= duration + 1e-6; t += 0.5) grid.push(Number(t.toFixed(2)));
  const targetAt = (t) => {
    const s = samples.reduce((best, x) => (Math.abs(x.t - t) < Math.abs((best?.t ?? 1e9) - t) ? x : best), null);
    if (s && s.boxes.length && Math.abs(s.t - t) <= 0.5) { const b = s.boxes.reduce((m, x) => (x[2] * x[3] > m[2] * m[3] ? x : m)); return { left: clampLeft(b[0] + b[2] / 2 - wNorm / 2), seen: true }; }
    return { left: null, seen: false };
  };
  let pos = centre;
  let lastSeen = -1e9;
  let lastTarget = centre;
  const raw = [];
  grid.forEach((t, i) => {
    const tg = targetAt(t);
    if (tg.seen) { lastSeen = t; lastTarget = tg.left; }
    const target = tg.seen ? tg.left : t - lastSeen <= 3 ? lastTarget : centre;
    const dt = i ? t - grid[i - 1] : 0.5;
    if (Math.abs(target - pos) > 0.02) {
      const alpha = 1 - Math.exp(-dt / 0.6);
      const step = (target - pos) * alpha;
      const cap = 0.25 * dt;
      pos += Math.max(-cap, Math.min(cap, step));
    }
    raw.push([t, Number(clampLeft(pos).toFixed(4))]);
  });
  // Rút gọn bằng Douglas-Peucker (sai số 0,3% chiều rộng) để biểu thức ffmpeg ngắn
  const simplify = (pts, tol) => {
    if (pts.length < 3) return pts;
    const [t0, v0] = pts[0];
    const [t1, v1] = pts.at(-1);
    let worst = -1;
    let at = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const v = v0 + ((v1 - v0) * (pts[i][0] - t0)) / (t1 - t0 || 1);
      const d = Math.abs(pts[i][1] - v);
      if (d > worst) { worst = d; at = i; }
    }
    if (worst <= tol) return [pts[0], pts.at(-1)];
    return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
  };
  return { wNorm: Number(wNorm.toFixed(5)), knots: simplify(raw, 0.003) };
}

/** Mép trái của khung cắt tại giờ gốc t (nội suy tuyến tính giữa các điểm). */
export function followLeftAt(follow, t) {
  const k = follow.knots;
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) return k[i - 1][1] + ((k[i][1] - k[i - 1][1]) * (t - k[i - 1][0])) / (k[i][0] - k[i - 1][0] || 1);
  return k.at(-1)[1];
}

/** Đổi khung mặt (tỉ lệ theo video gốc) sang tỉ lệ theo khung dọc của bố cục stack hoặc follow; bố cục thường giữ nguyên. */
export function mapFacesForLayout(faces, plan) {
  if (plan.layout === 'follow' && plan.follow) {
    return { ...faces, samples: (faces.samples ?? []).map((sm) => ({ ...sm, boxes: sm.boxes.map(([x, y, w, h]) => { const left = followLeftAt(plan.follow, sm.t); return [(x - left) / plan.follow.wNorm, y, w / plan.follow.wNorm, h]; }).filter((b) => b[0] + b[2] / 2 > -0.05 && b[0] + b[2] / 2 < 1.05) })) };
  }
  return mapFacesToStack(faces, stackGeometry(plan));
}
