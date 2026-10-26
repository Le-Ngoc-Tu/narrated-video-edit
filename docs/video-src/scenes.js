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
function maskWords(parent, text, cls) {
  const line = mk(parent, cls);
  return text.split(' ').map((w, i, arr) => {
    const m = mk(line, 'mask');
    const sp = document.createElement('span');
    sp.innerHTML = i < arr.length - 1 ? `${w}&nbsp;` : w;
    m.appendChild(sp);
    return sp;
  });
}

function hookScene(startBeat, beats) {
  const sc = scene(startBeat, beats);
  const box = mk(sc.el, 'center', '', { top: '230px' });
  const w1 = maskWords(box, L.hook1, 'h1');
  const w2 = maskWords(box, L.hook2, 'h1 hl');
  const s = mk(sc.el, 'center', `<div class="sub">${L.hookSub}</div>`, { top: '580px' });
  master.from(w1, { yPercent: 115, duration: 0.7, ease: 'power4.out', stagger: 0.14 }, sc.b(0.2));
  master.from(w2, { yPercent: 115, duration: 0.7, ease: 'power4.out', stagger: 0.12 }, sc.b(1.4));
  master.from(s, { y: 30, autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, sc.b(3));
  // sóng âm: giọng nói trở thành hình
  const wave = mk(sc.el, '', '', { position: 'absolute', left: '0', right: '0', top: '720px', height: '110px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' });
  for (let i = 0; i < 30; i += 1) {
    const bar = mk(wave, '', '', { width: '14px', height: '100px', borderRadius: '7px', background: i % 5 === 2 ? '#f6b800' : '#2f7fc1', transformOrigin: '50% 50%' });
    const amp = 0.25 + 0.75 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23));
    gsap.set(bar, { scaleY: 0.08 });
    master.to(bar, { scaleY: amp, duration: 0.18 + (i % 6) * 0.04, ease: 'sine.inOut', yoyo: true, repeat: 17 }, sc.b(3.4) + i * 0.012);
    master.from(bar, { autoAlpha: 0, duration: 0.2 }, sc.b(3.4) + i * 0.012);
  }
  const spots = [[130, 150], [1390, 130], [80, 800], [1420, 830], [760, 60], [690, 940]];
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

  endScene(40, 12);
  return at(52) + 0.4;
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
