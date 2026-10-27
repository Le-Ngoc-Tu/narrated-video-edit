// Khâu B2: kiểm kế hoạch dựng trước khi tải tài nguyên và render. Mã thoát 1 nếu có lỗi cứng.
// Chạy: node plan-lint.mjs --plan work/edit-plan.json --analysis work/analysis [--stage plan|assets]
// --stage assets: đòi mọi cutaway đã có tệp tài nguyên và dòng ghi công.
import fs from 'node:fs';
import path from 'node:path';
import { args, makeTimeMap, probe, readJson } from './common.mjs';
import { bindVars, loadLibrary, makeCtx } from './fx-lib.mjs';
import { readReport, wrongSpellings } from './glossary-lib.mjs';
import { DEMO_THEMES, MARK_TYPES, validRect } from './demo-lib.mjs';
import { STOP, clipPlan, hasDigit, loadAnalysis, loadStyle, mapPlan, norm, speechGap } from './plan-lib.mjs';
import { segPythonPath, skillRoot } from './common.mjs';

const { flags } = args();
if (!flags.plan || !flags.analysis) { console.error('Dùng: node plan-lint.mjs --plan work/edit-plan.json --analysis work/analysis [--stage plan|assets]'); process.exit(2); }
const planFile = path.resolve(String(flags.plan));
const plan = readJson(planFile);
const A = loadAnalysis(String(flags.analysis));
const style = loadStyle(plan.style);
const words = A.words;
const stage = String(flags.stage ?? 'plan');
const results = [];
const check = (level, name, detail = '') => results.push({ level, name, detail });
const pass = (name, detail) => check('PASS', name, detail);
const fail = (name, detail) => check('FAIL', name, detail);
const warn = (name, detail) => check('WARN', name, detail);

const timeMap = makeTimeMap(plan.cuts);
const outDur = timeMap.outDuration(plan.duration);

// Mọi mốc phải nằm trong video và neo vào từ có thật
const windows = [...plan.cutaways.map((x) => ['cutaway', x]), ...plan.punches.map((x) => ['zoom', x]), ...plan.stats.map((x) => ['thẻ số', x]), ...plan.decor.map((x) => ['sticker', x]), ...(plan.cards ?? []).map((x) => ['thẻ headline', x])];
const badRange = windows.filter(([, x]) => !(x.start >= 0 && x.end > x.start && x.end <= plan.duration + 0.05));
badRange.length ? fail('mốc thời gian hợp lệ', badRange.map(([k, x]) => `${k} ${x.id}`).join(', ')) : pass('mốc thời gian hợp lệ', `${windows.length} mục trong ${plan.duration.toFixed(1)}s`);
const badAnchor = windows.filter(([, x]) => x.anchorWord !== undefined && !words[x.anchorWord]);
badAnchor.length ? fail('mọi mục neo vào từ có thật', badAnchor.map(([k, x]) => `${k} ${x.id}`).join(', ')) : pass('mọi mục neo vào từ có thật');

// Truy vấn tìm ảnh phải là khái niệm tiếng Anh: kho ảnh công khai chủ yếu có nhãn tiếng Anh
const viQuery = plan.cutaways.filter((c) => /[^\x00-\x7f]/.test(String(c.query ?? '')));
viQuery.length ? warn('truy vấn cutaway là khái niệm tiếng Anh', `${viQuery.map((c) => c.id).join(', ')} còn tiếng Việt: viết lại thành cảnh cụ thể bằng tiếng Anh (references/03-planning.md)`) : pass('truy vấn cutaway là khái niệm tiếng Anh');

// Cutaway không cắt ngang một từ và không rơi vào đoạn đã cắt
const straddle = [];
for (const c of plan.cutaways) for (const t of [c.start, c.end]) {
  const w = words.find((x) => t > x.start + 0.06 && t < x.end - 0.06);
  if (w) straddle.push(`${c.id}@${t.toFixed(2)} giữa từ "${w.text}"`);
}
straddle.length ? fail('cutaway bắt đầu và kết thúc ở ranh giới từ', straddle.join('; ')) : pass('cutaway bắt đầu và kết thúc ở ranh giới từ');
const inCut = plan.cutaways.filter((c) => timeMap.toOut(c.start) === null);
inCut.length ? fail('cutaway không nằm trong đoạn bị cắt', inCut.map((c) => c.id).join(', ')) : pass('cutaway không nằm trong đoạn bị cắt');

// Thời lượng cutaway và tỉ lệ rời mặt người nói
const cm = style.cutaway;
const outOfRange = plan.cutaways.filter((c) => c.presentation !== 'demo' && (c.end - c.start < cm.minSec * 0.75 || c.end - c.start > cm.maxSec * 1.25));
outOfRange.length ? warn('thời lượng cutaway trong khoảng của phong cách', outOfRange.map((c) => `${c.id} ${(c.end - c.start).toFixed(1)}s`).join(', ')) : pass('thời lượng cutaway trong khoảng của phong cách', `${cm.minSec} đến ${cm.maxSec}s`);
const MODES = ['fullbleed', 'card', 'polaroid', 'pip', 'sticker', 'peek', 'stack', 'demo'];
const badMode = plan.cutaways.filter((c) => c.presentation && !MODES.includes(c.presentation));
badMode.length ? fail('kiểu trình bày cutaway hợp lệ', badMode.map((c) => `${c.id}:${c.presentation}`).join(', ')) : pass('kiểu trình bày cutaway hợp lệ', MODES.join(', '));
const badClip = plan.cutaways.filter((c) => (c.clipStart !== undefined && !(Number.isFinite(c.clipStart) && c.clipStart >= 0)) || (c.clipFit !== undefined && !['cover', 'contain'].includes(c.clipFit)));
badClip.length ? fail('clipStart và clipFit của cutaway hợp lệ', badClip.map((c) => `${c.id}: clipStart ${c.clipStart ?? '-'}, clipFit ${c.clipFit ?? '-'} (clipStart là giây ≥ 0; clipFit: cover hoặc contain)`).join('; ')) : pass('clipStart và clipFit của cutaway hợp lệ');
// Cảnh demo (voice-over trên màn hình): chủ đề có trong data/demo-themes.json, vùng zoom (focus) và chú thích (marks) hợp lệ và nằm trong cửa sổ, tổng thời lượng demo dưới trần riêng của phong cách (người nói vắng mặt trong lúc demo)
const demoCuts = plan.cutaways.filter((c) => c.presentation === 'demo');
if (demoCuts.length) {
  const problems = [];
  demoCuts.forEach((c) => {
    if (c.theme !== undefined && !DEMO_THEMES[c.theme]) problems.push(`${c.id}: theme "${c.theme}" (có: ${Object.keys(DEMO_THEMES).join(', ')})`);
    const inside = (x) => x.end > x.start && x.start >= c.start - 0.01 && x.end <= c.end + 0.01;
    const focus = [...(c.focus ?? [])].sort((a, b) => a.start - b.start);
    focus.forEach((f, i) => {
      if (!validRect(f.rect) || !inside(f)) problems.push(`${c.id}: focus ${i + 1} có rect ngoài 0..1 hoặc nằm ngoài cửa sổ cutaway`);
      if (i && f.start < focus[i - 1].end) problems.push(`${c.id}: focus ${i} và ${i + 1} chồng nhau`);
    });
    (c.marks ?? []).forEach((m, i) => { if (!MARK_TYPES.includes(m.type) || !validRect(m.rect) || !inside(m)) problems.push(`${c.id}: marks ${i + 1} sai type (${MARK_TYPES.join(', ')}), rect ngoài 0..1 hoặc nằm ngoài cửa sổ cutaway`); });
  });
  const count = (k) => demoCuts.reduce((t, c) => t + (c[k] ?? []).length, 0);
  problems.length ? fail('cảnh demo hợp lệ (theme, focus, marks)', problems.join('; ')) : pass('cảnh demo hợp lệ (theme, focus, marks)', `${demoCuts.length} cảnh, ${count('focus')} vùng zoom, ${count('marks')} chú thích`);
  const demoShare = demoCuts.reduce((t, c) => t + (c.end - c.start), 0) / outDur;
  const demoCap = style.demoMaxShare ?? 0.7;
  demoShare > demoCap + 0.1 ? fail('tỉ lệ cảnh demo (người nói vắng mặt)', `${(demoShare * 100).toFixed(0)}% > ${(demoCap * 100).toFixed(0)}%`) : demoShare > demoCap ? warn('tỉ lệ cảnh demo (người nói vắng mặt)', `${(demoShare * 100).toFixed(0)}%`) : pass('tỉ lệ cảnh demo (người nói vắng mặt)', `${(demoShare * 100).toFixed(0)}% (trần ${(demoCap * 100).toFixed(0)}%)`);
}
const isFullbleed = (c) => !c.presentation || c.presentation === 'fullbleed';
const modeRun = plan.cutaways.filter((c, i, a) => i && c.presentation === a[i - 1].presentation && !isFullbleed(c));
modeRun.length ? warn('không lặp liên tiếp cùng một kiểu showcase', modeRun.map((c) => c.id).join(', ')) : pass('không lặp liên tiếp cùng một kiểu showcase');
const share = plan.cutaways.filter(isFullbleed).reduce((s, c) => s + (c.end - c.start), 0) / outDur;
share > style.brollMaxShare + 0.1 ? fail('tỉ lệ rời mặt người nói', `${(share * 100).toFixed(0)}% > ${(style.brollMaxShare * 100).toFixed(0)}%`) : share > style.brollMaxShare ? warn('tỉ lệ rời mặt người nói', `${(share * 100).toFixed(0)}%`) : pass('tỉ lệ rời mặt người nói', `${(share * 100).toFixed(0)}% (trần ${(style.brollMaxShare * 100).toFixed(0)}%)`);

// Không chồng chéo và không lặp công thức
const sorted = [...plan.cutaways].sort((a, b) => a.start - b.start);
const overlap = sorted.filter((c, i) => i && c.start < sorted[i - 1].end);
overlap.length ? fail('cutaway không chồng nhau', overlap.map((c) => c.id).join(', ')) : pass('cutaway không chồng nhau');
let run3 = 0;
let maxRun = 1;
sorted.forEach((c, i) => { run3 = i && `${c.zoom}|${c.fit}` === `${sorted[i - 1].zoom}|${sorted[i - 1].fit}` ? run3 + 1 : 1; maxRun = Math.max(maxRun, run3); });
maxRun >= 3 ? fail('không quá 2 cutaway liên tiếp cùng kiểu', `${maxRun} liên tiếp`) : pass('không quá 2 cutaway liên tiếp cùng kiểu');

// Thẻ headline (title, compare, logos, bigtext, comment, actions, counter): kiểu hợp lệ, thương hiệu có trong data/brands.json, chữ có số phải có nguồn
const brandIds = new Set(JSON.parse(fs.readFileSync(path.join(skillRoot, 'data', 'brands.json'), 'utf8')).brands.map((b) => b.id));
const CARD_TYPES = ['title', 'compare', 'logos', 'bigtext', 'comment', 'actions', 'counter', 'orbit', 'wall', 'headline', 'chips', 'textspam'];
const cardProblem = (c) => {
  if (c.type === 'headline') return !(c.lines ?? []).some((l) => String(l).trim());
  if (c.type === 'chips') return !(c.items ?? []).some((it) => (typeof it === 'string' ? it : it?.label));
  if (c.type === 'textspam') return !String(c.text ?? '').trim() || (c.count !== undefined && !(Number.isInteger(c.count) && c.count >= 3 && c.count <= 14));
  if (c.type === 'title') return (c.highlight !== undefined && !(Array.isArray(c.highlight) && c.highlight.every((p) => typeof p === 'string' && String(c.text ?? '').toLowerCase().includes(p.toLowerCase())))) || (c.kicker !== undefined && typeof c.kicker !== 'string');
  return false;
};
const badCard = (plan.cards ?? []).filter((c) => !CARD_TYPES.includes(c.type) || cardProblem(c) || (['bigtext', 'comment'].includes(c.type) && !String(c.text ?? '').trim()) || (c.type === 'counter' && !(c.rows ?? []).some((r) => r.label && Number.isFinite(Number(r.to)))) || (c.type === 'wall' && !(c.items ?? []).length) || (c.type === 'orbit' && (c.items ?? []).length < 3) || (c.type === 'logos' && !(c.brands ?? []).length) || (c.brands ?? []).some((b) => !brandIds.has(b)));
badCard.length ? fail('thẻ headline hợp lệ', badCard.map((c) => c.id).join(', ')) : pass('thẻ headline hợp lệ', `${(plan.cards ?? []).length} thẻ`);
// Thẻ orbit và wall nằm SAU người nói nên cần mặt nạ người; thiếu môi trường tách người thì wall che kín cả người
const needMask = (plan.cards ?? []).filter((c) => ['orbit', 'wall'].includes(c.type));
if (needMask.length) segPythonPath() ? pass('môi trường tách người cho thẻ orbit và wall') : fail('môi trường tách người cho thẻ orbit và wall', 'chạy node setup.mjs --with-segmentation (không có mặt nạ người thì thẻ che cả người nói)');
const cardText = (c) => [c.text, c.sub, c.title, c.kicker, ...(c.lines ?? []), c.left?.title, c.left?.sub, c.right?.title, c.right?.sub, ...(c.rows ?? []).flatMap((r) => [r.from, r.to, r.label]), ...(c.items ?? []).map((i) => (typeof i === 'string' ? i : i.label))].filter((x) => x !== undefined && x !== null && x !== '').join(' ');
const cardsBadNumber = (plan.cards ?? []).filter((c) => hasDigit(cardText(c)) && !(plan.userSource ?? []).some((u) => cardText(c).toLowerCase().includes(String(u).toLowerCase())) && !spokenHas(cardText(c)));
function spokenHas(text) { const digits = (text.match(/\d+/g) ?? []); return digits.every((d) => words.some((w, i) => { let acc = ''; for (let k = 0; k < 3 && words[i + k]; k++) { acc += words[i + k].text.replace(/[^\d]/g, ''); if (acc === d) return true; } return false; })); }
cardsBadNumber.length ? fail('số trên thẻ headline có trong lời nói', cardsBadNumber.map((c) => c.id).join(', ')) : pass('số trên thẻ headline có trong lời nói');

// Chữ của thẻ kicker, headline, chips, textspam chỉ lấy từ lời nói quanh mốc neo (±3s, sai lệch cho phép 25% số từ nội dung) hoặc từ nguồn người dùng đưa (userSource)
const shownText = (c) => (c.type === 'headline' ? [(c.lines ?? []).join(' ')] : c.type === 'chips' ? [c.title, ...(c.items ?? []).map((it) => (typeof it === 'string' ? it : it?.label))] : c.type === 'textspam' ? [c.text] : c.type === 'title' ? [c.kicker] : []).filter(Boolean).map(String);
const unspoken = [];
for (const c of plan.cards ?? []) {
  const near = new Set(words.filter((w) => w.end >= c.start - 3 && w.start <= c.end + 3).map((w) => norm(w.text)));
  for (const text of shownText(c)) {
    if ((plan.userSource ?? []).some((u) => String(u).toLowerCase().includes(text.toLowerCase()))) continue;
    const content = text.split(/\s+/).map(norm).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));
    const missing = content.filter((w) => !near.has(w));
    if (content.length && missing.length / content.length > 0.25) unspoken.push(`${c.id}: "${text}" (không nghe thấy: ${missing.join(', ')})`);
  }
}
unspoken.length ? fail('chữ trên thẻ mới có trong lời nói quanh mốc neo', unspoken.join('; ')) : pass('chữ trên thẻ mới có trong lời nói quanh mốc neo');

// Sticker theo phong cách
const perMin = plan.decor.length / (outDur / 60);
// Video ngắn vẫn được một sticker (sàn chống slideshow bên dưới đòi ít nhất một): trần tính theo số sticker, tối thiểu 1
const decorCap = Math.max(1, Math.floor((style.decor.maxPerMinute * 1.3 * outDur) / 60));
plan.decor.length > decorCap ? fail('mật độ sticker', `${perMin.toFixed(1)}/phút > ${style.decor.maxPerMinute}`) : pass('mật độ sticker', `${perMin.toFixed(1)}/phút (trần ${style.decor.maxPerMinute})`);
const badType = plan.decor.filter((d) => !style.decor.allowed.includes(d.type));
const iconNoQuery = plan.decor.filter((d) => d.type === 'icon' && !String(d.query ?? '').trim());
iconNoQuery.length ? fail('sticker icon có truy vấn tiếng Anh', iconNoQuery.map((d) => d.id).join(', ')) : pass('sticker icon có truy vấn tiếng Anh');
badType.length ? fail('loại sticker được phép trong phong cách', badType.map((d) => `${d.id}:${d.type}`).join(', ')) : pass('loại sticker được phép trong phong cách');

// Hiệu ứng của thư viện data/effects (plan.effects): id và thông số hợp lệ, engine video, thời lượng, ngân sách theo phong cách (data/effects-rules.json), an toàn nhấp nháy
const planEffects = plan.effects ?? [];
if (planEffects.length) {
  const lib = loadLibrary();
  const rules = JSON.parse(fs.readFileSync(path.join(skillRoot, 'data', 'effects-rules.json'), 'utf8'));
  const L = rules.lint;
  const R = rules.styles[style.id];
  const problems = [];
  const warns = [];
  planEffects.forEach((x) => {
    const e = lib.byId.get(x.effect);
    if (!e) { problems.push(`${x.id}: hiệu ứng "${x.effect}" không có trong data/effects`); return; }
    if (e.engine !== 'video') { problems.push(`${x.id}: ${e.id} thuộc engine ${e.engine}, compose-base chỉ áp engine video`); return; }
    try { bindVars(e, x.params, makeCtx({ W: 1920, H: 1080 }), lib.dsl, e.dur.default); } catch (err) { problems.push(`${x.id}: ${err.message}`); return; }
    const len = x.atCut !== undefined ? x.dur : x.end - x.start;
    if (x.atCut !== undefined ? !(plan.cuts[x.atCut] && x.dur > 0) : !(x.start >= 0 && x.end > x.start && x.end <= plan.duration + 0.05)) problems.push(`${x.id}: mốc thời gian không hợp lệ`);
    if (!x.look && (len < e.dur.min * L.shortMinDurFactor || len > e.dur.max * L.shortMaxDurFactor)) warns.push(`${x.id} ${e.id} ${len.toFixed(2)}s ngoài khoảng ${e.dur.min} đến ${e.dur.max}s`);
    if (e.styles[style.id] === 'avoid') warns.push(`${x.id} ${e.id} nên tránh ở phong cách ${style.id}`);
    if ((e.needs ?? []).includes('faces') && (A.faces.coverage ?? 0) < 0.05) warns.push(`${x.id} ${e.id} cần vị trí mặt nhưng không dò được mặt: dùng tâm mặc định`);
  });
  problems.length ? fail('hiệu ứng thư viện hợp lệ', problems.join('; ')) : pass('hiệu ứng thư viện hợp lệ', `${planEffects.length} mục`);
  warns.length ? warn('hiệu ứng thư viện hợp phong cách và khoảng thời lượng', warns.join('; ')) : pass('hiệu ứng thư viện hợp phong cách và khoảng thời lượng');
  if (!problems.length) {
    const own = planEffects.filter((x) => !x.look);
    const minutes = outDur / 60;
    if (R && own.length) {
      const cap = Math.max(1, R.maxPerMinute * L.maxPerMinuteFactor * minutes);
      own.length > cap ? fail('mật độ hiệu ứng thư viện', `${own.length} mục > ${cap.toFixed(1)} cho ${outDur.toFixed(0)}s (phong cách ${style.id})`) : pass('mật độ hiệu ứng thư viện', `${own.length} mục (trần ${cap.toFixed(1)})`);
      const strongN = own.filter((x) => lib.byId.get(x.effect).intensity >= 3).length;
      const strongCap = Math.max(L.minStrongAllowed, R.strongPerMinute * L.maxStrongPerMinuteFactor * minutes);
      strongN > strongCap ? fail('cú mạnh chạm cả khung hình (intensity 3)', `${strongN} > ${strongCap.toFixed(1)}`) : pass('cú mạnh chạm cả khung hình (intensity 3)', `${strongN} (trần ${strongCap.toFixed(1)})`);
    }
    // Nhấp nháy: tổng số lần chớp khai báo của các cửa sổ bắt đầu trong cùng 1 giây không quá ngưỡng (WCAG 2.3.1: dưới 3 lần mỗi giây)
    const wins = mapPlan(plan, words, timeMap).effects.map((x) => ({ s: x.oStart, flash: lib.byId.get(x.effect).flash ?? 0 })).filter((w) => w.flash > 0);
    const worst = Math.max(0, ...wins.map((w) => wins.filter((v) => v.s >= w.s && v.s < w.s + L.flashWindowSec).reduce((sum, v) => sum + v.flash, 0)));
    worst > L.flashPerSecond ? fail('an toàn nhấp nháy (dưới 3 lần chớp mỗi giây)', `${worst.toFixed(1)} lần trong 1 giây`) : pass('an toàn nhấp nháy (dưới 3 lần chớp mỗi giây)', wins.length ? `tối đa ${worst.toFixed(1)}/giây` : 'không có hiệu ứng chớp');
  }
}

// Trung thực: giá trị thẻ số và chữ lower third phải có trong lời nói (hoặc nguồn người dùng đưa)
const spoken = words.map((w) => norm(w.text)).join(' ');
const userSource = (plan.userSource ?? []).join(' ').toLowerCase();
// Whisper có thể tách một số thành nhiều từ ("500", ".000"): ghép chữ số của tối đa 3 từ liền kề
const spokenDigits = new Set();
words.forEach((_, i) => { let acc = ''; for (let k = 0; k < 3 && words[i + k]; k++) { acc += words[i + k].text.replace(/[^\d]/g, ''); if (acc) spokenDigits.add(acc); } });
const badStat = plan.stats.filter((s) => {
  const digits = String(s.value).replace(/[^\d]/g, '');
  const ok = digits && (spokenDigits.has(digits) || userSource.includes(String(s.value).toLowerCase()));
  return !ok;
});
badStat.length ? fail('số liệu trên màn hình có trong lời nói', badStat.map((s) => `${s.id}="${s.value}"`).join(', ')) : pass('số liệu trên màn hình có trong lời nói', `${plan.stats.length} thẻ`);
const badLt = (plan.lowerThirds ?? []).filter((l) => hasDigit(`${l.title} ${l.sub ?? ''}`) && !spoken.includes(norm(l.title)) && !userSource.includes(String(l.title).toLowerCase()));
badLt.length ? fail('chữ có số trong lower third có nguồn', badLt.map((l) => l.title).join(', ')) : pass('chữ có số trong lower third có nguồn');

// Tên riêng (data/glossary.json, work/glossary.json): chữ trên thẻ không dùng cách viết sai đã biết; biến thể mơ hồ chưa được người dùng xác nhận là cảnh báo (CỔNG 1)
const glossary = readReport(A.dir);
if (glossary) {
  const shown = [...(plan.cards ?? []).map((c) => [c.id, cardText(c)]), ...(plan.lowerThirds ?? []).map((l, k) => [`lowerThird${k + 1}`, `${l.title} ${l.sub ?? ''}`]), ...plan.stats.map((s) => [s.id, `${s.value} ${s.label ?? ''}`])];
  const wrong = shown.flatMap(([id, text]) => wrongSpellings(text, glossary).map((x) => `${id}: "${x.shown}" thay vì "${x.canonical}"`));
  wrong.length ? fail('chữ trên màn hình viết đúng tên riêng theo từ điển', wrong.join('; ')) : pass('chữ trên màn hình viết đúng tên riêng theo từ điển', `${glossary.applied.length} từ đã thay trong lời nói`);
  glossary.pending.length ? warn('tên riêng mơ hồ đã được người dùng xác nhận', glossary.pending.map((p) => p.question).join(' | ')) : pass('tên riêng mơ hồ đã được người dùng xác nhận', 'không còn biến thể chờ xác nhận');
}

// Không chồng hai vật thể lớn trong cùng cửa sổ: cảnh phủ kín (fullbleed, demo), thẻ số và thẻ chữ lớn (title, compare, logos, comment, counter, headline, chips). Chữ sau người nói, tường, quỹ đạo và chữ nhân bản là lớp nền nên không tính
const BIG_CARDS = ['title', 'compare', 'logos', 'comment', 'counter', 'headline', 'chips'];
const bigObjs = [
  ...plan.cutaways.filter((c) => !c.presentation || c.presentation === 'fullbleed' || c.presentation === 'demo').map((c) => [`cutaway ${c.presentation ?? 'fullbleed'} ${c.id}`, c]),
  ...plan.stats.map((x) => [`thẻ số ${x.id}`, x]),
  ...(plan.cards ?? []).filter((c) => BIG_CARDS.includes(c.type)).map((c) => [`thẻ ${c.type} ${c.id}`, c])
].sort((a, b) => a[1].start - b[1].start);
const bigClash = [];
bigObjs.forEach(([na, a], i) => bigObjs.slice(i + 1).forEach(([nb, b]) => { if (b.start < a.end - 0.05 && b.end > a.start + 0.05) bigClash.push(`${na} và ${nb}`); }));
bigClash.length ? fail('không chồng hai vật thể lớn trong cùng cửa sổ', bigClash.join('; ')) : pass('không chồng hai vật thể lớn trong cùng cửa sổ', `${bigObjs.length} vật thể`);

// Sàn chống slideshow: video đủ dài cần có zoom nhấn, sticker và cutaway; không quá lâu không có sự kiện hình
if (outDur >= 12) {
  const missing = [plan.punches.length ? null : 'zoom nhấn', plan.decor.length ? null : 'sticker', plan.cutaways.length ? null : 'cutaway'].filter(Boolean);
  missing.length ? fail('sàn chống slideshow', `thiếu ${missing.join(', ')}`) : pass('sàn chống slideshow', 'có zoom, sticker, cutaway');
}
// Tính trên giờ thành phẩm (như audit): đoạn bị cắt không còn trong video nên không tính vào khoảng trống; chỗ nối sau mỗi lần cắt là một sự kiện hình
const outWords = words.map((w) => ({ oStart: timeMap.toOut(w.start), oEnd: timeMap.toOut(w.end - 0.001) })).filter((w) => w.oStart !== null && w.oEnd !== null).map((w) => ({ oStart: w.oStart, oEnd: w.oEnd + 0.001 }));
// Cảnh demo là clip chạy liên tục (không phải khung tĩnh): cứ 4s trong cửa sổ demo tính một sự kiện hình
const demoTicks = plan.cutaways.filter((c) => c.presentation === 'demo').flatMap((c) => Array.from({ length: Math.max(0, Math.ceil((c.end - c.start) / 4)) }, (_, k) => c.start + k * 4));
const events = [...windows.map(([, x]) => x.start), ...plan.cuts.map((c) => c.end), ...A.shotCuts, ...demoTicks].map((t) => (t >= 0 && t < plan.duration ? timeMap.toOut(t) : null)).filter((t) => t !== null).sort((a, b) => a - b);
let maxGap = events.length ? speechGap(0, events[0], outWords, 'oStart', 'oEnd') : outDur;
let gapAt = 0;
events.forEach((t, i) => { const g = speechGap(t, events[i + 1] ?? outDur, outWords, 'oStart', 'oEnd'); if (g > maxGap) { maxGap = g; gapAt = t; } });
const gapLimit = style.maxEventGap ?? 6;
maxGap > gapLimit * 1.25 ? fail('khoảng trống sự kiện hình', `${maxGap.toFixed(1)}s có lời nói mà không có sự kiện từ giây ${gapAt.toFixed(1)} của video thành phẩm (trần ${gapLimit}s của phong cách)`) : maxGap > gapLimit * 0.6 ? warn('khoảng trống sự kiện hình', `${maxGap.toFixed(1)}s (khuyến nghị ≤ ${(gapLimit * 0.6).toFixed(1)}s)`) : pass('khoảng trống sự kiện hình', `tối đa ${maxGap.toFixed(1)}s`);

// Giai đoạn tài nguyên: mọi cutaway đã có tệp và dòng ghi công
if (stage === 'assets') {
  const base = path.dirname(planFile);
  const credits = (() => { try { return readJson(path.join(base, 'assets', 'credits.json')); } catch { return []; } })();
  const lacking = plan.cutaways.filter((c) => !c.asset || !fs.existsSync(path.resolve(base, c.asset)));
  lacking.length ? fail('cutaway có tệp tài nguyên', lacking.map((c) => c.id).join(', ')) : pass('cutaway có tệp tài nguyên');
  const noCredit = plan.cutaways.filter((c) => c.asset && !credits.some((x) => path.resolve(base, c.asset).endsWith(path.normalize(x.file))) && !c.userProvided);
  noCredit.length ? fail('mọi tài nguyên tải về có dòng ghi công', noCredit.map((c) => c.id).join(', ')) : pass('mọi tài nguyên tải về có dòng ghi công');
  // Clip chạy một lần (của người dùng hoặc có clipStart): clipStart phải nằm trong clip; clip ngắn hơn cửa sổ thì giữ khung cuối
  const onceClips = plan.cutaways.filter((c) => c.asset && fs.existsSync(path.resolve(base, c.asset)) && (c.kind === 'video' || /\.(mp4|webm|mov)$/i.test(c.asset)) && clipPlan(c).once);
  const lengths = onceClips.map((c) => ({ c, left: probe(path.resolve(base, c.asset)).duration - clipPlan(c).start }));
  const pastEnd = lengths.filter((x) => x.left <= 0.1);
  const short = lengths.filter((x) => x.left > 0.1 && x.left < (x.c.end - x.c.start) - 0.1);
  pastEnd.length ? fail('clipStart nằm trong clip', pastEnd.map((x) => `${x.c.id} (clipStart ${x.c.clipStart} vượt độ dài clip)`).join(', ')) : pass('clipStart nằm trong clip', `${onceClips.length} clip chạy một lần`);
  short.length ? warn('clip đủ dài cho cửa sổ cutaway', short.map((x) => `${x.c.id}: còn ${x.left.toFixed(1)}s so với ${(x.c.end - x.c.start).toFixed(1)}s, phần sau giữ khung cuối`).join('; ')) : pass('clip đủ dài cho cửa sổ cutaway');
}

for (const r of results) console.log(`${r.level.padEnd(4)} ${r.name}${r.detail ? `: ${r.detail}` : ''}`);
const failed = results.filter((r) => r.level === 'FAIL').length;
console.log(failed ? `\nTRƯỢT ${failed} hạng mục` : `\nĐẠT${results.some((r) => r.level === 'WARN') ? ' (có cảnh báo cần xem)' : ''}`);
process.exit(failed ? 1 : 0);
