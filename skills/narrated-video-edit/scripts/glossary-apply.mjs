// Áp lại từ điển tên riêng lên bản phiên âm gốc mà không phiên âm hay dò mặt lại (CỔNG 1: người dùng xác nhận "Cloud là Claude" xong chạy lệnh này).
// Chạy: node glossary-apply.mjs --analysis work/analysis [--terms "Claude, GSAP"] [--glossary work/glossary.json]
// Đọc words.raw.json, ghi lại words.json và glossary-report.json. Chữ sửa tay trong words.json sẽ mất: sửa tay thì thêm mục vào work/glossary.json thay vì sửa words.json.
import fs from 'node:fs';
import path from 'node:path';
import { args } from './common.mjs';
import { glossaryPass } from './glossary-lib.mjs';

const { flags } = args();
if (!flags.analysis) { console.error('Dùng: node glossary-apply.mjs --analysis work/analysis [--terms "Claude, GSAP"] [--glossary work/glossary.json]'); process.exit(2); }
const dir = path.resolve(String(flags.analysis));
if (!fs.existsSync(path.join(dir, 'words.raw.json'))) { console.error(`Thiếu ${path.join(dir, 'words.raw.json')}: chạy analyze.mjs trước (bản phân tích cũ chưa có từ điển).`); process.exit(1); }
const terms = flags.terms ? String(flags.terms).split(',') : [];
const report = glossaryPass(dir, { projectFile: path.resolve(String(flags.glossary ?? path.join(dir, '..', 'glossary.json'))), terms });
console.log(`Đã thay ${report.applied.length} từ theo từ điển${report.declared.length ? ` (đã khai: ${report.declared.join(', ')})` : ''}.`);
report.pending.forEach((p) => console.log(`CHƯA THAY, cần người dùng xác nhận: ${p.question}`));
