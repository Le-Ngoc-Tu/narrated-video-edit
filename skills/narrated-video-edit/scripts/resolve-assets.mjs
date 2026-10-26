// Khâu C: tìm và tải tài nguyên cho các cutaway từ nguồn CÓ GIẤY PHÉP, ghi công đầy đủ vào assets/credits.json.
// Chạy: node resolve-assets.mjs --plan work/edit-plan.json [--user-assets dir] [--sources commons,openverse,nasa,cleveland] [--kind image|video|auto]
//        [--allow cc0,pd,by] [--limit 6] [--dry] [--only c01,c02]
// Thứ tự: thư mục của người dùng, rồi các nguồn công khai không cần khóa. Chỉ nhận giấy phép trong --allow (mặc định CC0, miền công cộng, CC BY).
// --dry chỉ tìm và ghi candidates.json, không tải. Truy vấn gửi đi là từ khóa rút từ lời nói: người dùng cần biết điều đó.
// Nguồn công khai khai báo ở data/asset-sources.json (thêm nguồn kiểu jsonApi không cần sửa mã). Tài nguyên tác tử tự tìm ngoài danh sách: --register (xem references/04-assets-licenses.md).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { args, launchChrome, readJson, skillRoot, writeJson } from './common.mjs';

// Nguồn, giấy phép nhận và giới hạn nằm ở data/asset-sources.json: thêm nguồn kiểu jsonApi chỉ cần thêm một mục dữ liệu
const CFG = readJson(path.join(skillRoot, 'data', 'asset-sources.json'));
const UA = CFG.defaults.userAgent; // phải là ASCII: tiêu đề HTTP không nhận chữ có dấu
const DEFAULT_ALLOW = CFG.defaults.allow;

const getJson = async (url, headers = {}) => {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json', ...headers }, signal: AbortSignal.timeout(CFG.defaults.timeoutMs) });
  if (!r.ok) throw new Error(`${r.status} ${url.slice(0, 90)}`);
  return r.json();
};
const strip = (html) => String(html ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

const LICENSE_RULES = CFG.licenseRules.map((r) => ({ re: new RegExp(r.match, 'i'), key: r.key }));
/** Chuẩn hóa tên giấy phép về cc0 | pd | by | by-sa | by-nc | by-nd | other theo data/asset-sources.json (licenseRules, thử lần lượt). */
/** Tên giấy phép dễ đọc cho dòng ghi công: mã CC của API (by, by-sa, cc0, pdm) thành "CC BY 2.0", "CC0 1.0", "Public Domain Mark 1.0". */
export function ccName(license, version) {
  const l = String(license ?? '').trim().toLowerCase();
  const v = String(version ?? '').trim();
  if (/^by(-(sa|nd|nc|nc-sa|nc-nd))?$/.test(l)) return `CC ${l.toUpperCase()}${v ? ` ${v}` : ''}`;
  if (l === 'cc0') return `CC0 ${v || '1.0'}`;
  if (l === 'pdm') return `Public Domain Mark ${v || '1.0'}`;
  return `${license ?? ''} ${version ?? ''}`.trim();
}

export function licenseKey(text) {
  const t = String(text ?? '').toLowerCase();
  return LICENSE_RULES.find((r) => r.re.test(t))?.key ?? 'other';
}

/** Lấy giá trị theo đường dẫn chấm: a.b, a[0].b (phần tử đầu), a[].b (ghép các phần tử bằng dấu cách). */
function pick(obj, parts) {
  if (!parts.length) return obj;
  const [head, ...rest] = parts;
  const m = head.match(/^([^[\]]+)(?:\[(\d*)\])?$/);
  if (!m) return undefined;
  const value = obj?.[m[1]];
  if (m[2] === undefined) return pick(value, rest);
  if (m[2] === '') return Array.isArray(value) ? value.map((v) => pick(v, rest)).filter((x) => x !== undefined && x !== null && x !== '').join(' ') : undefined;
  return pick(value?.[Number(m[2])], rest);
}
const at = (obj, p) => pick(obj, String(p).split('.'));
const pageSizeOf = (cfg, limit) => Math.min(Math.ceil(limit * (cfg.pageSize?.factor ?? 1)), cfg.pageSize?.max ?? limit);

// Bộ chuyển đổi theo type của nguồn trong data/asset-sources.json. jsonApi: khai báo thuần; commons, nasa: API hai bước cần mã riêng.
const ADAPTERS = {
  jsonApi: (cfg, name) => async (query, { limit }) => {
    const j = await getJson(cfg.url.replace('{query}', encodeURIComponent(query)).replace('{pageSize}', String(pageSizeOf(cfg, limit))));
    let rows = at(j, cfg.results);
    if (!Array.isArray(rows)) return [];
    if (cfg.where) rows = rows.filter((r) => Object.entries(cfg.where).every(([k, v]) => at(r, k) === v));
    return rows.map((r) => {
      const f = Object.fromEntries(Object.entries(cfg.fields).map(([k, p]) => [k, at(r, p)]));
      const url = cfg.urlTemplate ? cfg.urlTemplate.replace(/\{([\w.]+)\}/g, (_, p) => at(r, p) ?? '') : f.url;
      const raw = cfg.const?.license ?? f.license;
      return { source: name, kind: 'image', id: String(f.id), title: f.title ?? '', description: strip(f.description), url, thumb: f.thumb, width: Number(f.width) || 0, height: Number(f.height) || 0, page: f.page, creator: f.creator ?? '', license: licenseKey(`${raw}${cfg.licenseValueSuffix?.[raw] ?? ''}`), licenseName: cfg.const?.licenseName ?? ccName(f.license, f.licenseVersion), licenseUrl: cfg.const?.licenseUrl ?? f.licenseUrl ?? '' };
    }).filter((x) => x.url);
  },
  commons: (cfg) => async (query, { kind, limit }) => {
    const video = kind === 'video';
    const base = `${cfg.endpoint}?action=query&format=json&generator=search&gsrnamespace=6&origin=*`;
    const q = `${query} filetype:${video ? 'video' : 'bitmap'}`;
    const prop = video ? 'videoinfo&viprop=url|size|mime|extmetadata|derivatives' : `imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=${cfg.imageWidth}`;
    const j = await getJson(`${base}&gsrsearch=${encodeURIComponent(q)}&gsrlimit=${pageSizeOf(cfg, limit)}&prop=${prop}`);
    const [minW, maxW] = cfg.videoWidthRange;
    return Object.values(j.query?.pages ?? {}).map((p) => {
      const info = (p.videoinfo ?? p.imageinfo ?? [])[0];
      if (!info) return null;
      const meta = info.extmetadata ?? {};
      const lic = meta.LicenseShortName?.value ?? '';
      let url = info.thumburl ?? info.url;
      let width = info.thumbwidth ?? info.width;
      let height = info.thumbheight ?? info.height;
      if (video) {
        const ds = (info.derivatives ?? []).filter((d) => /webm|mp4/.test(d.type ?? '') && d.width >= minW && d.width <= maxW).sort((a, b) => b.width - a.width);
        if (!ds.length) return null;
        url = ds[0].src; width = ds[0].width; height = ds[0].height;
      }
      return { source: 'commons', kind: video ? 'video' : 'image', id: String(p.pageid), title: p.title.replace(/^File:/, ''), description: strip(meta.ImageDescription?.value), url, width, height, duration: info.duration, page: info.descriptionurl, creator: strip(meta.Artist?.value), license: licenseKey(lic), licenseName: lic, licenseUrl: meta.LicenseUrl?.value ?? '' };
    }).filter(Boolean);
  },
  nasa: (cfg) => async (query, { kind, limit }) => {
    const j = await getJson(`${cfg.searchUrl}?q=${encodeURIComponent(query)}&media_type=${kind === 'video' ? 'video' : 'image'}&page_size=${Math.min(limit, cfg.pageSizeMax)}`);
    const items = (j.collection?.items ?? []).slice(0, limit);
    const out = [];
    for (const it of items) {
      const d = it.data?.[0];
      if (!d) continue;
      let url = it.links?.find((l) => l.rel === 'preview')?.href;
      try {
        const manifest = await getJson(`${cfg.assetUrl}${encodeURIComponent(d.nasa_id)}`);
        const files = (manifest.collection?.items ?? []).map((x) => x.href);
        const pickFile = kind === 'video' ? files.find((f) => /~medium\.mp4$/i.test(f)) ?? files.find((f) => /~mobile\.mp4$/i.test(f)) : files.find((f) => /~large\.jpg$/i.test(f)) ?? files.find((f) => /~medium\.jpg$/i.test(f)) ?? files.find((f) => /~orig\.jpg$/i.test(f));
        if (pickFile) url = pickFile.replace(/^http:/, 'https:');
      } catch { /* dùng bản xem trước */ }
      if (!url) continue;
      out.push({ source: 'nasa', kind: kind === 'video' ? 'video' : 'image', id: d.nasa_id, title: d.title, description: d.description?.slice(0, 300) ?? '', url, thumb: it.links?.find((l) => l.rel === 'preview')?.href, width: 0, height: 0, page: `${cfg.pageUrl}${encodeURIComponent(d.nasa_id)}`, creator: d.photographer ?? d.secondary_creator ?? d.center ?? 'NASA', license: 'pd', licenseName: cfg.licenseName, licenseUrl: cfg.licenseUrl });
    }
    return out;
  }
};
export const SOURCES = Object.fromEntries(Object.entries(CFG.sources).map(([name, cfg]) => [name, { kinds: cfg.kinds, search: ADAPTERS[cfg.type](cfg, name) }]));

/** Chấm điểm một ứng viên theo độ khớp chữ với truy vấn, độ phân giải và hướng khung. Hàm thuần để selftest kiểm. */
export function score(candidate, query, orientation = '9x16') {
  const terms = String(query).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 2);
  const hay = `${candidate.title} ${candidate.description}`.toLowerCase();
  const hits = terms.filter((t) => hay.includes(t)).length;
  const textScore = terms.length ? hits / terms.length : 0;
  const w = candidate.width || 0;
  const h = candidate.height || 0;
  const resScore = Math.min(1, Math.max(w, h) / 1920);
  const portrait = h > w;
  const wantPortrait = orientation === '9x16';
  const aspectScore = !w ? 0.5 : portrait === wantPortrait ? 1 : 0.6;
  const licenseScore = { cc0: 1, pd: 1, by: 0.9 }[candidate.license] ?? 0;
  return Number((textScore * 3 + resScore + aspectScore * 0.5 + licenseScore * 0.5).toFixed(3));
}

export const allowed = (candidate, allow) => allow.includes(candidate.license);

async function download(url, file) {
  const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(CFG.defaults.downloadTimeoutMs) });
  if (!r.ok) throw new Error(`tải lỗi ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(file, buf);
  return { bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
}
const extOf = (url, kind) => (url.split('?')[0].match(/\.(jpe?g|png|webp|mp4|webm)$/i)?.[1] ?? (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase();

async function sheet(entries, outFile) {
  const cells = entries.map((e) => `<figure><img src="${pathToFileURL(e.abs)}"><figcaption><b>${e.id}</b> ${e.query}<br>${e.title}<br><i>${e.licenseName ?? e.license} · ${e.source}</i></figcaption></figure>`).join('');
  const html = `<html><body style="margin:0;background:#111;color:#eee;font:14px Arial"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:10px">${cells}</div><style>figure{margin:0}img,video{width:100%;height:260px;object-fit:cover}figcaption{padding:4px}</style></body></html>`;
  const tmp = outFile.replace(/\.png$/, '.html');
  fs.writeFileSync(tmp, html);
  const browser = await launchChrome();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.goto(pathToFileURL(tmp).href);
    await page.waitForTimeout(800);
    await page.screenshot({ path: outFile, fullPage: true });
  } finally { await browser.close(); }
  fs.rmSync(tmp, { force: true });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { flags } = args();
  if (!flags.plan) { console.error('Dùng: node resolve-assets.mjs --plan work/edit-plan.json [--user-assets dir] [--sources commons,openverse,nasa] [--allow cc0,pd,by] [--dry]'); process.exit(2); }
  const planFile = path.resolve(String(flags.plan));
  const plan = readJson(planFile);
  const base = path.dirname(planFile);
  const outDir = path.join(base, 'assets');
  fs.mkdirSync(outDir, { recursive: true });
  const allow = String(flags.allow ?? DEFAULT_ALLOW.join(',')).split(',').map((s) => s.trim());
  if (allow.some((a) => CFG.forbiddenLicenses.includes(a))) throw new Error('Không nhận giấy phép NC, ND hay không rõ: không dùng được trong video thương mại.');
  if (allow.includes('by-sa')) console.log('Cảnh báo: BY-SA buộc chia sẻ tương tự và có thể kéo cả video vào cùng giấy phép. Chỉ dùng khi hiểu rõ.');
  const sources = String(flags.sources ?? CFG.defaults.sources.join(',')).split(',').map((s) => s.trim()).filter((s) => SOURCES[s]);
  const only = flags.only ? new Set(String(flags.only).split(',')) : null;
  const limit = Number(flags.limit ?? CFG.defaults.limit);
  const creditsFile = path.join(outDir, 'credits.json');
  const credits = fs.existsSync(creditsFile) ? readJson(creditsFile) : [];
  const userDir = flags['user-assets'] ? path.resolve(String(flags['user-assets'])) : null;
  const userFiles = userDir ? fs.readdirSync(userDir).filter((f) => /\.(jpe?g|png|webp|mp4|webm|mov)$/i.test(f)) : [];
  const report = [];
  const preview = [];

  // Đăng ký một tài nguyên do tác tử tự tìm ngoài danh sách nguồn: phải có giấy phép trong danh sách trắng, tên tác giả, trang nguồn và tiêu đề; ghi sha256 và dòng ghi công
  if (flags.register) {
    const file = path.resolve(String(flags.register));
    const c = plan.cutaways.find((x) => x.id === String(flags.cutaway));
    if (!c) throw new Error('--cutaway phải là id một cutaway trong kế hoạch (vd c03)');
    if (!fs.existsSync(file)) throw new Error(`Không thấy tệp ${file}`);
    const raw = String(flags.license ?? '');
    const key = ['cc0', 'pd', 'by'].includes(raw) ? raw : licenseKey(raw);
    if (!allow.includes(key)) throw new Error(`Giấy phép "${raw}" (nhận ra là ${key}) không nằm trong danh sách trắng ${allow.join(', ')}`);
    for (const need of ['title', 'creator', 'page']) if (!flags[need] || flags[need] === true) throw new Error(`--${need} bắt buộc: ghi tác giả và trang nguồn đã xác minh giấy phép`);
    if (key === 'by' && !flags['license-url']) throw new Error('CC BY cần --license-url (đường dẫn văn bản giấy phép) để ghi công');
    const ext = path.extname(file).toLowerCase();
    const dest = path.join(outDir, `${c.id}${ext}`);
    fs.copyFileSync(file, dest);
    const buf = fs.readFileSync(dest);
    const rel = path.relative(base, dest).replace(/\\/g, '/');
    const licenseName = String(flags['license-name'] ?? raw);
    const entry = { file: `${c.id}${ext}`, cutaway: c.id, query: c.query, title: String(flags.title), creator: String(flags.creator), license: key, licenseName, licenseUrl: String(flags['license-url'] ?? ''), source: 'manual', page: String(flags.page), credit: `"${flags.title}" của ${flags.creator}, ${licenseName}, qua ${new URL(String(flags.page)).hostname}`, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
    credits.splice(0, credits.length, ...credits.filter((x) => x.cutaway !== c.id), entry);
    c.asset = rel;
    c.kind = /\.(mp4|webm|mov)$/i.test(ext) ? 'video' : 'image';
    c.userProvided = false;
    c.status = 'resolved';
    report.push({ id: c.id, source: 'đăng ký tay', title: entry.title, license: key });
  }

  for (const c of plan.cutaways) {
    if (flags.register || (only && !only.has(c.id))) continue;
    if (c.asset && fs.existsSync(path.resolve(base, c.asset))) continue;
    // 1. Tài nguyên của người dùng: tên tệp là id cutaway hoặc chứa từ trong truy vấn
    const terms = c.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const mine = userFiles.find((f) => path.parse(f).name === c.id) ?? userFiles.find((f) => terms.some((t) => f.toLowerCase().includes(t)));
    if (mine) {
      const dest = path.join(outDir, `${c.id}${path.extname(mine).toLowerCase()}`);
      fs.copyFileSync(path.join(userDir, mine), dest);
      c.asset = path.relative(base, dest).replace(/\\/g, '/');
      c.kind = /\.(mp4|webm|mov)$/i.test(mine) ? 'video' : 'image';
      c.userProvided = true;
      c.status = 'resolved';
      report.push({ id: c.id, source: 'người dùng', file: mine });
      preview.push({ id: c.id, query: c.query, title: mine, license: 'người dùng cung cấp', source: 'user', abs: dest });
      continue;
    }
    // 2. Nguồn công khai
    const kinds = c.kind === 'video' ? ['video'] : c.kind === 'image' || flags.kind === 'image' ? ['image'] : flags.kind === 'video' ? ['video'] : ['image'];
    let pool = [];
    for (const kind of kinds) for (const name of sources) {
      if (!SOURCES[name].kinds.includes(kind)) continue;
      try { pool.push(...(await SOURCES[name].search(c.query, { kind, limit }))); } catch (e) { report.push({ id: c.id, source: name, warn: String(e.message ?? e) }); }
    }
    const safe = pool.filter((x) => allowed(x, allow) && x.url);
    const ranked = safe.map((x) => ({ ...x, score: score(x, c.query, plan.orientation) })).sort((a, b) => b.score - a.score);
    c.candidates = ranked.slice(0, 5).map(({ source, id, title, url, page, license, score: s }) => ({ source, id, title, url, page, license, score: s }));
    if (!ranked.length) { c.status = 'no-result'; report.push({ id: c.id, query: c.query, warn: `không có kết quả hợp lệ (${pool.length} kết quả, ${pool.length - safe.length} bị loại vì giấy phép)` }); continue; }
    if (flags.dry) { c.status = 'candidates'; continue; }
    const best = ranked[0];
    const file = path.join(outDir, `${c.id}.${extOf(best.url, best.kind)}`);
    try {
      const got = await download(best.url, file);
      c.asset = path.relative(base, file).replace(/\\/g, '/');
      c.kind = best.kind;
      c.status = 'resolved';
      const creditText = `"${best.title}" của ${best.creator || 'không rõ tác giả'}, ${best.licenseName}, qua ${best.source}`;
      credits.splice(0, credits.length, ...credits.filter((x) => x.file !== path.relative(base, file).replace(/\\/g, '/').replace(/^assets\//, '')));
      credits.push({ file: `${c.id}.${extOf(best.url, best.kind)}`, cutaway: c.id, query: c.query, title: best.title, creator: best.creator, license: best.license, licenseName: best.licenseName, licenseUrl: best.licenseUrl, source: best.source, page: best.page, credit: creditText, bytes: got.bytes, sha256: got.sha256 });
      preview.push({ id: c.id, query: c.query, title: best.title, license: best.license, source: best.source, abs: file });
      report.push({ id: c.id, source: best.source, title: best.title, license: best.license, score: best.score });
    } catch (e) { c.status = 'download-failed'; report.push({ id: c.id, warn: `tải lỗi: ${e.message}` }); }
  }
  writeJson(planFile, plan);
  writeJson(creditsFile, credits);
  writeJson(path.join(base, 'candidates.json'), plan.cutaways.map((c) => ({ id: c.id, query: c.query, status: c.status, candidates: c.candidates ?? [] })));
  const lines = credits.map((x) => `${x.file}: ${x.credit}${x.page ? ` (${x.page})` : ''}`);
  fs.writeFileSync(path.join(outDir, 'credits.txt'), `${lines.join('\n')}\n`);
  // Ảnh duyệt CỔNG 2 gồm mọi cutaway đã có ảnh (tải tự động, của người dùng, hoặc đăng ký tay), không chỉ các mục của lần chạy này
  const imagePreview = plan.cutaways.filter((c) => c.asset && /\.(jpe?g|png|webp)$/i.test(c.asset)).map((c) => {
    const credit = credits.find((x) => x.cutaway === c.id);
    return { id: c.id, query: c.query, title: credit?.title ?? path.basename(c.asset), license: credit?.license ?? 'người dùng cung cấp', source: credit?.source ?? 'user', abs: path.resolve(base, c.asset) };
  });
  void preview;
  if (imagePreview.length && !flags.dry) await sheet(imagePreview, path.join(base, 'assets-sheet.png'));
  for (const r of report) console.log(r.warn ? `CẢNH BÁO ${r.id}: ${r.warn}` : `ok   ${r.id} ← ${r.source}: ${r.title ?? r.file}${r.license ? ` [${r.license}]` : ''}`);
  const missing = plan.cutaways.filter((c) => !c.asset).length;
  console.log(missing ? `\nCòn ${missing} cutaway chưa có tài nguyên: sửa truy vấn, thêm tệp vào --user-assets, hoặc bỏ cutaway đó.` : '\nMọi cutaway đã có tài nguyên. Xem assets-sheet.png: hình có đúng ngữ cảnh câu đang nói không (CỔNG 2).');
}
