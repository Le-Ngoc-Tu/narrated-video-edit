// Trang chọn kiểu: dựng một tệp HTML chạy ngoại tuyến từ chính kho hiệu ứng (data/effects) và ba phong cách (data/styles.json). Thẻ có mã (TRA-07), tìm và lọc theo họ, thanh "Mix" gom các thẻ đã chọn, nút Copy prompt ra câu lệnh dán thẳng cho tác tử (mẫu và ràng buộc cố định nằm ở data/style-menu.json).
// Chạy: node style-menu.mjs --out work/style-menu.html [--demos "C:\\Users\\bạn\\Downloads\\Effects-Library-Demo"]
// --demos: thư mục có <họ>/<id>.mp4 (xem node effects-selftest.mjs --sheet hoặc bộ demo đã dựng); có thì thẻ phát video khi rê chuột, không thì thẻ chỉ có chữ. Mở tệp HTML bằng trình duyệt, không cần máy chủ và không gửi dữ liệu đi đâu.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { args, readJson, skillRoot } from './common.mjs';
import { loadLibrary } from './fx-lib.mjs';

const { flags } = args();
if (!flags.out) { console.error('Dùng: node style-menu.mjs --out work/style-menu.html [--demos <thư mục demo>]'); process.exit(2); }
const out = path.resolve(String(flags.out));
const demos = flags.demos ? path.resolve(String(flags.demos)) : null;
const menu = readJson(path.join(skillRoot, 'data', 'style-menu.json'));
const styles = Object.keys(readJson(path.join(skillRoot, 'data', 'styles.json')).styles);
const lib = loadLibrary();

const counter = {};
const items = lib.effects.map((e) => {
  const group = e.file.replace(/\.json$/, '');
  counter[group] = (counter[group] || 0) + 1;
  const preview = demos && fs.existsSync(path.join(demos, group, `${e.id}.mp4`)) ? pathToFileURL(path.join(demos, group, `${e.id}.mp4`)).href : null;
  return { code: `${group.slice(0, 3).toUpperCase()}-${String(counter[group]).padStart(2, '0')}`, group, id: e.id, name: e.name?.vi || e.name?.en || e.id, purpose: e.purpose, about: String(e.about || e.purpose || '').split(/(?<=[.!?])s/)[0], engine: e.engine, preview };
});
const groups = [...new Set(items.map((x) => x.group))];
const data = JSON.stringify({ menu, styles, items, groups }).replace(/</g, '\\u003c');

const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Style Menu</title>
<style>
:root{--bg:#111;--panel:#1b1b1b;--line:#2c2c2c;--text:#eee;--dim:#9a9a9a;--accent:#7ee787;--warm:#ffb86b}
@media (prefers-color-scheme:light){:root{--bg:#f6f4ef;--panel:#fff;--line:#ddd8cc;--text:#1a1a1a;--dim:#6b665c;--accent:#17803d;--warm:#b45309}}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.4 system-ui,Arial,sans-serif;padding-bottom:230px}
header{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 16px;z-index:2}
h1{margin:0 0 8px;font-size:17px}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
input,select,textarea{background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:6px 8px;font:inherit}
.chip{border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:999px;padding:4px 10px;cursor:pointer}.chip.on{border-color:var(--accent);color:var(--accent)}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;padding:14px 16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column}
.card.sel{border-color:var(--accent)}
.pv{aspect-ratio:9/12;background:linear-gradient(160deg,var(--line),var(--panel));display:flex;align-items:center;justify-content:center;color:var(--dim);font-size:12px}
.pv video{width:100%;height:100%;object-fit:cover}
.body{padding:8px 10px;display:flex;flex-direction:column;gap:4px;flex:1}
.code{color:var(--warm);font-weight:700;font-size:12px}.id{color:var(--dim);font-size:12px}
.purpose{font-size:12.5px;color:var(--dim);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
button{background:var(--accent);color:#06210f;border:0;border-radius:6px;padding:6px 10px;font-weight:700;cursor:pointer}button.ghost{background:transparent;color:var(--text);border:1px solid var(--line)}
.mix{position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:1px solid var(--line);padding:10px 16px;display:flex;flex-direction:column;gap:8px;z-index:3}
.mix textarea{width:100%;box-sizing:border-box;height:84px}
</style></head><body>
<header><h1 id="t"></h1><div class="bar"><input id="q" placeholder="Tìm theo tên, id, mô tả" size="28"><span id="chips" class="bar"></span></div></header>
<main id="grid"></main>
<div class="mix"><div class="bar"><b>Mix <span id="n">0</span></b><span id="sel" class="bar"></span></div>
<div class="bar"><input id="video" placeholder="Đường dẫn video của bạn" size="34"><select id="style"></select><button id="copy">Copy prompt</button><button class="ghost" id="clear">Xóa mix</button><span id="msg" style="color:var(--accent)"></span></div>
<textarea id="out" readonly placeholder="Chọn hiệu ứng rồi bấm Copy prompt: câu lệnh hiện ở đây và vào clipboard."></textarea></div>
<script>
const D=${data};const mix=new Set();let group='';
const $=(s)=>document.querySelector(s);const esc=(x)=>String(x??'').replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
$('#t').textContent=D.menu.title;
$('#style').innerHTML=D.styles.map((s)=>'<option>'+esc(s)+'</option>').join('');
$('#chips').innerHTML=['',...D.groups].map((g)=>'<button class="chip" data-g="'+esc(g)+'">'+(g||'tất cả')+'</button>').join('');
function render(){const q=$('#q').value.trim().toLowerCase();
 document.querySelectorAll('#chips .chip').forEach((c)=>c.classList.toggle('on',c.dataset.g===group));
 $('#grid').innerHTML=D.items.filter((x)=>(!group||x.group===group)&&(!q||(x.id+' '+x.name+' '+x.purpose+' '+x.about+' '+x.code).toLowerCase().includes(q))).map((x)=>
 '<div class="card'+(mix.has(x.code)?' sel':'')+'"><div class="pv" data-c="'+x.code+'">'+(x.preview?'<video muted loop playsinline preload="metadata" src="'+x.preview+'"></video>':'không có video demo')+'</div><div class="body"><span class="code">'+x.code+'</span><b>'+esc(x.name)+'</b><span class="id">'+esc(x.id)+' · '+esc(x.engine)+'</span><span class="purpose">'+esc(x.purpose)+'</span><button data-add="'+x.code+'">'+(mix.has(x.code)?'Bỏ khỏi mix':'Thêm vào mix')+'</button></div></div>').join('');
 $('#n').textContent=mix.size;$('#sel').innerHTML=[...mix].map((c)=>'<span class="chip on">'+c+'</span>').join('');}
document.addEventListener('click',(e)=>{const g=e.target.closest('[data-g]');if(g){group=g.dataset.g;render();}
 const a=e.target.closest('[data-add]');if(a){const c=a.dataset.add;mix.has(c)?mix.delete(c):mix.add(c);render();}});
document.addEventListener('mouseover',(e)=>{const v=e.target.closest('.pv')?.querySelector('video');if(v)v.play().catch(()=>{});});
document.addEventListener('mouseout',(e)=>{const v=e.target.closest('.pv')?.querySelector('video');if(v){v.pause();v.currentTime=0;}});
$('#q').addEventListener('input',render);
$('#clear').onclick=()=>{mix.clear();$('#out').value='';render();};
$('#copy').onclick=async()=>{if(!mix.size){$('#msg').textContent='Chưa chọn hiệu ứng nào.';return;}
 const lines=D.items.filter((x)=>mix.has(x.code)).map((x)=>D.menu.itemLine.replace('{code}',x.code).replace('{id}',x.id).replace('{purpose}',x.purpose).replace('{about}',x.about));
 const text=D.menu.promptTemplate.replace('{video}',$('#video').value.trim()||'<đường dẫn video>').replace('{style}',$('#style').value).replace('{items}',lines.join('\\n')).replace('{constraints}',D.menu.constraints.join('\\n'));
 $('#out').value=text;try{await navigator.clipboard.writeText(text);$('#msg').textContent='Đã copy.';}catch{$('#out').select();$('#msg').textContent='Chọn rồi nhấn Ctrl+C.';}};
render();
</script></body></html>`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`Đã ghi ${out}: ${items.length} hiệu ứng trong ${groups.length} họ, ${demos ? `${items.filter((x) => x.preview).length} có video demo` : 'chưa có thư mục demo (--demos)'}. Mở bằng trình duyệt.`);
