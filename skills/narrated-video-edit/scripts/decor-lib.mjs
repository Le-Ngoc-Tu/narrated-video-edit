// Tải decor có giấy phép: emoji động Noto (Lottie) và icon Iconify (SVG). Mọi tệp tải về được lưu đệm; lỗi mạng trả null để lớp phủ dùng bản tĩnh.
// Danh sách trắng giấy phép và nguồn nằm ở data/decor-sources.json. Từ khóa tìm icon gửi tới api.iconify.design (nói với người dùng ở cổng 1).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readJson, skillRoot } from './common.mjs';

const sources = readJson(path.join(skillRoot, 'data', 'decor-sources.json'));
const notoMap = readJson(path.join(skillRoot, 'data', 'noto-lottie.json')).map;
const cacheDir = process.env.NVE_CACHE ? path.resolve(process.env.NVE_CACHE) : path.join(os.homedir(), '.cache', 'narrated-video-edit');
const get = async (url, as = 'text') => {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'narrated-video-edit/1.0' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === 'json' ? r.json() : r.text();
};
const cached = async (name, url, as = 'text', maxAgeDays = 365) => {
  const file = path.join(cacheDir, name);
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < maxAgeDays * 86400000) return as === 'json' ? readJson(file) : fs.readFileSync(file, 'utf8');
  const body = await get(url, as);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, as === 'json' ? JSON.stringify(body) : body);
  return body;
};

export const hasNotoLottie = (emojiId) => Boolean(notoMap[emojiId]);
export const decorCredits = { noto: sources.noto.credit };

/** Lottie của Noto cho một id emoji của skill: { file, data } hoặc null nếu không có hoặc mất mạng. */
export async function notoLottie(emojiId) {
  const cp = notoMap[emojiId];
  if (!cp) return null;
  try {
    const data = await cached(path.join('noto', `${cp}.json`), sources.noto.lottie.replace('{codepoint}', cp), 'json');
    return { file: path.join(cacheDir, 'noto', `${cp}.json`), data, credit: sources.noto.credit };
  } catch { return null; }
}

/**
 * Tìm icon màu theo từ khóa tiếng Anh trong các bộ có giấy phép trong danh sách trắng; ưu tiên bộ không cần ghi công.
 * Trả { file, svg, set, name, license, credit } hoặc null.
 */
export async function iconifyFind(query) {
  try {
    const prefixes = sources.iconify.color;
    const q = encodeURIComponent(query.trim().toLowerCase());
    const res = await cached(path.join('iconify-search', `${q}.json`), `${sources.iconify.api}/search?query=${q}&prefixes=${prefixes.join(',')}&limit=24`, 'json', 30);
    const ok = (set) => sources.allow.includes(res.collections?.[set]?.license?.spdx);
    const noCredit = (set) => !sources.needsCredit.includes(res.collections?.[set]?.license?.spdx);
    const hits = (res.icons ?? []).map((i) => ({ set: i.split(':')[0], name: i.split(':')[1] })).filter((h) => ok(h.set));
    const best = hits.find((h) => noCredit(h.set)) ?? hits[0];
    if (!best) return null;
    const svg = await cached(path.join('iconify-svg', `${best.set}__${best.name}.svg`), `${sources.iconify.api}/${best.set}/${best.name}.svg`);
    const lic = res.collections[best.set];
    const credit = sources.needsCredit.includes(lic.license.spdx) ? `${lic.name} (${lic.author?.name}), ${lic.license.title}, icon "${best.name}" qua Iconify` : null;
    return { file: path.join(cacheDir, 'iconify-svg', `${best.set}__${best.name}.svg`), svg, set: best.set, name: best.name, license: lic.license.spdx, credit };
  } catch { return null; }
}

const brandData = readJson(path.join(skillRoot, 'data', 'brands.json')).brands;
export const brands = brandData;

/** Logo thương hiệu (data/brands.json): { file, set, name, license } hoặc null. Icon đơn sắc lấy bản trắng để đặt trên ô màu thương hiệu. */
export async function brandLogo(brandId) {
  const b = brandData.find((x) => x.id === brandId);
  if (!b) return null;
  const [set, name] = b.icon.split(':');
  const mono = set === 'simple-icons';
  try {
    const url = `${sources.iconify.api}/${set}/${name}.svg${mono ? '?color=%23ffffff' : ''}`;
    await cached(path.join('iconify-svg', `${set}__${name}${mono ? '__white' : ''}.svg`), url);
    return { file: path.join(cacheDir, 'iconify-svg', `${set}__${name}${mono ? '__white' : ''}.svg`), set, name, license: 'CC0-1.0', brand: b };
  } catch { return null; }
}
