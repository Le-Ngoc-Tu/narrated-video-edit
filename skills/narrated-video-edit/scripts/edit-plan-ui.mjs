// Trang sửa kế hoạch dựng trực tiếp (không cần nhắn AI sửa đi sửa lại): mở trên máy bạn, sửa phụ đề, ảnh minh họa, thẻ, sticker, emoji rồi xem khung thử.
// Chạy: node edit-plan-ui.mjs --work work [--analysis work/analysis] [--port 8765]
// Chỉ lắng nghe 127.0.0.1. Lưu ghi đè work/edit-plan.json (bản cũ giữ ở edit-plan.bak.json). Xem khung thử cần work/base.mp4 (chạy compose-base một lần).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { args, ffmpeg, makeTimeMap, readJson, run, skillRoot, writeJson, here } from './common.mjs';
import { loadAnalysis, mapPlan } from './plan-lib.mjs';

const { flags } = args();
if (!flags.work) { console.error('Dùng: node edit-plan-ui.mjs --work work [--analysis work/analysis] [--port 8765]'); process.exit(2); }
const work = path.resolve(String(flags.work));
const planFile = path.join(work, 'edit-plan.json');
const analysisDir = path.resolve(String(flags.analysis ?? path.join(work, 'analysis')));
const port = Number(flags.port ?? 8765);
if (!fs.existsSync(planFile)) { console.error(`Không thấy ${planFile}`); process.exit(2); }
const emojiIds = fs.readdirSync(path.join(skillRoot, 'templates', 'emoji')).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4));
const brandIds = readJson(path.join(skillRoot, 'data', 'brands.json')).brands.map((b) => ({ id: b.id, label: b.label }));

const send = (res, code, body, type = 'application/json; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', (c) => { size += c.length; if (size > 5e6) { reject(new Error('Nội dung quá lớn')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
});

function loadState() {
  const plan = readJson(planFile);
  const A = loadAnalysis(analysisDir);
  const tm = makeTimeMap(plan.cuts);
  return {
    plan,
    words: A.words.map((w) => ({ i: w.i, text: w.text, start: w.start, end: w.end })),
    outDuration: tm.outDuration(plan.duration),
    hasBase: fs.existsSync(path.join(work, 'base.mp4')),
    emojiIds,
    brandIds
  };
}

function validate(plan) {
  if (!plan || typeof plan !== 'object') throw new Error('Kế hoạch không hợp lệ');
  for (const key of ['cuts', 'beats', 'cutaways', 'punches', 'stats', 'decor']) if (!Array.isArray(plan[key])) throw new Error(`Thiếu mảng "${key}"`);
  for (const [k, list] of [['cutaways', plan.cutaways], ['decor', plan.decor], ['cards', plan.cards ?? []], ['stats', plan.stats]]) {
    for (const x of list) if (!(Number(x.start) >= 0 && Number(x.end) > Number(x.start))) throw new Error(`${k} ${x.id ?? ''}: mốc giờ không hợp lệ (cần end lớn hơn start)`);
  }
}

// Khung thử: ghi lại plan.mapped.json từ kế hoạch hiện tại, chụp lớp phủ tại giờ gốc t rồi ghép lên khung lớp nền
function preview(srcT) {
  const plan = readJson(planFile);
  const A = loadAnalysis(analysisDir);
  const tm = makeTimeMap(plan.cuts);
  const outT = tm.toOut(srcT);
  if (outT === null) throw new Error('Thời điểm này nằm trong đoạn bị cắt');
  const base = path.join(work, 'base.mp4');
  if (!fs.existsSync(base)) throw new Error('Chưa có work/base.mp4: chạy compose-base.mjs một lần');
  const mapped = mapPlan(plan, A.words, tm);
  writeJson(path.join(work, 'plan.mapped.json'), { ...mapped, wordsOut: mapped.wordsOut.map(({ i, text, oStart, oEnd, confidence }) => ({ i, text, oStart, oEnd, confidence })) });
  const outDir = path.join(work, 'overlay-preview');
  const r = run(process.execPath, [path.join(here, 'render-overlay.mjs'), '--mapped', path.join(work, 'plan.mapped.json'), '--out', outDir, '--analysis', analysisDir, '--times', String(outT)]);
  if (r.status !== 0) throw new Error(`render-overlay lỗi: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' | ')}`);
  const ms = String(Math.round(outT * 1000)).padStart(6, '0');
  const overlayPng = path.join(outDir, `test_${ms}.png`);
  const out = path.join(work, 'preview.png');
  ffmpeg(['-ss', String(Math.max(0, outT)), '-i', base, '-i', overlayPng, '-filter_complex', '[0:v][1:v]overlay,scale=540:-2', '-frames:v', '1', out], 'ghép khung thử');
  const warnings = (r.stdout.match(/cảnh báo: .*/g) ?? []);
  return { png: fs.readFileSync(out), warnings, outT };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, loadState());
    if (req.method === 'POST' && url.pathname === '/api/save') {
      const plan = JSON.parse(await readBody(req));
      validate(plan);
      fs.copyFileSync(planFile, path.join(work, 'edit-plan.bak.json'));
      writeJson(planFile, plan);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/preview') {
      const { t } = JSON.parse(await readBody(req));
      const p = preview(Number(t));
      return send(res, 200, { image: `data:image/png;base64,${p.png.toString('base64')}`, warnings: p.warnings, outT: p.outT });
    }
    return send(res, 404, { error: 'Không có' });
  } catch (e) { return send(res, 400, { error: e.message }); }
});
server.listen(port, '127.0.0.1', () => console.log(`Trang sửa kế hoạch: http://127.0.0.1:${port}  (Ctrl+C để dừng)`));

const PAGE = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sửa kế hoạch dựng</title>
<link rel="icon" href="data:,">
<style>
  :root { --bg:#f6f7f9; --card:#fff; --ink:#1b1f27; --mute:#5b6472; --line:#d9dde4; --accent:#2563eb; --danger:#b42318; }
  @media (prefers-color-scheme: dark) { :root { --bg:#12151b; --card:#1b2029; --ink:#e8ebf1; --mute:#9aa4b2; --line:#2b3340; --accent:#6ea0ff; --danger:#ff8a80; } }
  body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 "Segoe UI",system-ui,sans-serif; }
  header { position:sticky; top:0; z-index:5; background:var(--card); border-bottom:1px solid var(--line); padding:10px 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  h1 { font-size:17px; margin:0 12px 0 0; }
  main { max-width:1180px; margin:0 auto; padding:16px; display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:16px; }
  @media (max-width:900px) { main { grid-template-columns:1fr; } }
  section { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px; margin-bottom:16px; }
  h2 { font-size:15px; margin:0 0 10px; }
  button { font:inherit; padding:6px 12px; border:1px solid var(--line); background:var(--card); color:var(--ink); border-radius:7px; cursor:pointer; }
  button.primary { background:var(--accent); color:#fff; border-color:var(--accent); }
  button.danger { color:var(--danger); }
  button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
  input, select, textarea { font:inherit; color:var(--ink); background:var(--bg); border:1px solid var(--line); border-radius:6px; padding:4px 6px; min-width:0; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; font-size:12px; color:var(--mute); font-weight:600; padding:2px 4px; }
  td { padding:3px 4px; vertical-align:top; }
  td input, td select { width:100%; box-sizing:border-box; }
  .words { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:10px; }
  .words input { width:auto; }
  .beat { border-top:1px solid var(--line); padding-top:8px; margin-top:8px; }
  .beat small { color:var(--mute); }
  .mute { color:var(--mute); font-size:13px; }
  #status { margin-left:auto; font-size:13px; }
  #status.err { color:var(--danger); }
  aside img { width:100%; border-radius:8px; border:1px solid var(--line); background:#000; }
  aside { position:sticky; top:64px; align-self:start; }
  .row { display:flex; gap:6px; align-items:center; margin-bottom:8px; flex-wrap:wrap; }
  label { font-size:13px; color:var(--mute); }
</style></head><body>
<header>
  <h1>Sửa kế hoạch dựng</h1>
  <button class="primary" id="save">Lưu kế hoạch</button>
  <span class="mute">Sửa xong lưu, rồi chạy lại compose-base (nếu đổi cắt hoặc kiểu trình bày), render-overlay và finalize.</span>
  <span id="status" role="status"></span>
</header>
<main>
  <div id="editors"></div>
  <aside>
    <section>
      <h2>Xem khung thử</h2>
      <div class="row"><label for="pt">Giây trong video gốc</label><input id="pt" type="number" step="0.1" min="0" value="1" style="width:90px"><button id="go" class="primary">Xem</button></div>
      <input id="slider" type="range" min="0" max="100" step="0.1" value="1" style="width:100%" aria-label="Kéo chọn thời điểm">
      <p class="mute" id="pmsg">Bấm Xem sẽ lưu kế hoạch đang sửa rồi dựng khung tại thời điểm đó.</p>
      <img id="pimg" alt="Khung thử" hidden>
      <ul id="pwarn" class="mute"></ul>
    </section>
  </aside>
</main>
<script>
const $ = (s) => document.querySelector(s);
let S = null;
const status = (m, err) => { const el = $('#status'); el.textContent = m; el.className = err ? 'err' : ''; };
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const set = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach((k) => { a[k] ??= {}; a = a[k]; }); a[ks.at(-1)] = v; };
const MODES = ['fullbleed', 'card', 'polaroid', 'pip', 'sticker', 'peek', 'stack'];
const DECOR = ['underline', 'circle', 'arrow', 'sparkle', 'confetti', 'icon', 'burst', 'check', 'question', 'exclaim', 'badge'];
const SECTIONS = [
  { key: 'cutaways', title: 'Ảnh minh họa (cutaway)', note: 'Kiểu trình bày: card, polaroid, pip, stack... đè lên video; fullbleed phủ kín khung (chạy lại compose-base sau khi đổi).', fields: [['id', 'Mã', 'ro'], ['presentation', 'Kiểu', MODES], ['query', 'Truy vấn tiếng Anh', 'text'], ['label', 'Chú thích', 'text'], ['start', 'Bắt đầu (s)', 'num'], ['end', 'Kết thúc (s)', 'num']], blank: () => ({ id: nid('c'), presentation: 'card', query: '', kind: 'image', fit: 'fill', zoom: 'push-in', asset: null, status: 'pending', start: 0, end: 2 }) },
  { key: 'decor', title: 'Sticker và icon', note: 'icon cần truy vấn tiếng Anh (ví dụ "shopping bags"); anchorWord là số thứ tự từ trong phần Phụ đề.', fields: [['id', 'Mã', 'ro'], ['type', 'Loại', DECOR], ['anchorWord', 'Từ neo', 'num'], ['query', 'Truy vấn icon', 'text'], ['start', 'Bắt đầu (s)', 'num'], ['end', 'Kết thúc (s)', 'num']], blank: () => ({ id: nid('d'), type: 'underline', anchorWord: 0, start: 0, end: 1.6 }) },
  { key: 'cards', title: 'Thẻ ở vùng trên (title, compare, logos, comment, actions)', note: 'title: tiêu đề hai tầng. compare: so sánh hai cột (icon là truy vấn tiếng Anh). logos: các thương hiệu cách nhau bằng dấu phẩy (xem danh sách mã bên dưới). comment: ô bình luận gõ từ khóa ở ô Tiêu đề, phản hồi ở ô Phản hồi. actions: thanh tim, bình luận, chia sẻ, lưu; ô Biểu tượng nhấn là like, comment, share hoặc save. Thẻ số liệu đếm lên (counter) có nhiều dòng nên sửa trong edit-plan.json.', fields: [['id', 'Mã', 'ro'], ['type', 'Loại', ['title', 'compare', 'logos', 'comment', 'actions']], ['text', 'Tiêu đề', 'text'], ['sub', 'Dòng phụ', 'text'], ['reply', 'Phản hồi (comment)', 'text'], ['active', 'Biểu tượng nhấn (actions)', 'text'], ['left.title', 'Trái: tên', 'text'], ['left.sub', 'Trái: mô tả', 'text'], ['left.icon', 'Trái: icon', 'text'], ['right.title', 'Phải: tên', 'text'], ['right.sub', 'Phải: mô tả', 'text'], ['right.icon', 'Phải: icon', 'text'], ['brands', 'Thương hiệu', 'list'], ['start', 'Bắt đầu (s)', 'num'], ['end', 'Kết thúc (s)', 'num']], blank: () => ({ id: nid('k'), type: 'title', text: '', sub: '', start: 0, end: 3 }) },
  { key: 'stats', title: 'Thẻ số liệu', note: 'Giá trị phải có trong lời nói.', fields: [['id', 'Mã', 'ro'], ['value', 'Giá trị', 'text'], ['label', 'Nhãn', 'text'], ['start', 'Bắt đầu (s)', 'num'], ['end', 'Kết thúc (s)', 'num']], blank: () => ({ id: nid('s'), value: '', label: '', anchorWord: 0, start: 0, end: 2.4 }) }
];
function nid(p) { const used = new Set([...S.plan.cutaways, ...S.plan.decor, ...(S.plan.cards ?? []), ...S.plan.stats].map((x) => x.id)); let n = 1; while (used.has(p + n)) n++; return p + n; }
function cell(item, [path, , kind]) {
  const td = document.createElement('td');
  let el;
  if (kind === 'ro') { el = document.createElement('span'); el.textContent = get(item, path) ?? ''; }
  else if (Array.isArray(kind)) { el = document.createElement('select'); kind.forEach((o) => el.add(new Option(o, o))); el.value = get(item, path) ?? kind[0]; el.onchange = () => set(item, path, el.value); }
  else if (kind === 'list') { el = document.createElement('input'); el.value = (get(item, path) ?? []).join(','); el.onchange = () => set(item, path, el.value.split(',').map((x) => x.trim()).filter(Boolean)); }
  else { el = document.createElement('input'); if (kind === 'num') el.type = 'number'; if (kind === 'num') el.step = '0.05'; el.value = get(item, path) ?? ''; el.onchange = () => set(item, path, kind === 'num' ? Number(el.value) : el.value); }
  if (!(kind === 'ro')) el.setAttribute('aria-label', path);
  td.appendChild(el);
  return td;
}
function sectionEl(sec) {
  const box = document.createElement('section');
  const h = document.createElement('h2'); h.textContent = sec.title; box.appendChild(h);
  const note = document.createElement('p'); note.className = 'mute'; note.textContent = sec.note; box.appendChild(note);
  const list = S.plan[sec.key] ??= [];
  const used = sec.key === 'cards' ? sec.fields : sec.fields;
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  used.forEach(([, label]) => { const th = document.createElement('th'); th.textContent = label; head.appendChild(th); });
  head.appendChild(document.createElement('th'));
  const body = table.createTBody();
  list.forEach((item, idx) => {
    const tr = body.insertRow();
    used.forEach((f) => tr.appendChild(cell(item, f)));
    const td = tr.insertCell();
    const del = document.createElement('button'); del.textContent = 'Xóa'; del.className = 'danger'; del.onclick = () => { list.splice(idx, 1); render(); };
    td.appendChild(del);
  });
  box.appendChild(table);
  const add = document.createElement('button'); add.textContent = 'Thêm dòng'; add.onclick = () => { list.push(sec.blank()); render(); };
  add.style.marginTop = '8px';
  box.appendChild(add);
  if (sec.key === 'cards') { const m = document.createElement('p'); m.className = 'mute'; m.textContent = 'Mã thương hiệu: ' + S.brandIds.map((b) => b.id).join(', '); box.appendChild(m); }
  return box;
}
function captionsEl() {
  const box = document.createElement('section');
  const h = document.createElement('h2'); h.textContent = 'Phụ đề (sửa chữ, giữ nguyên mốc giờ)'; box.appendChild(h);
  const note = document.createElement('p'); note.className = 'mute'; note.textContent = 'Mỗi ô là một từ; ô để trống hoặc giống bản phiên âm thì không ghi đè. Số nhỏ là chỉ số từ (dùng cho từ neo của sticker).'; box.appendChild(note);
  S.plan.captions ??= {}; S.plan.captions.overrides ??= {};
  S.plan.beats.forEach((b) => {
    const wrap = document.createElement('div'); wrap.className = 'beat';
    const t = document.createElement('small'); t.textContent = b.id + ' · ' + b.start.toFixed(1) + 's đến ' + b.end.toFixed(1) + 's'; wrap.appendChild(t);
    const box2 = document.createElement('div'); box2.className = 'words';
    for (let i = b.startWord; i <= b.endWord; i++) {
      const w = S.words[i]; if (!w) continue;
      const input = document.createElement('input');
      input.value = S.plan.captions.overrides[i] ?? w.text; input.size = Math.max(3, input.value.length + 1); input.title = 'từ ' + i; input.setAttribute('aria-label', 'từ ' + i + ' ' + w.text);
      input.onchange = () => { const v = input.value.trim(); if (!v || v === w.text) delete S.plan.captions.overrides[i]; else S.plan.captions.overrides[i] = v; input.size = Math.max(3, input.value.length + 1); };
      const cell2 = document.createElement('span'); const idx = document.createElement('sup'); idx.textContent = i; idx.className = 'mute';
      cell2.append(idx, input); box2.appendChild(cell2);
    }
    wrap.appendChild(box2); box.appendChild(wrap);
  });
  return box;
}
function emojiEl() {
  const box = document.createElement('section');
  const h = document.createElement('h2'); h.textContent = 'Emoji'; box.appendChild(h);
  const auto = !Array.isArray(S.plan.emoji);
  const row = document.createElement('div'); row.className = 'row';
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'emojiauto'; cb.checked = auto;
  cb.onchange = () => { S.plan.emoji = cb.checked ? undefined : []; render(); };
  const lb = document.createElement('label'); lb.htmlFor = 'emojiauto'; lb.textContent = 'Tự gợi ý theo từ khóa (bỏ chọn để tự chọn từng emoji)';
  row.append(cb, lb); box.appendChild(row);
  if (!auto) {
    const list = S.plan.emoji;
    list.forEach((e, idx) => {
      const r = document.createElement('div'); r.className = 'row';
      const sel = document.createElement('select'); S.emojiIds.forEach((id) => sel.add(new Option(id, id))); sel.value = e.id; sel.onchange = () => { e.id = sel.value; };
      const num = document.createElement('input'); num.type = 'number'; num.value = e.anchorWord; num.style.width = '90px'; num.setAttribute('aria-label', 'từ neo'); num.onchange = () => { e.anchorWord = Number(num.value); };
      const del = document.createElement('button'); del.textContent = 'Xóa'; del.className = 'danger'; del.onclick = () => { list.splice(idx, 1); render(); };
      r.append(sel, num, del); box.appendChild(r);
    });
    const add = document.createElement('button'); add.textContent = 'Thêm emoji'; add.onclick = () => { list.push({ id: S.emojiIds[0], anchorWord: 0 }); render(); };
    box.appendChild(add);
  }
  return box;
}
function render() {
  const root = $('#editors'); root.replaceChildren();
  SECTIONS.forEach((s) => root.appendChild(sectionEl(s)));
  root.appendChild(emojiEl());
  root.appendChild(captionsEl());
}
async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j;
}
$('#save').onclick = async () => { try { await api('/api/save', S.plan); status('Đã lưu ' + new Date().toLocaleTimeString()); } catch (e) { status(e.message, true); } };
$('#go').onclick = async () => {
  status('Đang dựng khung thử...');
  try {
    // Khung thử dùng kế hoạch đang sửa: lưu tạm trước để máy chủ đọc đúng bản này
    await api('/api/save', S.plan);
    const r = await api('/api/preview', { t: Number($('#pt').value) });
    $('#pimg').src = r.image; $('#pimg').hidden = false;
    $('#pwarn').replaceChildren(...r.warnings.map((w) => { const li = document.createElement('li'); li.textContent = w; return li; }));
    status('Xong');
  } catch (e) { status(e.message, true); }
};
$('#slider').oninput = () => { $('#pt').value = $('#slider').value; };
$('#pt').oninput = () => { $('#slider').value = $('#pt').value; };
(async () => {
  try {
    S = await api('/api/state');
    $('#slider').max = S.plan.duration;
    if (!S.hasBase) $('#pmsg').textContent = 'Chưa có work/base.mp4: chạy compose-base.mjs một lần để xem khung thử.';
    render();
  } catch (e) { status(e.message, true); }
})();
</script></body></html>`;
