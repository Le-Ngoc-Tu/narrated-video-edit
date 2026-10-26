// Thư viện hiệu ứng dựng: nạp data/effects/*.json, kiểm lược đồ, điền tham số vào công thức ffmpeg và dựng đoạn filtergraph áp dụng trong một cửa sổ thời gian.
// Công thức nằm trong dữ liệu (data/effects), mã này chỉ là bộ thông dịch: thêm hiệu ứng không cần sửa mã.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, skillRoot } from './common.mjs';

export const effectsDir = () => (process.env.NVE_EFFECTS ? path.resolve(process.env.NVE_EFFECTS) : path.join(skillRoot, 'data', 'effects'));

export function loadLibrary(dir = effectsDir()) {
  const dsl = readJson(path.join(dir, '_dsl.json'));
  const effects = [];
  for (const file of fs.readdirSync(dir).filter((n) => n.endsWith('.json') && !n.startsWith('_')).sort()) {
    const fam = readJson(path.join(dir, file));
    for (const e of fam.effects) effects.push({ ...e, family: fam.family, file });
  }
  return { dsl, effects, byId: new Map(effects.map((e) => [e.id, e])), dir };
}

/** Đường dẫn phông cho drawtext: ffmpeg cần dấu gạch chéo xuôi và dấu hai chấm được thoát. */
export const fontPath = (name) => path.join(skillRoot, 'templates', 'fonts', name).replace(/\\/g, '/').replace(/:/g, '\\:');

/** Biến ngữ cảnh mặc định cho một khung hình W x H. fx, fy là tâm mặt (0..1). */
export function makeCtx({ W, H, fps = 30, fx = 0.5, fy = 0.35 }) {
  return { W, H, fps, fx, fy, font: fontPath('BeVietnamPro-SemiBold.ttf'), fontBold: fontPath('BeVietnamPro-Black.ttf'), fontImpact: fontPath('Anton-Regular.ttf') };
}

const fmt = (n) => String(+Number(n).toFixed(5));
const TOKEN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
// {=biểu thức số} tính trước khi ghi vào công thức, cho thông số ffmpeg không nhận biểu thức (vd st của afade): {={dur}*0.5}
const CALC = /\{=((?:[^{}]|\{[A-Za-z_][A-Za-z0-9_]*\})+)\}/g;

/** Điền chỗ trống {tên}: params, let của hiệu ứng, ctx, rồi macros. Ném lỗi nếu còn chỗ trống không rõ. */
export function expand(text, vars, depth = 0) {
  if (depth > 8) throw new Error(`chỗ trống lồng quá sâu hoặc vòng lặp: ${text.slice(0, 60)}`);
  let missing = null;
  const calc = String(text).replace(CALC, (_m, inner) => {
    const num = expand(inner, vars, depth + 1);
    if (!/^[0-9+\-*/().\s]+$/.test(num)) throw new Error(`{=${inner}} không phải biểu thức số: ${num}`);
    return fmt(Function(`"use strict";return (${num})`)());
  });
  const out = calc.replace(TOKEN, (m, name) => {
    if (name in vars) return expand(String(vars[name]), vars, depth + 1);
    missing = missing ?? name;
    return m;
  });
  if (missing) throw new Error(`chưa có giá trị cho {${missing}}`);
  return out;
}

const sanitizeText = (s) => String(s).replace(/['\\:,;\[\]%{}]/g, ' ').replace(/\s+/g, ' ').trim();

/** Gom giá trị tham số (mặc định, ghi đè của người gọi, kiểm khoảng) rồi dựng bảng biến để điền công thức. */
export function bindVars(e, given, ctx, dsl, dur) {
  const vars = {};
  for (const [name, spec] of Object.entries(e.params ?? {})) {
    let v = given?.[name] ?? spec.default;
    if (spec.type === 'choice') {
      if (!spec.options.includes(v)) throw new Error(`${e.id}: tham số ${name}="${v}" không thuộc ${spec.options.join('|')}`);
      vars[name] = v;
    } else if (spec.type === 'text') vars[name] = sanitizeText(v);
    else {
      v = Number(v);
      if (!Number.isFinite(v) || v < spec.min || v > spec.max) throw new Error(`${e.id}: tham số ${name}=${given?.[name]} ngoài khoảng ${spec.min}..${spec.max}`);
      vars[name] = fmt(v);
    }
  }
  for (const [name, expr] of Object.entries(e.let ?? {})) vars[name] = expr;
  for (const [k, v] of Object.entries(ctx)) if (!(k in vars)) vars[k] = typeof v === 'number' ? fmt(v) : v;
  vars.dur = fmt(dur);
  // Nguồn lavfi sinh dài hơn cửa sổ một chút rồi trim=end_frame={frames} cắt đúng số khung: tránh thiếu hoặc thừa một khung do làm tròn thời lượng
  vars.durpad = fmt(dur + 0.3);
  vars.frames = String(Math.round(dur * (ctx.fps ?? 30)));
  for (const [k, v] of Object.entries(dsl.macros)) if (!(k in vars)) vars[k] = v;
  return vars;
}

const RECIPE_KEYS = ['chain', 'graph', 'xfade', 'synth', 'video', 'audio', 'ref'];

export function validateEffect(e, lib) {
  const { dsl } = lib;
  const errs = [];
  const bad = (m) => errs.push(`${e.id ?? '(không id)'}: ${m}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id ?? '')) bad('id phải là kebab-case');
  if (lib.effects.filter((x) => x.id === e.id).length > 1) bad('id trùng');
  if (!dsl.families[e.family]) bad(`họ "${e.family}" không có trong _dsl.json`);
  if (!dsl.purposes.includes(e.purpose)) bad(`purpose "${e.purpose}" không hợp lệ`);
  if (!dsl.engines[e.engine]) bad(`engine "${e.engine}" không hợp lệ`);
  if (!e.name?.vi || !e.name?.en) bad('thiếu name.vi hoặc name.en');
  if (!e.about || e.about.length < 20) bad('thiếu mô tả about (từ 20 ký tự)');
  for (const s of dsl.styles) if (!dsl.usage.includes(e.styles?.[s])) bad(`styles.${s} phải thuộc ${dsl.usage.join('|')}`);
  const needsDur = ['video', 'mask', 'xfade', 'audio'].includes(e.engine);
  if (needsDur) {
    const d = e.dur;
    if (!d || !(d.min > 0 && d.min <= d.default && d.default <= d.max)) bad('dur phải có min <= default <= max, đều > 0');
    if (!(e.intensity >= 1 && e.intensity <= 3)) bad('intensity phải từ 1 đến 3');
  }
  if (e.flash !== undefined && !(e.flash >= 0)) bad('flash phải >= 0');
  if (!Array.isArray(e.pitfalls) || !e.pitfalls.length) bad('cần ít nhất một lỗi hay gặp (pitfalls)');
  const have = RECIPE_KEYS.filter((k) => e[k] !== undefined);
  const want = { video: ['chain|graph'], mask: ['graph'], xfade: ['xfade'], audio: ['synth'], retime: ['video'], overlay: ['ref'] }[e.engine] ?? [];
  for (const w of want) if (!w.split('|').some((k) => have.includes(k))) bad(`engine ${e.engine} cần trường ${w}`);
  for (const [name, spec] of Object.entries(e.params ?? {})) {
    if (['p', 'pT', 'dur', ...dsl.ctx].includes(name)) bad(`tham số "${name}" trùng tên dành riêng`);
    if (spec.type === 'choice') { if (!Array.isArray(spec.options) || !spec.options.includes(spec.default)) bad(`tham số ${name}: default phải thuộc options`); }
    else if (spec.type === 'text') { if (typeof spec.default !== 'string') bad(`tham số ${name}: default phải là chuỗi`); }
    else if (!(spec.min <= spec.default && spec.default <= spec.max)) bad(`tham số ${name}: cần min <= default <= max`);
  }
  if (!errs.length && e.engine !== 'overlay') {
    try {
      const ctx = makeCtx({ W: 540, H: 960 });
      const dur = e.dur?.default ?? 1;
      const vars = bindVars(e, {}, ctx, dsl, dur);
      for (const k of ['chain', 'graph', 'xfade', 'synth', 'post', 'video', 'audio', 'outDur']) if (typeof e[k] === 'string') expand(e[k], { ...vars, offset: '1' });
    } catch (err) { bad(err.message); }
  }
  return errs;
}

/** Căn cửa sổ [t0, t1] vào ranh giới khung hình. Trả số khung và giây đã căn. */
export function snapWindow(t0, t1, fps, totalFrames) {
  const n0 = Math.max(0, Math.round(t0 * fps));
  const n1 = Math.min(totalFrames, Math.max(n0 + 1, Math.round(t1 * fps)));
  return { n0, n1, t0: n0 / fps, t1: n1 / fps, dur: (n1 - n0) / fps };
}

const labelRe = /\[([A-Za-z0-9_]+)\]/g;

/**
 * Đoạn filtergraph áp dụng một hiệu ứng hình trong cửa sổ khung [n0, n1) của luồng `input`, trả luồng `output` cùng độ dài.
 * Cắt luồng làm ba đoạn (trước, giữa, sau), chỉ đoạn giữa đi qua công thức (giờ cục bộ bắt đầu từ 0), rồi nối lại.
 */
export function videoStage(e, { params, ctx, n0, n1, totalFrames, fps, tag, input, output, maskInput }, dsl) {
  const dur = (n1 - n0) / fps;
  const vars = bindVars(e, params, ctx, dsl, dur);
  // trim so khung theo điểm giữa thời lượng khung, nên mép cửa sổ đặt đúng ranh giới khung n/fps
  const a = (n0 / fps).toFixed(5);
  const b = (n1 / fps).toFixed(5);
  const head = n0 > 0;
  const tail = n1 < totalFrames;
  const outs = [`${tag}m0`, ...(head ? [`${tag}h0`] : []), ...(tail ? [`${tag}t0`] : [])];
  const norm = `fps=${fps},setsar=1,format=yuv420p`;
  const lines = [`[${input}]split=${outs.length}${outs.map((o) => `[${o}]`).join('')}`];
  if (head) lines.push(`[${tag}h0]trim=end=${a},setpts=PTS-STARTPTS,${norm}[${tag}h]`);
  if (tail) lines.push(`[${tag}t0]trim=start=${b},setpts=PTS-STARTPTS,${norm}[${tag}t]`);
  lines.push(`[${tag}m0]trim=start=${head ? a : 0}:end=${b},setpts=PTS-STARTPTS[${tag}m1]`);
  if (e.engine === 'mask') {
    if (!maskInput) throw new Error(`${e.id} cần mặt nạ người (maskInput)`);
    lines.push(`[${maskInput}]trim=start=${head ? a : 0}:end=${b},setpts=PTS-STARTPTS,fps=${fps},format=gray[${tag}k]`);
  }
  if (e.chain) lines.push(`[${tag}m1]${expand(e.chain, vars)}[${tag}mo]`);
  else {
    const graph = expand(e.graph, vars).replace(labelRe, (_m, name) => `[${name === 'in' ? `${tag}m1` : name === 'out' ? `${tag}mo` : name === 'mask' ? `${tag}k` : `${tag}_${name}`}]`);
    lines.push(graph);
  }
  lines.push(`[${tag}mo]${norm}[${tag}mf]`);
  const parts = [...(head ? [`[${tag}h]`] : []), `[${tag}mf]`, ...(tail ? [`[${tag}t]`] : [])];
  lines.push(parts.length > 1 ? `${parts.join('')}concat=n=${parts.length}:v=1:a=0[${output}]` : `[${tag}mf]null[${output}]`);
  return lines;
}

/** Chuyển cảnh thật giữa hai clip: [a][b] -> [out]. offset là giây trong clip a nơi bắt đầu chồng. */
export function xfadeStage(e, { params, ctx, dur, offset }, dsl) {
  const vars = { ...bindVars(e, params, ctx, dsl, dur), offset: fmt(offset) };
  return `[a][b]${expand(e.xfade, vars)}[out]`;
}

/** Lệnh sinh tiếng tổng hợp: trả { input: chuỗi lavfi, post: chuỗi bộ lọc hoặc '' , dur }. */
export function audioRecipe(e, { params, ctx, dur }, dsl) {
  const d = dur ?? e.dur.default;
  const vars = bindVars(e, params, ctx, dsl, d);
  return { input: expand(e.synth, vars), post: e.post ? expand(e.post, vars) : '', dur: d, gainDb: e.gainDb ?? -14 };
}

/** Chuỗi hình và tiếng của hiệu ứng đổi tốc độ, kèm độ dài đầu ra dự kiến cho đầu vào `dur` giây. */
export function retimeRecipe(e, { params, ctx, dur }, dsl) {
  const vars = bindVars(e, params, ctx, dsl, dur);
  const outExpr = expand(e.outDur, vars);
  if (!/^[0-9+\-*/().\s]+$/.test(outExpr)) throw new Error(`${e.id}: outDur không phải biểu thức số`);
  return { video: expand(e.video, vars), audio: e.audio ? expand(e.audio, vars) : null, outDur: Function(`"use strict";return (${outExpr})`)() };
}

/**
 * Số lần chớp sáng mỗi giây từ chuỗi độ sáng trung bình theo khung: một "chớp" là một cặp đổi chiều ngược nhau, mỗi bước từ minSwing mức sáng (trên 255) trở lên.
 * Phép đo dùng chung của selftest và audit-edit cho giới hạn dưới 3 lần mỗi giây (WCAG 2.3.1).
 */
export function flashesPerSecond(luma, fps, minSwing = 25) {
  let swings = 0;
  let dir = 0;
  for (let i = 1; i < luma.length; i++) {
    const d = luma[i] - luma[i - 1];
    if (Math.abs(d) < minSwing) continue;
    const sign = Math.sign(d);
    if (dir && sign !== dir) swings++;
    dir = sign;
  }
  return swings / 2 / Math.max(0.5, luma.length / fps);
}

/** Tên các bộ lọc ffmpeg mà một hiệu ứng dùng, để kiểm máy có đủ (node fx-apply.mjs filters). */
export function usedFilters(e) {
  const names = new Set();
  for (const key of ['chain', 'graph', 'xfade', 'synth', 'post', 'video', 'audio']) {
    if (typeof e[key] !== 'string') continue;
    const text = e[key].replace(/'[^']*'/g, "''").replace(/\[[^\]]*\]/g, '').replace(/\{[^}]*\}/g, '0');
    for (const part of text.split(/[;,]/)) { const m = part.trim().match(/^([a-z][a-z0-9_]*)/); if (m) names.add(m[1]); }
  }
  return [...names];
}
