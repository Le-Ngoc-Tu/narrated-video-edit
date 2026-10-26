// Khâu B0 (tùy chọn): chọn các đoạn QUAN TRỌNG của một video dài để chỉ dựng bản highlight.
// Chạy: node pick-highlights.mjs --analysis work/analysis --out work/highlights.json [--target 75] [--min 7] [--max 15] [--bins 8]
// Cách chấm: số liệu nói ra, câu hỏi và cảm thán, từ khóa có emoji, tỉ lệ từ nội dung, đổi cảnh gốc, có mặt người nói, tốc độ nói, độ tin cậy phiên âm.
// Chọn tốt nhất mỗi đoạn thời gian (bins) để bản highlight trải đều câu chuyện, rồi xếp theo thứ tự thời gian. Ranh giới luôn nằm giữa hai từ.
// Kết quả dùng cho: plan-skeleton.mjs --keep work/highlights.json
import path from 'node:path';
import { args, readJson, skillRoot, writeJson } from './common.mjs';
import { STOP, hasDigit, loadAnalysis, norm } from './plan-lib.mjs';

const { flags } = args();
if (!flags.analysis || !flags.out) { console.error('Dùng: node pick-highlights.mjs --analysis work/analysis --out work/highlights.json [--target 75] [--min 7] [--max 15] [--bins 8]'); process.exit(2); }
const A = loadAnalysis(String(flags.analysis));
const target = Number(flags.target ?? 75);
const minSec = Number(flags.min ?? 7);
const maxSec = Number(flags.max ?? 15);
const words = A.words;
const duration = A.meta.duration;
const bins = Number(flags.bins ?? Math.max(4, Math.round(target / 10)));

const emojiMap = readJson(path.join(skillRoot, 'data', 'emoji-map.json')).map;
const emojiWords = new Set(emojiMap.flatMap((m) => m.any.map(norm)));

// 1. Câu: ngắt tại dấu câu, khoảng lặng từ 0,5s, hoặc quá dài tại chỗ nghỉ nhỏ
const sentences = [];
let cur = [];
words.forEach((w, i) => {
  cur.push(i);
  const next = words[i + 1];
  const gap = next ? next.start - w.end : Infinity;
  const elapsed = w.end - words[cur[0]].start;
  if (!next || /[.!?…]$/.test(w.text) || gap >= 0.5 || (elapsed >= 8 && gap >= 0.15) || elapsed >= 12) { sentences.push(cur); cur = []; }
});

// 2. Chấm điểm từng câu
const faceSamples = (A.faces.samples ?? []);
const scoreSentence = (idx) => {
  const ws = idx.map((i) => words[i]);
  const s = ws[0].start;
  const e = ws.at(-1).end;
  const dur = Math.max(0.1, e - s);
  const text = ws.map((w) => w.text).join(' ');
  const reasons = [];
  let score = 0;
  const numbers = ws.filter((w) => hasDigit(w.text)).length;
  if (numbers) { score += Math.min(3, numbers) * 1.2; reasons.push('có số liệu'); }
  if (/[?]$/.test(text)) { score += 1; reasons.push('câu hỏi'); }
  if (/!$/.test(text)) { score += 1; reasons.push('cảm thán'); }
  const emo = ws.filter((w) => emojiWords.has(norm(w.text))).length;
  if (emo) { score += Math.min(3, emo) * 0.7; reasons.push('từ khóa có emoji'); }
  const content = ws.filter((w) => !STOP.has(norm(w.text)) && norm(w.text).length >= 3).length / ws.length;
  score += content * 1.5;
  const conf = ws.reduce((a, w) => a + (w.confidence ?? 0.9), 0) / ws.length;
  if (conf < 0.75) { score -= 2; reasons.push('phiên âm kém tin cậy'); }
  const cutsIn = A.shotCuts.filter((t) => t > s && t < e).length;
  if (cutsIn) { score += Math.min(3, cutsIn) * 0.4; reasons.push('đổi cảnh'); }
  const withFace = faceSamples.filter((x) => x.t >= s && x.t <= e);
  if (withFace.length && withFace.filter((x) => x.boxes.length).length / withFace.length > 0.4) { score += 0.8; reasons.push('có người nói'); }
  const rate = ws.length / dur;
  if (rate >= 2.2 && rate <= 4.5) score += 0.5;
  if (ws.length < 3) score -= 1;
  return { startWord: idx[0], endWord: idx.at(-1), start: s, end: e, score, reasons, text };
};
const scored = sentences.map(scoreSentence);

// 3. Ứng viên: gộp các câu liền nhau đến khi đủ độ dài tối thiểu, không quá tối đa
const candidates = [];
for (let a = 0; a < scored.length; a++) {
  let sum = 0;
  const reasons = new Set();
  for (let b = a; b < scored.length; b++) {
    const dur = scored[b].end - scored[a].start;
    if (b > a && scored[b].start - scored[b - 1].end > 1.5) break;
    if (dur > maxSec * 1.2) break;
    sum += scored[b].score;
    scored[b].reasons.forEach((r) => reasons.add(r));
    if (dur >= minSec) candidates.push({ a, b, start: scored[a].start, end: scored[b].end, dur, score: sum / dur ** 0.6, reasons: [...reasons], text: scored.slice(a, b + 1).map((x) => x.text).join(' ') });
  }
}

// 4. Chọn tốt nhất trong từng đoạn thời gian, không chồng nhau
const picked = [];
const free = (c) => picked.every((p) => c.end <= p.start - 6 || c.start >= p.end + 6);
for (let k = 0; k < bins; k++) {
  const lo = (duration * k) / bins;
  const hi = (duration * (k + 1)) / bins;
  const best = candidates.filter((c) => c.start >= lo && c.start < hi && free(c)).sort((x, y) => y.score - x.score)[0];
  if (best) picked.push(best);
}
let total = picked.reduce((s, c) => s + c.dur, 0);
while (total > target * 1.15 && picked.length > 3) {
  const worst = picked.reduce((w, c) => (c.score < w.score ? c : w), picked[0]);
  picked.splice(picked.indexOf(worst), 1);
  total -= worst.dur;
}
picked.sort((x, y) => x.start - y.start);

// 5. Ranh giới nằm giữa hai từ: đệm trước 0,15s và sau 0,25s nhưng không chạm từ kế bên
const ranges = picked.map((c) => {
  const first = words[scored[c.a].startWord];
  const last = words[scored[c.b].endWord];
  const prev = words[scored[c.a].startWord - 1];
  const next = words[scored[c.b].endWord + 1];
  const start = Math.max(0, prev ? Math.max(first.start - 0.15, (prev.end + first.start) / 2) : first.start - 0.15);
  const end = Math.min(duration, next ? Math.min(last.end + 0.25, (last.end + next.start) / 2) : last.end + 0.25);
  return { start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), score: Number(c.score.toFixed(2)), reasons: c.reasons, text: c.text };
});
const outTotal = ranges.reduce((s, r) => s + (r.end - r.start), 0);
writeJson(String(flags.out), { source: A.meta.source, sourceDuration: duration, target, total: Number(outTotal.toFixed(1)), ranges });
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
console.log(`Chọn ${ranges.length} đoạn, tổng ${outTotal.toFixed(1)}s (mục tiêu ${target}s) trong ${mmss(duration)}:`);
ranges.forEach((r, i) => console.log(`${i + 1}. ${mmss(r.start)} đến ${mmss(r.end)} (${(r.end - r.start).toFixed(1)}s, điểm ${r.score}; ${r.reasons.join(', ') || 'nhịp chung'}): ${r.text.slice(0, 110)}`));
