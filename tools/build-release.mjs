// Đóng gói skill thành tệp zip để tải lên Claude (Settings > Skills > Upload skill) hoặc giải nén vào thư mục skill.
// Chạy: node tools/build-release.mjs [--out dist] [--version 1.0.0]
// Zip có thư mục `narrated-video-edit/` ở cấp trên cùng (đặc tả của Claude: SKILL.md đặt ngay gốc zip thì không được nhận).
// Không phụ thuộc gói ngoài; thời gian tệp cố định nên cùng nội dung cho cùng một zip (băm SHA-256 lặp lại được).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const outDir = path.resolve(root, opt('--out', 'dist'));
const version = opt('--version', JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version);
const skillName = 'narrated-video-edit';
const skillDir = path.join(root, 'skills', skillName);

const skip = (rel) => /(^|\/)(node_modules|\.venv|\.venv-seg|\.selftest|__pycache__)(\/|$)/.test(rel) || /\.(log|pyc)$/.test(rel);
const walk = (base, cur = base) => fs.readdirSync(cur, { withFileTypes: true })
  .sort((a, b) => (a.name < b.name ? -1 : 1))
  .flatMap((e) => {
    const full = path.join(cur, e.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (skip(rel)) return [];
    return e.isDirectory() ? walk(base, full) : [rel];
  });

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const entries = [];
const chunks = [];
let offset = 0;
const push = (buf) => { chunks.push(buf); offset += buf.length; };

for (const rel of walk(skillDir)) {
  const data = fs.readFileSync(path.join(skillDir, rel));
  const deflated = zlib.deflateRawSync(data, { level: 9 });
  const useDeflate = deflated.length < data.length;
  const body = useDeflate ? deflated : data;
  const nameBuf = Buffer.from(`${skillName}/${rel}`, 'utf8');
  const crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(useDeflate ? 8 : 0, 8);
  header.writeUInt16LE(DOS_TIME, 10);
  header.writeUInt16LE(DOS_DATE, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(body.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBuf.length, 26);
  header.writeUInt16LE(0, 28);
  entries.push({ nameBuf, crc, size: data.length, packed: body.length, method: useDeflate ? 8 : 0, offset });
  push(header); push(nameBuf); push(body);
}

const centralStart = offset;
for (const e of entries) {
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0);
  c.writeUInt16LE(0x031e, 4);
  c.writeUInt16LE(20, 6);
  c.writeUInt16LE(0x0800, 8);
  c.writeUInt16LE(e.method, 10);
  c.writeUInt16LE(DOS_TIME, 12);
  c.writeUInt16LE(DOS_DATE, 14);
  c.writeUInt32LE(e.crc, 16);
  c.writeUInt32LE(e.packed, 20);
  c.writeUInt32LE(e.size, 24);
  c.writeUInt16LE(e.nameBuf.length, 28);
  c.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  c.writeUInt32LE(e.offset, 42);
  push(c); push(e.nameBuf);
}
const centralSize = offset - centralStart;
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(centralStart, 16);
push(end);

fs.mkdirSync(outDir, { recursive: true });
const zipPath = path.join(outDir, `${skillName}-v${version}.zip`);
const zip = Buffer.concat(chunks);
fs.writeFileSync(zipPath, zip);
const sha = crypto.createHash('sha256').update(zip).digest('hex');
fs.writeFileSync(`${zipPath}.sha256`, `${sha}  ${path.basename(zipPath)}\n`);
console.log(`${zipPath}\n  ${entries.length} tệp, ${(zip.length / 1048576).toFixed(2)} MB\n  sha256 ${sha}`);
