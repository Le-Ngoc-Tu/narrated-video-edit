// Dựng ba video (guide, reel, banner) bằng một timeline GSAP tạm dừng; render.mjs gọi window.seek(t) rồi chụp từng khung.
// Tham số trang: ?video=guide|reel|banner&lang=en|vi&scale=1
const params = new URLSearchParams(location.search);
const VIDEO = params.get('video') || 'guide';
const LANG = params.get('lang') || 'en';
const L = I18N[LANG];
const SIZES = { guide: [1920, 1080], reel: [1920, 1080], banner: [1200, 400] };
const [W, H] = SIZES[VIDEO];

const stage = document.getElementById('stage');
stage.style.width = `${W}px`;
stage.style.height = `${H}px`;
stage.style.transform = `scale(${Number(params.get('scale') || 1)})`;

// Nhịp nhạc đo từ bài "Music Promotion": 118 BPM, chu kỳ 0,509 s. Cắt cảnh theo số nhịp.
const P = 0.509;
const T0 = 0.15;
const at = (beat) => T0 + beat * P;

const master = gsap.timeline({ paused: true });
const CLIPS = [];
let CLIPCOUNT = {};

const mk = (parent, cls, html = '', css = {}) => {
  const e = document.createElement('div');
  if (cls) e.className = cls;
  e.innerHTML = html;
  Object.assign(e.style, css);
  parent.appendChild(e);
  return e;
};
const px = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? `${v}px` : v]));
const place = (e, o) => { Object.assign(e.style, px(o)); return e; };

function scene(startBeat, beats, css = {}) {
  const el = mk(stage, 'scene');
  Object.assign(el.style, css);
  const s = startBeat === 0 ? 0 : at(startBeat);
  const e = at(startBeat + beats);
  if (startBeat === 0) gsap.set(el, { autoAlpha: 1 });
  else master.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.16, ease: 'none' }, s);
  master.to(el, { autoAlpha: 0, duration: 0.12, ease: 'none' }, e - 0.12);
  return { el, s, e, b: (n) => at(startBeat + n) };
}

function clip(parent, name, { x, y, w, h, start, offset = 0, fps = 30, loop = false, radius = 0 }) {
  const img = document.createElement('img');
  img.className = 'clip';
  place(img, { left: x ?? 0, top: y ?? 0, width: w ?? '100%', height: h ?? '100%', borderRadius: radius });
  parent.appendChild(img);
  CLIPS.push({ img, name, start, offset, fps, loop, last: '' });
  return img;
}

async function updateClips(t) {
  const jobs = [];
  for (const c of CLIPS) {
    const n = CLIPCOUNT[c.name] || 1;
    let idx = Math.floor((t - c.start + c.offset) * c.fps);
    if (t < c.start) idx = Math.floor(c.offset * c.fps);
    idx = c.loop ? ((idx % n) + n) % n : Math.min(Math.max(idx, 0), n - 1);
    const src = `/docs/video-src/.cache/${c.name}/f${String(idx + 1).padStart(4, '0')}.jpg`;
    if (c.last !== src) {
      c.last = src;
      c.img.src = src;
      jobs.push(c.img.decode().catch(() => {}));
    }
  }
  await Promise.all(jobs);
}

function typeText(el, text, start, dur) {
  const o = { n: 0 };
  el.textContent = '';
  master.to(o, { n: text.length, duration: dur, ease: 'none', onUpdate() { el.textContent = text.slice(0, Math.round(o.n)); } }, start);
}

const CURSOR_SVG = '<svg viewBox="0 0 56 56" width="56" height="56"><path d="M8 4 L8 40 L18 31 L25 47 L32 44 L25 29 L39 29 Z" fill="#1e2a3b" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>';
function makeCursor(parent, x, y) {
  const c = mk(parent, 'cursor', CURSOR_SVG);
  gsap.set(c, { x, y, autoAlpha: 0 });
  return c;
}
function cursorMove(c, x, y, start, dur = 0.7) {
  master.to(c, { x, y, duration: dur, ease: 'power2.inOut' }, start);
}
function click(parent, c, x, y, start) {
  const r = mk(parent, 'ripple');
  master.set(r, { x: x - 15, y: y - 15, scale: 0.4, opacity: 0.9 }, start);
  master.to(r, { scale: 3.2, opacity: 0, duration: 0.5, ease: 'power2.out' }, start);
  master.to(c, { scale: 0.82, duration: 0.08, transformOrigin: '8px 4px' }, start);
  master.to(c, { scale: 1, duration: 0.14 }, start + 0.08);
}

const svgCheck = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const ICONS = {
  download: '<svg viewBox="0 0 120 120" width="130" height="130" fill="none" stroke="#2f7fc1" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M60 18v58M38 56l22 22 22-22M24 98h72"/></svg>',
  upload: '<svg viewBox="0 0 120 120" width="130" height="130" fill="none" stroke="#2f7fc1" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M60 78V20M38 40l22-22 22 22M24 98h72"/></svg>',
  chat: '<svg viewBox="0 0 120 120" width="130" height="130" fill="none" stroke="#2f7fc1" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 28h80a6 6 0 0 1 6 6v46a6 6 0 0 1-6 6H56L36 104V86H20a6 6 0 0 1-6-6V34a6 6 0 0 1 6-6z"/><path d="M38 52h44M38 66h28"/></svg>'
};
const sendSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';

function brandMark(parent, x, y) {
  const m = mk(parent, 'mark', '<div style="width:84px"><i style="width:84px"></i><i style="width:60px"></i><i style="width:74px"></i></div>');
  return place(m, { left: x, top: y, position: 'absolute' });
}

// ---------- cảnh dùng chung ----------
function hookScene(startBeat, beats) {
  const sc = scene(startBeat, beats);
  const box = mk(sc.el, 'center', '', { top: '250px' });
  const a = mk(box, 'h1', L.hook1);
  const b = mk(box, 'h1 hl', L.hook2);
  const s = mk(sc.el, 'center', `<div class="sub">${L.hookSub}</div>`, { top: '590px' });
  master.from(a, { y: 70, autoAlpha: 0, duration: 0.55, ease: 'power3.out' }, sc.b(0.2));
  master.from(b, { y: 70, autoAlpha: 0, duration: 0.55, ease: 'power3.out' }, sc.b(1.2));
  master.from(s, { y: 30, autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, sc.b(2.4));
  const spots = [[130, 150], [1390, 130], [80, 780], [1420, 830], [760, 70], [690, 920]];
  L.chips.forEach((t, i) => {
    const c = mk(sc.el, 'chip', t);
    place(c, { left: spots[i][0], top: spots[i][1] });
    master.from(c, { scale: 0.3, autoAlpha: 0, duration: 0.5, ease: 'back.out(2)' }, sc.b(2.8 + i * 0.45));
    master.to(c, { y: (i % 2 ? 14 : -14), duration: 1.6, ease: 'sine.inOut', repeat: 5, yoyo: true }, sc.b(2.8 + i * 0.45));
  });
  return sc;
}

function endScene(startBeat, beats) {
  const sc = scene(startBeat, beats);
  const mark = brandMark(sc.el, 885, 150);
  const name = mk(sc.el, 'center', '<div class="h2" style="font-size:96px">narrated-video-edit</div>', { top: '350px' });
  const free = mk(sc.el, 'center', `<div class="sub">${L.endFree}</div>`, { top: '480px' });
  const cta = mk(sc.el, 'center', `<div class="step-title" style="font-size:46px">${L.endCta}</div>`, { top: '590px' });
  const url = mk(sc.el, 'center', '<div class="chip" style="position:static;font-size:38px;padding:18px 40px">github.com/Le-Ngoc-Tu/narrated-video-edit</div>', { top: '690px' });
  const note = mk(sc.el, 'center', `<div class="step-sub" style="font-size:30px">${L.endNote}</div>`, { top: '830px' });
  const mus = mk(sc.el, 'center', `<div class="step-sub" style="font-size:22px;color:#8a99ad">${L.music}</div>`, { top: '985px' });
  master.from(mark, { scale: 0.4, autoAlpha: 0, rotation: -12, duration: 0.6, ease: 'back.out(2)' }, sc.b(0.2));
  [name, free, cta, url, note, mus].forEach((e, i) => master.from(e, { y: 36, autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, sc.b(0.8 + i * 0.7)));
  return sc;
}

function gateCards(sc, y, startOffset, withArrows) {
  const imgs = ['plan-board.jpg', 'assets-sheet.jpg', 'out-sheet.jpg'];
  const xs = [150, 720, 1290];
  const cards = [];
  imgs.forEach((f, i) => {
    const g = mk(sc.el, 'gate', `<div class="im" style="background-image:url('/docs/video-src/assets/${f}');${i === 0 ? 'background-size:100% auto' : ''}"></div><div class="lb"><div class="badge" style="width:50px;height:50px;font-size:28px">${i + 1}</div><div>${L.gates[i].replace(/^\S+\s+\d\s+/, '')}</div></div>`);
    place(g, { left: xs[i], top: y });
    master.from(g, { y: 90, autoAlpha: 0, duration: 0.6, ease: 'back.out(1.5)' }, sc.b(startOffset + i * 1.3));
    cards.push(g);
  });
  if (withArrows) {
    [630, 1200].forEach((x, i) => {
      const a = mk(sc.el, '', '<svg viewBox="0 0 90 40" width="90" height="40" fill="none" stroke="#2f7fc1" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 20h70M60 6l18 14-18 14"/></svg>');
      place(a, { left: x, top: y + 130, position: 'absolute' });
      master.from(a, { x: -20, autoAlpha: 0, duration: 0.4, ease: 'power2.out' }, sc.b(startOffset + 0.9 + i * 1.3));
    });
  }
  return cards;
}

// ---------- guide ----------
function buildGuide() {
  hookScene(0, 8);

  // 2. tổng quan ba bước
  {
    const sc = scene(8, 8);
    mk(sc.el, 'center', `<div class="eyebrow">${L.ovEyebrow}</div>`, { top: '88px' });
    mk(sc.el, 'center', `<div class="h2">${L.ovTitle}</div>`, { top: '146px' });
    const icons = [ICONS.download, ICONS.upload, ICONS.chat];
    [150, 710, 1270].forEach((x, i) => {
      const c = mk(sc.el, 'card', `<div class="badge" style="margin:34px auto 6px">${i + 1}</div><div style="display:grid;place-items:center;height:150px">${icons[i]}</div><div class="step-title" style="padding:0 14px;font-size:37px">${L.ov[i][0]}</div><div class="step-sub" style="margin-top:12px">${L.ov[i][1]}</div>`, { height: '470px', width: '500px' });
      place(c, { left: x, top: 330 });
      master.from(c, { y: 100, autoAlpha: 0, duration: 0.6, ease: 'back.out(1.6)' }, sc.b(1 + i * 1.5));
    });
    const note = mk(sc.el, 'center', `<div class="chip" style="position:static;font-size:30px;color:#1e2a3b">${L.ovNote}</div>`, { top: '900px' });
    master.from(note, { y: 40, autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, sc.b(5.6));
  }

  // 3. tải zip
  {
    const sc = scene(16, 8);
    const lab = mk(sc.el, 'steplabel', `<div class="badge">1</div><div class="t">${L.s1[0]}<small>${L.s1[1]}</small></div>`);
    master.from(lab, { x: -60, autoAlpha: 0, duration: 0.5, ease: 'power3.out' }, sc.b(0.2));
    const win = mk(sc.el, 'win', '<div class="bar"><i></i><i></i><i></i><b>github.com/Le-Ngoc-Tu/narrated-video-edit/releases</b></div>');
    place(win, { left: 260, top: 210, width: 1400, height: 760 });
    mk(win, 'rel', '<h3>narrated-video-edit v1.0.0</h3><span class="tag">Latest</span>');
    const assets = mk(win, 'assets', '<div class="hd">Assets</div><div class="ar">narrated-video-edit-v1.0.0.zip<span>4.1 MB</span></div><div class="ar">narrated-video-edit-v1.0.0.zip.sha256<span>0.1 KB</span></div><div class="ar">Source code (zip)<span></span></div>');
    master.from(win, { y: 70, autoAlpha: 0, duration: 0.6, ease: 'power3.out' }, sc.b(0.4));
    const row = assets.querySelectorAll('.ar')[0];
    const cur = makeCursor(sc.el, 1560, 900);
    master.to(cur, { autoAlpha: 1, duration: 0.2 }, sc.b(1.6));
    cursorMove(cur, 760, 612, sc.b(1.6), 0.9);
    click(sc.el, cur, 760, 612, sc.b(3.2));
    master.to(row, { backgroundColor: '#eaf3fb', duration: 0.2 }, sc.b(3.2));
    const f = mk(sc.el, 'file', `<div class="zipicon"></div>narrated-video-edit-v1.0.0.zip<small>4.1 MB</small><div class="check" style="margin-left:14px">${svgCheck}</div>`);
    place(f, { left: 1090, top: 880 });
    master.from(f, { y: 70, autoAlpha: 0, duration: 0.5, ease: 'back.out(1.6)' }, sc.b(3.8));
  }

  // 4. tải lên Claude
  {
    const sc = scene(24, 24);
    const labels = L.s2.map((l, i) => mk(sc.el, 'steplabel', `<div class="badge">2</div><div class="t">${l[0]}${l[1] ? `<small>${l[1]}</small>` : ''}</div>`));
    const lt = [0, 4, 12, 20];
    labels.forEach((lb, i) => {
      master.fromTo(lb, { autoAlpha: 0, x: -50 }, { autoAlpha: 1, x: 0, duration: 0.4, ease: 'power3.out' }, sc.b(lt[i]));
      if (i < 3) master.to(lb, { autoAlpha: 0, duration: 0.2 }, sc.b(lt[i + 1]) - 0.05);
    });
    const win = mk(sc.el, 'win', '<div class="bar"><i></i><i></i><i></i></div>');
    place(win, { left: 210, top: 190, width: 1500, height: 800 });
    master.from(win, { y: 70, autoAlpha: 0, duration: 0.6, ease: 'power3.out' }, sc.b(0.3));
    const app = mk(win, 'app');
    const side = mk(app, 'side', '<div class="row"></div><div class="row s"></div><div class="row"></div><div class="row s"></div><div class="row"></div>');
    mk(side, 'user', `<div class="av">${L.ui.user[0]}</div><div>${L.ui.user}<br><small>${L.ui.plan}</small></div>`);
    const main = mk(app, 'main');

    // A: màn hình chính
    const pA = mk(main, '', '', { position: 'absolute', inset: '0' });
    mk(pA, 'chatbox', '<div style="position:absolute;left:40px;top:44px;width:360px;height:22px;border-radius:11px;background:#e4dfd2"></div>', { left: '120px', right: '120px', top: '300px', height: '180px' });
    // B: trang Skills
    const pB = mk(main, '', `<div style="position:absolute;left:60px;top:40px;font-weight:800;font-size:56px">${L.ui.skills}</div><div style="position:absolute;left:60px;top:130px"><span class="tab on">${L.ui.tabs[0]}</span><span class="tab">${L.ui.tabs[1]}</span></div><div class="btn" style="position:absolute;right:60px;top:52px">+ ${L.ui.add} &nbsp;v</div><div class="skillrow" style="top:230px;opacity:.55"><div style="width:52px;height:52px;border-radius:14px;background:#e4dfd2"></div><div style="width:260px;height:20px;border-radius:10px;background:#e4dfd2"></div><div class="tog"><i></i></div></div>`, { position: 'absolute', inset: '0' });
    // C: trang tải lên
    const pC = mk(main, '', `<div style="position:absolute;left:60px;top:36px;font-weight:600;font-size:26px;color:#8c8574">&larr; ${L.ui.back}</div><div style="position:absolute;left:60px;top:84px;font-weight:800;font-size:52px">${L.ui.upTitle}</div><div class="drop" id="drop"><div style="font-size:54px;line-height:1">&#8593;</div>${L.ui.drop}</div>`, { position: 'absolute', inset: '0' });
    const scan = mk(pC, 'scan', `<div style="width:18px;height:18px;border-radius:50%;background:#cfc9ba"></div>${L.ui.scan}<div class="st" style="color:#8c8574">${L.ui.running}</div>`);
    const upBtn = mk(pC, 'btn', L.ui.upload, { position: 'absolute', right: '60px', bottom: '36px', opacity: '0.35' });
    // D: danh sách Skills sau khi thêm
    const pD = mk(main, '', `<div style="position:absolute;left:60px;top:40px;font-weight:800;font-size:56px">${L.ui.skills}</div><div style="position:absolute;left:60px;top:130px"><span class="tab on">${L.ui.tabs[0]}</span><span class="tab">${L.ui.tabs[1]}</span></div>`, { position: 'absolute', inset: '0' });
    const newRow = mk(pD, 'skillrow', `<div class="zipicon" style="width:44px;height:50px"></div><div>narrated-video-edit<small>${L.ui.you}</small></div><div class="tog"><i></i></div>`, { top: '230px' });
    gsap.set([pB, pC, pD], { autoAlpha: 0 });
    const swap = (from, to, t) => { master.to(from, { autoAlpha: 0, duration: 0.18 }, t); master.to(to, { autoAlpha: 1, duration: 0.18 }, t); };

    const menu = mk(win, 'menu', L.ui.menu.map((m, i) => `${i === 4 ? '<hr>' : ''}<div class="it${i === 0 ? ' on' : ''}">${m}</div>`).join(''), { left: '18px', top: '340px', width: '300px' });
    gsap.set(menu, { autoAlpha: 0, y: 14 });
    const ring = mk(sc.el, 'ring', '', { left: '232px', top: '542px', width: '296px', height: '66px' });
    gsap.set(ring, { autoAlpha: 0 });
    const cur = makeCursor(sc.el, 1500, 860);
    master.to(cur, { autoAlpha: 1, duration: 0.2 }, sc.b(0.8));
    // A: bấm avatar, mở menu, chọn Cài đặt
    cursorMove(cur, 330, 934, sc.b(0.8), 0.9);
    click(sc.el, cur, 330, 934, sc.b(2));
    master.to(menu, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out' }, sc.b(2));
    master.to(ring, { autoAlpha: 1, duration: 0.2 }, sc.b(2.4));
    cursorMove(cur, 380, 577, sc.b(2.3), 0.5);
    click(sc.el, cur, 380, 577, sc.b(3.3));
    master.to(menu, { autoAlpha: 0, duration: 0.15 }, sc.b(3.5));
    master.to(ring, { autoAlpha: 0, duration: 0.15 }, sc.b(3.5));
    swap(pA, pB, sc.b(3.8));
    // B: Thêm -> Tải Skill lên
    const addMenu = mk(win, 'menu', `<div class="it on" id="am1">${L.ui.addMenu[0]}</div><div class="it">${L.ui.addMenu[1]}</div>`, { left: '1150px', top: '178px', width: '300px' });
    gsap.set(addMenu, { autoAlpha: 0, y: 12 });
    cursorMove(cur, 1565, 327, sc.b(4.4), 0.9);
    click(sc.el, cur, 1565, 327, sc.b(6));
    master.to(addMenu, { autoAlpha: 1, y: 0, duration: 0.25 }, sc.b(6));
    cursorMove(cur, 1500, 413, sc.b(6.6), 0.5);
    click(sc.el, cur, 1500, 413, sc.b(7.6));
    master.to(addMenu, { autoAlpha: 0, duration: 0.15 }, sc.b(7.8));
    swap(pB, pC, sc.b(8));
    // C: thả zip, quét, Tải lên
    const file = mk(sc.el, 'file', `<div class="zipicon"></div>narrated-video-edit-v1.0.0.zip<small>4.1 MB</small>`);
    place(file, { left: 1200, top: 100 });
    gsap.set(file, { autoAlpha: 0 });
    master.to(file, { autoAlpha: 1, duration: 0.25 }, sc.b(9.2));
    master.to(file, { x: -270, y: 470, rotation: -4, duration: 0.9, ease: 'power2.inOut' }, sc.b(9.6));
    master.to(file, { x: -270, y: 485, scale: 0.92, duration: 0.2, ease: 'power2.in' }, sc.b(11.4));
    master.to(file, { autoAlpha: 0, duration: 0.2 }, sc.b(11.8));
    const dropEl = pC.querySelector('#drop');
    master.to(dropEl, { borderColor: '#2f7fc1', backgroundColor: '#f1f7fc', duration: 0.25 }, sc.b(10.8));
    master.to(dropEl, { height: 110, duration: 0.35, ease: 'power2.inOut' }, sc.b(12.2));
    master.to(dropEl.firstElementChild, { autoAlpha: 0, duration: 0.2 }, sc.b(12.2));
    master.set(dropEl, { innerHTML: '' }, sc.b(12.3));
    const fileRow = mk(pC, 'skillrow', `<div class="zipicon" style="width:44px;height:50px"></div><div>narrated-video-edit-v1.0.0.zip<small>4.1 MB</small></div>`, { top: '190px', height: '110px' });
    gsap.set(fileRow, { autoAlpha: 0 });
    master.to(fileRow, { autoAlpha: 1, duration: 0.25 }, sc.b(12.5));
    master.to(dropEl, { autoAlpha: 0, duration: 0.15 }, sc.b(12.4));
    gsap.set(scan, { top: 330, autoAlpha: 0 });
    master.to(scan, { autoAlpha: 1, duration: 0.25 }, sc.b(13));
    master.add(() => {}, sc.b(15));
    const st = scan.querySelector('.st');
    master.set(st, { color: '#2fa36b', innerHTML: `${L.ui.passed} &#10003;` }, sc.b(15.2));
    master.to(upBtn, { opacity: 1, duration: 0.25 }, sc.b(15.4));
    cursorMove(cur, 1570, 923, sc.b(15.5), 0.8);
    click(sc.el, cur, 1570, 923, sc.b(17.2));
    const toast = mk(sc.el, 'toast', `<div class="check">${svgCheck}</div>${L.ui.toast}`, { left: '760px', top: '900px' });
    gsap.set(toast, { autoAlpha: 0, y: 30 });
    master.to(toast, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'back.out(1.6)' }, sc.b(17.5));
    swap(pC, pD, sc.b(18));
    master.to(toast, { autoAlpha: 0, duration: 0.3 }, sc.b(20.5));
    // D: bật skill
    const tog = newRow.querySelector('.tog');
    cursorMove(cur, 1578, 522, sc.b(19), 0.8);
    click(sc.el, cur, 1578, 522, sc.b(21));
    master.to(tog, { backgroundColor: '#2fa36b', duration: 0.25 }, sc.b(21));
    master.to(tog.firstElementChild, { x: 38, duration: 0.25, ease: 'back.out(2)' }, sc.b(21));
  }

  // 5. Claude Code
  {
    const sc = scene(48, 10);
    mk(sc.el, 'center', `<div class="h2">${L.ccTitle}</div>`, { top: '56px' });
    mk(sc.el, 'center', `<div class="sub">${L.ccSub}</div>`, { top: '152px' });
    const t = mk(sc.el, 'term', '<div class="bar"><i style="background:#ff6b5e"></i><i style="background:#f6c244"></i><i style="background:#5fd49a"></i><b>zsh</b></div>');
    place(t, { left: 240, top: 250, width: 1440, height: 640 });
    master.from(t, { y: 70, autoAlpha: 0, duration: 0.55, ease: 'power3.out' }, sc.b(0.3));
    const pre = mk(t, '', '', {});
    pre.outerHTML = '<pre id="ccpre"></pre>';
    const ccpre = t.querySelector('#ccpre');
    const l1 = '$ unzip narrated-video-edit-v1.0.0.zip -d ~/.claude/skills';
    const l2 = '  inflating: narrated-video-edit/SKILL.md';
    const l3 = '  inflating: narrated-video-edit/scripts/setup.mjs';
    const l4 = '$ claude';
    const l5 = '> /narrated-video-edit';
    const o = { n: 0 };
    const total = l1.length + l4.length + l5.length;
    const lines = (n) => {
      let html = '';
      const a = Math.min(n, l1.length);
      html += `<span class="pr">$</span>${l1.slice(1, a)}`;
      if (n > l1.length + 5) html += `\n<span class="dim">${l2}\n${l3}\n  ...</span>`;
      if (n > l1.length + 10) {
        const b = Math.min(n - l1.length - 10, l4.length);
        html += `\n<span class="pr">$</span>${l4.slice(1, b)}`;
      }
      if (n > l1.length + 10 + l4.length + 4) {
        const c = Math.min(n - (l1.length + 10 + l4.length + 4), l5.length);
        html += `\n\n<span class="pr">&gt;</span>${l5.slice(1, c)}<span class="caret"></span>`;
      }
      return html;
    };
    master.to(o, { n: l1.length + 10 + l4.length + 4 + l5.length, duration: sc.b(7) - sc.b(1), ease: 'none', onUpdate() { ccpre.innerHTML = lines(Math.round(o.n)); } }, sc.b(1));
    const sug = mk(t, '', `<span class="ok">/narrated-video-edit</span> &nbsp;<span class="dim">${L.ccDesc}</span>`, { position: 'absolute', left: '36px', top: '430px', fontFamily: "'Cascadia Mono', Consolas, monospace", fontSize: '28px', padding: '14px 22px', border: '2px solid #2b3d52', borderRadius: '14px', background: '#0e1824' });
    master.from(sug, { y: 14, autoAlpha: 0, duration: 0.35 }, sc.b(7.3));
    const win = mk(sc.el, 'center', `<div class="chip" style="position:static;font-size:26px;font-family:'Cascadia Mono',Consolas,monospace;color:#1e2a3b">${L.ccWin}</div>`, { top: '940px' });
    master.from(win, { y: 30, autoAlpha: 0, duration: 0.4 }, sc.b(8));
  }

  // 6. nhờ Claude dựng
  {
    const sc = scene(58, 10);
    mk(sc.el, 'center', `<div class="eyebrow">${L.askEyebrow}</div>`, { top: '56px' });
    mk(sc.el, 'center', `<div class="h2">${L.askTitle}</div>`, { top: '104px' });
    const box = mk(sc.el, 'chatbox', '<div class="txt"></div>');
    place(box, { left: 330, top: 240, width: 1260, height: 200 });
    master.from(box, { y: 50, autoAlpha: 0, duration: 0.5, ease: 'power3.out' }, sc.b(0.3));
    const send = mk(box, 'send', sendSvg);
    typeText(box.querySelector('.txt'), L.prompt, sc.b(1), sc.b(4.5) - sc.b(1));
    master.fromTo(send, { scale: 1 }, { scale: 1.2, duration: 0.18, yoyo: true, repeat: 1 }, sc.b(4.8));
    gateCards(sc, 500, 5.2, false);
    const sub = mk(sc.el, 'center', `<div class="sub" style="color:#1e2a3b">${L.gatesSub}</div>`, { top: '965px' });
    master.from(sub, { y: 30, autoAlpha: 0, duration: 0.4 }, sc.b(8.6));
  }

  // 7. chuẩn bị máy
  {
    const sc = scene(68, 10);
    mk(sc.el, 'center', `<div class="h2">${L.setupTitle}</div>`, { top: '64px' });
    const row = mk(sc.el, 'center', ['Node.js 20+', 'FFmpeg', 'Chrome', 'Python 3.11+'].map((x) => `<div class="chip" style="position:static;font-size:30px">${x}</div>`).join(''), { top: '200px', flexDirection: 'row', justifyContent: 'center', gap: '22px' });
    [...row.children].forEach((c, i) => master.from(c, { scale: 0.4, autoAlpha: 0, duration: 0.4, ease: 'back.out(2)' }, sc.b(0.5 + i * 0.4)));
    const t = mk(sc.el, 'term', '<div class="bar"><i style="background:#ff6b5e"></i><i style="background:#f6c244"></i><i style="background:#5fd49a"></i><b>narrated-video-edit/scripts</b></div><pre id="setpre"></pre>');
    place(t, { left: 300, top: 320, width: 1320, height: 600 });
    master.from(t, { y: 60, autoAlpha: 0, duration: 0.5, ease: 'power3.out' }, sc.b(1.2));
    const pre = t.querySelector('#setpre');
    const steps = [
      { c: '$ npm install', out: '' },
      { c: '$ node setup.mjs', out: '<span class="ok">ok</span>  Node, ffmpeg, Chrome\n<span class="ok">ok</span>  Python .venv, faster-whisper, opencv' },
      { c: '$ node selftest.mjs', out: '<span class="ok">ok</span>  68 / 68 checks' }
    ];
    const timeline = [2.2, 4.2, 6.4];
    const o = { n: 0 };
    master.to(o, { n: 1, duration: sc.b(7) - sc.b(2), ease: 'none', onUpdate() {
      const now = sc.s + 0; void now;
    } }, sc.b(2));
    steps.forEach((s, i) => {
      const o2 = { n: 0 };
      master.to(o2, { n: s.c.length, duration: 0.9, ease: 'none', onUpdate() {
        const done = steps.slice(0, i).map((x) => `<span class="pr">$</span>${x.c.slice(1)}${x.out ? `\n${x.out}` : ''}`).join('\n');
        pre.innerHTML = `${done ? `${done}\n` : ''}<span class="pr">$</span>${s.c.slice(1, Math.round(o2.n))}<span class="caret"></span>`;
      }, onComplete() {} }, sc.b(timeline[i]));
      master.add(() => {
        const done = steps.slice(0, i + 1).map((x) => `<span class="pr">$</span>${x.c.slice(1)}${x.out ? `\n${x.out}` : ''}`).join('\n');
        pre.innerHTML = `${done}<span class="caret"></span>`;
      }, sc.b(timeline[i]) + 1.2);
    });
    const note = mk(sc.el, 'center', `<div class="step-sub" style="font-size:30px">${L.setupNote}</div>`, { top: '960px' });
    master.from(note, { y: 24, autoAlpha: 0, duration: 0.4 }, sc.b(7.5));
  }

  endScene(78, 10);
  return at(88) + 0.4;
}

// ---------- reel ----------
function buildReel() {
  hookScene(0, 8);

  // 2. kết quả thật
  {
    const sc = scene(8, 16);
    const ph = mk(sc.el, 'phone');
    place(ph, { left: 330, top: 92, width: 470, height: 870 });
    const scr = mk(ph, 'scr');
    clip(scr, 'selftest', { start: sc.b(0.2), offset: 2.5 });
    master.from(ph, { y: 120, autoAlpha: 0, rotation: -3, duration: 0.7, ease: 'power3.out' }, sc.b(0.2));
    const icons = ['Aa', '★', '▣', '12'];
    const times = [0.8, 2.2, 4, 12.4];
    L.callouts.forEach((txt, i) => {
      const c = mk(sc.el, 'card', `<div class="badge" style="flex:none">${icons[i]}</div><div style="font-weight:800;font-size:40px;line-height:1.15">${txt}</div>`, { width: '760px', height: '130px', display: 'flex', alignItems: 'center', gap: '26px', padding: '0 34px', borderRadius: '30px' });
      place(c, { left: 900, top: 190 + i * 168 });
      master.from(c, { x: 120, autoAlpha: 0, duration: 0.55, ease: 'back.out(1.5)' }, sc.b(times[i]));
    });
    const note = mk(sc.el, 'center', `<div class="step-sub" style="font-size:26px">${L.realNote}</div>`, { top: '1010px' });
    master.from(note, { autoAlpha: 0, duration: 0.4 }, sc.b(1));
  }

  // 3. hiệu ứng
  {
    const sc = scene(24, 8);
    mk(sc.el, 'center', `<div class="h2" style="font-size:88px">${L.fxTitle1} <span class="hl">${L.fxTitle2}</span></div>`, { top: '70px' });
    const ids = ['crash-zoom', 'whip-pan', 'rgb-split-hit', 'vhs-look', 'duotone', 'iris-color'];
    ids.forEach((id, i) => {
      const x = 55 + i * 305;
      const ph = mk(sc.el, 'phone', '', {});
      place(ph, { left: x, top: 270, width: 290, height: 520, borderRadius: 40, padding: 10 });
      const scr = mk(ph, 'scr', '', { borderRadius: '30px' });
      clip(scr, `fx-${id}`, { start: sc.b(0.6 + i * 0.2), loop: true });
      master.from(ph, { y: 110, autoAlpha: 0, duration: 0.5, ease: 'back.out(1.5)' }, sc.b(0.4 + i * 0.25));
      const lb = mk(sc.el, 'chip', id, { fontSize: '24px', padding: '10px 20px', fontFamily: "'Cascadia Mono', Consolas, monospace" });
      place(lb, { left: x + 145 - (id.length * 7.4 + 20), top: 830 });
      master.from(lb, { y: 20, autoAlpha: 0, duration: 0.4 }, sc.b(1.2 + i * 0.25));
    });
  }

  // 4. cổng duyệt
  {
    const sc = scene(32, 8);
    mk(sc.el, 'center', `<div class="h2">${L.gatesSub}</div>`, { top: '70px' });
    gateCards(sc, 280, 0.8, true);
    const sub = mk(sc.el, 'center', `<div class="sub" style="color:#1e2a3b">${L.gatesSub2}</div>`, { top: '800px' });
    master.from(sub, { y: 30, autoAlpha: 0, duration: 0.4 }, sc.b(4.8));
  }

  // 5. kiểm toán
  {
    const sc = scene(40, 8);
    mk(sc.el, 'center', `<div class="h2">${L.auditTitle}</div>`, { top: '70px' });
    L.audit.forEach(([txt, val], i) => {
      const r = mk(sc.el, 'arow', `<div class="check" style="width:56px;height:56px"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" style="width:30px;height:30px"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div><div>${txt}</div><b>${val}</b>`);
      place(r, { left: 410, top: 230 + i * 138 });
      master.from(r, { x: 90, autoAlpha: 0, duration: 0.5, ease: 'power3.out' }, sc.b(0.8 + i * 0.9));
      master.from(r.querySelector('.check'), { scale: 0, duration: 0.35, ease: 'back.out(3)' }, sc.b(1.1 + i * 0.9));
    });
  }

  endScene(48, 12);
  return at(60) + 0.4;
}

// ---------- banner ----------
function buildBanner() {
  const DUR = 6;
  const bg = mk(stage, '', '', { position: 'absolute', inset: '0', background: 'linear-gradient(120deg,#eaf3fb 0%,#dcebf8 100%)' });
  mk(stage, 'bn-title', 'narrated-video-edit');
  mk(stage, 'bn-sub', L.bnSub);
  const chips = L.bnChips.map((t, i) => mk(stage, 'bn-chip', t));
  let x = 72;
  chips.forEach((c) => { place(c, { left: x, top: 290 }); x += c.offsetWidth + 14; });
  chips.forEach((c, i) => {
    const t0 = i * 1.2;
    master.to(c, { backgroundColor: '#2f7fc1', color: '#ffffff', borderColor: '#2f7fc1', duration: 0.2 }, t0);
    master.to(c, { backgroundColor: '#ffffff', color: '#2f7fc1', borderColor: '#d3e1ef', duration: 0.2 }, t0 + 1.2);
  });
  // chip đầu sáng ở khung đầu và khung cuối để vòng lặp liền mạch
  gsap.set(chips[0], { backgroundColor: '#2f7fc1', color: '#fff', borderColor: '#2f7fc1' });
  master.set(chips[0], { backgroundColor: '#2f7fc1', color: '#fff', borderColor: '#2f7fc1' }, 0);
  master.to(chips[0], { backgroundColor: '#ffffff', color: '#2f7fc1', borderColor: '#d3e1ef', duration: 0.2 }, 1.2);
  const ph = mk(stage, 'phone');
  place(ph, { left: 880, top: 22, width: 222, height: 392, borderRadius: 34, padding: 9 });
  const scr = mk(ph, 'scr', '', { borderRadius: '26px' });
  clip(scr, 'selftest', { start: 0, offset: 2.5 });
  master.to({}, { duration: DUR }, 0);
  return DUR;
}

// ---------- khởi động ----------
window.ready = (async () => {
  try { CLIPCOUNT = await (await fetch('/docs/video-src/.cache/clips.json')).json(); } catch { CLIPCOUNT = {}; }
  await document.fonts.ready;
  await Promise.all(['500', '600', '800', '900'].map((w) => document.fonts.load(`${w} 40px BVP`)));
  const dur = VIDEO === 'guide' ? buildGuide() : VIDEO === 'reel' ? buildReel() : buildBanner();
  window.DURATION = dur;
  master.time(0, false);
  await updateClips(0);
  return dur;
})();

window.seek = async (t) => {
  master.time(t, false);
  await updateClips(t);
  await new Promise((r) => requestAnimationFrame(() => r()));
};
