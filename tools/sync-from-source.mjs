// Đồng bộ skill từ kho nguồn (Motion Atlas: ai_skills_package/narrated-video-edit) vào skills/narrated-video-edit của kho này.
// Chạy: node tools/sync-from-source.mjs <thư mục skill nguồn> [--dry]
// Việc làm: chép cây thư mục (bỏ node_modules, .venv, .venv-seg, .selftest), đổi CRLF thành LF cho tệp văn bản
// (khớp .gitattributes nên zip dựng ở máy nào cũng giống nhau), áp sáu chú thích "skill đồng hành không kèm theo gói"
// (xem STANDALONE_NOTES), xóa tệp đã bị xóa ở nguồn, rồi chạy tools/validate-skill.mjs.
// Chạy lặp lại cho cùng một nguồn thì không đổi gì (idempotent): kiểm bằng `git status`.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'skills', 'narrated-video-edit');
const argv = process.argv.slice(2);
const src = argv.find((a) => !a.startsWith('--'));
const dry = argv.includes('--dry');
if (!src || !fs.existsSync(path.join(src, 'SKILL.md'))) {
  console.error('Dùng: node tools/sync-from-source.mjs <thư mục skill nguồn có SKILL.md> [--dry]');
  process.exit(1);
}

const skip = (rel) => /(^|\/)(node_modules|\.venv|\.venv-seg|\.selftest|__pycache__)(\/|$)/.test(rel);
const textExt = new Set(['.md', '.mjs', '.js', '.py', '.json', '.css', '.html', '.txt', '.yml', '.yaml', '.svg']);
const list = (base, cur = base) => fs.readdirSync(cur, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(cur, e.name);
  const rel = path.relative(base, full).split(path.sep).join('/');
  if (skip(rel)) return [];
  return e.isDirectory() ? list(base, full) : [rel];
});

// Sáu chỗ nhắc skill đồng hành beat-synced-video-edit (không nằm trong gói này).
const STANDALONE_NOTES = [
  ['references/01-intake.md', '(dùng `beat-synced-video-edit` nếu chỉ có nhạc)', '(nếu chỉ có nhạc, dùng skill đồng hành `beat-synced-video-edit` của kho Motion Atlas, không kèm theo gói này)'],
  ['references/03-planning.md', '(xem `beat-synced-video-edit/references/14-learn-from-reference.md`)', '(ghi trong skill đồng hành `beat-synced-video-edit` của kho Motion Atlas, không kèm theo gói này)'],
  ['references/12-effects.md', '(xem cả `beat-synced-video-edit/references/11-editing-research.md`)', '(xem cả `references/11-editing-research.md` của skill đồng hành `beat-synced-video-edit` trong kho Motion Atlas, không kèm theo gói này)'],
  ['references/12-effects.md', 'Với video có nhạc nền, dùng `beat-synced-video-edit`.', 'Với video có nhạc nền, dùng skill đồng hành `beat-synced-video-edit` (kho Motion Atlas, không kèm theo gói này).'],
  ['SKILL.md', 'dùng `beat-synced-video-edit/scripts/reference-study.mjs --words`', 'dùng `scripts/reference-study.mjs --words` của skill đồng hành `beat-synced-video-edit` (kho Motion Atlas, không kèm theo gói này)'],
  ['references/08-agy-delegation.md', 'công cụ `scripts/sync-skill.mjs --to <thư mục>` của các skill khác trong repo làm việc này', 'công cụ `scripts/sync-skill.mjs --to <thư mục>` kèm theo skill này']
];

const srcFiles = list(src);
let written = 0;
let notes = 0;
const out = new Map();
for (const rel of srcFiles) {
  let data = fs.readFileSync(path.join(src, rel));
  if (textExt.has(path.extname(rel).toLowerCase())) data = Buffer.from(data.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  out.set(rel, data);
}
for (const [rel, from, to] of STANDALONE_NOTES) {
  const buf = out.get(rel);
  if (!buf) { console.warn(`Không thấy ${rel} ở nguồn`); continue; }
  const s = buf.toString('utf8');
  if (s.includes(from)) { out.set(rel, Buffer.from(s.replace(from, to), 'utf8')); notes += 1; }
  else if (!s.includes(to)) console.warn(`Chú thích không khớp trong ${rel}: nguồn đã đổi, cần cập nhật STANDALONE_NOTES`);
}

if (!dry) {
  fs.mkdirSync(dest, { recursive: true });
  for (const [rel, data] of out) {
    const target = path.join(dest, rel);
    const same = fs.existsSync(target) && fs.readFileSync(target).equals(data);
    if (same) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    written += 1;
  }
  const removed = list(dest).filter((rel) => !out.has(rel));
  for (const rel of removed) fs.rmSync(path.join(dest, rel));
  console.log(`${out.size} tệp từ nguồn, ${written} tệp đã ghi, ${removed.length} tệp đã xóa, ${notes} chú thích áp dụng.`);
  const v = spawnSync(process.execPath, [path.join(root, 'tools', 'validate-skill.mjs')], { stdio: 'inherit' });
  process.exit(v.status ?? 1);
}
console.log(`[dry] ${out.size} tệp từ nguồn, ${notes} chú thích sẽ áp dụng.`);
