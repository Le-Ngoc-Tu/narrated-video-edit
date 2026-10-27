// Lớp phủ: dựng mọi phần tử từ window.OVERLAY (do render-overlay.mjs sinh) và một timeline GSAP tạm dừng.
// Mọi khung là hàm của thời gian: window.seek(t) đặt timeline tại t. Không CSS animation, không timer.
// Chỉ animate transform, opacity, clip-path và nét vẽ (DrawSVG); màu đổi bằng set tại mốc từ.
gsap.registerPlugin(DrawSVGPlugin);
// Nạp phông trước khi dựng: các vòng co chữ cho vừa khung đo độ rộng thật, không đo bằng phông dự phòng
(async () => {
await Promise.all(['900 40px Montserrat', '800 40px Montserrat', '400 40px Anton', '500 40px "Be Vietnam Pro"', '600 40px "Be Vietnam Pro"', '700 40px "Be Vietnam Pro"', '800 40px "Be Vietnam Pro"', '900 40px "Be Vietnam Pro"'].map((spec) => document.fonts.load(spec, 'Ắ ỡ ệ ư Dạy').catch(() => null)));

const D = window.OVERLAY;
const { W, H, style } = D;
const U = Math.min(W, H);
const stage = document.getElementById('stage');
stage.style.width = `${W}px`;
stage.style.height = `${H}px`;
const C = style.colors;
const tl = gsap.timeline({ paused: true });
const NS = 'http://www.w3.org/2000/svg';
const FALLBACK = style.fonts.body;
const HEX = (hex, a) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
const mk = (cls, parent) => { const el = document.createElement('div'); el.className = cls; if (parent) parent.appendChild(el); return el; };
// Tween bắt đầu từ giá trị tường minh và không vẽ ngay lúc dựng: an toàn khi tua tới lui
const ft = (el, from, to, pos) => tl.fromTo(el, from, { immediateRender: false, ...to }, pos);
const show = (el, s, e) => { tl.set(el, { visibility: 'visible' }, s); tl.set(el, { visibility: 'hidden' }, e); };
const fontLoads = [];
const useFont = (family, weight, style = 'normal') => fontLoads.push(`${style === 'italic' ? 'italic ' : ''}${weight} 40px "${family}"`);

// ---- Caption: mô hình "băng chữ" — cả lượt chữ hiện cùng lúc, từ đang nói được nhấn; không bao giờ bỏ từ ----
// Bóng mềm, không có lớp bóng cứng lệch (trông như viền chữ): chữ vẫn đọc được trên nền sáng mà không vẽ viền
const SH_STRONG = '0 0.04em 0.16em rgba(0,0,0,.55), 0 0 0.45em rgba(0,0,0,.3)';
const SH_SOFT = '0 0.04em 0.18em rgba(0,0,0,.6), 0 0 0.5em rgba(0,0,0,.4)';
// Caption trong cảnh demo nền sáng: chữ tối, quầng sáng thay bóng tối
const LIGHT_INK = '#1c1a2e';
const SH_LIGHT = '0 0 0.3em rgba(255,255,255,.9), 0 0 0.7em rgba(255,255,255,.6)';
const PRESETS = {
  bold: { family: 'Montserrat', weight: 900, upper: true, lh: 1.08, gap: 0.3, shadow: SH_STRONG, active: 'color', enter: 'pop', scale: 1 },
  kinetic: { family: 'Anton', weight: 400, upper: true, lh: 1.02, gap: 0.34, shadow: SH_STRONG, active: 'color', enter: 'pop', scale: 1.18, tilt: true },
  pill: { family: 'Be Vietnam Pro', weight: 700, upper: false, lh: 1.22, gap: 0.3, shadow: 'none', active: 'box', enter: 'rise', plate: true, scale: 1, sz: 0.85 },
  marker: { family: 'Be Vietnam Pro', weight: 900, upper: true, lh: 1.2, gap: 0.3, shadow: SH_STRONG, active: 'swipe', enter: 'rise', scale: 1 },
  minimal: { family: 'Be Vietnam Pro', weight: 600, upper: false, lh: 1.28, gap: 0.24, shadow: SH_SOFT, active: 'color', enter: 'fade', scale: 1 },
  // Kiểu biên tập: chữ sans yên tĩnh (không nảy, không đổi màu từng từ), chỉ TỪ NHẤN chuyển sang serif nghiêng màu nhấn
  editorial: { family: 'Be Vietnam Pro', weight: 600, upper: false, lh: 1.25, gap: 0.26, shadow: SH_SOFT, active: 'color', enter: 'fade', scale: 1, sz: 0.92, quiet: true, accent: { family: 'Lora', weight: 600, size: 1.12 } }
};
const P = PRESETS[style.captions.preset] ?? PRESETS.bold;
useFont(P.family, P.weight);
if (P.accent) useFont(P.accent.family, P.accent.weight, 'italic');
const capSize0 = style.captions.sizeRatio * U * (P.family === 'Anton' ? 1.18 : 1) * (P.sz ?? 1);
const wordEls = new Map();
const capBoxes = [];
const imgs = [];
// Lottie (emoji động Noto): mỗi hoạt họa được tua theo giờ của lớp phủ bằng goToAndStop, nên mọi khung vẫn là hàm của thời gian
const lotties = [];
const lottieMount = (parent, name, s, e, cssText) => {
  const data = D.lottie?.[name];
  if (!data || !window.lottie) return null;
  const box = document.createElement('div');
  box.style.cssText = `position:absolute;${cssText}`;
  parent.appendChild(box);
  const anim = lottie.loadAnimation({ container: box, renderer: 'svg', loop: false, autoplay: false, animationData: data });
  lotties.push({ anim, fr: data.fr, op: data.op, s, e });
  return box;
};
// Hạt trang trí tất định (không Math.random): vị trí và góc là hàm của chỉ số
const rr = (i, k) => { const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const starPath = (r) => `M0 ${-r} C${r * 0.12} ${-r * 0.12} ${r * 0.12} ${-r * 0.12} ${r} 0 C${r * 0.12} ${r * 0.12} ${r * 0.12} ${r * 0.12} 0 ${r} C${-r * 0.12} ${r * 0.12} ${-r * 0.12} ${r * 0.12} ${-r} 0 C${-r * 0.12} ${-r * 0.12} ${-r * 0.12} ${-r * 0.12} 0 ${-r}Z`;
const PARTICLE_COLORS = [C.accent, C.accent2, C.ink];
// Lấp lánh: các ngôi sao bốn cánh nhấp nháy quanh một hình chữ nhật (px trong khung)
const sparkles = (rect, at, count, sizeU) => {
  const wrap = mk('deco');
  wrap.style.cssText += `left:0;top:0;width:${W}px;height:${H}px;filter:drop-shadow(0 ${U * 0.004}px ${U * 0.008}px rgba(0,0,0,.35));`;
  for (let i = 0; i < count; i++) {
    const r = U * sizeU * (0.6 + rr(i, 1) * 0.7);
    const side = i % 4;
    const px = side === 0 ? rect.x - r * 0.4 : side === 1 ? rect.x + rect.w + r * 0.4 : rect.x + rect.w * (0.15 + rr(i, 2) * 0.7);
    const py = side === 2 ? rect.y - r * 0.5 : side === 3 ? rect.y + rect.h + r * 0.5 : rect.y + rect.h * (0.1 + rr(i, 3) * 0.8);
    const star = svg(r * 2, r * 2, `<path transform="translate(${r} ${r})" d="${starPath(r)}" fill="${i % 2 ? C.accent : C.ink}"/>`);
    star.style.cssText = `position:absolute;left:${px - r}px;top:${py - r}px;`;
    wrap.appendChild(star);
    const t0 = at + i * 0.07;
    tl.fromTo(star, { scale: 0, rotation: -45, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.22, ease: 'back.out(2)' }, t0);
    ft(star, { scale: 1, rotation: 0, opacity: 1 }, { scale: 0, rotation: 60, opacity: 0, duration: 0.28, ease: 'power2.in' }, t0 + 0.4);
  }
  stage.appendChild(wrap);
  show(wrap, at - 0.02, at + count * 0.07 + 0.8);
};
// Confetti: các mảnh màu bắn ra từ một điểm rồi rơi và mờ dần
const confetti = (cx, cy, at, count) => {
  const wrap = mk('deco');
  wrap.style.cssText += `left:${cx}px;top:${cy}px;width:0;height:0;`;
  for (let i = 0; i < count; i++) {
    const p = mk('chip', wrap);
    const w = U * (0.018 + rr(i, 4) * 0.016);
    const round = rr(i, 5) > 0.6;
    p.style.cssText += `left:${-w / 2}px;top:${-w / 2}px;width:${w}px;height:${round ? w : w * 1.9}px;border-radius:${round ? '50%' : '2px'};background:${PARTICLE_COLORS[i % 3]};`;
    const ang = -Math.PI / 2 + (rr(i, 6) - 0.5) * Math.PI * 1.3;
    const dist = U * (0.14 + rr(i, 7) * 0.2);
    tl.fromTo(p, { x: 0, y: 0, scale: 0, rotation: 0, opacity: 1 }, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, scale: 1, rotation: (rr(i, 8) - 0.5) * 540, duration: 0.55 + rr(i, 9) * 0.25, ease: 'power3.out' }, at);
    ft(p, { y: Math.sin(ang) * dist, opacity: 1 }, { y: Math.sin(ang) * dist + U * 0.14, opacity: 0, duration: 0.5, ease: 'power1.in' }, at + 0.55);
  }
  stage.appendChild(wrap);
  show(wrap, at - 0.02, at + 1.4);
};
const decorByWord = new Map();
D.decor.filter((d) => d.anchored && d.type !== 'arrow').forEach((d) => decorByWord.set(d.anchorWord, [...(decorByWord.get(d.anchorWord) ?? []), d]));

D.chunks.forEach((chunk) => {
  const light = !P.plate && (D.demoLight ?? []).some((z) => chunk.s < z.e && chunk.e > z.s);
  chunk.ink = light ? LIGHT_INK : C.ink;
  const box = mk('cap');
  box.style.top = `${D.captionY * H}px`;
  const inner = mk('cap-in', box);
  inner.dataset.kind = 'caption';
  inner.dataset.id = chunk.id;
  inner.style.fontFamily = `"${P.family}", ${FALLBACK}`;
  inner.style.fontWeight = String(P.weight);
  inner.style.color = chunk.ink;
  inner.style.lineHeight = String(P.lh);
  inner.style.textShadow = light ? SH_LIGHT : P.shadow;
  inner.style.textTransform = P.upper ? 'uppercase' : 'none';
  inner.style.columnGap = `${P.gap}em`;
  if (P.plate) {
    inner.style.background = HEX(C.panel, 0.86);
    inner.style.padding = '0.22em 0.5em';
    inner.style.borderRadius = '0.62em';
    inner.style.boxShadow = '0 0.2em 0.7em rgba(0,0,0,.35)';
  }
  stage.appendChild(box);
  chunk.words.forEach((w) => {
    const el = document.createElement('span');
    el.className = 'w';
    el.dataset.i = String(w.i);
    el.textContent = w.text;
    if (w.emph && P.accent) { el.style.fontFamily = `"${P.accent.family}", Georgia, serif`; el.style.fontStyle = 'italic'; el.style.fontWeight = String(P.accent.weight); el.style.fontSize = `${P.accent.size}em`; el.style.color = C.accent; }
    else if (w.emph && P.active === 'color') { el.style.fontSize = '1.08em'; el.style.color = light ? C.accent : C.accent2; }
    inner.appendChild(el);
    wordEls.set(w.i, el);
    if (P.active === 'box' || P.active === 'swipe') {
      const hl = mk('hl', el);
      hl.style.background = C.accent;
      if (P.active === 'swipe') { hl.style.borderRadius = '0.1em'; hl.style.transform = 'skewX(-7deg)'; }
    }
  });
  if (chunk.emoji) {
    const slot = mk('', inner);
    slot.style.cssText = 'display:inline-block;position:relative;width:0;height:1em;';
    const boxCss = 'left:0.3em;top:50%;width:1.3em;height:1.3em;margin-top:-0.62em;transform-origin:50% 70%;opacity:0;filter:drop-shadow(0 0.1em 0.12em rgba(0,0,0,.4));';
    let em = chunk.emoji.animated ? lottieMount(slot, chunk.emoji.file, chunk.emoji.s, chunk.e, boxCss) : null;
    if (!em) {
      em = document.createElement('img');
      em.src = `emoji/${chunk.emoji.file}.png`;
      em.alt = '';
      em.style.cssText = `position:absolute;${boxCss}`;
      slot.appendChild(em);
      imgs.push(em);
    }
    chunk.emojiEl = em;
  }
  // Vừa khung: chữ quá dài thì thu nhỏ dần để không quá 2 dòng và không tràn
  let size = capSize0;
  inner.style.fontSize = `${size}px`;
  const tooWide = () => Math.max(...chunk.words.map((w) => wordEls.get(w.i).getBoundingClientRect().width)) > inner.clientWidth * 0.98;
  for (let n = 0; n < 8 && (inner.getBoundingClientRect().height > size * P.lh * 2.4 || tooWide()); n++) { size *= 0.93; inner.style.fontSize = `${size}px`; }
  capBoxes.push({ chunk, box, inner, size });
});

// ---- Hình vẽ phẳng cho sticker (không viền, đổ bóng mềm bằng filter) ----
const svg = (w, h, inner) => {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('width', w);
  el.setAttribute('height', h);
  el.setAttribute('viewBox', `0 0 ${w} ${h}`);
  el.innerHTML = inner;
  return el;
};
const lineAttrs = (color, width) => `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
const glyph = (w, h, ch, fill) => `<text x="50%" y="53%" text-anchor="middle" dominant-baseline="central" font-family="Montserrat, ${FALLBACK}" font-weight="900" font-size="${Math.min(w, h) * 0.62}" fill="${fill}">${ch}</text>`;
const SHAPES = {
  arrow: (w, h) => svg(w, h, `<path class="draw" d="M${w * 0.5} 4 L ${w * 0.5} ${h * 0.86}" ${lineAttrs(C.accent, Math.max(7, U * 0.012))}/><path class="draw" d="M${w * 0.24} ${h * 0.6} L ${w * 0.5} ${h * 0.9} L ${w * 0.76} ${h * 0.6}" ${lineAttrs(C.accent, Math.max(7, U * 0.012))}/>`),
  burst: (w, h) => {
    const pts = Array.from({ length: 20 }, (_, k) => { const a = (k / 20) * Math.PI * 2; const r = k % 2 ? 0.37 : 0.5; return `${w * (0.5 + Math.cos(a) * r)},${h * (0.5 + Math.sin(a) * r)}`; }).join(' ');
    return svg(w, h, `<polygon points="${pts}" fill="${C.accent}" stroke="${C.accent}" stroke-width="${U * 0.008}" stroke-linejoin="round"/>`);
  },
  check: (w, h) => svg(w, h, `<circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.48}" fill="${C.accent}"/><path class="draw" d="M${w * 0.27} ${h * 0.52} L ${w * 0.44} ${h * 0.68} L ${w * 0.74} ${h * 0.34}" ${lineAttrs(C.panel, U * 0.02)}/>`),
  question: (w, h) => svg(w, h, `<circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.48}" fill="${C.accent2}"/>${glyph(w, h, '?', C.ink)}`),
  exclaim: (w, h) => svg(w, h, `<circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.48}" fill="${C.accent}"/>${glyph(w, h, '!', C.panel)}`),
  badge: (w, h, text) => svg(w, h, `<rect x="0" y="0" width="${w}" height="${h}" rx="${h / 2}" fill="${C.accent}"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="central" font-family="Montserrat, ${FALLBACK}" font-weight="900" font-size="${h * 0.48}" fill="${C.panel}">${(text ?? '').toUpperCase()}</text>`)
};
useFont('Montserrat', 900);

// ---- Đo vị trí mũi tên neo vào chữ (trước khi dựng tween, lúc chữ chưa bị biến đổi) ----
const stage0 = stage.getBoundingClientRect();
const measure = (wordIndex) => {
  const target = wordEls.get(wordIndex);
  if (!target) return null;
  const capBox = target.closest('.cap');
  const prev = capBox.style.visibility;
  capBox.style.visibility = 'visible';
  const r = target.getBoundingClientRect();
  capBox.style.visibility = prev;
  return r;
};
const arrowRects = new Map(D.decor.filter((d) => d.anchored && ['arrow', 'sparkle', 'confetti'].includes(d.type)).map((d) => [d.id, measure(d.anchorWord)]));

// ---- Dựng tween caption ----
capBoxes.forEach(({ chunk, inner, size }) => {
  const box = inner.parentElement;
  show(box, chunk.s, chunk.e);
  const enterY = size * (P.enter === 'rise' ? 0.4 : 0.14);
  const from = P.enter === 'fade' ? { opacity: 0 } : { opacity: 0, y: enterY, scale: P.enter === 'pop' ? 0.9 : 1 };
  tl.fromTo(inner, from, { opacity: 1, y: 0, scale: 1, duration: P.enter === 'fade' ? 0.18 : 0.16, ease: P.enter === 'pop' ? 'back.out(2)' : 'power3.out' }, chunk.s);
  ft(inner, { opacity: 1 }, { opacity: 0, duration: 0.1, ease: 'power1.in' }, Math.max(chunk.s + 0.2, chunk.e - 0.1));
  if (chunk.emojiEl) tl.fromTo(chunk.emojiEl, { scale: 0, rotation: -28, opacity: 0 }, { scale: 1, rotation: 8, opacity: 1, duration: 0.5, ease: 'elastic.out(1.1,0.45)' }, chunk.emoji.s);
  chunk.words.forEach((w, k) => {
    const el = wordEls.get(w.i);
    const next = chunk.words[k + 1];
    const until = next ? next.s : Math.max(w.e, w.s + 0.18) + 0.05;
    const hl = el.querySelector('.hl');
    if (P.quiet) return;
    if (P.active === 'color') {
      if (!w.emph) { tl.set(el, { color: C[style.captions.activeColor] ?? C.accent }, w.s); tl.set(el, { color: chunk.ink }, until); }
    } else {
      ft(hl, { opacity: 0, scaleX: 0.6 }, { opacity: 1, scaleX: 1, duration: 0.09, ease: 'power2.out' }, w.s);
      tl.set(hl, { opacity: 0 }, until);
      tl.set(el, { color: C.panel }, w.s);
      tl.set(el, { color: chunk.ink }, until);
    }
    const peak = P.scale > 1 ? P.scale : style.captions.popScale;
    const tilt = P.tilt ? (k % 2 ? 3 : -3) : 0;
    ft(el, { scale: 1, rotation: 0 }, { scale: peak, rotation: tilt, duration: 0.09, ease: 'power3.out' }, w.s);
    ft(el, { scale: peak, rotation: tilt }, { scale: 1, rotation: 0, duration: 0.14, ease: 'power2.inOut' }, w.s + 0.09);
  });
});

// ---- Sticker: gắn vào từ (underline, circle, arrow) hoặc đặt ở vùng trống (burst, check, question, exclaim, badge) ----
D.decor.forEach((d) => {
  if (d.type === 'sparkle' || d.type === 'confetti') {
    const r = arrowRects.get(d.id);
    if (!r) return;
    const rect = { x: r.left - stage0.left, y: r.top - stage0.top, w: r.width, h: r.height };
    if (d.type === 'sparkle') sparkles(rect, d.s, 7, 0.032);
    else confetti(rect.x + rect.w / 2, rect.y, d.s, 24);
    return;
  }
  if (d.type === 'icon') {
    // Sticker cắt viền trắng từ icon Iconify (SVG màu): viền bằng các drop-shadow bốn hướng, bóng đổ mềm phía ngoài
    const wrap = mk('deco');
    wrap.dataset.kind = 'decor';
    wrap.dataset.id = d.id;
    const o = Math.max(3, U * 0.007);
    wrap.style.cssText += `left:${d.x * W}px;top:${d.y * H}px;width:${d.w * W}px;height:${d.h * H}px;filter:drop-shadow(${o}px 0 0 #fff) drop-shadow(${-o}px 0 0 #fff) drop-shadow(0 ${o}px 0 #fff) drop-shadow(0 ${-o}px 0 #fff) drop-shadow(0 ${U * 0.014}px ${U * 0.02}px rgba(0,0,0,.38));`;
    const img = document.createElement('img');
    img.src = d.src;
    img.alt = '';
    img.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;';
    imgs.push(img);
    wrap.appendChild(img);
    stage.appendChild(wrap);
    show(wrap, d.s, d.e);
    const dir = d.side ?? 1;
    tl.fromTo(wrap, { scale: 0.2, rotation: -dir * 25, opacity: 0 }, { scale: 1, rotation: dir * 7, opacity: 1, duration: 0.45, ease: 'elastic.out(1.1,0.5)' }, d.s);
    if (d.e - d.s > 1) ft(wrap, { rotation: dir * 7, y: 0 }, { rotation: -dir * 5, y: -U * 0.012, duration: d.e - d.s - 0.75, ease: 'sine.inOut' }, d.s + 0.45);
    ft(wrap, { scale: 1, opacity: 1 }, { scale: 0.5, opacity: 0, duration: 0.2, ease: 'power2.in' }, d.e - 0.2);
    return;
  }
  if (d.anchored && d.type !== 'arrow') {
    const el = wordEls.get(d.anchorWord);
    if (!el) return;
    const m = mk('mk', el);
    if (d.type === 'underline') { m.style.cssText = `left:-0.04em;right:-0.04em;bottom:-0.02em;height:0.11em;background:${C.accent};border-radius:0.1em;`; }
    else { m.style.cssText = `left:-0.2em;right:-0.2em;top:-0.04em;bottom:-0.04em;height:auto;background:${HEX(C.accent2, 0.9)};border-radius:0.3em;`; }
    ft(m, { opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: 0.22, ease: 'power3.out' }, d.s);
    tl.to(m, { opacity: 0, duration: 0.12, ease: 'power1.in', immediateRender: false }, Math.max(d.s + 0.25, d.e - 0.12));
    return;
  }
  const wrap = mk('deco');
  wrap.dataset.kind = 'decor';
  wrap.dataset.id = d.id;
  let x;
  let y;
  let w;
  let h;
  if (d.anchored) {
    const r = arrowRects.get(d.id);
    if (!r) return;
    w = Math.max(U * 0.1, r.width * 0.4);
    h = U * 0.11;
    x = r.left - stage0.left + r.width / 2 - w / 2;
    y = r.top - stage0.top - h - U * 0.012;
  } else { x = d.x * W; y = d.y * H; w = d.w * W; h = d.h * H; }
  wrap.style.left = `${x}px`;
  wrap.style.top = `${y}px`;
  wrap.style.filter = 'drop-shadow(0 0.35em 0.5em rgba(0,0,0,.35))';
  wrap.style.fontSize = `${U * 0.02}px`;
  wrap.appendChild(SHAPES[d.type](Math.round(w), Math.round(h), d.text));
  stage.appendChild(wrap);
  const life = d.e - d.s;
  show(wrap, d.s, d.e);
  tl.fromTo(wrap, { scale: 0.2, rotation: d.anchored ? 0 : -16, opacity: 0 }, { scale: 1, rotation: d.anchored ? 0 : (d.side ?? 1) * 6, opacity: 1, duration: 0.3, ease: 'back.out(2.4)' }, d.s);
  wrap.querySelectorAll('.draw').forEach((p) => tl.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: Math.min(0.3, life * 0.4), ease: 'power2.out' }, d.s + 0.05));
  if (!d.anchored) ft(wrap, { rotation: (d.side ?? 1) * 6 }, { rotation: -(d.side ?? 1) * 5, duration: Math.max(0.3, life - 0.5), ease: 'sine.inOut' }, d.s + 0.3);
  ft(wrap, { scale: 1, opacity: 1 }, { scale: 0.6, opacity: 0, duration: 0.15, ease: 'power2.in' }, d.e - 0.15);
});

// ---- Showcase: tài nguyên hiện như vật thể thiết kế (thẻ, polaroid, sticker, PiP, ló ra từ mép, chồng thẻ) ----
// Showcase có clip (sc.clip): khung hình thứ n của chuỗi JPG hiện tại thời điểm t; seek chỉ đổi src, window.settle() đợi giải mã xong trước khi chụp
const playing = [];
let decoding = [];
useFont('Be Vietnam Pro', 800);
D.showcases.forEach((sc) => {
  const w = sc.w * W;
  const h = sc.h * H;
  const el = mk('sc');
  el.dataset.kind = 'showcase';
  el.dataset.id = sc.id;
  el.dataset.mode = sc.mode;
  el.style.cssText += `left:${sc.x * W}px;top:${sc.y * H}px;width:${w}px;height:${h}px;`;
  const shadow = `0 ${U * 0.028}px ${U * 0.06}px rgba(0,0,0,.4), 0 ${U * 0.005}px ${U * 0.012}px rgba(0,0,0,.32)`;
  const inner = mk('sc-in');
  const img = document.createElement('img');
  img.src = sc.src;
  img.alt = '';
  imgs.push(img);
  if (sc.clip) { img.style.objectFit = sc.clip.fit; playing.push({ img, sc, n: 0 }); }
  inner.appendChild(img);
  let radius = U * 0.034;
  if (sc.mode === 'polaroid') {
    radius = U * 0.006;
    const pad = w * 0.06;
    el.style.background = '#fbfaf5';
    el.style.boxShadow = shadow;
    el.style.borderRadius = `${radius}px`;
    inner.style.cssText += `position:absolute;width:auto;height:auto;left:${pad}px;top:${pad}px;right:${pad}px;bottom:${pad * 3.6}px;border-radius:${U * 0.003}px;`;
    el.appendChild(inner);
    const tape = mk('chip', el);
    tape.style.cssText += `left:${w * 0.36}px;top:${-w * 0.035}px;width:${w * 0.28}px;height:${w * 0.09}px;background:rgba(255,226,150,.78);transform:rotate(-4deg);box-shadow:0 1px 3px rgba(0,0,0,.2);`;
    if (sc.label) {
      const cap = mk('chip', el);
      cap.textContent = sc.label;
      cap.style.cssText += `left:${pad}px;right:${pad}px;bottom:${pad * 0.7}px;text-align:center;font:600 ${U * 0.03}px "Be Vietnam Pro",${FALLBACK};color:#33323a;`;
    }
  } else {
    if (sc.mode === 'sticker') { radius = Math.abs(sc.w * W - sc.h * H) < U * 0.05 ? w : U * 0.09; }
    if (sc.mode === 'pip') radius = U * 0.05;
    el.style.borderRadius = `${radius}px`;
    el.style.boxShadow = sc.mode === 'sticker' ? `0 0 0 ${U * 0.011}px #fff, ${shadow}` : shadow;
    inner.style.borderRadius = `${radius}px`;
    if (sc.mode === 'stack') {
      [[-5, C.accent], [4, '#ffffff']].forEach(([deg, color]) => {
        const back = mk('chip', el);
        back.style.cssText += `left:0;top:0;width:100%;height:100%;background:${color};border-radius:${radius}px;transform:rotate(${deg}deg) scale(.97);box-shadow:${shadow};z-index:-1;`;
      });
    }
    el.appendChild(inner);
    const gl = mk('chip', inner);
    gl.style.cssText += `left:0;top:0;width:100%;height:100%;background:linear-gradient(135deg,rgba(255,255,255,.2),rgba(255,255,255,0) 42%);`;
    if (sc.label) {
      const chip = mk('chip', el);
      chip.textContent = sc.label;
      chip.style.cssText += `left:${w * 0.06}px;bottom:${-U * 0.016}px;padding:${U * 0.009}px ${U * 0.022}px;border-radius:99px;background:${C.accent};color:${C.panel};font:800 ${U * 0.026}px "Be Vietnam Pro",${FALLBACK};box-shadow:0 ${U * 0.006}px ${U * 0.016}px rgba(0,0,0,.35);`;
    }
  }
  stage.appendChild(el);

  const dir = sc.side === 'left' ? -1 : 1;
  const rot = sc.rot ?? 0;
  const life = sc.e - sc.s;
  show(el, sc.s, sc.e);
  const inSpan = { pop: 0.4, slide: 0.45, flip: 0.5, drop: 0.62, mask: 0.5 }[sc.entrance] ?? 0.4;
  if (sc.entrance === 'slide') tl.fromTo(el, { x: dir * W * 0.4, rotation: rot + dir * 14, opacity: 0 }, { x: 0, rotation: rot, opacity: 1, duration: inSpan, ease: 'power3.out' }, sc.s);
  else if (sc.entrance === 'flip') tl.fromTo(el, { rotationY: -dir * 85, transformPerspective: 900, scale: 0.85, rotation: rot, opacity: 0 }, { rotationY: 0, scale: 1, opacity: 1, duration: inSpan, ease: 'power3.out' }, sc.s);
  else if (sc.entrance === 'drop') {
    tl.fromTo(el, { y: -H * 0.4, rotation: rot - dir * 18, opacity: 0 }, { y: 0, rotation: rot, duration: inSpan, ease: 'bounce.out' }, sc.s);
    tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.08, ease: 'none' }, sc.s);
  } else if (sc.entrance === 'mask') {
    tl.fromTo(el, { scale: 0.94, rotation: rot, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.2, ease: 'power2.out' }, sc.s);
    tl.fromTo(inner, { clipPath: `inset(0% ${dir > 0 ? 100 : 0}% 0% ${dir > 0 ? 0 : 100}% round ${radius}px)` }, { clipPath: `inset(0% 0% 0% 0% round ${radius}px)`, duration: inSpan, ease: 'power3.inOut' }, sc.s);
  } else tl.fromTo(el, { scale: 0.3, rotation: rot - dir * 14, opacity: 0 }, { scale: 1, rotation: rot, opacity: 1, duration: inSpan, ease: 'back.out(1.9)' }, sc.s);
  if (life > inSpan + 0.55) {
    ft(el, { y: 0 }, { y: -U * 0.012, duration: life - inSpan - 0.25, ease: 'sine.inOut' }, sc.s + inSpan);
    if (sc.mode !== 'sticker' && !sc.clip) ft(img, { scale: 1 }, { scale: 1.1, duration: life, ease: 'none' }, sc.s);
  }
  const exitAt = sc.e - 0.22;
  if (sc.exit === 'slide') ft(el, { x: 0, opacity: 1 }, { x: dir * W * 0.4, opacity: 0, duration: 0.22, ease: 'power2.in' }, exitAt);
  else ft(el, { scale: 1, opacity: 1 }, { scale: 0.84, opacity: 0, duration: 0.22, ease: 'power2.in' }, exitAt);
});

// ---- Chú thích trên cảnh demo (circle, arrow, underline): hộp đích tính sẵn cho từng khung (m.track) nên chú thích đi theo khi clip zoom; nét hiện dần bằng stroke-dashoffset (không dùng DrawSVG vì độ dài nét đổi theo khung) ----
const FPS = 30;
const MARK_D = {
  circle: ([x, y, w, h]) => {
    const pad = U * 0.014;
    const rx = w / 2 * 1.12 + pad;
    const ry = h / 2 * 1.2 + pad;
    const cx = x + w / 2;
    const cy = y + h / 2;
    return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}`;
  },
  underline: ([x, y, w, h]) => { const yy = y + h + U * 0.012; return `M${x} ${yy} Q${x + w / 2} ${yy + U * 0.014} ${x + w} ${yy - U * 0.004}`; },
  arrow: ([x, y, w, h]) => {
    const len = U * 0.13;
    const hs = U * 0.032;
    const tipx = x + w / 2;
    const tipy = y + h + U * 0.014;
    const sx = tipx + (tipx > W * 0.6 ? -1 : 1) * len * 0.55;
    const sy = tipy + len;
    const a = Math.atan2(tipy - sy, tipx - sx);
    const arm = (d) => `L${tipx - hs * Math.cos(a + d)} ${tipy - hs * Math.sin(a + d)}`;
    return `M${sx} ${sy} L${tipx} ${tipy} M${tipx} ${tipy} ${arm(0.5)} M${tipx} ${tipy} ${arm(-0.5)}`;
  }
};
const marks = (D.demoMarks ?? []).map((m) => {
  const wrap = mk('deco');
  wrap.style.cssText += `left:0;top:0;width:${W}px;height:${H}px;filter:drop-shadow(0 ${U * 0.004}px ${U * 0.008}px rgba(0,0,0,.3));`;
  const el = svg(W, H, `<path d="" ${lineAttrs(m.color, Math.max(7, U * 0.011))}/>`);
  wrap.appendChild(el);
  stage.appendChild(wrap);
  const mark = { ...m, path: el.firstChild, st: { p: 0 } };
  show(wrap, m.s, m.e);
  ft(mark.st, { p: 0 }, { p: 1, duration: Math.min(0.5, (m.e - m.s) * 0.5), ease: 'power2.out' }, m.s + 0.05);
  ft(wrap, { opacity: 1 }, { opacity: 0, duration: 0.15, ease: 'power1.in' }, m.e - 0.15);
  return mark;
});
const placeMark = (m, t) => {
  const b = m.track[Math.max(0, Math.min(m.track.length - 1, Math.round((t - m.s) * FPS)))];
  if (!b) { m.path.setAttribute('d', ''); return; }
  m.path.setAttribute('d', MARK_D[m.type]([b[0] * W, b[1] * H, b[2] * W, b[3] * H]));
  const len = m.path.getTotalLength();
  m.path.style.strokeDasharray = len;
  m.path.style.strokeDashoffset = len * (1 - m.st.p);
};

// ---- Thẻ số liệu: đếm lên tới giá trị nói trong video ----
const counter = (value) => {
  const m = String(value).match(/^(\D*)(\d[\d.,]*)(\D*)$/);
  if (!m) return null;
  const [, pre, num, post] = m;
  let sep = '';
  let decimals = 0;
  let decChar = '.';
  let target;
  if (/^\d{1,3}([.,]\d{3})+$/.test(num)) { sep = num.match(/[.,]/)[0]; target = Number(num.replace(/[.,]/g, '')); }
  else if (/^\d+[.,]\d+$/.test(num)) { const k = num.search(/[.,]/); decChar = num[k]; decimals = num.length - k - 1; target = Number(num.replace(/[.,]/, '.')); }
  else if (/^\d+$/.test(num)) target = Number(num);
  else return null;
  if (!(target < 1e9)) return null;
  const format = (v) => { let s = decimals ? v.toFixed(decimals).replace('.', decChar) : String(Math.round(v)); if (sep) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, sep); return `${pre}${s}${post}`; };
  return { target, format };
};
const fitLen = (text, base) => base * (String(text).length <= 3 ? 1 : String(text).length <= 5 ? 0.84 : 0.66);
const statEmoji = (parent, file, css, st) => {
  if (!file) return null;
  const live = st.emojiAnim ? lottieMount(parent, file, st.s, st.e, `display:block;filter:drop-shadow(0 0.06em 0.1em rgba(0,0,0,.4));${css}`) : null;
  if (live) return live;
  const im = document.createElement('img');
  im.src = `emoji/${file}.png`;
  im.alt = '';
  im.style.cssText = `position:absolute;display:block;filter:drop-shadow(0 0.06em 0.1em rgba(0,0,0,.4));${css}`;
  imgs.push(im);
  parent.appendChild(im);
  return im;
};
// Ba kiểu thẻ số: ring (huy chương tròn có vòng vẽ dần), sticker (nhãn dán nghiêng viền trắng), capsule (viên thuốc có biểu tượng và vệt sáng quét)
D.stats.forEach((s) => {
  const k = s.scale ?? 1;
  const w0 = s.w * W;
  const h0 = s.h * H;
  const card = mk('stat');
  card.dataset.kind = 'stat';
  card.dataset.id = s.id;
  card.style.cssText += `left:${s.x * W}px;top:${s.y * H}px;width:${w0}px;height:${h0}px;font-family:"Montserrat",${FALLBACK};`;
  stage.appendChild(card);
  const valueEl = document.createElement('div');
  valueEl.textContent = s.value;
  const count = counter(s.value);
  let emoji = null;
  let emojiTo = { scale: 1, rotation: 0 };
  let enter;
  if (s.variant === 'ring') {
    const S = w0;
    const bg = mk('chip', card);
    bg.style.cssText += `left:0;top:0;width:100%;height:100%;border-radius:50%;background:${HEX(C.panel, 0.95)};box-shadow:0 ${S * 0.06}px ${S * 0.14}px rgba(0,0,0,.45);`;
    const r = S * 0.455;
    const ring = svg(S, S, `<circle cx="${S / 2}" cy="${S / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="${S * 0.045}"/><circle class="draw" cx="${S / 2}" cy="${S / 2}" r="${r}" transform="rotate(-90 ${S / 2} ${S / 2})" ${lineAttrs(C.accent, S * 0.045)}/>`);
    ring.style.cssText = 'position:absolute;left:0;top:0;';
    card.appendChild(ring);
    const col = mk('chip', card);
    col.style.cssText += 'left:0;top:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;';
    valueEl.style.cssText = `font-size:${fitLen(s.value, S * 0.3)}px;font-weight:900;color:${C.accent};line-height:1;font-variant-numeric:tabular-nums;`;
    col.appendChild(valueEl);
    for (let n = 0; n < 6 && valueEl.scrollWidth > S * 0.74; n++) valueEl.style.fontSize = `${parseFloat(valueEl.style.fontSize) * 0.88}px`;
    if (s.label) {
      const lab = mk('', col);
      lab.textContent = s.label;
      lab.style.cssText = `font-size:${S * 0.085}px;font-weight:800;color:${C.ink};text-transform:uppercase;letter-spacing:.1em;margin-top:${S * 0.03}px;`;
    }
    emoji = statEmoji(card, s.emoji, `left:${S * 0.66}px;top:${-S * 0.08}px;width:${S * 0.36}px;height:${S * 0.36}px;`, s);
    emojiTo = { scale: 1, rotation: 12 };
    enter = [{ scale: 0.4, rotation: -14, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.8)' }];
    card.querySelectorAll('.draw').forEach((p) => tl.fromTo(p, { drawSVG: '0%' }, { drawSVG: '100%', duration: Math.min(0.9, (s.e - s.s) * 0.5), ease: 'power2.out' }, s.s + 0.1));
  } else if (s.variant === 'capsule') {
    const pill = mk('chip', card);
    pill.style.cssText += `left:0;top:0;width:100%;height:100%;border-radius:999px;background:${HEX(C.panel, 0.95)};box-shadow:0 ${h0 * 0.18}px ${h0 * 0.5}px rgba(0,0,0,.45);overflow:hidden;`;
    const dot = mk('chip', pill);
    dot.style.cssText += `left:${h0 * 0.1}px;top:${h0 * 0.1}px;width:${h0 * 0.8}px;height:${h0 * 0.8}px;border-radius:50%;background:${C.accent};`;
    statEmoji(dot, s.emoji, 'left:15%;top:15%;width:70%;height:70%;', s);
    const row = mk('chip', pill);
    row.style.cssText += `left:${h0 * 1.05}px;top:0;right:${h0 * 0.35}px;height:100%;display:flex;align-items:center;gap:${h0 * 0.14}px;`;
    valueEl.style.cssText = `font-size:${h0 * 0.58}px;font-weight:900;color:${C.ink};line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;`;
    row.appendChild(valueEl);
    if (s.label) {
      const lab = mk('', row);
      lab.textContent = s.label;
      lab.style.cssText = `font-size:${h0 * 0.26}px;font-weight:800;color:${C.accent};text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;`;
    }
    const shine = mk('chip', pill);
    shine.style.cssText += 'top:0;bottom:0;left:0;width:22%;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.38),rgba(255,255,255,0));transform:skewX(-20deg);';
    ft(shine, { x: -w0 * 0.3 }, { x: w0 * 1.1, duration: 0.8, ease: 'power2.inOut' }, s.s + 0.35);
    enter = [{ x: -W * 0.08, opacity: 0, scale: 0.9 }, { x: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'power3.out' }];
  } else {
    const plate = mk('chip', card);
    plate.style.cssText += `left:0;top:${h0 * 0.08}px;width:100%;height:${h0 * 0.66}px;border-radius:${h0 * 0.2}px;background:${C.accent};box-shadow:0 0 0 ${U * 0.012 * k}px #fff,0 ${U * 0.03}px ${U * 0.06}px rgba(0,0,0,.4);transform:rotate(-4deg);display:flex;align-items:center;justify-content:center;`;
    valueEl.style.cssText = `font-size:${fitLen(s.value, h0 * 0.48)}px;font-weight:900;color:${C.panel};line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap;`;
    plate.appendChild(valueEl);
    for (let n = 0; n < 6 && valueEl.scrollWidth > w0 * 0.72; n++) valueEl.style.fontSize = `${parseFloat(valueEl.style.fontSize) * 0.88}px`;
    if (s.label) {
      const chip = mk('chip', card);
      chip.textContent = s.label;
      chip.style.cssText += `right:${w0 * 0.05}px;bottom:${-h0 * 0.02}px;padding:${h0 * 0.05}px ${h0 * 0.14}px;border-radius:99px;background:${C.accent2};color:${C.ink};font-size:${h0 * 0.2}px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;box-shadow:0 0 0 ${U * 0.007 * k}px #fff,0 ${U * 0.012}px ${U * 0.03}px rgba(0,0,0,.35);transform:rotate(3deg);`;
    }
    emoji = statEmoji(card, s.emoji, `right:${-w0 * 0.1}px;top:${-h0 * 0.22}px;width:${h0 * 0.52}px;height:${h0 * 0.52}px;`, s);
    emojiTo = { scale: 1, rotation: 14 };
    enter = [{ y: -U * 0.16, rotation: -10, opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: 0.6, ease: 'bounce.out' }];
  }
  show(card, s.s, s.e);
  if (style.accents?.statSparkle) sparkles({ x: s.x * W, y: s.y * H, w: w0, h: h0 }, s.s + 0.3, 5, 0.02);
  tl.fromTo(card, enter[0], enter[1], s.s);
  if (emoji) tl.fromTo(emoji, { scale: 0, rotation: 0 }, { ...emojiTo, duration: 0.55, ease: 'elastic.out(1.1,0.45)' }, s.s + 0.25);
  if (count) {
    const state = { v: 0 };
    valueEl.textContent = count.format(0);
    ft(state, { v: 0 }, { v: count.target, duration: Math.min(0.8, (s.e - s.s) * 0.45), ease: 'power2.out', onUpdate: () => { valueEl.textContent = count.format(state.v); } }, s.s + 0.1);
  }
  ft(card, { scale: 1, opacity: 1 }, { scale: 0.85, opacity: 0, duration: 0.2, ease: 'power2.in' }, s.e - 0.2);
});

// ---- Lower third ----
useFont('Be Vietnam Pro', 800);
D.lowerThirds.forEach((l, n) => {
  const bar = mk('lt');
  bar.dataset.kind = 'lowerthird';
  bar.dataset.id = `lt${n + 1}`;
  bar.style.cssText += `top:${l.y * H}px;padding:${U * 0.016}px ${U * 0.04}px ${U * 0.016}px 6%;background:${HEX(C.panel, 0.92)};border-radius:0 ${U * 0.035}px ${U * 0.035}px 0;box-shadow:0 ${U * 0.012}px ${U * 0.035}px rgba(0,0,0,.4);font-family:"Be Vietnam Pro",${FALLBACK};`;
  const accent = mk('chip', bar);
  accent.style.cssText += `left:0;top:0;bottom:0;width:${U * 0.012}px;background:${C.accent};`;
  const title = mk('', bar);
  title.style.cssText = `font-size:${U * 0.046}px;font-weight:800;color:${C.ink};`;
  title.textContent = l.title;
  if (l.sub) {
    const sub = mk('', bar);
    sub.style.cssText = `font-size:${U * 0.03}px;font-weight:600;color:${C.accent};`;
    sub.textContent = l.sub;
  }
  stage.appendChild(bar);
  show(bar, l.s, l.e);
  tl.fromTo(bar, { xPercent: -105 }, { xPercent: 0, duration: 0.4, ease: 'power3.out' }, l.s);
  ft(bar, { xPercent: 0 }, { xPercent: -105, duration: 0.3, ease: 'power3.in' }, l.e - 0.3);
});

// ---- Thẻ headline ở vùng trên (kiểu reels): title (chữ lớn hai tầng), compare (thẻ so sánh hai cột), logos (chip thương hiệu) ----
const cardImg = (parent, src, css) => {
  const im = document.createElement('img');
  im.src = src;
  im.alt = '';
  im.style.cssText = `position:absolute;display:block;${css}`;
  imgs.push(im);
  parent.appendChild(im);
  return im;
};
const shrinkToFit = (el, maxW, min = 0.5) => {
  const base = parseFloat(el.style.fontSize);
  for (let n = 0; n < 10 && el.scrollWidth > maxW && parseFloat(el.style.fontSize) > base * min; n++) el.style.fontSize = `${parseFloat(el.style.fontSize) * 0.92}px`;
};
// Icon 24x24 nét liền (tim, bình luận, chia sẻ, lưu) cho thẻ CTA; giao diện chung, không dùng logo hay biểu tượng riêng của nền tảng nào
const icon24 = (d, size, stroke, fill) => {
  const el = document.createElementNS(NS, 'svg');
  el.setAttribute('width', size);
  el.setAttribute('height', size);
  el.setAttribute('viewBox', '0 0 24 24');
  el.innerHTML = `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  return el;
};
const ICON_PATHS = { like: 'M12 21s-7.5-4.8-9.6-9.4A5.3 5.3 0 0 1 12 6.1a5.3 5.3 0 0 1 9.6 5.5C19.5 16.2 12 21 12 21z', comment: 'M4 5h16v11H9.5L4 20.5z', share: 'M3 11.5L21 3l-8 18-2.2-7.8z', save: 'M6 3h12v18l-6-4.5L6 21z' };
const fmtCount = (v) => Math.round(v).toLocaleString('vi-VN');
(D.cards ?? []).forEach((c) => {
  const w0 = c.w * W;
  const h0 = c.h * H;
  const el = mk('stat');
  el.dataset.kind = 'card';
  el.dataset.id = c.id;
  el.style.cssText += `left:${c.x * W}px;top:${c.y * H}px;width:${w0}px;height:${h0}px;font-family:"Montserrat",${FALLBACK};`;
  stage.appendChild(el);
  show(el, c.s, c.e);
  const out = [];
  if (c.type === 'bigtext') {
    // Chữ cực lớn đặt SAU người nói: dựng ở lớp behind, finalize ghép người (mặt nạ) lên trên chữ. behind=false thì chữ nằm phía trước
    el.dataset.layer = c.behind === false ? 'front' : 'behind';
    el.style.cssText += `left:${c.x * W}px;top:${c.y * H}px;width:${w0}px;height:${h0}px;filter:drop-shadow(0 ${U * 0.012}px ${U * 0.03}px rgba(0,0,0,.45));`;
    const longest = Math.max(...c.lines.map((l) => l.length));
    const size = Math.min(U * 0.46, w0 / (longest * 0.64));
    const lineEls = c.lines.map((line, i) => {
      const t = mk('chip', el);
      t.textContent = line;
      t.style.cssText += `left:0;width:${w0}px;text-align:center;top:${i * size * 1.02}px;font-size:${size}px;font-weight:900;line-height:1;letter-spacing:-0.02em;text-transform:uppercase;background:linear-gradient(180deg,${C.ink} 0%,${C.accent} 55%,${C.accent2} 100%);-webkit-background-clip:text;background-clip:text;color:transparent;`;
      return t;
    });
    lineEls.forEach((t, i) => {
      shrinkToFit(t, w0 * 0.98, 0.4);
      tl.fromTo(t, { scale: 1.3, opacity: 0, y: size * 0.18 }, { scale: 1, opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, c.s + i * 0.12);
      ft(t, { scale: 1 }, { scale: 1.05, duration: Math.max(0.5, c.e - c.s - 0.8), ease: 'sine.inOut' }, c.s + 0.6 + i * 0.12);
    });
    out.push(...lineEls);
  } else if (c.type === 'title') {
    // Biến thể: plate (nền thẻ bo góc), kicker (nhãn nhỏ phía trên), highlight (cụm chữ được tô nền như bút dạ quang); thiếu các trường này thì giữ kiểu hai tầng như cũ
    const pad = c.plate ? h0 * 0.11 : 0;
    const inW = w0 - 2 * pad;
    const size = ((h0 - 2 * pad) * 0.5) / (c.kicker ? 1.3 : 1);
    let plate = null;
    if (c.plate) {
      plate = mk('chip', el);
      plate.style.cssText += `left:0;top:0;width:${w0}px;height:${h0}px;border-radius:${h0 * 0.16}px;background:${HEX(C.panel, 0.9)};box-shadow:0 ${h0 * 0.06}px ${h0 * 0.2}px rgba(0,0,0,.38);`;
      tl.fromTo(plate, { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.6)' }, c.s);
      out.push(plate);
    }
    let top = pad;
    if (c.kicker) {
      const kc = mk('chip', el);
      kc.textContent = c.kicker;
      kc.style.cssText += `left:${pad}px;top:${top}px;font-family:"Be Vietnam Pro",${FALLBACK};font-size:${size * 0.4}px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;line-height:1.2;color:${C.accent};text-shadow:${c.plate ? 'none' : SH_STRONG};`;
      shrinkToFit(kc, inW);
      top += size * 0.62;
      tl.fromTo(kc, { y: size * 0.2, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }, c.s + 0.05);
      out.push(kc);
    }
    const t1 = mk('chip', el);
    t1.style.cssText += `left:${pad}px;top:${top}px;font-size:${size}px;font-weight:900;line-height:1.05;color:${C.ink};text-shadow:${c.plate ? 'none' : SH_STRONG};`;
    const phrases = (c.highlight ?? []).filter(Boolean).sort((a, b) => b.length - a.length);
    const marks = [];
    if (phrases.length) {
      const re = new RegExp(`(${phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
      c.text.split(re).forEach((part, k) => {
        if (!part) return;
        if (k % 2) {
          const span = document.createElement('span');
          span.textContent = part;
          span.style.cssText = `display:inline-block;padding:0 0.16em;border-radius:0.2em;background:${HEX(C.accent, 0.95)};color:${C.panel};text-shadow:none;`;
          marks.push(span);
          t1.appendChild(span);
        } else t1.appendChild(document.createTextNode(part));
      });
    } else t1.textContent = c.text;
    shrinkToFit(t1, inW);
    const s1 = parseFloat(t1.style.fontSize);
    const t2 = mk('chip', el);
    t2.textContent = c.sub;
    t2.style.cssText += `left:${pad}px;top:${top + s1 * 1.12}px;font-family:"Be Vietnam Pro",${FALLBACK};font-size:${s1 * 0.5}px;font-weight:700;line-height:1.2;color:${C.ink};text-shadow:${c.plate ? 'none' : SH_STRONG};`;
    shrinkToFit(t2, inW);
    // Nền thẻ ôm vừa nội dung (kicker, tiêu đề, dòng phụ nếu có), không chiếm cả khung đã dành cho dòng phụ
    if (plate) plate.style.height = `${top + s1 * 1.12 + (c.sub ? s1 * 0.62 : 0) + pad - (c.sub ? 0 : s1 * 0.05)}px`;
    tl.fromTo(t1, { clipPath: 'inset(-30% 100% -30% -10%)', y: s1 * 0.25, opacity: 0 }, { clipPath: 'inset(-30% -10% -30% -10%)', y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, c.s);
    marks.forEach((m, k) => tl.fromTo(m, { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' }, c.s + 0.45 + k * 0.15));
    if (c.sub) tl.fromTo(t2, { y: s1 * 0.3, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'power3.out' }, c.s + 0.2);
    if (!c.plate) sparkles({ x: c.x * W, y: c.y * H, w: Math.min(w0, t1.scrollWidth), h: s1 * 1.3 }, c.s + 0.4, 5, 0.02);
    out.push(t1, t2);
  } else if (c.type === 'headline') {
    // Ba dòng chữ gradient căn trái, vào lần lượt từ dưới lên
    const font = Math.min(U * 0.1, (w0 * 0.95) / (Math.max(...c.lines.map((l) => l.length)) * 0.6));
    c.lines.forEach((line, i) => {
      const t = mk('chip', el);
      t.textContent = line;
      t.style.cssText += `left:0;top:${i * font * 1.12}px;font-size:${font}px;font-weight:900;line-height:1.05;letter-spacing:-0.01em;background:linear-gradient(90deg,${C.ink} 0%,${C.accent} 60%,${C.accent2} 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 ${font * 0.05}px ${font * 0.12}px rgba(0,0,0,.5));`;
      shrinkToFit(t, w0, 0.4);
      tl.fromTo(t, { y: font * 0.5, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, c.s + i * 0.14);
      out.push(t);
    });
  } else if (c.type === 'chips') {
    const f = w0 / 22;
    let cursor = 0;
    if (c.title) {
      const tt = mk('chip', el);
      tt.textContent = c.title;
      tt.style.cssText += `left:0;top:0;font-family:"Be Vietnam Pro",${FALLBACK};font-size:${f * 0.95}px;font-weight:800;color:${C.ink};text-shadow:${SH_STRONG};`;
      shrinkToFit(tt, w0);
      tl.fromTo(tt, { y: f * 0.3, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' }, c.s);
      out.push(tt);
      cursor = 1.8 * f;
    }
    let x = 0;
    let y = cursor;
    c.items.forEach((it) => {
      const cw = (0.6 * it.label.length + 1.6 + (it.src ? 1.5 : 0)) * f;
      if (x && x + cw > w0) { x = 0; y += 2.7 * f; }
      const chip = mk('chip', el);
      chip.style.cssText += `left:${x}px;top:${y}px;height:${2.2 * f}px;padding:0 ${0.8 * f}px;border-radius:${1.1 * f}px;background:${HEX(C.panel, 0.92)};box-shadow:0 ${0.2 * f}px ${0.5 * f}px rgba(0,0,0,.35);display:flex;align-items:center;gap:${0.5 * f}px;font-family:"Be Vietnam Pro",${FALLBACK};font-size:${f}px;font-weight:700;color:${C.ink};white-space:nowrap;`;
      if (it.src) cardImg(chip, it.src, `position:static;width:${f * 1.1}px;height:${f * 1.1}px;object-fit:contain;`);
      const lab = document.createElement('span');
      lab.textContent = it.label;
      chip.appendChild(lab);
      tl.fromTo(chip, { scale: 0.4, y: f * 0.4, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)' }, Math.max(c.s, it.s));
      out.push(chip);
      x += cw + 0.5 * f;
    });
  } else if (c.type === 'textspam') {
    // Chữ nhân bản: mỗi bản sao là một phần tử riêng (audit kiểm từng bản có che mặt không); coverFace thì các bản sau thuộc lớp "backdrop", được miễn kiểm mặt
    el.removeAttribute('data-kind');
    c.copies.forEach((cp, k) => {
      const t = mk('chip', stage);
      t.style.visibility = 'hidden';
      t.dataset.kind = cp.late ? 'backdrop' : 'card';
      t.dataset.id = c.id;
      t.textContent = c.text;
      t.style.cssText += `left:${cp.x * W}px;top:${cp.y * H}px;font-family:"Montserrat",${FALLBACK};font-size:${cp.size}px;font-weight:900;line-height:1.2;letter-spacing:-0.01em;color:${k % 2 ? C.accent : C.ink};text-shadow:${SH_STRONG};transform:rotate(${cp.rot}deg);`;
      show(t, cp.s, c.e);
      tl.fromTo(t, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2.2)' }, cp.s);
      ft(t, { opacity: 1 }, { opacity: 0, duration: 0.2, ease: 'power1.in' }, c.e - 0.2);
    });
  } else if (c.type === 'compare') {
    const gap = w0 * 0.1;
    const cw = (w0 - gap) / 2;
    const sides = [['left', 0, -1], ['right', cw + gap, 1]];
    sides.forEach(([key, left, dir]) => {
      const d = c[key];
      const card = mk('chip', el);
      card.style.cssText += `left:${left}px;top:0;width:${cw}px;height:${h0}px;border-radius:${h0 * 0.14}px;background:${HEX(C.panel, 0.88)};box-shadow:0 ${h0 * 0.08}px ${h0 * 0.22}px rgba(0,0,0,.4);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${h0 * 0.035}px;padding:${h0 * 0.06}px ${cw * 0.06}px;white-space:normal;text-align:center;`;
      let icon = null;
      if (d.src) {
        icon = document.createElement('img');
        icon.src = d.src;
        icon.alt = '';
        icon.style.cssText = `display:block;width:${h0 * 0.36}px;height:${h0 * 0.36}px;object-fit:contain;`;
        imgs.push(icon);
        card.appendChild(icon);
      }
      const title = mk('', card);
      title.textContent = d.title;
      title.style.cssText = `font-size:${h0 * 0.13}px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${C.accent};line-height:1.1;`;
      const sub = mk('', card);
      sub.textContent = d.sub;
      sub.style.cssText = `font-family:"Be Vietnam Pro",${FALLBACK};font-size:${h0 * 0.08}px;font-weight:600;color:${C.ink};line-height:1.25;`;
      tl.fromTo(card, { x: dir * w0 * 0.14, opacity: 0, scale: 0.92 }, { x: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out' }, c.s + (dir > 0 ? 0.12 : 0));
      if (icon) tl.fromTo(icon, { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2)' }, c.s + 0.3);
      out.push(card);
    });
    const x = mk('chip', el);
    x.textContent = '×';
    x.style.cssText += `left:${cw + gap / 2 - h0 * 0.11}px;top:${h0 / 2 - h0 * 0.11}px;width:${h0 * 0.22}px;height:${h0 * 0.22}px;border-radius:50%;background:${C.accent};color:${C.panel};font-size:${h0 * 0.17}px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 ${h0 * 0.03}px ${h0 * 0.08}px rgba(0,0,0,.4);`;
    tl.fromTo(x, { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'elastic.out(1.1,0.5)' }, c.s + 0.3);
    out.push(x);
  } else if (c.type === 'logos') {
    const tile = U * 0.17;
    const gap = U * 0.12;
    c.items.forEach((it, i) => {
      const left = i * (tile + gap);
      const t = mk('chip', el);
      t.style.cssText += `left:${left}px;top:0;width:${tile}px;height:${tile}px;border-radius:${tile * 0.26}px;background:${it.mono ? it.color : '#ffffff'};box-shadow:0 ${tile * 0.1}px ${tile * 0.25}px rgba(0,0,0,.4);`;
      cardImg(t, it.src, 'left:19%;top:19%;width:62%;height:62%;object-fit:contain;');
      const lab = mk('chip', el);
      lab.textContent = it.label;
      lab.style.cssText += `left:${left - gap * 0.3}px;top:${tile * 1.1}px;width:${tile + gap * 0.6}px;text-align:center;font-family:"Be Vietnam Pro",${FALLBACK};font-size:${tile * 0.15}px;font-weight:700;color:${C.ink};text-shadow:${SH_STRONG};`;
      tl.fromTo(t, { scale: 0, rotation: -18, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.5, ease: 'back.out(2)' }, c.s + i * 0.12);
      tl.fromTo(lab, { y: tile * 0.15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power2.out' }, c.s + 0.25 + i * 0.12);
      out.push(t, lab);
      if (i < c.items.length - 1) {
        const line = svg(gap, tile, `<path class="draw" d="M${gap * 0.1} ${tile / 2} L ${gap * 0.9} ${tile / 2}" fill="none" stroke="${C.ink}" stroke-width="${Math.max(3, tile * 0.03)}" stroke-dasharray="${tile * 0.06} ${tile * 0.06}" stroke-linecap="round"/>`);
        line.style.cssText = `position:absolute;left:${left + tile}px;top:0;`;
        el.appendChild(line);
        tl.fromTo(line, { opacity: 0 }, { opacity: 0.9, duration: 0.3, ease: 'none' }, c.s + 0.35);
        out.push(line);
      }
    });
  } else if (c.type === 'comment') {
    // Ô bình luận: gõ từ khóa, đăng, tim đầy, phản hồi tùy chọn. Mọi phần tử thuộc một khối inner để làm mờ ra một lần
    const inner = mk('chip', el);
    inner.style.cssText += `left:0;top:0;width:${w0}px;height:${h0}px;font-family:"Be Vietnam Pro",${FALLBACK};`;
    const plate = mk('chip', inner);
    plate.style.cssText += `left:0;top:0;width:${w0}px;height:${h0}px;border-radius:${h0 * (c.reply ? 0.12 : 0.26)}px;background:${HEX(C.panel, 0.95)};box-shadow:0 ${h0 * 0.05}px ${h0 * 0.18}px rgba(0,0,0,.4);`;
    const rowH = c.reply ? h0 * 0.5 : h0;
    const fs0 = rowH * 0.3;
    const textLeft = rowH * 0.95;
    const avatar = (size, left, top) => {
      const a = mk('chip', inner);
      a.style.cssText += `left:${left}px;top:${top}px;width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,${C.accent},${C.accent2});`;
      return a;
    };
    avatar(rowH * 0.5, rowH * 0.22, rowH * 0.25);
    const typed = [...c.text];
    const per = Math.min(0.14, Math.max(0.06, (c.e - c.s - (c.reply ? 2.6 : 1.7)) / typed.length));
    const tType = c.s + 0.4;
    const tPost = tType + typed.length * per + 0.35;
    const field = mk('chip', inner);
    field.style.cssText += `left:${textLeft}px;top:${rowH * 0.2}px;width:${w0 - textLeft - rowH * 0.95}px;height:${rowH * 0.6}px;border-radius:999px;background:rgba(255,255,255,.1);`;
    const holder = mk('chip', field);
    holder.textContent = c.placeholder ?? 'Viết bình luận…';
    holder.style.cssText += `left:${rowH * 0.25}px;top:0;line-height:${rowH * 0.6}px;font-size:${fs0 * 0.8}px;color:${C.ink};opacity:.45;`;
    const typedEl = mk('chip', field);
    typedEl.style.cssText += `left:${rowH * 0.25}px;top:0;line-height:${rowH * 0.6}px;font-size:${fs0}px;font-weight:700;color:${C.ink};white-space:pre;`;
    const charEls = typed.map((ch) => {
      const sp = document.createElement('span');
      sp.textContent = ch;
      sp.style.opacity = '0';
      typedEl.appendChild(sp);
      return sp;
    });
    const send = mk('chip', inner);
    send.style.cssText += `left:${w0 - rowH * 0.8}px;top:${rowH * 0.2}px;width:${rowH * 0.6}px;height:${rowH * 0.6}px;border-radius:50%;background:${C.accent};opacity:0;`;
    send.appendChild(svg(rowH * 0.6, rowH * 0.6, `<path d="M${rowH * 0.18} ${rowH * 0.31} L ${rowH * 0.3} ${rowH * 0.19} L ${rowH * 0.42} ${rowH * 0.31} M${rowH * 0.3} ${rowH * 0.19} L ${rowH * 0.3} ${rowH * 0.43}" ${lineAttrs(C.panel, rowH * 0.05)}/>`));
    tl.set(holder, { opacity: 0 }, tType);
    charEls.forEach((sp, i) => tl.set(sp, { opacity: 1 }, tType + i * per));
    ft(send, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' }, tType + typed.length * per);
    const posted = mk('chip', inner);
    posted.style.cssText += `left:${textLeft}px;top:${rowH * 0.2}px;opacity:0;`;
    const nm = mk('chip', posted);
    nm.textContent = c.name ?? 'bạn';
    nm.style.cssText += `left:0;top:0;font-size:${fs0 * 0.62}px;font-weight:600;color:${C.accent};`;
    const body = mk('chip', posted);
    body.textContent = c.text;
    body.style.cssText += `left:0;top:${fs0 * 0.8}px;font-size:${fs0}px;font-weight:700;color:${C.ink};`;
    const hs = rowH * 0.34;
    const heart = icon24(ICON_PATHS.like, hs, C.ink, 'none');
    heart.style.cssText = `position:absolute;left:${w0 - rowH * 0.7}px;top:${(rowH - hs) / 2}px;display:block;opacity:0;`;
    const heartOn = icon24(ICON_PATHS.like, hs, C.accent, C.accent);
    heartOn.style.cssText = `position:absolute;left:${w0 - rowH * 0.7}px;top:${(rowH - hs) / 2}px;display:block;opacity:0;transform-origin:50% 50%;`;
    inner.appendChild(heart);
    inner.appendChild(heartOn);
    tl.set([field, send], { opacity: 0 }, tPost);
    ft(posted, { opacity: 0, y: rowH * 0.12 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }, tPost);
    tl.set(heart, { opacity: 1 }, tPost);
    ft(heartOn, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1.25, duration: 0.25, ease: 'back.out(2.5)' }, tPost + 0.45);
    tl.to(heartOn, { scale: 1, duration: 0.2, ease: 'power2.out' }, tPost + 0.7);
    if (c.reply) {
      const rs = rowH * 0.36;
      const ra = avatar(rs, textLeft, rowH + rowH * 0.3);
      const rt = mk('chip', inner);
      rt.textContent = c.reply;
      rt.style.cssText += `left:${textLeft + rs * 1.3}px;top:${rowH + rowH * 0.3}px;line-height:${rs}px;font-size:${fs0 * 0.82}px;font-weight:600;color:${C.ink};`;
      ft([ra, rt], { opacity: 0, x: -rowH * 0.15 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out', stagger: 0.05 }, tPost + 0.9);
    }
    ft(inner, { y: h0 * 0.2, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, c.s);
    out.push(inner);
  } else if (c.type === 'actions') {
    // Thanh thao tác (tim, bình luận, chia sẻ, lưu): biểu tượng được nhấn đầy màu và nảy lên đúng lúc người nói nhắc
    const inner = mk('chip', el);
    inner.style.cssText += `left:0;top:0;width:${w0}px;height:${h0}px;border-radius:${h0 / 2}px;background:${HEX(C.panel, 0.95)};box-shadow:0 ${h0 * 0.08}px ${h0 * 0.25}px rgba(0,0,0,.4);`;
    const keys = Object.keys(ICON_PATHS);
    const size = h0 * 0.52;
    const step = w0 / keys.length;
    keys.forEach((k, i) => {
      const left = step * i + (step - size) / 2;
      const base = icon24(ICON_PATHS[k], size, C.ink, 'none');
      base.style.cssText = `position:absolute;left:${left}px;top:${(h0 - size) / 2}px;display:block;`;
      inner.appendChild(base);
      if (k !== c.active) return;
      const filled = icon24(ICON_PATHS[k], size, C.accent, C.accent);
      filled.style.cssText = `position:absolute;left:${left}px;top:${(h0 - size) / 2}px;display:block;opacity:0;transform-origin:50% 50%;`;
      inner.appendChild(filled);
      ft(filled, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1.3, duration: 0.25, ease: 'back.out(2.5)' }, c.s + 0.7);
      tl.to(filled, { scale: 1, duration: 0.2, ease: 'power2.out' }, c.s + 0.95);
    });
    ft(inner, { y: h0 * 0.3, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, c.s);
    out.push(inner);
  } else if (c.type === 'counter') {
    // Thẻ số liệu đếm lên (bằng chứng xã hội): số do người dùng cung cấp, plan-lint bắt buộc có nguồn trong userSource hoặc lời nói
    const inner = mk('chip', el);
    inner.style.cssText += `left:0;top:0;width:${w0}px;height:${h0}px;border-radius:${h0 * 0.1}px;background:${HEX(C.panel, 0.95)};box-shadow:0 ${h0 * 0.05}px ${h0 * 0.18}px rgba(0,0,0,.4);font-family:"Be Vietnam Pro",${FALLBACK};`;
    const pad = h0 * 0.1;
    const titleH = c.title ? h0 * 0.18 : 0;
    if (c.title) {
      const t = mk('chip', inner);
      t.textContent = c.title;
      t.style.cssText += `left:${pad * 1.4}px;top:${pad * 0.9}px;font-size:${h0 * 0.1}px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.accent};`;
    }
    const rowH = (h0 - titleH - pad * 1.6) / c.rows.length;
    c.rows.forEach((r, i) => {
      const top = titleH + pad * 0.9 + i * rowH;
      const num = mk('chip', inner);
      num.style.cssText += `left:${pad * 1.4}px;top:${top}px;font-size:${rowH * 0.66}px;font-weight:900;line-height:${rowH}px;color:${C.ink};font-variant-numeric:tabular-nums;`;
      num.textContent = fmtCount(r.from);
      const lab = mk('chip', inner);
      lab.textContent = r.label;
      lab.style.cssText += `right:${pad * 1.4}px;top:${top}px;font-size:${rowH * 0.34}px;font-weight:700;line-height:${rowH}px;color:${C.ink};opacity:.75;`;
      const state = { v: r.from };
      ft(state, { v: r.from }, { v: r.to, duration: Math.min(1.2, (c.e - c.s) * 0.5), ease: 'power2.out', onUpdate: () => { num.textContent = fmtCount(state.v); } }, c.s + 0.3 + i * 0.15);
    });
    ft(inner, { y: h0 * 0.2, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, c.s);
    out.push(inner);
  } else if (c.type === 'wall') {
    // Tường ghép (couch wall): lưới thẻ lấp kín khung ở lớp SAU người nói; người (mặt nạ) đứng trước tường. Thẻ có ảnh của người dùng hoặc nhãn chữ trên nền màu phong cách
    el.dataset.layer = 'behind';
    el.dataset.kind = 'backdrop';
    const inner = mk('chip', el);
    inner.style.cssText += `left:0;top:0;width:${w0}px;height:${h0}px;overflow:hidden;background:${C.panel};font-family:"Be Vietnam Pro",${FALLBACK};`;
    const tw = w0 / c.cols;
    const th = tw * 1.45;
    const rows = Math.ceil(h0 / th) + 1;
    const palette = [C.accent, C.accent2, C.ink];
    const grid = mk('chip', inner);
    grid.style.cssText += `left:0;top:0;width:${w0}px;height:${rows * th}px;`;
    let n = 0;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < c.cols + 1; k++) {
        const it = c.items[n % c.items.length];
        const seed = Math.sin((n + 1) * 12.9898) * 43758.5453;
        const jitter = seed - Math.floor(seed) - 0.5;
        const tile = mk('chip', grid);
        tile.style.cssText += `left:${(k - (r % 2 ? 0.5 : 0)) * tw + tw * 0.03}px;top:${r * th + th * 0.03}px;width:${tw * 0.94}px;height:${th * 0.94}px;border-radius:${tw * 0.12}px;overflow:hidden;background:${it.src ? C.panel : HEX(palette[n % 3], 0.92)};transform:rotate(${(jitter * 5).toFixed(2)}deg);display:flex;align-items:center;justify-content:center;white-space:normal;text-align:center;`;
        if (it.src) cardImg(tile, it.src, 'left:0;top:0;width:100%;height:100%;object-fit:cover;');
        else if (it.label) {
          const lab = mk('', tile);
          lab.textContent = it.label;
          lab.style.cssText = `font-size:${tw * 0.17}px;font-weight:800;line-height:1.15;padding:0 ${tw * 0.08}px;color:${C.panel};`;
        }
        tl.fromTo(tile, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.7)' }, c.s + ((r + k) % 9) * 0.045);
        n++;
      }
    }
    ft(grid, { y: 0 }, { y: -th * 0.6, duration: Math.max(0.5, c.e - c.s), ease: 'none' }, c.s);
    tl.to(inner, { opacity: 0, duration: 0.3, ease: 'power2.in' }, c.e - 0.3);
  } else if (c.type === 'orbit') {
    // Quỹ đạo (orbit): thẻ chạy vòng quanh người, nửa sau quỹ đạo nằm SAU người (lớp behind, bị mặt nạ che), nửa trước nằm TRƯỚC (lớp front). Mỗi thẻ có hai bản sao, bản nào hiện là theo độ sâu
    el.dataset.layer = 'behind';
    el.dataset.kind = 'backdrop';
    const elF = mk('stat');
    elF.dataset.kind = 'backdrop';
    elF.dataset.id = c.id;
    elF.dataset.layer = 'front';
    elF.style.cssText += el.style.cssText;
    stage.appendChild(elF);
    show(elF, c.s, c.e);
    const cw = U * 0.2;
    const ch = cw * 1.5;
    const cx = c.cx * W;
    const cy = c.cy * H;
    const rx = c.rx * W;
    const ry = c.ry * H;
    const dur = Math.max(1, c.e - c.s - 0.3);
    const revs = Math.max(1, Math.round(dur / 3));
    const mkOrbitCard = (root, it) => {
      const card = mk('chip', root);
      card.style.cssText += `left:${-cw / 2}px;top:${-ch / 2}px;width:${cw}px;height:${ch}px;border-radius:${cw * 0.14}px;overflow:hidden;background:${it.src ? C.panel : `linear-gradient(160deg,${C.accent},${C.accent2})`};box-shadow:0 ${cw * 0.06}px ${cw * 0.18}px rgba(0,0,0,.45);opacity:0;display:flex;align-items:center;justify-content:center;white-space:normal;text-align:center;`;
      if (it.src) cardImg(card, it.src, 'left:0;top:0;width:100%;height:100%;object-fit:cover;');
      else if (it.label) {
        const lab = mk('', card);
        lab.textContent = it.label;
        lab.style.cssText = `font-size:${cw * 0.17}px;font-weight:800;line-height:1.15;padding:0 ${cw * 0.08}px;color:${C.panel};`;
      }
      return card;
    };
    c.items.forEach((it, i) => {
      const back = mkOrbitCard(el, it);
      const front = mkOrbitCard(elF, it);
      const phase0 = (i / c.items.length) * Math.PI * 2;
      const st = { a: phase0, k: 0 };
      const place = () => {
        const z = Math.sin(st.a);
        const sc = (0.72 + 0.4 * ((z + 1) / 2)) * (0.6 + 0.4 * st.k);
        const pose = { x: cx + Math.cos(st.a) * rx, y: cy + z * ry, scale: sc, rotation: Math.cos(st.a) * 7 };
        gsap.set(back, { ...pose, opacity: z <= 0 ? st.k : 0 });
        gsap.set(front, { ...pose, opacity: z > 0 ? st.k : 0 });
      };
      place();
      ft(st, { a: phase0 }, { a: phase0 + Math.PI * 2 * revs, duration: dur, ease: 'none', onUpdate: place }, c.s);
      ft(st, { k: 0 }, { k: 1, duration: 0.45, ease: 'power2.out', onUpdate: place }, c.s);
      ft(st, { k: 1 }, { k: 0, duration: 0.3, ease: 'power2.in', onUpdate: place }, c.e - 0.3);
    });
  }
  ft(out, { opacity: 1 }, { opacity: 0, y: -h0 * 0.12, duration: 0.25, ease: 'power2.in', stagger: 0.02 }, c.e - 0.3);
});

window.setLayer = (layer) => { stage.dataset.layer = layer; };
stage.dataset.layer = 'front';
window.seek = (t) => {
  tl.time(t, false);
  for (const m of marks) if (t >= m.s - 0.02 && t <= m.e + 0.02) placeMark(m, t);
  for (const p of playing) {
    if (t < p.sc.s - 0.05 || t > p.sc.e + 0.05) continue;
    const n = Math.min(p.sc.clip.frames, Math.max(1, Math.floor((t - p.sc.s) * p.sc.clip.fps + 1e-6) + 1));
    if (n === p.n) continue;
    p.n = n;
    p.img.src = `${p.sc.clip.dir}/c_${String(n).padStart(5, '0')}.jpg`;
    decoding.push(p.img.decode().catch(() => null));
  }
  for (const L of lotties) if (t >= L.s - 0.05 && t <= L.e + 0.05) L.anim.goToAndStop(Math.max(0, ((t - L.s) * L.fr) % (L.op - 1)), true);
};
window.settle = () => { const wait = decoding; decoding = []; return Promise.all(wait); };
window.duration = () => tl.duration();
// Hộp bao (tỉ lệ 0..1, cắt theo khung hình) của mọi phần tử đang hiện: audit dùng để kiểm chồng mặt và lề an toàn
window.boxes = () => [...stage.querySelectorAll('[data-kind]')].flatMap((el) => {
  const cs = getComputedStyle(el);
  if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return [];
  const r = el.getBoundingClientRect();
  const x0 = Math.max(0, r.left - stage0.left);
  const y0 = Math.max(0, r.top - stage0.top);
  const x1 = Math.min(W, r.right - stage0.left);
  const y1 = Math.min(H, r.bottom - stage0.top);
  if (x1 <= x0 || y1 <= y0) return [];
  return [{ kind: el.dataset.kind, id: el.dataset.id, mode: el.dataset.mode, x: x0 / W, y: y0 / H, w: (x1 - x0) / W, h: (y1 - y0) / H, offscreen: Math.round((1 - ((x1 - x0) * (y1 - y0)) / (r.width * r.height)) * 100) / 100 }];
});
Promise.all([...new Set(fontLoads)].map((spec) => document.fonts.load(spec, 'Ắ ỡ ệ ư')).concat(imgs.map((i) => i.decode().catch(() => null)))).then(() => { window.ready = true; });
})();
