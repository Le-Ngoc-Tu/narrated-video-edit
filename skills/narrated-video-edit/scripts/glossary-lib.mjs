// Từ điển tên riêng và thuật ngữ: sửa chính tả SAU phiên âm (Whisper hay nghe "Claude" thành "Cloud"). Dùng chung cho analyze, glossary-apply, plan-lint, plan-board và audit-edit.
// Dữ liệu: data/glossary.json (mặc định, mở rộng bằng cách thêm mục) và work/glossary.json (của dự án; mọi mục trong đó coi là người dùng đã khai).
import fs from 'node:fs';
import path from 'node:path';
import { readJson, skillRoot, writeJson } from './common.mjs';
import { norm } from './plan-lib.mjs';

const tokens = (text) => String(text).trim().split(/\s+/).map(norm).filter(Boolean);
const formsOf = (entries) => entries.flatMap((e) => e.variants.map((v) => ({ e, toks: tokens(v) }))).sort((a, b) => b.toks.length - a.toks.length);
const matchAt = (norms, i, forms) => forms.find((f) => f.toks.every((t, k) => norms[i + k] === t));

/**
 * Gộp từ điển mặc định, từ điển dự án và danh sách --terms thành các mục có hiệu lực.
 * Biến thể "ambiguous" (là từ thật như "cloud") chỉ có hiệu lực khi mục đó đã được khai (có trong từ điển dự án hoặc --terms); biến thể không mơ hồ luôn có hiệu lực.
 */
export function loadGlossary({ projectFile, terms = [], language } = {}) {
  const read = (file) => (file && fs.existsSync(file) ? readJson(file).entries ?? [] : []);
  const merged = new Map();
  const add = (raw, declared) => {
    if (raw.lang && language && !raw.lang.includes(language)) return;
    const key = tokens(raw.canonical).join(' ');
    const size = tokens(raw.canonical).length;
    const bad = (raw.variants ?? []).find((v) => tokens(v).length !== size);
    if (bad) throw new Error(`Từ điển: biến thể "${bad}" của "${raw.canonical}" phải có đúng ${size} từ (đổi từng từ một để giữ nguyên chỉ số từ trong kế hoạch).`);
    const cur = merged.get(key) ?? { canonical: raw.canonical, variants: [], ambiguous: Boolean(raw.ambiguous), declared: false };
    for (const v of raw.variants ?? []) if (tokens(v).join(' ') !== key && !cur.variants.some((x) => tokens(x).join(' ') === tokens(v).join(' '))) cur.variants.push(v);
    cur.declared = cur.declared || declared;
    merged.set(key, cur);
  };
  read(path.join(skillRoot, 'data', 'glossary.json')).forEach((e) => add(e, false));
  read(projectFile).forEach((e) => add(e, true));
  for (const t of terms.map((x) => String(x).trim()).filter(Boolean)) {
    const hit = merged.get(tokens(t).join(' '));
    if (hit) hit.declared = true; else add({ canonical: t, variants: [] }, true);
  }
  return [...merged.values()].map((e) => ({ ...e, active: e.declared || !e.ambiguous }));
}

/** Thay biến thể bằng dạng đúng, giữ nguyên dấu câu quanh từ, mốc giờ và chỉ số từ. Biến thể mơ hồ chưa khai chỉ được ghi vào `pending`. */
export function applyGlossary(words, entries) {
  const forms = formsOf(entries);
  const norms = words.map((w) => norm(w.text));
  const out = words.map((w) => ({ ...w }));
  const applied = [];
  const pending = new Map();
  for (let i = 0; i < out.length;) {
    const f = matchAt(norms, i, forms);
    if (!f) { i++; continue; }
    const target = f.e.canonical.trim().split(/\s+/);
    if (f.e.active) {
      f.toks.forEach((_, k) => {
        const w = out[i + k];
        const [, pre, core, post] = w.text.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su);
        if (core === target[k]) return;
        applied.push({ i: w.i, t: w.start, from: w.text, to: target[k], canonical: f.e.canonical });
        w.was = w.text;
        w.text = `${pre}${target[k]}${post}`;
      });
    } else {
      const p = pending.get(f.e.canonical) ?? { canonical: f.e.canonical, forms: [], count: 0, times: [] };
      const seen = out.slice(i, i + f.toks.length).map((w) => w.text).join(' ');
      if (!p.forms.includes(seen)) p.forms.push(seen);
      p.count++;
      if (p.times.length < 6) p.times.push(Number(out[i].start.toFixed(2)));
      pending.set(f.e.canonical, p);
    }
    i += f.toks.length;
  }
  return { words: out, applied, pending: [...pending.values()] };
}

/** Bước dùng chung của analyze.mjs và glossary-apply.mjs: đọc words.raw.json, áp từ điển, ghi lại words.json và glossary-report.json. */
export function glossaryPass(dir, { projectFile, terms = [] } = {}) {
  const raw = readJson(path.join(dir, 'words.raw.json'));
  const entries = loadGlossary({ projectFile, terms, language: raw.language });
  const result = applyGlossary(raw.words, entries);
  writeJson(path.join(dir, 'words.json'), { ...raw, words: result.words });
  const report = {
    version: 1,
    language: raw.language,
    declared: entries.filter((e) => e.declared).map((e) => e.canonical),
    entries: entries.filter((e) => e.variants.length).map(({ canonical, variants, ambiguous, declared, active }) => ({ canonical, variants, ambiguous, declared, active })),
    applied: result.applied,
    pending: result.pending.map((p) => ({ ...p, question: `"${p.forms.join('", "')}" xuất hiện ${p.count} lần (giây ${p.times.join(', ')}${p.count > p.times.length ? ', ...' : ''}): có phải "${p.canonical}" không?` }))
  };
  writeJson(path.join(dir, 'glossary-report.json'), report);
  return report;
}

export const readReport = (dir) => { try { return readJson(path.join(dir, 'glossary-report.json')); } catch { return null; } };

/** Văn bản hiển thị (thẻ, lower third, caption) còn dùng cách viết sai của một mục đang có hiệu lực. */
export function wrongSpellings(text, report) {
  if (!report) return [];
  const forms = formsOf((report.entries ?? []).filter((e) => e.active));
  const parts = String(text).split(/\s+/).filter(Boolean);
  const norms = parts.map(norm);
  const found = [];
  for (let i = 0; i < parts.length;) {
    const f = matchAt(norms, i, forms);
    if (!f) { i++; continue; }
    found.push({ canonical: f.e.canonical, shown: parts.slice(i, i + f.toks.length).join(' ') });
    i += f.toks.length;
  }
  return found;
}

/** Đối chiếu caption đã dựng với báo cáo từ điển, không qua bộ nhận dạng: mọi từ đã thay phải hiện đúng dạng đúng, và không còn dạng sai. */
export function captionProblems(report, capWords) {
  if (!report) return { changed: [], leftover: [] };
  const byIndex = new Map(capWords.map((w) => [w.i, w]));
  const changed = report.applied.filter((a) => { const c = byIndex.get(a.i); return c && norm(c.text) !== norm(a.to); }).map((a) => `${a.to} (giây ${a.t.toFixed(1)}) hiện "${byIndex.get(a.i).text}"`);
  const leftover = wrongSpellings(capWords.map((w) => w.text).join(' '), report).map((x) => `${x.shown} thay vì ${x.canonical}`);
  return { changed, leftover };
}
