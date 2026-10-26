// Kiểm skill theo đặc tả Agent Skills và các điều kiện của gói phát hành.
// Chạy: node tools/validate-skill.mjs [thư mục skill]   (mặc định: skills/narrated-video-edit)
// Mã thoát 1 nếu có FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(process.argv[2] || path.join(root, 'skills', 'narrated-video-edit'));
const results = [];
const check = (level, name, detail = '') => results.push({ level, name, detail });
const skip = (rel) => /(^|\/)(node_modules|\.venv|\.venv-seg|\.selftest)(\/|$)/.test(rel);

const walk = (base, cur = base) => fs.readdirSync(cur, { withFileTypes: true }).flatMap((e) => {
  const full = path.join(cur, e.name);
  const rel = path.relative(base, full).replace(/\\/g, '/');
  if (skip(rel)) return [];
  return e.isDirectory() ? walk(base, full) : [rel];
});

const skillFile = path.join(dir, 'SKILL.md');
if (!fs.existsSync(skillFile)) {
  console.error(`FAIL  không thấy ${skillFile}`);
  process.exit(1);
}
const text = fs.readFileSync(skillFile, 'utf8').replace(/\r\n/g, '\n');
const front = text.match(/^---\n([\s\S]*?)\n---\n/);
check(front ? 'ok' : 'fail', 'SKILL.md bắt đầu bằng khối frontmatter YAML');

const field = (key) => {
  if (!front) return '';
  const lines = front[1].split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i < 0) return '';
  const first = lines[i].slice(key.length + 1).trim();
  if (!/^[>|][+-]?$/.test(first)) return first.replace(/^["']|["']$/g, '');
  const body = [];
  for (let j = i + 1; j < lines.length && /^\s+/.test(lines[j]); j += 1) body.push(lines[j].trim());
  return body.join(' ');
};

const name = field('name');
const description = field('description');
const folder = path.basename(dir);
check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) && name.length <= 64 ? 'ok' : 'fail', 'name: chữ thường, số, gạch nối, tối đa 64 ký tự', name);
check(name === folder ? 'ok' : 'fail', 'name trùng tên thư mục chứa skill', `${name} / ${folder}`);
check(description.length > 0 && description.length <= 1024 ? 'ok' : 'fail', 'description có và không quá 1024 ký tự', `${description.length} ký tự`);
check(description.length <= 400 ? 'ok' : 'warn', 'description không quá 400 ký tự (Antigravity CLI bỏ qua skill có mô tả dài)', `${description.length} ký tự`);

const lines = text.split('\n').length;
check(lines <= 500 ? 'ok' : 'warn', 'SKILL.md không quá 500 dòng', `${lines} dòng`);

const files = walk(dir);
const missing = [...text.matchAll(/`((?:references|data|templates|scripts)\/[A-Za-z0-9_./-]+\.[a-z]+)`/g)]
  .map((m) => m[1]).filter((p) => !/[*<{]/.test(p) && !fs.existsSync(path.join(dir, p)));
check(missing.length === 0 ? 'ok' : 'fail', 'mọi tệp SKILL.md nhắc tới đều có thật', [...new Set(missing)].join(', '));

let badJson = [];
for (const f of files.filter((x) => x.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { badJson.push(`${f}: ${e.message}`); }
}
check(badJson.length === 0 ? 'ok' : 'fail', `${files.filter((x) => x.endsWith('.json')).length} tệp JSON đều hợp lệ`, badJson.join('; '));

let badSyntax = [];
for (const f of files.filter((x) => x.endsWith('.mjs') || x.endsWith('.js') && x.startsWith('scripts/'))) {
  const r = spawnSync(process.execPath, ['--check', path.join(dir, f)], { encoding: 'utf8' });
  if (r.status !== 0) badSyntax.push(f);
}
check(badSyntax.length === 0 ? 'ok' : 'fail', 'mọi script Node qua `node --check`', badSyntax.join(', '));

const secret = /(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
const textual = files.filter((x) => /\.(md|json|mjs|js|py|html|css|txt|yml|yaml)$/.test(x) && !/templates\/vendor\//.test(x));
const leaked = textual.filter((f) => secret.test(fs.readFileSync(path.join(dir, f), 'utf8')));
check(leaked.length === 0 ? 'ok' : 'fail', 'không có khóa API hay khóa riêng trong tệp văn bản', leaked.join(', '));

const personal = textual.filter((f) => !/(LICENSE|OFL|NOTICE)/i.test(path.basename(f))).filter((f) => /@gmail\.com|@outlook\.com|C:\\Users\\|\/Users\/[a-z]/i.test(fs.readFileSync(path.join(dir, f), 'utf8')));
check(personal.length === 0 ? 'ok' : 'warn', 'không lộ email hay đường dẫn cá nhân', personal.join(', '));

const needLicense = ['templates/models', 'templates/fonts', 'templates/emoji', 'templates/vendor'];
const noLicense = needLicense.filter((d) => !files.some((f) => f.startsWith(`${d}/`) && /(LICENSE|OFL|NOTICE)/i.test(path.basename(f))));
check(noLicense.length === 0 ? 'ok' : 'fail', 'mỗi thư mục tài sản bên thứ ba có tệp giấy phép', noLicense.join(', '));

const bytes = files.reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
check(bytes < 30 * 1024 * 1024 ? 'ok' : 'fail', 'tổng dung lượng dưới 30 MB', `${(bytes / 1048576).toFixed(1)} MB, ${files.length} tệp`);

let failed = 0;
for (const r of results) {
  if (r.level === 'fail') failed += 1;
  console.log(`${r.level === 'ok' ? 'ok  ' : r.level === 'warn' ? 'WARN' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
console.log(failed ? `\n${failed} mục FAIL.` : '\nSkill hợp lệ.');
process.exit(failed ? 1 : 0);
