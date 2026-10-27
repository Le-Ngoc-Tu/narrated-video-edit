// Bảng storyboard bằng ẢNH cho CỔNG 1: mỗi sự kiện trong edit-plan.json một hàng gồm khung hình gốc tại lúc sự kiện bắt đầu, mốc giờ, câu đang nói, xử lý và âm thanh, để người dùng xem rồi chốt TRƯỚC khi tải tài nguyên và dựng.
// Chạy: node plan-board.mjs --plan work/edit-plan.json [--analysis work/analysis] [--out work]
// Khung hình giữ đúng tỉ lệ của video gốc (nguồn ngang trong bố cục dọc hiện có viền đen), không bóp méo.
// Ra work/plan-board.png và plan-board.md. Hàm chỉ ĐỌC kế hoạch và video gốc; không đổi gì trong kế hoạch.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { args, ffmpeg, launchChrome, readJson } from './common.mjs';
import { readReport } from './glossary-lib.mjs';

const { flags } = args();
if (!flags.plan) { console.error('Dùng: node plan-board.mjs --plan work/edit-plan.json [--analysis work/analysis] [--out work]'); process.exit(2); }
const planFile = path.resolve(String(flags.plan));
const plan = readJson(planFile);
const work = path.resolve(String(flags.out || path.dirname(planFile)));
const analysisDir = path.resolve(String(flags.analysis || path.join(path.dirname(planFile), 'analysis')));
const words = readJson(path.join(analysisDir, 'words.json')).words;
// Tên riêng mơ hồ chưa được người dùng xác nhận (vd "Cloud" hay "Claude") hỏi ngay ở CỔNG 1, trước khi dựng
const questions = (readReport(analysisDir)?.pending ?? []).map((p) => `${p.question} Nếu đúng: node glossary-apply.mjs --analysis ${analysisDir} --terms "${p.canonical}"`);
fs.mkdirSync(path.join(work, 'plan-board-thumbs'), { recursive: true });

const timeOf = (e) => e.start ?? words[e.anchorWord]?.start ?? 0;
const wordAt = (t) => { const i = words.findIndex((w) => w.end >= t); return i < 0 ? words.length - 1 : i; };
const phraseAt = (t) => { const i = wordAt(t); return words.slice(Math.max(0, i - 1), i + 6).map((w) => w.text.trim()).join(' '); };

const events = [
  ...(plan.cutaways || []).map((e) => ({ t: timeOf(e), what: `cutaway ${e.presentation || 'fullbleed'}: ${e.query || e.label || ''}${e.zoom ? ` (${e.zoom})` : ''}` })),
  ...(plan.punches || []).map((e) => ({ t: timeOf(e), what: `zoom x${e.scale}` })),
  ...(plan.stats || []).map((e) => ({ t: timeOf(e), what: `số liệu ${e.value} ${e.label || ''}` })),
  ...(plan.decor || []).map((e) => ({ t: timeOf(e), what: `trang trí ${e.type}` })),
  ...(plan.cards || []).map((e) => ({ t: timeOf(e), what: `thẻ ${e.type}: ${e.text || (e.lines || []).join(' / ') || e.title || ''}` })),
  ...(plan.lowerThirds || []).map((e) => ({ t: timeOf(e), what: `lower third: ${e.title}` })),
  ...(plan.emoji || []).map((e) => ({ t: timeOf(e), what: `emoji ${e.id}` })),
  ...(plan.cuts || []).map((e) => ({ t: e.start, what: `cắt ${(e.end - e.start).toFixed(2)}s (${e.reason || 'ngắt'})` }))
].sort((a, b) => a.t - b.t);
if (!events.length) { console.error('edit-plan.json chưa có sự kiện nào (cutaways, punches, stats, decor, cards, lowerThirds, emoji, cuts).'); process.exit(1); }
const sfxOf = (t) => [...new Set((plan.sfx || []).filter((s) => Math.abs(s.t - t) <= 0.35).map((s) => s.type))].join(', ');

const tall = plan.orientation === '9x16';
const [tw, th] = tall ? [216, 384] : [384, 216];
const rows = events.map((e, i) => {
  const file = path.join(work, 'plan-board-thumbs', `${String(i).padStart(2, '0')}.jpg`);
  ffmpeg(['-ss', String(Math.min(e.t + 0.25, plan.duration - 0.1)), '-i', plan.source, '-frames:v', '1', '-vf', `scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:color=black`, '-q:v', '3', file], `khung ${i + 1}`);
  return { i, t: e.t, thumb: file, say: phraseAt(e.t), what: e.what, sfx: sfxOf(e.t) };
});

const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
const head = `Storyboard ${path.basename(plan.source)}: phong cách ${plan.style}, ${plan.orientation}, ${plan.duration.toFixed(1)}s, ${events.length} sự kiện, cắt ${(plan.cuts || []).reduce((a, c) => a + c.end - c.start, 0).toFixed(1)}s khoảng ngắt. Mốc giờ là giờ của video GỐC.`;
const md = [`# ${head}`, '', ...(questions.length ? ['**Cần hỏi người dùng về tên riêng trước khi dựng:**', ...questions.map((q) => `- ${q}`), ''] : []), '| # | Giờ | Câu đang nói | Xử lý | Âm thanh |', '|---|---|---|---|---|', ...rows.map((r) => `| ${r.i + 1} | ${mmss(r.t)} | ${r.say} | ${r.what} | ${r.sfx || '-'} |`), ''].join('\n');
fs.writeFileSync(path.join(work, 'plan-board.md'), md);

const esc = (x) => String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const cells = rows.map((r) => `<div class="r"><b>${r.i + 1}</b><img src="${pathToFileURL(r.thumb).href}"><div><div class="t">${mmss(r.t)}</div><div class="s">${esc(r.say)}</div><div class="w">${esc(r.what)}</div>${r.sfx ? `<div class="x">âm thanh: ${esc(r.sfx)}</div>` : ''}</div></div>`).join('');
const html = `<html><body style="margin:0;background:#111;color:#eee;font:14px Arial"><div style="padding:10px 12px;font-size:15px">${esc(head)}</div>${questions.length ? `<div style="padding:6px 12px 10px;color:#ffb86b">${questions.map((q) => `<div>Cần hỏi: ${esc(q.split(' Nếu đúng:')[0])}</div>`).join('')}</div>` : ''}<div class="g">${cells}</div><style>.g{display:grid;grid-template-columns:repeat(2,1fr);gap:0 14px;padding:0 10px 10px}.r{display:grid;grid-template-columns:28px ${tw}px 1fr;gap:10px;align-items:center;border-top:1px solid #333;padding:8px 0}.r b{font-size:20px;color:#7ee787}.t{color:#ffb86b;font-size:13px}.s{margin:4px 0;font-style:italic}.w{color:#7ee787}.x{color:#aaa;font-size:12px;margin-top:3px}</style></body></html>`;
const tmp = path.join(work, 'plan-board.html');
fs.writeFileSync(tmp, html);
const browser = await launchChrome();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 700 } });
  await page.goto(pathToFileURL(tmp).href);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(work, 'plan-board.png'), fullPage: true });
} finally { await browser.close(); }
fs.rmSync(tmp, { force: true });
console.log(md);
console.log(`\nĐã ghi ${path.join(work, 'plan-board.png')} và plan-board.md. GỬI plan-board.png kèm tóm tắt cho người dùng rồi DỪNG (CỔNG 1).`);
