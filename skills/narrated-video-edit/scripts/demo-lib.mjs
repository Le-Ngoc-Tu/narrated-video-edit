// Kiểu trình bày "demo" (voice-over trên màn hình thao tác): nền hoa văn tự vẽ, khung bo góc quanh clip, zoom vùng (focus) và chú thích theo tọa độ clip (marks).
// Dùng chung cho compose-base (dựng nền, zoom bằng biểu thức ffmpeg), render-overlay (đổi tọa độ clip sang tọa độ khung hình cho chú thích) và plan-lint.
import fs from 'node:fs';
import path from 'node:path';
import { ffmpeg, readJson, skillRoot } from './common.mjs';

export const DEMO_THEMES = readJson(path.join(skillRoot, 'data', 'demo-themes.json')).themes;
export const demoTheme = (id) => {
  const theme = DEMO_THEMES[id ?? 'pastel'];
  if (!theme) throw new Error(`Chủ đề demo "${id}" không có trong data/demo-themes.json (có: ${Object.keys(DEMO_THEMES).join(', ')})`);
  return theme;
};
export const MARK_TYPES = ['circle', 'arrow', 'underline'];

const even = (v) => Math.round(v / 2) * 2;
const n4 = (v) => Number(v).toFixed(4);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (p) => p * p * (3 - 2 * p);

/** Hộp chữ nhật (px, chẵn) đặt clip vừa khít trong vùng của chủ đề, giữ nguyên tỉ lệ clip. */
export function demoLayout({ W, H, theme, clipW, clipH }) {
  const a = H > W ? theme.areaPortrait : theme.areaLandscape;
  const aw = a.w * W;
  const ah = a.h * H;
  const k = Math.min(aw / clipW, ah / clipH);
  const w = even(clipW * k);
  const h = even(clipH * k);
  return { x: even(a.x * W + (aw - w) / 2), y: even(a.y * H + (ah - h) / 2), w, h };
}

/** Hợp lệ khi rect (tọa độ clip 0..1) nằm trong clip và có kích thước dương. */
export const validRect = (r) => r && [r.x, r.y, r.w, r.h].every(Number.isFinite) && r.w > 0 && r.h > 0 && r.x >= 0 && r.y >= 0 && r.x + r.w <= 1.001 && r.y + r.h <= 1.001;

/** Danh sách vùng zoom theo giây từ đầu cửa sổ demo: a, b (vào và ra), r (thời gian chuyển), z (mức zoom), cx, cy (tâm theo tọa độ clip). */
export function focusList(demo) {
  return (demo.focus ?? []).filter((f) => f.oStart !== null && f.oStart !== undefined).map((f) => {
    const a = f.oStart - demo.oStart;
    const b = f.oEnd - demo.oStart;
    return { a, b, r: Math.max(0.05, Math.min(0.45, (b - a) / 3)), z: Math.max(1, Math.min(3, 1 / (Math.max(f.rect.w, f.rect.h) * 1.15))), cx: f.rect.x + f.rect.w / 2, cy: f.rect.y + f.rect.h / 2 };
  });
}

/** Vùng clip đang hiển thị tại giây t (từ đầu cửa sổ demo): z là mức zoom, (x0, y0) là góc trái trên của vùng nhìn theo tọa độ clip. Cùng công thức với biểu thức ffmpeg của focusFilters. */
export function viewAt(list, t) {
  let z = 1;
  let cx = 0.5;
  let cy = 0.5;
  for (const f of list) {
    const w = ease(clamp01((t - f.a) / f.r)) * ease(clamp01((f.b - t) / f.r));
    z += w * (f.z - 1);
    cx += w * (f.cx - 0.5);
    cy += w * (f.cy - 0.5);
  }
  return { z, x0: Math.max(0, Math.min(1 - 1 / z, cx - 0.5 / z)), y0: Math.max(0, Math.min(1 - 1 / z, cy - 0.5 / z)) };
}

/** Bộ lọc ffmpeg scale rồi crop theo thời gian t của luồng clip (t = 0 ở đầu cửa sổ demo); không có vùng zoom thì chỉ scale vừa khung. */
export function focusFilters(list, rect) {
  if (!list.length) return `scale=${rect.w}:${rect.h}`;
  const e = (p) => `(3*pow(${p},2)-2*pow(${p},3))`;
  const wt = (f) => `${e(`clip((t-${n4(f.a)})/${n4(f.r)},0,1)`)}*${e(`clip((${n4(f.b)}-t)/${n4(f.r)},0,1)`)}`;
  const sum = (key, base) => `(${base}+${list.map((f) => `(${n4(f[key] - base)})*${wt(f)}`).join('+')})`;
  const z = sum('z', 1);
  const wz = `trunc(${rect.w}*${z}/2)*2`;
  const hz = `trunc(${rect.h}*${z}/2)*2`;
  return `scale=eval=frame:w='${wz}':h='${hz}',crop=${rect.w}:${rect.h}:x='max(0,min(${wz}-${rect.w},${sum('cx', 0.5)}*(${wz})-${rect.w}/2))':y='max(0,min(${hz}-${rect.h},${sum('cy', 0.5)}*(${hz})-${rect.h}/2))'`;
}

/** Quỹ đạo của một chú thích: với mỗi khung (30 khung/giây từ oStart của chú thích) hộp [x, y, w, h] theo tỉ lệ khung hình, hoặc null khi vùng đích nằm ngoài vùng đang nhìn. */
export function markTrack({ demo, mark, layout, W, H, fps }) {
  const list = focusList(demo);
  const frames = Math.max(1, Math.round((mark.oEnd - mark.oStart) * fps));
  return Array.from({ length: frames + 1 }, (_, k) => {
    const v = viewAt(list, mark.oStart + k / fps - demo.oStart);
    const x0 = (mark.rect.x - v.x0) * v.z;
    const y0 = (mark.rect.y - v.y0) * v.z;
    const x1 = (mark.rect.x + mark.rect.w - v.x0) * v.z;
    const y1 = (mark.rect.y + mark.rect.h - v.y0) * v.z;
    if (x1 <= 0 || y1 <= 0 || x0 >= 1 || y0 >= 1) return null;
    return [(layout.x + x0 * layout.w) / W, (layout.y + y0 * layout.h) / H, ((x1 - x0) * layout.w) / W, ((y1 - y0) * layout.h) / H].map((x) => Number(x.toFixed(5)));
  });
}

// Mặt nạ hình chữ nhật bo góc: 255 trong hình, 0 ngoài, viền mềm 1 px; (cx, cy) tâm, hw và hh nửa rộng và nửa cao, r bán kính góc
const roundedMask = (cx, cy, hw, hh, r) => `255*max(0,min(1,${n4(r)}-hypot(max(abs(X-${n4(cx)})-${n4(hw - r)},0),max(abs(Y-${n4(cy)})-${n4(hh - r)},0))+0.5))`;
const rgbExpr = (theme, dot, W, H) => {
  const pitch = Math.max(8, Math.round(dot.pitch * Math.min(W, H)));
  const radius = Math.max(1.2, dot.radius * Math.min(W, H));
  const inDot = `lt(hypot(mod(X,${pitch})-${pitch / 2},mod(Y,${pitch})-${pitch / 2}),${n4(radius)})`;
  return ['r', 'g', 'b'].map((c, i) => `${c}='lerp(${theme.bg.from[i]},${theme.bg.to[i]},(X/W+Y/H)/2)-${inDot}*(${dot.shade[i]})'`).join(':');
};

/**
 * Dựng nền tĩnh của một cảnh demo vào thư mục dir: plate.png (nền hoa văn, bóng và viền khung, kích thước W x H) và mask.png (mặt nạ bo góc cỡ khung clip).
 * Mọi thứ vẽ bằng mã (geq, gblur), không dùng ảnh có sẵn. Cùng thông số thì dùng lại tệp.
 */
export function buildPlate({ theme, W, H, rect, dir }) {
  fs.mkdirSync(dir, { recursive: true });
  const U = Math.min(W, H);
  const fr = theme.frame;
  const radius = fr.radius * U;
  const grow = Math.max(2, fr.borderWidth * U);
  const key = JSON.stringify([theme, W, H, rect]);
  const stamp = path.join(dir, 'plate.key');
  const plate = path.join(dir, 'plate.png');
  const mask = path.join(dir, 'mask.png');
  if (fs.existsSync(plate) && fs.existsSync(mask) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === key) return { plate, mask };
  const bg = path.join(dir, 'bg.png');
  const ring = path.join(dir, 'ring.png');
  ffmpeg(['-f', 'lavfi', '-i', `color=c=black:s=${W}x${H},format=rgb24`, '-vf', `geq=${rgbExpr(theme, theme.bg.dot, W, H)}`, '-frames:v', '1', bg], 'nền demo');
  ffmpeg(['-f', 'lavfi', '-i', `color=c=black:s=${rect.w}x${rect.h},format=gray`, '-vf', `geq=lum='${roundedMask(rect.w / 2, rect.h / 2, rect.w / 2, rect.h / 2, radius)}'`, '-frames:v', '1', mask], 'mặt nạ khung');
  ffmpeg(['-f', 'lavfi', '-i', `color=c=black:s=${W}x${H},format=gray`, '-vf', `geq=lum='${roundedMask(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w / 2 + grow, rect.h / 2 + grow, radius + grow)}'`, '-frames:v', '1', ring], 'viền khung');
  const dy = Math.round(fr.shadowDy * U);
  ffmpeg([
    '-i', bg, '-i', ring, '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H},format=rgb24`, '-f', 'lavfi', '-i', `color=c=${fr.border}:s=${W}x${H},format=rgb24`,
    '-filter_complex', `[1:v]gblur=sigma=${n4(fr.shadowBlur * U)},lut=y='val*${fr.shadowAlpha}',pad=${W}:${H}:0:${dy}:color=black,crop=${W}:${H}:0:0[sm];[2:v][sm]alphamerge[shadow];[3:v][1:v]alphamerge[border];[0:v][shadow]overlay[a];[a][border]overlay,format=rgb24[plate]`,
    '-map', '[plate]', '-frames:v', '1', plate
  ], 'nền và khung demo');
  fs.writeFileSync(stamp, key);
  return { plate, mask };
}
