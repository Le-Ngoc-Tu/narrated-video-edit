// Khâu B1: sinh BỘ KHUNG kế hoạch dựng từ lời nói và phong cách. Tác tử đọc, sửa truy vấn và quyết định cuối; plan-lint kiểm.
// Chạy: node plan-skeleton.mjs --analysis work/analysis --style hype --out work/edit-plan.json [--seed 7] [--size 1280x720] [--user-footage <thư mục có footage.json>]
// --user-footage: footage của chính người dùng (bản quay màn hình, ảnh) khớp từ khóa với lời nói thành cutaway dùng ngay (kiểu demo nếu footage khai demo: true) thay cho ảnh stock; không nêu --style thì dùng creator.
// --keep chỉ dựng các đoạn đã chọn (kết quả pick-highlights.mjs, hoặc chuỗi "44-61,175-185" tính bằng giây): mọi thứ ngoài các đoạn bị cắt, không cắt khoảng lặng bên trong đoạn.
// --layout stack|follow|auto đổi video ngang thành khung dọc 9:16 (xem references/11-reels-layout.md): stack giữ cả video gốc ở giữa và dành nửa trên cho thẻ decor;
// follow cắt khung 9:16 bám mặt người nói; auto chọn follow khi mặt người nói rõ và có mặt ở phần lớn video, ngược lại stack.
// --size đặt kích thước khung ra (mặc định 1920x1080 hoặc 1080x1920); dùng khi video gốc nhỏ hơn để khỏi phóng to không cần thiết.
// Bộ khung chỉ gợi ý theo quy tắc xác định: chia nhịp theo câu, từ khóa, ứng viên cutaway/zoom/sticker/thẻ số liệu, khoảng ngắt cần cắt.
import fs from 'node:fs';
import path from 'node:path';
import { args, makeTimeMap, readJson, skillRoot, writeJson } from './common.mjs';
import { loadLibrary } from './fx-lib.mjs';
import { STOP, faceZone, followPath, hasDigit, loadAnalysis, loadStyle, mapFacesForLayout, norm, speechGap, stackGeometry } from './plan-lib.mjs';

const { flags } = args();
const styleId = flags.style ? String(flags.style) : flags['user-footage'] ? 'creator' : null;
if (!flags.analysis || !styleId || !flags.out) { console.error('Dùng: node plan-skeleton.mjs --analysis work/analysis --style hype|explainer|documentary|creator --out work/edit-plan.json [--seed 7] [--user-footage dir]'); process.exit(2); }
const A = loadAnalysis(String(flags.analysis));
const style = loadStyle(styleId);
const { words, meta } = A;
// Bảng gợi ý decor và truy vấn (data/decor-keywords.json): tác tử mở rộng được, không hardcode trong mã
const KW = readJson(path.join(skillRoot, 'data', 'decor-keywords.json'));
const WEAK = new Set((KW.weak ?? []).map(norm));
const KEYWORD_MIN = (KW.keywordMinLength ?? {})[String(A.language ?? '').slice(0, 2)] ?? (KW.keywordMinLength ?? {}).default ?? 5;
const ABSTRACT = new Set((KW.abstractQuery ?? []).map((x) => String(x).toLowerCase()));
const POINTERS = new Set((KW.pointers ?? []).map(norm));
if (!words.length) throw new Error('words.json không có từ nào: không có gì để dựng.');
let seed = Number(flags.seed ?? 1);
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

// 1. Cắt các khoảng ngắt đủ dài (nếu phong cách cho phép); với --keep thì cắt phần bù của các đoạn được giữ
const keepRanges = !flags.keep ? null : (fs.existsSync(String(flags.keep))
  ? JSON.parse(fs.readFileSync(String(flags.keep), 'utf8')).ranges.map((r) => [r.start, r.end])
  : String(flags.keep).split(',').map((p) => p.split('-').map(Number))).sort((a, b) => a[0] - b[0]);
const cuts = keepRanges
  ? [[0, ...keepRanges.flat(), meta.duration]].flatMap((edges) => Array.from({ length: edges.length / 2 }, (_, k) => [edges[2 * k], edges[2 * k + 1]]))
    .filter(([a, b]) => b - a > 0.05).map(([a, b]) => ({ start: a, end: b, reason: 'ngoài đoạn được giữ (--keep)' }))
  : style.cutPauses
  ? A.pauses.pauses.filter((p) => p.end - p.start >= style.minPauseToCut && p.end - p.start <= (style.maxPauseToCut ?? 3)).map((p) => ({ start: p.start, end: p.end, reason: `ngắt ${(p.end - p.start).toFixed(2)}s` }))
  : [];
const timeMap = makeTimeMap(cuts);
const outDuration = timeMap.outDuration(meta.duration);

// 2. Chia nhịp theo câu và khoảng ngắt
// Biên của --keep luôn là chỗ cắt nhịp: nhịp vắt qua biên sẽ bị loại cả nhịp ở bước lọc inKept bên dưới
const keepEdges = (keepRanges ?? []).flat();
const crossesKeepEdge = (w, next) => !!next && keepEdges.some((e) => w.end <= e + 0.01 && next.start >= e - 0.01);
const beatsRaw = [];
let cur = [];
words.forEach((w, i) => {
  cur.push(i);
  const next = words[i + 1];
  const endsSentence = /[.!?…]$/.test(w.text);
  const gap = next ? next.start - w.end : Infinity;
  // Whisper không phải lúc nào cũng ghi dấu câu (giọng kể liền mạch): ngoài dấu câu và khoảng ngắt, cắt nhịp khi đã dài trên 6s tại chỗ nghỉ nhỏ, và bắt buộc trên 10s
  const elapsed = w.end - words[cur[0]].start;
  if (!next || endsSentence || gap >= 0.6 || crossesKeepEdge(w, next) || (elapsed >= 6 && gap >= 0.15) || elapsed >= 10) { beatsRaw.push(cur); cur = []; }
});
const merged = [];
for (const idx of beatsRaw) {
  const span = words[idx.at(-1)].end - words[idx[0]].start;
  const prev = merged.at(-1);
  if (prev && span < 1.4 && !crossesKeepEdge(words[prev.at(-1)], words[idx[0]])) prev.push(...idx); else merged.push([...idx]);
}
const inKept = (t) => !keepRanges || keepRanges.some(([a, b]) => t >= a && t <= b);
const beats = merged.filter((idx) => inKept(words[idx[0]].start + 0.01) && inKept(words[idx.at(-1)].end - 0.01)).map((idx, n) => {
  const first = words[idx[0]];
  const last = words[idx.at(-1)];
  const text = idx.map((i) => words[i].text).join(' ');
  const numbers = idx.filter((i) => hasDigit(words[i].text));
  const content = idx.filter((i) => !hasDigit(words[i].text) && norm(words[i].text).length >= KEYWORD_MIN && !STOP.has(norm(words[i].text)) && !WEAK.has(norm(words[i].text)));
  const keywords = [...content].sort((a, b) => norm(words[b].text).length - norm(words[a].text).length).slice(0, 2).sort((a, b) => a - b);
  return { id: `b${String(n + 1).padStart(2, '0')}`, startWord: idx[0], endWord: idx.at(-1), start: first.start, end: last.end, text, role: n === 0 ? 'hook' : '', numbers, keywords, question: /\?$/.test(text), exclaim: /!$/.test(text) };
});
if (!beats.length) { console.error('Không có nhịp nào nằm trọn trong đoạn được giữ (--keep): kiểm lại khoảng giữ có lời nói không.'); process.exit(1); }
beats.at(-1).role = beats.length > 1 ? 'cta' : 'hook';

// 2b. Footage riêng của người dùng (--user-footage): footage.json liệt kê { file, description, keywords, demo, theme, clipStart, clipSpeed }. Nhịp nào có từ khóa trùng lời nói thì dùng footage đó;
// các nhịp liền nhau cùng footage gộp thành một cutaway. demo: true dựng kiểu demo (tổng thời lượng dưới demoMaxShare), không thì dùng kiểu trình bày luân phiên của phong cách.
const footageCuts = [];
const sequence0 = (k) => (style.showcase?.sequence ?? ['card', 'polaroid', 'pip'])[k % (style.showcase?.sequence ?? ['card']).length];
const footageDir = flags['user-footage'] ? path.resolve(String(flags['user-footage'])) : null;
const footage = [];
if (footageDir) {
  const listFile = path.join(footageDir, 'footage.json');
  if (!fs.existsSync(listFile)) throw new Error(`Thiếu ${listFile}: --user-footage cần footage.json (references/03-planning.md, mục footage của người dùng)`);
  for (const f of readJson(listFile).files ?? []) {
    const abs = path.resolve(footageDir, f.file);
    if (!fs.existsSync(abs)) throw new Error(`footage.json: không thấy ${abs}`);
    footage.push({ ...f, abs, keys: new Set((f.keywords ?? []).map(norm)) });
  }
}
{
  const outDirOfPlan = path.dirname(path.resolve(String(flags.out)));
  const hits = (b, f) => words.slice(b.startWord, b.endWord + 1).filter((w) => f.keys.has(norm(w.text)));
  const pick = beats.map((b) => { let best = -1; let bestN = 0; footage.forEach((f, k) => { const n = hits(b, f).length; if (n > bestN) { best = k; bestN = n; } }); return best; });
  // Một nhịp ngắn không có từ khóa nằm giữa hai nhịp cùng footage thì thuộc về footage đó; cảnh demo luôn chừa nhịp mở đầu (hook) và nhịp kết (cta) cho người nói
  for (let n = 1; n + 1 < pick.length; n++) if (pick[n] < 0 && pick[n - 1] >= 0 && pick[n - 1] === pick[n + 1] && beats[n].end - beats[n].start < 6) pick[n] = pick[n - 1];
  if (pick.length && pick[0] >= 0 && footage[pick[0]].demo) pick[0] = -1;
  if (pick.length > 1 && pick.at(-1) >= 0 && footage[pick.at(-1)].demo) pick[pick.length - 1] = -1;
  const runs = [];
  pick.forEach((k, n) => {
    if (k < 0) return;
    const last = runs.at(-1);
    if (last && last.k === k && last.endBeat === n - 1) { last.endBeat = n; return; }
    runs.push({ k, startBeat: n, endBeat: n });
  });
  let demoSec = 0;
  for (const r of runs) {
    const f = footage[r.k];
    const first = beats[r.startBeat];
    const lastBeat = beats[r.endBeat];
    const start = words[first.startWord].start;
    const end = words[lastBeat.endWord].end;
    if (end - start < 2 || timeMap.toOut(start) === null) continue;
    if (f.demo && (demoSec + (end - start)) / outDuration > style.demoMaxShare * 0.95) continue;
    if (f.demo) demoSec += end - start;
    const video = /\.(mp4|webm|mov)$/i.test(f.file);
    const anchor = hits(first, f)[0] ? words.indexOf(hits(first, f)[0]) : first.startWord;
    footageCuts.push({
      id: '', beat: first.id, presentation: f.demo ? 'demo' : sequence0(footageCuts.length), ...(f.demo ? { theme: f.theme ?? 'pastel' } : {}),
      start, end, anchorWord: anchor, query: f.description ?? f.file, kind: video ? 'video' : 'image', fit: style.cutaway.fit,
      asset: path.relative(outDirOfPlan, f.abs).replace(/\\/g, '/'), userProvided: true, status: 'resolved',
      ...(video && f.clipStart !== undefined ? { clipStart: f.clipStart } : {}), ...(video && f.clipSpeed !== undefined ? { clipSpeed: f.clipSpeed } : {}),
      ...(f.demo ? { focus: [], marks: [] } : {})
    });
  }
}

// 3. Cutaway: ưu tiên nhịp có từ khóa; bắt đầu ở đầu một từ, kết thúc ở cuối một từ; xen kẽ, không vượt trần thời lượng
const conceptOf = (word) => KW.concepts[word] ?? (/^[\x00-\x7f]+$/.test(word) ? word : null);
const cutaways = [];
const sequence = style.showcase?.sequence ?? ['card', 'polaroid', 'pip'];
const droppedQueries = [];
const queryOk = (q) => q.split(/\s+/).filter(Boolean).every((t) => /^[\x00-\x7f]+$/.test(t) && !ABSTRACT.has(t.toLowerCase())) && q.trim().length > 0;
let brollOut = 0;
let lastBroll = -2;
footageCuts.forEach((c) => cutaways.push({ ...c, id: `c${String(cutaways.length + 1).padStart(2, '0')}` }));
beats.forEach((b, n) => {
  if (!b.keywords.length || n - lastBroll < 2 || b.role === 'hook' && beats.length > 3) return;
  const anchor = b.keywords[0];
  const s = words[anchor].start;
  const endCandidates = words.slice(b.startWord, b.endWord + 1).filter((w) => w.end - s >= style.cutaway.minSec && w.end - s <= style.cutaway.maxSec);
  const endWord = endCandidates[0] ?? words[b.endWord];
  const dur = endWord.end - s;
  if (dur < style.cutaway.minSec * 0.8 || (timeMap.toOut(s) === null)) return;
  // Kiểu trình bày luân phiên theo phong cách: fullbleed phủ kín khung (rời mặt người nói), các kiểu còn lại là vật thể thiết kế trong lớp phủ nên không tính vào tỉ lệ rời mặt
  const presentation = sequence[cutaways.length % sequence.length];
  if (presentation === 'fullbleed' && (brollOut + dur) / outDuration > style.brollMaxShare) return;
  const query = (() => { const ks = b.keywords.map((i) => norm(words[i].text)); const mapped = ks.map(conceptOf).filter(Boolean); return mapped.length ? mapped.slice(0, 2).join(' ') : ks.join(' '); })();
  if (!queryOk(query)) { droppedQueries.push(query); return; }
  if (cutaways.some((c) => s < c.end && endWord.end > c.start)) return;
  if (presentation === 'fullbleed') brollOut += dur;
  lastBroll = n;
  cutaways.push({ id: `c${String(cutaways.length + 1).padStart(2, '0')}`, beat: b.id, presentation, start: s, end: endWord.end, anchorWord: anchor, query, kind: 'auto', fit: style.cutaway.fit, zoom: rnd() < 0.5 ? 'push-in' : 'drift', asset: null, status: 'pending' });
});

// 4. Zoom nhấn: ở đầu một từ của nhịp mạnh, cách nhau theo phong cách, không trùng cutaway
const punches = [];
let lastPunch = -Infinity;
for (const b of beats) {
  if (b.start - lastPunch < style.punch.everySec) continue;
  const w = words[b.keywords[0] ?? b.startWord];
  if (cutaways.some((c) => w.start < c.end && w.start + style.punch.durSec > c.start)) continue;
  punches.push({ id: `p${punches.length + 1}`, start: w.start, end: Math.min(w.start + style.punch.durSec, b.end + 0.3), scale: style.punch.scale, anchorWord: words.indexOf(w) });
  lastPunch = w.start;
}

// 5. Thẻ số liệu (chỉ từ lời nói) và sticker gắn từ khóa
const stats = [];
const overlapsAny = (start, end, list) => list.some((x) => start < x.end + 0.05 && end > x.start - 0.05);
const bigCuts = () => cutaways.filter((c) => c.presentation === 'fullbleed' || c.presentation === 'demo');
// Chỉ làm thẻ số cho con số có nghĩa: từ 3 chữ số, có %, hoặc đứng ngay trước một đơn vị (data/emoji-map.json "units"); bỏ "thứ 2", "tầng 3", "2 cái"
const UNIT_WORDS = new Set((readJson(path.join(skillRoot, 'data', 'emoji-map.json')).units ?? []).flatMap((u) => u.words.map(norm)).concat(['%', 'triệu', 'nghìn', 'ngàn', 'tỷ', 'đồng', 'lần']));
for (const b of beats) for (const i of b.numbers) {
  if (/^[.,]\d/.test(words[i].text)) continue;
  // Whisper tách "500.000" thành "500" và ".000": ghép lại thành một giá trị
  let nextIdx = i + 1;
  let value = words[i].text.replace(/[^\p{N}.,%]/gu, '');
  if (/^[.,]\d{3}$/.test(words[nextIdx]?.text ?? '')) { value += words[nextIdx].text; nextIdx++; }
  const next = words[nextIdx];
  const nextNorm = next && next.start - words[nextIdx - 1].end < 0.4 ? norm(next.text) : '';
  const meaningful = value.replace(/\D/g, '').length >= 3 || /%/.test(words[i].text) || UNIT_WORDS.has(nextNorm);
  if (!meaningful) continue;
  const stat = { id: `s${stats.length + 1}`, anchorWord: i, value, label: UNIT_WORDS.has(nextNorm) ? nextNorm : '', start: words[i].start, end: Math.min(words[i].start + 2.4, b.end + 0.8) };
  if (overlapsAny(stat.start, stat.end, [...bigCuts(), ...stats])) continue;
  stats.push(stat);
}
const decor = [];
const maxDecor = Math.max(1, Math.round((style.decor.maxPerMinute * outDuration) / 60));
const allow = new Set(style.decor.allowed);
const pickType = (b, i) => (b.question && allow.has('question') ? 'question' : b.exclaim && allow.has('exclaim') ? 'exclaim' : POINTERS.has(norm(words[i].text)) && allow.has('arrow') ? 'arrow' : allow.has('underline') ? 'underline' : [...allow][0]);
// Chừa một phần trần mật độ cho decor tự gợi ý (icon, sparkle) để video ngắn cũng có icon thay vì toàn thanh gạch chân
const autoShare = Math.min(Math.round((((style.decor.auto?.icons ?? 0) + (style.decor.auto?.sparkle ?? 0)) * outDuration) / 60), Math.floor(maxDecor / 2));
for (const b of beats) {
  if (decor.length >= maxDecor - autoShare) break;
  const i = b.keywords.at(-1) ?? (b.question || b.exclaim ? b.endWord : null);
  if (i === null || stats.some((s) => s.anchorWord === i)) continue;
  const life = style.decor.lifeSec[0] + rnd() * (style.decor.lifeSec[1] - style.decor.lifeSec[0]);
  decor.push({ id: `d${decor.length + 1}`, type: pickType(b, i), anchorWord: i, start: words[i].start, end: words[i].start + life });
}

// 5b. Decor tự gợi ý từ bảng từ khóa: icon theo chủ đề, sparkle ở lời khen, confetti ở lời cảm ơn và kết; thưa theo style.decor.auto, nằm trong trần mật độ
const auto = style.decor.auto ?? {};
const autoUsed = [];
// Không vượt 1,25 lần trần mật độ của phong cách (plan-lint chỉ cho tới 1,3 lần)
const autoRoom = () => ((decor.length + 1) / outDuration) * 60 <= style.decor.maxPerMinute * 1.25;
const farFromAuto = (t, gap) => autoUsed.every((u) => Math.abs(u - t) >= gap);
const visible = (w) => timeMap.toOut(w.start) !== null && inKept(w.start) && inKept(w.end);
const addAuto = (type, i, life, extra = {}) => { autoUsed.push(words[i].start); decor.push({ id: `d${decor.length + 1}`, type, anchorWord: i, start: words[i].start, end: words[i].start + life, ...extra, auto: true }); };
const iconByWord = new Map();
KW.icons.forEach((e) => e.words.forEach((w) => iconByWord.set(norm(w), e.query)));
const sparkleWords = new Set(KW.sparkle.map(norm));
const perMin = (n) => Math.max(0, Math.round((n * outDuration) / 60));
const nIcon = allow.has('icon') ? perMin(auto.icons ?? 0) : 0;
const nSpark = allow.has('sparkle') ? perMin(auto.sparkle ?? 0) : 0;
let addedIcon = 0;
let addedSpark = 0;
words.forEach((w, i) => {
  if (!visible(w) || !autoRoom() || stats.some((s) => Math.abs(s.start - w.start) < 2)) return;
  const nw = norm(w.text);
  if (addedSpark < nSpark && sparkleWords.has(nw) && farFromAuto(w.start, auto.minGapSec ?? 14)) { addAuto('sparkle', i, 1.6); addedSpark++; return; }
  const q = iconByWord.get(nw);
  if (addedIcon < nIcon && q && farFromAuto(w.start, auto.minGapSec ?? 14)) { addAuto('icon', i, 1.9, { query: q }); addedIcon++; }
});
if (auto.confetti && allow.has('confetti')) {
  const phrases = KW.confetti.map((p) => p.map(norm));
  let lastC = -Infinity;
  words.forEach((w, i) => {
    if (!visible(w) || w.start - lastC < 30) return;
    if (phrases.some((p) => p.every((x, k) => norm(words[i + k]?.text ?? '') === x))) { addAuto('confetti', i, 1.8); lastC = w.start; }
  });
}

// 5c. Chữ lớn đặt sau người nói (tùy chọn --behind-text, cần node setup.mjs --with-segmentation): từ khóa mạnh nhất của nhịp mở đầu và một nhịp giữa video
const cardsBehind = [];
if (flags['behind-text']) {
  const pickBeats = [beats[0], beats[Math.floor(beats.length * 0.6)]].filter((b, k, a) => b && a.indexOf(b) === k && b.keywords.length);
  for (const b of pickBeats) {
    const kw = [...b.keywords].sort((p, q) => norm(words[q].text).length - norm(words[p].text).length)[0];
    const behind = { id: `b${cardsBehind.length + 1}`, type: 'bigtext', text: words[kw].text.replace(/[^\p{L}\p{N}]+/gu, ''), start: words[kw].start, end: Math.min(words[kw].start + 2.6, b.end + 0.4) };
    if (!overlapsAny(behind.start, behind.end, [...bigCuts(), ...stats, ...cardsBehind])) cardsBehind.push(behind);
  }
}

// 5d. Lấp khoảng trống sự kiện hình bằng zoom nhấn: nơi có lời nói mà quá 60% trần của phong cách không có sự kiện nào
{
  const goal = (style.maxEventGap ?? 6) * 0.6;
  const events = () => [...cutaways, ...punches, ...stats, ...decor, ...cardsBehind].map((x) => x.start).concat(cuts.map((c) => c.end)).filter((t) => timeMap.toOut(t) !== null).sort((a, b) => a - b);
  for (let round = 0; round < 8; round++) {
    const ev = events();
    let changed = false;
    for (let k = 0; k + 1 < ev.length; k++) {
      if (speechGap(ev[k], ev[k + 1], words) <= goal) continue;
      const target = ev[k] + goal * 0.8;
      const w = words.find((x) => x.start >= target && x.start < ev[k + 1] - 0.8 && visible(x) && !overlapsAny(x.start, x.end, bigCuts()));
      if (!w) continue;
      punches.push({ id: `p${punches.length + 1}`, start: w.start, end: Math.min(w.start + style.punch.durSec, w.end + 0.6), scale: style.punch.scale, anchorWord: words.indexOf(w) });
      changed = true;
    }
    if (!changed) break;
  }
  punches.sort((a, b) => a.start - b.start);
  punches.forEach((p, k) => { p.id = `p${k + 1}`; });
}

// 6. Hiệu ứng âm thanh tại điểm đổi hình
const sfx = [];
if (style.sfx.whoosh) for (const c of cutaways.filter((x) => x.presentation === 'fullbleed')) { sfx.push({ t: c.start, type: 'whoosh' }); sfx.push({ t: c.end - 0.15, type: 'whoosh' }); }
// Chỗ nối giữa hai đoạn được giữ: một tiếng whoosh làm dấu chuyển
if (keepRanges && style.sfx.whoosh) keepRanges.slice(1).forEach(([a]) => sfx.push({ t: a, type: 'whoosh' }));
if (style.sfx.pop) for (const d of decor) sfx.push({ t: d.start, type: 'pop' });

// 6b. Hiệu ứng của thư viện data/effects theo data/effects-rules.json (ngân sách, pool và tỉ lệ theo phong cách; --no-effects để tắt, --look id,id để phủ tông cho cả video)
const effects = [];
{
  const lib = loadLibrary();
  const R = readJson(path.join(skillRoot, 'data', 'effects-rules.json')).styles[style.id];
  const usable = (id) => { const e = lib.byId.get(id); return e && e.engine === 'video' && e.styles[style.id] !== 'avoid' ? e : null; };
  const clampDur = (e, want) => Math.min(e.dur.max, Math.max(e.dur.min, want ?? e.dur.default));
  const perMinuteBudget = (n) => Math.floor(((n ?? 0) * outDuration) / 60 + 0.0001);
  const totalMax = R ? Math.max(R.maxPerMinute > 0 && outDuration >= 8 ? 1 : 0, perMinuteBudget(R.maxPerMinute)) : 0;
  const strongMax = R ? perMinuteBudget(R.strongPerMinute) : 0;
  const spans = [];
  let strong = 0;
  const roomFor = (a, b) => spans.every(([x, y]) => a >= y + (R?.minGapSec ?? 0) || b <= x - (R?.minGapSec ?? 0));
  const rotate = new Map();
  const nextOf = (key, pool) => {
    const ok = pool.map(usable).filter(Boolean);
    if (!ok.length) return null;
    const i = (rotate.get(key) ?? Math.floor(rnd() * ok.length)) % ok.length;
    rotate.set(key, i + 1);
    return ok[i];
  };
  // Thêm một hiệu ứng nếu còn ngân sách, chỗ trống và không vượt trần cú mạnh; trả true nếu đã thêm
  const addEffect = (e, spec, oStart, oEnd) => {
    if (effects.length >= totalMax || !roomFor(oStart, oEnd)) return false;
    if (e.intensity >= 3 && strong >= strongMax) return false;
    if (e.intensity >= 3) strong++;
    spans.push([oStart, oEnd]);
    effects.push({ id: `e${effects.length + 1}`, effect: e.id, ...spec, auto: true });
    const audio = (e.sfx ?? []).map((id) => lib.byId.get(id)).find((a) => a && a.engine === 'audio' && a.styles[style.id] !== 'avoid' && (a.id !== 'whoosh' || style.sfx.whoosh) && (a.id !== 'pop' || style.sfx.pop));
    if (audio) sfx.push({ oT: Math.max(0, (oStart + oEnd) / 2 - (audio.peakAt ?? 0) * audio.dur.default), type: audio.id });
    return true;
  };
  if (R && !flags['no-effects']) {
    // Chuyển cảnh tại chỗ nối sau lần cắt
    if (R.atCut?.pool?.length) cuts.forEach((c, i) => {
      const join = c.start > 0.01 ? timeMap.toOut(c.end) : null;
      if (join === null || rnd() >= R.atCut.fraction) return;
      const e = nextOf('cut', R.atCut.pool);
      if (!e) return;
      const dur = clampDur(e, Math.min(e.dur.default, 0.7));
      addEffect(e, { atCut: i, dur }, join - dur / 2, join + dur / 2);
    });
    // Nhấn ở thẻ số liệu
    if (R.atStat?.pool?.length) for (const st of stats) {
      const o = timeMap.toOut(st.start);
      if (o === null || rnd() >= R.atStat.fraction) continue;
      const e = nextOf('stat', R.atStat.pool);
      if (!e) continue;
      const dur = clampDur(e);
      addEffect(e, { start: st.start, end: st.start + dur }, o, o + dur);
    }
    // Mở đầu ở nhịp hook
    if (R.atOpen?.pool?.length && beats.length && rnd() < R.atOpen.fraction) {
      const e = nextOf('open', R.atOpen.pool);
      const t0 = words[beats[0].startWord].start;
      const o = timeMap.toOut(t0);
      if (e && o !== null) { const dur = clampDur(e); addEffect(e, { start: t0, end: t0 + dur }, o, o + dur); }
    }
    // Thay một phần zoom nhấn thường bằng biến thể khác (cứng hơn hoặc mạnh hơn); zoom bị thay được bỏ khỏi punches
    for (const v of R.atPunch ?? []) {
      const e = usable(v.effect);
      if (!e) continue;
      for (const p of [...punches]) {
        const o = timeMap.toOut(p.start);
        if (o === null || rnd() >= v.fraction) continue;
        const dur = clampDur(e, p.end - p.start);
        if (addEffect(e, { start: p.start, end: p.start + dur, anchorWord: p.anchorWord }, o, o + dur)) punches.splice(punches.indexOf(p), 1);
      }
    }
  }
  // Tông phủ cả video do người dùng chọn: --look matte-fade,film-grain
  for (const id of flags.look ? String(flags.look).split(',') : []) {
    const e = lib.byId.get(id);
    if (!e || e.engine !== 'video') throw new Error(`--look: "${id}" không phải hiệu ứng hình trong data/effects`);
    effects.push({ id: `e${effects.length + 1}`, effect: id, start: 0, end: meta.duration, look: true });
  }
  punches.forEach((p, k) => { p.id = `p${k + 1}`; });
}

// Thẻ logo tự gợi ý khi lời nói nhắc thương hiệu trong data/brands.json (nhóm các lần nhắc cách nhau dưới 4s thành một thẻ; mỗi thẻ cách thẻ trước tối thiểu 12s)
const brandNames = new Map();
readJson(path.join(skillRoot, 'data', 'brands.json')).brands.forEach((b) => b.names.forEach((n) => brandNames.set(n, b.id)));
const cards = [...cardsBehind];
for (const w of words) {
  const id = brandNames.get(norm(w.text));
  if (!id || timeMap.toOut(w.start) === null || !inKept(w.start)) continue;
  const last = cards.at(-1);
  if (last && w.start - last.start < 4) { if (!last.brands.includes(id) && last.brands.length < 3) { last.brands.push(id); last.end = Math.max(last.end, w.start + 2.4); } continue; }
  if (last && w.start - last.start < 12) continue;
  if (overlapsAny(w.start, w.start + 2.6, [...bigCuts(), ...stats])) continue;
  cards.push({ id: `k${cards.length + 1}`, type: 'logos', brands: [id], start: w.start, end: w.start + 2.6 });
}
const requestedLayout = flags.layout ? String(flags.layout) : null;
if (requestedLayout && !['stack', 'follow', 'auto'].includes(requestedLayout)) throw new Error('--layout chỉ nhận stack, follow hoặc auto');
if (requestedLayout && meta.orientation === '9x16') throw new Error('--layout chỉ dùng cho video ngang (video gốc đã là dọc).');
// Chọn bố cục: follow cần mặt người nói đủ lớn và xuất hiện ở phần lớn video, không thì stack
const largest = (A.faces.samples ?? []).filter((x) => x.boxes.length).map((x) => Math.max(...x.boxes.map((bx) => bx[2]))).sort((p, q) => p - q);
const faceCoverage = A.faces.coverage ?? 0;
const medianFace = largest.length ? largest[Math.floor(largest.length / 2)] : 0;
const layoutKind = requestedLayout === 'auto' ? (faceCoverage >= 0.4 && medianFace >= 0.08 ? 'follow' : 'stack') : requestedLayout;
if (requestedLayout) console.log(`Bố cục ${layoutKind}${requestedLayout === 'auto' ? ` (tự chọn: mặt có ở ${(faceCoverage * 100).toFixed(0)}% mẫu, rộng trung vị ${(medianFace * 100).toFixed(0)}% khung${layoutKind === 'follow' ? '' : ', chưa đủ để bám mặt'})` : ''}`);
const stackMode = layoutKind === 'stack';
const followMode = layoutKind === 'follow';
const verticalSize = (stackMode || followMode) && !flags.size && meta.height <= 720 ? '720x1280' : flags.size ? String(flags.size) : undefined;
const layoutFields = stackMode
  ? { layout: 'stack', layoutY: 0.38, srcSize: { w: meta.width, h: meta.height } }
  : followMode ? { layout: 'follow', srcSize: { w: meta.width, h: meta.height }, follow: followPath(A.faces, { w: meta.width, h: meta.height }, meta.duration) } : {};
const plan = {
  version: 1,
  style: style.id,
  source: meta.source,
  orientation: stackMode || followMode ? '9x16' : meta.orientation,
  ...layoutFields,
  size: verticalSize,
  duration: meta.duration,
  language: A.language,
  generated: 'plan-skeleton: gợi ý theo quy tắc; tác tử sửa truy vấn, bỏ hoặc thêm mục rồi chạy plan-lint',
  safeZone: stackMode ? { x: 0, y: 0.38, w: 1, h: stackGeometry({ ...layoutFields, orientation: '9x16', size: verticalSize }).box.h, assumed: true } : followMode ? faceZone(mapFacesForLayout(A.faces, { ...layoutFields, orientation: '9x16' }), '9x16') : faceZone(A.faces, meta.orientation),
  cuts,
  keep: keepRanges ?? undefined,
  beats: beats.map(({ numbers, keywords, ...rest }) => ({ ...rest, numbers, keywords })),
  cutaways,
  punches,
  effects,
  stats,
  decor,
  cards,
  lowerThirds: [],
  captions: { mode: 'words', preset: style.captions.preset, maxWords: style.captions.maxWords, emphasis: [...new Set(beats.flatMap((b) => b.keywords))] },
  sfx,
  music: { file: null, duckDb: -12, level: -22 }
};
writeJson(String(flags.out), plan);
console.log(`Đã ghi ${flags.out}: ${beats.length} nhịp, ${cuts.length} cắt, ${cutaways.length} cutaway (${((brollOut / outDuration) * 100).toFixed(0)}% thời lượng), ${punches.length} zoom, ${effects.length} hiệu ứng thư viện, ${stats.length} thẻ số, ${decor.length} sticker.`);
if (footageCuts.length) console.log(`Footage riêng: ${footageCuts.length} cutaway (${footageCuts.filter((c) => c.presentation === 'demo').length} cảnh demo); thêm focus và marks cho cảnh demo rồi plan-lint.`);
if (droppedQueries.length) console.log(`Bỏ ${droppedQueries.length} cutaway vì truy vấn ảnh không đủ cụ thể (${[...new Set(droppedQueries)].join(' | ')}): thêm tay nếu có ảnh đúng, hoặc dùng --user-footage.`);
console.log(`Thời lượng sau cắt ${outDuration.toFixed(1)}s (gốc ${meta.duration.toFixed(1)}s). Việc tiếp: đọc từng cutaway.query, viết lại thành khái niệm cảnh bằng tiếng Anh, rồi node plan-lint.mjs.`);
