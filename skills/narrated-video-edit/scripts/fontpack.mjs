#!/usr/bin/env node
// fontpack.mjs - Lấy phông Fontsource, KIỂM tra hỗ trợ tiếng Việt, sinh @font-face (latin + vietnamese) và ảnh mẫu thử dấu.
// Dùng:
//   node scripts/fontpack.mjs --check fraunces,playfair-display,be-vietnam-pro       chỉ kiểm có bộ ký tự tiếng Việt không
//   node scripts/fontpack.mjs fraunces:500,700,500i be-vietnam-pro:500 jetbrains-mono:400,500 --out fnt --css fnt/fonts.css [--specimen fnt/specimen.png] [--require-vi]
//     đặc tả: <tên-fontsource>:<độ đậm>[i] (hậu tố i = in nghiêng). Họ chữ trong CSS = tên fontsource (ví dụ font-family:'fraunces').
// Cần mạng lần đầu để npm tải @fontsource/<tên> vào .fontcache/ (sau đó dùng lại).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const a = process.argv.slice(2);
const flag = n => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : null; };
const V = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB';
const L = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const cache = path.resolve('.fontcache');
fs.mkdirSync(cache, { recursive: true });
if (!fs.existsSync(path.join(cache, 'package.json'))) fs.writeFileSync(path.join(cache, 'package.json'), '{"name":"fontcache","private":true}');

// Tên phông đi vào lệnh npm (có shell trên Windows), nên chỉ nhận chữ thường, số và gạch nối
const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;
function ensure(name) {
  if (!SAFE_NAME.test(name)) return null;
  const dir = path.join(cache, 'node_modules', '@fontsource', name, 'files');
  if (!fs.existsSync(dir)) {
    const r = spawnSync('npm', ['install', `@fontsource/${name}`, '--silent', '--no-audit', '--no-fund'], { cwd: cache, encoding: 'utf8', shell: process.platform === 'win32' });
    if (r.status !== 0) return null;
  }
  return fs.existsSync(dir) ? dir : null;
}
const hasVi = dir => fs.readdirSync(dir).some(f => f.includes('-vietnamese-'));

const chk = flag('check');
if (chk) {
  for (const n of chk.split(',').filter(Boolean)) {
    const d = ensure(n);
    if (!d) { console.log(`${n.padEnd(24)} KHÔNG TÌM THẤY gói @fontsource/${n} (hoặc không có mạng)`); continue; }
    const ws = [...new Set(fs.readdirSync(d).filter(f => f.includes('-latin-') && f.endsWith('-normal.woff2')).map(f => f.match(/-latin-(\d+)-normal/)?.[1]))].filter(Boolean).join(',');
    const it = fs.readdirSync(d).some(f => f.includes('-latin-') && f.includes('-italic.woff2'));
    console.log(`${n.padEnd(24)} ${hasVi(d) ? 'CÓ tiếng Việt   ' : 'KHÔNG có tiếng Việt'}  độ đậm: ${ws || '?'}${it ? '  (có nghiêng)' : ''}`);
  }
  process.exit(0);
}

const specs = a.filter(x => !x.startsWith('--') && x.includes(':') && !a[a.indexOf(x) - 1]?.startsWith('--'));
const out = path.resolve(flag('out') || 'fnt'), cssPath = path.resolve(flag('css') || path.join(out, 'fonts.css'));
if (!specs.length) { console.error('Thiếu đặc tả phông. Ví dụ: fraunces:500,700,500i be-vietnam-pro:500'); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
let css = '', bad = 0; const families = [];
for (const s of specs) {
  const [name, wl] = s.split(':'); const d = ensure(name);
  if (!d) { console.log(`LỖI: không lấy được @fontsource/${name}`); bad++; continue; }
  const vi = hasVi(d); if (!vi) { console.log(`CẢNH BÁO: ${name} KHÔNG có bộ ký tự tiếng Việt, chữ có dấu sẽ rơi sang phông dự phòng.`); bad++; }
  families.push(name);
  for (const w of wl.split(',')) {
    const italic = w.endsWith('i'), wt = w.replace('i', ''), st = italic ? 'italic' : 'normal';
    for (const [sub, rng] of [['latin', L], ['vietnamese', V]]) {
      const f = `${name}-${sub}-${wt}-${st}.woff2`;
      if (!fs.existsSync(path.join(d, f))) { if (sub === 'latin') { console.log(`LỖI: thiếu ${f}`); bad++; } continue; }
      fs.copyFileSync(path.join(d, f), path.join(out, f));
      css += `@font-face{font-family:'${name}';font-weight:${wt};font-style:${st};src:url(${path.relative(path.dirname(cssPath), path.join(out, f)).split(path.sep).join('/')}) format('woff2');unicode-range:${rng}}\n`;
    }
  }
}
fs.writeFileSync(cssPath, css);
console.log(`Đã ghi ${cssPath} (${css.split('\n').filter(Boolean).length} khai báo) và chép woff2 vào ${out}. Họ chữ: ${families.map(f => `'${f}'`).join(', ')}`);
console.log('Nhớ: khi tải phông trong trang, gọi document.fonts.load("500 20px <họ>", "Gõ một câu ấ ớ ặ ẫ") để cả bộ latin và vietnamese được nạp.');

const sp = flag('specimen');
if (sp) {
  const { launchChrome } = await import('./creative-chrome.mjs');
  const phrase1 = 'Nhấn Enter. Thiết kế hoàn chỉnh', phrase2 = 'Ấ Ế Ộ Ử ớ ợ ặ ẫ ỗ Kiểm tra trước khi giao';
  const html = `<style>@import url(${pathToFileURL(cssPath).href});body{margin:0;background:#f2eee4;color:#17130f;width:1700px;padding:30px}.r{margin-bottom:22px}.l{font:12px monospace;color:#777}.h{font-size:78px;line-height:1.15;letter-spacing:-.02em;white-space:nowrap}</style>` +
    families.map(f => `<div class="r"><div class="l">${f}</div><div class="h" style="font-family:'${f}',serif;font-weight:600">${phrase1}<br><span style="font-weight:400">${phrase2}</span></div></div>`).join('');
  const tmp = path.join(out, '_specimen.html'); fs.writeFileSync(tmp, html);
  const b = await launchChrome(); const p = await b.newPage({ viewport: { width: 1760, height: 120 + families.length * 240 } });
  await p.goto(pathToFileURL(tmp).href); await p.waitForTimeout(900);
  await p.screenshot({ path: path.resolve(sp) }); await b.close(); fs.rmSync(tmp);
  console.log('Ảnh thử dấu: ' + path.resolve(sp) + ' (mở và xem: dấu có bị dính, bị cắt, hay rơi sang phông khác không).');
}
process.exit(bad && a.includes('--require-vi') ? 2 : 0);
