#!/usr/bin/env node
// style-ledger.mjs - Sổ phong cách: nhớ các thiết kế đã làm (video hoặc website), ép thiết kế mới KHÁC, và gợi ý hạt giống sáng tạo chưa dùng.
//   node scripts/style-ledger.mjs list
//   node scripts/style-ledger.mjs seed --subject "chủ đề" [--n 3]        gợi ý n tổ hợp ý tưởng chưa dùng (chưa phải thiết kế, chỉ là hạt giống để bạn phát triển)
//   node scripts/style-ledger.mjs check dna.json [--last 3] [--min 5]    so với các thiết kế gần nhất, trượt (mã 1) nếu quá giống
//   node scripts/style-ledger.mjs add dna.json                           ghi thiết kế đã chốt vào sổ
// Mỗi skill một sổ: ~/.<tên thư mục skill>/style-ledger.json (đổi bằng biến STYLE_LEDGER). Không để trong thư mục skill vì đồng bộ skill ghi đè tệp đó và sổ là của từng người dùng.
// Tệp này thuộc lõi chung ai_skills_package/_creative-core: sửa ở đó rồi chạy scripts/sync_skills.mjs, đừng sửa bản chép trong skill.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ledgerPath = process.env.STYLE_LEDGER || path.join(os.homedir(), '.' + path.basename(path.resolve(here, '..')), 'style-ledger.json');
const seedsPath = path.join(here, '..', 'templates', 'creative-seeds.json');
const a = process.argv.slice(2), cmd = a[0];
const flag = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
const load = () => fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : { entries: [] };
const save = l => { fs.mkdirSync(path.dirname(ledgerPath), { recursive: true }); fs.writeFileSync(ledgerPath, JSON.stringify(l, null, 2)); };

function hue(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.08) return -1;   // gần trung tính
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return (h + 360) % 360;
}
const hueDiff = (x, y) => { if (x == null || y == null) return 180; if (x < 0 && y < 0) return 0; if (x < 0 || y < 0) return 90; const d = Math.abs(x - y); return Math.min(d, 360 - d); };
const norm = s => String(s || '').trim().toLowerCase();

const AXES = [
  ['chất liệu', (A, B) => norm(A.material) !== norm(B.material)],
  ['màu nhấn / chế độ sáng tối', (A, B) => A.mode !== B.mode || hueDiff(hue(A.palette?.accent), hue(B.palette?.accent)) >= 50],
  ['kiểu nền', (A, B) => norm(A.bgType) !== norm(B.bgType)],
  ['phông tiêu đề', (A, B) => norm(A.fonts?.display) !== norm(B.fonts?.display)],
  ['bố cục', (A, B) => norm(A.layoutGrammar) !== norm(B.layoutGrammar)],
  ['chuyển động chữ ký', (A, B) => norm(A.motionSignature) !== norm(B.motionSignature)],
  ['chuyển cảnh chữ ký', (A, B) => norm(A.transitionSignature) !== norm(B.transitionSignature)],
  ['vật thể chủ đạo', (A, B) => norm(A.heroObject) !== norm(B.heroObject)]
];

if (cmd === 'list') {
  const l = load(); console.log(`${l.entries.length} phong cách đã dùng:`);
  l.entries.forEach((e, i) => console.log(`${String(i + 1).padStart(2)}. ${e.date || '?'}  ${e.name}  [${e.material}; ${e.mode}; ${e.bgType}; ${e.fonts?.display}; ${e.motionSignature}]`));
} else if (cmd === 'check') {
  const dna = JSON.parse(fs.readFileSync(a[1], 'utf8')); const l = load(); const N = +flag('last', 3), MIN = +flag('min', 5);
  const prev = l.entries.slice(-N); let fail = false;
  if (!prev.length) console.log('Sổ trống, không có gì để so.');
  for (const p of prev) {
    const res = AXES.map(([n, f]) => [n, f(dna, p)]); const diff = res.filter(r => r[1]).length;
    console.log(`\nSo với "${p.name}" (${p.date}): khác ${diff}/${AXES.length} trục (cần ≥ ${MIN})`);
    res.forEach(([n, ok]) => console.log(`  ${ok ? 'khác  ' : 'GIỐNG '} ${n}`));
    if (diff < MIN) fail = true;
  }
  const last = prev[prev.length - 1];
  if (last) {
    if (norm(dna.fonts?.display) === norm(last.fonts?.display)) { console.log('\nLỖI: phông tiêu đề trùng thiết kế gần nhất.'); fail = true; }
    if (dna.mode === last.mode && hueDiff(hue(dna.palette?.accent), hue(last.palette?.accent)) < 50) { console.log('LỖI: màu nhấn và chế độ sáng/tối trùng thiết kế gần nhất.'); fail = true; }
  }
  const miss = ['material', 'mode', 'bgType', 'layoutGrammar', 'heroObject', 'motionSignature', 'transitionSignature'].filter(k => !dna[k]).concat(dna.fonts?.display ? [] : ['fonts.display']);
  if (miss.length) { console.log('Thiếu trường: ' + miss.join(', ')); fail = true; }
  console.log(fail ? '\nKẾT LUẬN: CHƯA ĐỦ KHÁC. Đổi ý tưởng rồi kiểm lại.' : '\nKẾT LUẬN: đủ khác các thiết kế gần nhất.');
  process.exit(fail ? 1 : 0);
} else if (cmd === 'add') {
  const dna = JSON.parse(fs.readFileSync(a[1], 'utf8')); const l = load(); dna.date = dna.date || new Date().toISOString().slice(0, 10);
  l.entries.push(dna); save(l); console.log(`Đã ghi "${dna.name}" vào ${ledgerPath} (tổng ${l.entries.length}).`);
} else if (cmd === 'seed') {
  const seeds = JSON.parse(fs.readFileSync(seedsPath, 'utf8')); const l = load(); const used = l.entries.slice(-6);
  const usedSet = k => new Set(used.map(e => norm(e[k])));
  const subject = flag('subject', 'video'); const n = +flag('n', 3); const day = new Date().toISOString().slice(0, 10);
  const taken = {};   // trong một lần gọi, các ý không được trùng nhau ở cùng một trục
  const pick = (list, key, i, getName = x => x) => {
    const u = usedSet(key); const t = (taken[key] = taken[key] || new Set());
    let pool = list.filter(x => !u.has(norm(getName(x))) && !t.has(norm(getName(x)))); if (!pool.length) pool = list.filter(x => !t.has(norm(getName(x)))); if (!pool.length) pool = list;
    const h = parseInt(crypto.createHash('sha1').update(`${subject}|${day}|${key}|${i}`).digest('hex').slice(0, 8), 16); const r = pool[h % pool.length]; t.add(norm(getName(r))); return r;
  };
  const lastFont = used.length ? norm(used[used.length - 1].fonts?.display) : '';
  console.log(`Hạt giống cho "${subject}" (đã loại các mục dùng trong ${used.length} thiết kế gần nhất). Đây là điểm xuất phát, hãy phát triển thành thiết kế riêng, đừng chép nguyên.\n`);
  for (let i = 0; i < n; i++) {
    let tp = pick(seeds.typePairing, 'fonts.display', i, x => x.display); if (norm(tp.display) === lastFont) tp = seeds.typePairing.find(x => norm(x.display) !== lastFont);
    console.log(`Ý ${i + 1}:`);
    console.log(`  chất liệu          : ${pick(seeds.material, 'material', i)}`);
    console.log(`  logic màu          : ${pick(seeds.paletteLogic, 'palette', i)}`);
    console.log(`  bố cục             : ${pick(seeds.layoutGrammar, 'layoutGrammar', i)}`);
    console.log(`  vật thể chủ đạo    : ${pick(seeds.heroObject, 'heroObject', i)}`);
    console.log(`  chuyển động chữ ký : ${pick(seeds.motionSignature, 'motionSignature', i)}`);
    console.log(`  chuyển cảnh chữ ký : ${pick(seeds.transitionSignature, 'transitionSignature', i)}`);
    console.log(`  cặp phông (có tiếng Việt): ${tp.name} = ${tp.display} / ${tp.label} / ${tp.body}\n`);
  }
} else { console.log('Dùng: list | seed --subject "..." | check dna.json | add dna.json'); process.exit(1); }
