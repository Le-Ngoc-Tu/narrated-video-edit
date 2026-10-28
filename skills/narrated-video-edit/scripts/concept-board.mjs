#!/usr/bin/env node
// concept-board.mjs - Dựng bảng ý tưởng (concept board) từ các tệp DNA thiết kế ORIGINAL, không dùng preset.
// Mỗi DNA thành một khung dọc 540x960 (nền, khung viền, phông, màu, vật thể chủ đạo), ghép cạnh nhau để người dùng chọn.
//   node scripts/concept-board.mjs a.json b.json c.json --css fnt/fonts.css --title "Tên chủ đề" --sub "một câu mô tả" --out concepts.png
// Phông trong DNA (fonts.display/label/body) phải có trong tệp CSS do `fontpack.mjs` sinh (họ chữ trùng tên fontsource).
// Đây là KHUNG XEM NHANH để chọn hướng. Thiết kế thật vẫn do bạn viết tay trong composition.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchChrome } from './creative-chrome.mjs';

const a = process.argv.slice(2);
const flag = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
const files = a.filter((x, i) => x.endsWith('.json') && !a[i - 1]?.startsWith('--'));
if (!files.length) { console.error('Dùng: node scripts/concept-board.mjs a.json b.json c.json --css fnt/fonts.css --title "..." --out concepts.png'); process.exit(1); }
const css = flag('css'), title = flag('title', 'Tiêu đề chủ đề'), sub = flag('sub', 'Một câu mô tả ngắn gọn.'), out = path.resolve(flag('out', 'concepts.png'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const words = title.split(/\s+/); const half = Math.ceil(words.length / 2); const t1 = words.slice(0, half).join(' '), t2 = words.slice(half).join(' ');

function bg(d) {
  const p = d.palette, ink = p.ink;
  switch (d.bgType) {
    case 'grain': { const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .3 0 0 0 0 .22 0 0 0 0 .14 0 0 0 .5 0"/></filter><rect width="260" height="260" filter="url(#n)"/></svg>'; return `background:${p.bg};background-image:url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}');`; }
    case 'halftone': return `background:${p.bg};background-image:radial-gradient(circle,${p.accent2} 1.4px,transparent 1.9px);background-size:11px 11px;`;
    case 'grid': return `background:${p.bg};background-image:linear-gradient(${ink}22 1px,transparent 1px),linear-gradient(90deg,${ink}22 1px,transparent 1px);background-size:36px 36px;`;
    case 'gradient': return `background:linear-gradient(160deg,${p.bg},${p.accent2});`;
    case 'stripes': return `background:${p.bg};background-image:repeating-linear-gradient(135deg,${p.accent}22 0 14px,transparent 14px 28px);`;
    default: return `background:${p.bg};`;
  }
}
function frame(d) {
  const c = d.palette.ink;
  if (d.frame === 'double-rule') return `<div style="position:absolute;inset:22px;border:1.5px solid ${c}"></div><div style="position:absolute;inset:30px;border:.7px solid ${c}88"></div>`;
  if (d.frame === 'border') return `<div style="position:absolute;inset:16px;border:6px solid ${d.palette.accent}"></div>`;
  if (d.frame === 'corner-marks') return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => `<div style="position:absolute;${x ? 'right' : 'left'}:24px;${y ? 'bottom' : 'top'}:24px;width:34px;height:34px;border-${x ? 'right' : 'left'}:2px solid ${c};border-${y ? 'bottom' : 'top'}:2px solid ${c}"></div>`).join('');
  return '';
}
const panels = files.map((f, i) => {
  const d = JSON.parse(fs.readFileSync(f, 'utf8')); const p = d.palette; const F = d.fonts || {};
  const swatches = [p.bg, p.ink, p.accent, p.accent2].map(c => `<i style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${c};border:1px solid ${p.ink}55;margin-right:6px"></i>`).join('');
  return `<div style="position:relative;width:540px;height:960px;overflow:hidden;color:${p.ink};${bg(d)}">
    ${frame(d)}
    <div style="position:absolute;left:56px;top:70px;font:500 13px '${F.label}',monospace;letter-spacing:.18em;text-transform:uppercase;color:${p.accent}">Ý ${i + 1} · ${esc(d.material)}</div>
    <div style="position:absolute;left:56px;top:130px;right:56px;font:700 64px/1.12 '${F.display}',serif;letter-spacing:-.02em">${esc(t1)}<br><span style="color:${p.accent}">${esc(t2)}</span></div>
    <div style="position:absolute;left:56px;top:330px;right:70px;font:500 20px/1.45 '${F.body}',sans-serif;opacity:.8">${esc(sub)}</div>
    <div style="position:absolute;left:56px;right:56px;top:470px;height:250px;background:${p.mode === 'dark' || d.mode === 'dark' ? p.ink + '14' : '#ffffffcc'};border:2px solid ${p.ink};padding:22px;box-shadow:8px 8px 0 ${p.accent}">
      <div style="font:500 12px '${F.label}',monospace;letter-spacing:.16em;text-transform:uppercase;opacity:.7">${esc(d.heroObject)}</div>
      <div style="font:700 40px/1.1 '${F.display}',serif;margin-top:14px">${esc(d.motionSignature)}</div>
      <div style="font:500 16px/1.4 '${F.body}',sans-serif;margin-top:16px;opacity:.75">${esc(d.transitionSignature)}</div>
    </div>
    <div style="position:absolute;left:56px;bottom:150px">${swatches}</div>
    <div style="position:absolute;left:56px;bottom:100px;right:56px;font:500 12px '${F.label}',monospace;letter-spacing:.1em;text-transform:uppercase;opacity:.75">${esc(F.display)} · ${esc(F.body)} · ${esc(F.label)}</div>
    <div style="position:absolute;left:56px;bottom:62px;font:700 22px '${F.display}',serif">${esc(d.name)}</div>
  </div>`;
}).join('<div style="width:6px;background:#555"></div>');
const html = `<style>${css ? `@import url(${pathToFileURL(path.resolve(css)).href});` : ''}body{margin:0;background:#555;display:flex}</style>${panels}`;
const tmp = path.join(path.dirname(out), '_concepts.html'); fs.writeFileSync(tmp, html);
const b = await launchChrome(); const pg = await b.newPage({ viewport: { width: 546 * files.length - 6, height: 960 } });
await pg.goto(pathToFileURL(tmp).href); await pg.waitForTimeout(1200); await pg.screenshot({ path: out }); await b.close(); fs.rmSync(tmp);
console.log('Đã ghi ' + out + ` (${files.length} ý tưởng). Mở và xem, rồi hỏi người dùng chọn một.`);
