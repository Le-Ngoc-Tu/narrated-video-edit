// Đồng bộ skill từ thư mục nguồn sang một hoặc nhiều nơi khác (bản sao dùng chung, thư mục skill của agy...), rồi kiểm không còn lệch.
// Chạy: node sync-skill.mjs --to <thư mục đích> [--to <thư mục đích khác>] [--dry]
// Nguồn là thư mục skill chứa tệp này. Bỏ qua node_modules, .selftest và exam/runs. Tệp đã bị xóa ở nguồn cũng bị xóa ở đích (phản chiếu).
// Mã thoát 1 nếu sau khi chép vẫn còn tệp lệch.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, '..');
const argv = process.argv.slice(2);
const targets = argv.flatMap((a, i) => (a === '--to' ? [path.resolve(argv[i + 1])] : []));
const dry = argv.includes('--dry');
if (!targets.length) { console.error('Dùng: node sync-skill.mjs --to <thư mục đích> [--to ...] [--dry]'); process.exit(1); }

const skip = (rel) => /(^|\/)(node_modules|\.selftest|\.venv|\.venv-seg)(\/|$)/.test(rel) || /^exam\/runs(\/|$)/.test(rel);
const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(dir, e.name);
  const rel = path.relative(base, full).replace(/\\/g, '/');
  if (skip(rel)) return [];
  return e.isDirectory() ? walk(full, base) : [rel];
});
const same = (a, b) => fs.existsSync(b) && fs.statSync(a).size === fs.statSync(b).size && fs.readFileSync(a).equals(fs.readFileSync(b));

const files = walk(source);
let bad = 0;
for (const target of targets) {
  if (target === source) { console.error(`Bỏ qua ${target}: trùng nguồn`); continue; }
  fs.mkdirSync(target, { recursive: true });
  const stale = fs.existsSync(target) ? walk(target).filter((f) => !files.includes(f)) : [];
  let copied = 0;
  for (const rel of files) {
    const from = path.join(source, rel);
    const to = path.join(target, rel);
    if (same(from, to)) continue;
    copied++;
    if (!dry) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); }
  }
  for (const rel of stale) if (!dry) fs.rmSync(path.join(target, rel));
  const left = dry ? copied + stale.length : files.filter((rel) => !same(path.join(source, rel), path.join(target, rel))).length + walk(target).filter((f) => !files.includes(f)).length;
  bad += left;
  console.log(`${dry ? '[thử] ' : ''}${target}: chép ${copied}, xóa ${stale.length}, còn lệch ${left}`);
}
process.exit(bad && !dry ? 1 : 0);
