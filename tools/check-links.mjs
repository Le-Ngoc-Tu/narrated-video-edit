// Kiểm mọi liên kết và ảnh tương đối trong các tệp .md của kho (trừ skills/) có đích thật.
// Chạy: node tools/check-links.mjs      Mã thoát 1 nếu có liên kết hỏng.
// Bỏ qua liên kết http(s) và các đường dẫn đi lên trang GitHub (../releases, ../issues, ../security).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skip = /(^|\/)(node_modules|\.cache|\.git|dist|skills)(\/|$)/;
const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (skip.test(rel)) continue;
    if (e.isDirectory()) walk(full); else if (rel.endsWith('.md')) files.push(rel);
  }
};
walk(root);

let checked = 0;
const broken = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of text.matchAll(/\]\(([^)\s]+)\)|(?:src|href)="([^"]+)"/g)) {
    const link = (m[1] || m[2]).split('#')[0];
    if (!link || /^(https?:|mailto:)/.test(link)) continue;
    if (/^(\.\.\/)+(releases|issues|security)/.test(link)) continue;
    checked += 1;
    if (!fs.existsSync(path.normalize(path.join(path.dirname(path.join(root, f)), link)))) broken.push(`${f}: ${link}`);
  }
}
for (const b of broken) console.log(`HỎNG  ${b}`);
console.log(broken.length ? `${broken.length} liên kết hỏng` : `Mọi liên kết tương đối đều có đích (${checked} liên kết, ${files.length} tệp)`);
process.exit(broken.length ? 1 : 0);
