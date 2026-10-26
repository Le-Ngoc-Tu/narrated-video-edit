// Video hướng dẫn thêm skill vào Claude: motion graphic thuần (biểu tượng, tuyến đường, vòng tiến độ, bộ đếm), không vẽ giả giao diện của ứng dụng nào.
// Dùng các hàm dùng chung của scenes.js (mk, place, scene, at, master, makeCursor, cursorMove, click, typeText, gateCards, endScene, hookScene).
function gearSvg() {
  const T = (Math.PI * 2) / 8;
  const pt = (r, a) => `${(60 + r * Math.cos(a - Math.PI / 2)).toFixed(1)} ${(60 + r * Math.sin(a - Math.PI / 2)).toFixed(1)}`;
  let d = '';
  for (let k = 0; k < 8; k += 1) {
    const b = k * T;
    d += `${k ? 'L' : 'M'}${pt(34, b)}L${pt(48, b + 0.16 * T)}L${pt(48, b + 0.5 * T)}L${pt(34, b + 0.66 * T)}`;
  }
  return `<path d="${d}Z"/><circle cx="60" cy="60" r="15"/>`;
}
const GP = {
  user: '<circle cx="60" cy="42" r="20"/><path d="M20 104c4-24 22-34 40-34s36 10 40 34"/>',
  gear: gearSvg(),
  bolt: '<path d="M70 10L26 70h31l-9 40 46-62H64z"/>',
  plus: '<path d="M60 20v80M20 60h80"/>',
  upload: '<path d="M60 80V20M36 42l24-24 24 24M20 102h80"/>',
  download: '<path d="M60 18v62M36 58l24 24 24-24M20 102h80"/>',
  shield: '<path d="M60 12l40 15v30c0 27-17 44-40 52C37 101 20 84 20 57V27z"/><path d="M41 60l14 14 26-30"/>',
  folder: '<path d="M12 34a8 8 0 0 1 8-8h28l11 13h41a8 8 0 0 1 8 8v47a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8z"/>',
  zip: '<path d="M30 12h40l22 22v74H30z"/><path d="M70 12v22h22M52 38h10M52 52h10M52 66h10M52 80h10"/>',
  check: '<path d="M24 62l24 24 48-52"/>',
  bubble: '<path d="M18 26h84a8 8 0 0 1 8 8v48a8 8 0 0 1-8 8H58L36 110V90H18a8 8 0 0 1-8-8V34a8 8 0 0 1 8-8z"/><path d="M34 50h52M34 66h30"/>',
  hex: '<path d="M60 10l42 24v52L60 110 18 86V34z"/><path d="M44 74V46l32 28V46"/>',
  film: '<rect x="18" y="22" width="84" height="76" rx="8"/><path d="M18 42h84M18 78h84M38 22v76M82 22v76"/>',
  globe: '<circle cx="60" cy="60" r="44"/><path d="M16 60h88M60 16c-22 24-22 64 0 88M60 16c22 24 22 64 0 88"/>',
  code: '<path d="M44 34L18 60l26 26M76 34l26 26-26 26"/>'
};
const gicon = (n, size = 80, sw = 7) => `<svg viewBox="0 0 120 120" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${GP[n]}</svg>`;

// Hai tấm màu quét ngang qua màn hình đúng lúc đổi cảnh (đổi cảnh nằm dưới tấm phủ).
function wipeAt(t) {
  const b = mk(stage, 'wipe b');
  const a = mk(stage, 'wipe a');
  gsap.set([a, b], { x: -W - 60 });
  master.to(b, { x: 0, duration: 0.26, ease: 'power3.in' }, t - 0.3);
  master.to(a, { x: 0, duration: 0.26, ease: 'power3.in' }, t - 0.26);
  master.to(a, { x: W + 60, duration: 0.28, ease: 'power3.out' }, t + 0.02);
  master.to(b, { x: W + 60, duration: 0.28, ease: 'power3.out' }, t + 0.08);
}

function stepLabel(sc, n, title, sub) {
  const lab = mk(sc.el, 'steplabel', `<div class="badge">${n}</div><div class="t">${title}${sub ? `<small>${sub}</small>` : ''}</div>`);
  master.from(lab, { x: -80, autoAlpha: 0, duration: 0.55, ease: 'power3.out' }, sc.b(0.2));
  return lab;
}

function buildGuide() {
  const G = L.g;

  // nền: hai vệt màu trôi chậm, nằm dưới mọi cảnh
  const b1 = mk(stage, 'blob', '', { background: '#bfdcf5' });
  place(b1, { left: -220, top: -180, width: 720, height: 720 });
  const b2 = mk(stage, 'blob', '', { background: '#ffe9a8' });
  place(b2, { left: 1440, top: 600, width: 640, height: 640 });
  master.to(b1, { x: 200, y: 110, duration: 14, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 0);
  master.to(b2, { x: -220, y: -90, duration: 16, ease: 'sine.inOut', yoyo: true, repeat: 2 }, 0);

  hookScene(0, 8);

  // 2. tổng quan: ba nút nối bằng đường nét đứt vẽ dần
  {
    const sc = scene(8, 8);
    mk(sc.el, 'center', `<div class="eyebrow">${G.ovEyebrow}</div>`, { top: '78px' });
    mk(sc.el, 'center', `<div class="h2">${G.ovTitle}</div>`, { top: '134px' });
    const xs = [400, 960, 1520];
    const icons = ['download', 'upload', 'bubble'];
    [0, 1].forEach((i) => {
      const seg = mk(sc.el, 'seg', '<i></i>');
      place(seg, { left: xs[i] + 150, top: 535, width: xs[i + 1] - xs[i] - 300 });
      master.to(seg.firstElementChild, { scaleX: 1, duration: 0.7, ease: 'power2.inOut' }, sc.b(1.7 + i * 1.7));
    });
    xs.forEach((x, i) => {
      const node = mk(sc.el, 'node', gicon(icons[i], 110, 6), { width: '220px', height: '220px', borderColor: '#2f7fc1', borderWidth: '8px' });
      place(node, { left: x - 110, top: 420 });
      const badge = mk(sc.el, 'badge', String(i + 1));
      place(badge, { left: x - 130, top: 410, position: 'absolute' });
      const lab = mk(sc.el, 'center', `<div class="step-title">${G.ov[i][0]}</div><div class="step-sub" style="margin-top:8px">${G.ov[i][1]}</div>`, { left: `${x - 260}px`, width: '520px', right: 'auto', top: '680px' });
      const t = sc.b(0.8 + i * 1.7);
      master.from(node, { scale: 0.2, autoAlpha: 0, duration: 0.6, ease: 'back.out(2.2)' }, t);
      master.from(badge, { scale: 0, duration: 0.4, ease: 'back.out(3)' }, t + 0.25);
      master.from(lab, { y: 30, autoAlpha: 0, duration: 0.45, ease: 'power2.out' }, t + 0.3);
    });
    const note = mk(sc.el, 'center', `<div class="chip" style="position:static;font-size:30px;color:#1e2a3b">${G.ovNote}</div>`, { top: '920px' });
    master.from(note, { y: 40, autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, sc.b(5.6));
  }

  // 3. bước 1: tải zip (vòng tiến độ quanh tệp)
  {
    const sc = scene(16, 10);
    stepLabel(sc, 1, G.s1[0], G.s1[1]);
    const ring = mk(sc.el, '', '<svg width="480" height="480" viewBox="0 0 480 480"><circle cx="240" cy="240" r="220" fill="none" stroke="#d3e1ef" stroke-width="18"/><circle class="pr" cx="240" cy="240" r="220" fill="none" stroke="#2f7fc1" stroke-width="18" stroke-linecap="round" stroke-dasharray="1382.3" stroke-dashoffset="1382.3" transform="rotate(-90 240 240)"/></svg>');
    place(ring, { left: 720, top: 310, position: 'absolute' });
    master.from(ring, { scale: 0.5, autoAlpha: 0, duration: 0.6, ease: 'back.out(1.6)' }, sc.b(0.6));
    const card = mk(sc.el, 'big', `<div style="color:#2f7fc1">${gicon('zip', 120, 6)}</div><div style="font-weight:900;font-size:40px;margin-top:-10px">v1.0.0</div>`, { width: '250px', height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' });
    place(card, { left: 835, top: 400 });
    master.from(card, { y: -70, autoAlpha: 0, duration: 0.6, ease: 'back.out(1.7)' }, sc.b(1));
    const arrow = mk(sc.el, '', gicon('download', 120, 7), { color: '#f6b800' });
    place(arrow, { left: 900, top: 150, position: 'absolute' });
    master.from(arrow, { autoAlpha: 0, duration: 0.3 }, sc.b(1.6));
    master.to(arrow, { y: 190, duration: 0.55, ease: 'power2.in', repeat: 5, repeatDelay: 0.05 }, sc.b(1.8));
    master.to(arrow, { autoAlpha: 0, duration: 0.2 }, sc.b(6.4));
    master.to(ring.querySelector('.pr'), { strokeDashoffset: 0, duration: sc.b(6.6) - sc.b(2), ease: 'power1.inOut' }, sc.b(2));
    const done = mk(sc.el, 'check', svgCheck, { width: '96px', height: '96px' });
    place(done, { left: 1020, top: 340, position: 'absolute' });
    master.from(done, { scale: 0, rotation: -40, duration: 0.5, ease: 'back.out(3)' }, sc.b(6.7));
    const name = mk(sc.el, 'center', '<div class="chip" style="position:static;font-size:34px;color:#1e2a3b">narrated-video-edit-v1.0.0.zip</div>', { top: '800px' });
    master.from(name, { y: 40, autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, sc.b(2.2));
    const row = mk(sc.el, 'center', G.s1chips.map((c) => `<div class="chip" style="position:static;font-size:26px">${c}</div>`).join(''), { top: '880px', flexDirection: 'row', justifyContent: 'center', gap: '18px' });
    [...row.children].forEach((c, i) => master.from(c, { scale: 0.4, autoAlpha: 0, duration: 0.4, ease: 'back.out(2)' }, sc.b(3.2 + i * 0.5)));
    const url = mk(sc.el, 'center', '<div class="step-sub" style="font-size:28px">github.com/Le-Ngoc-Tu/narrated-video-edit/releases</div>', { top: '240px' });
    master.from(url, { autoAlpha: 0, duration: 0.5 }, sc.b(0.8));
  }

  // 4. bước 2: tuyến đường Cài đặt, rồi thả zip, quét bảo mật, bật skill
  {
    const sc = scene(26, 24);
    stepLabel(sc, 2, G.s2[0], '');
    const xs = [250, 585, 920, 1255, 1590];
    const cy = 520;
    const names = ['user', 'gear', 'bolt', 'plus', 'upload'];
    const route = mk(sc.el, '', '', { position: 'absolute', inset: '0' });
    const nodes = [];
    xs.forEach((x, i) => {
      const n = mk(route, 'node', gicon(names[i], 76, 6));
      place(n, { left: x - 75, top: cy - 75 });
      const lb = mk(route, 'nlabel', G.nodes[i]);
      place(lb, { left: x - 165, top: cy + 100 });
      gsap.set(lb, { autoAlpha: 0, y: 16 });
      nodes.push({ n, lb });
      master.from(n, { scale: 0.2, autoAlpha: 0, duration: 0.5, ease: 'back.out(2)' }, sc.b(0.3 + i * 0.25));
      if (i < 4) {
        const seg = mk(route, 'seg', '<i></i>');
        place(seg, { left: x + 85, top: cy - 5, width: xs[i + 1] - x - 170 });
        master.to(seg.firstElementChild, { scaleX: 1, duration: 0.55, ease: 'power2.inOut' }, sc.b(2 + i * 3) + 0.45);
      }
    });
    const cur = makeCursor(sc.el, 120, 800);
    master.to(cur, { autoAlpha: 1, duration: 0.2 }, sc.b(0.9));
    xs.forEach((x, i) => {
      const tClick = sc.b(2 + i * 3);
      cursorMove(cur, x + 14, cy + 6, tClick - 0.85, 0.8);
      click(sc.el, cur, x + 14, cy + 6, tClick);
      master.to(nodes[i].n, { backgroundColor: '#2f7fc1', color: '#ffffff', borderColor: '#2f7fc1', scale: 1.12, duration: 0.3, ease: 'back.out(2)' }, tClick);
      master.to(nodes[i].lb, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, tClick + 0.05);
      if (i < 4) master.to(nodes[i].n, { scale: 1, duration: 0.3 }, tClick + 1.2);
    });
    master.to(route, { autoAlpha: 0, y: -40, duration: 0.4, ease: 'power2.in' }, sc.b(15.4));
    master.to(cur, { autoAlpha: 0, duration: 0.2 }, sc.b(15.4));

    // thả zip
    const cap = G.drop.map((txt) => mk(sc.el, 'center', `<div class="h2" style="font-size:64px">${txt}</div>`, { top: '190px' }));
    const capAt = [16, 20, 22.4];
    cap.forEach((c, i) => {
      master.fromTo(c, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, sc.b(capAt[i]));
      if (i < 2) master.to(c, { autoAlpha: 0, y: -20, duration: 0.25 }, sc.b(capAt[i + 1]) - 0.1);
    });
    const dash = mk(sc.el, '', '', { position: 'absolute', border: '7px dashed #2f7fc1', borderRadius: '50%' });
    place(dash, { left: 730, top: 330, width: 460, height: 460 });
    const solid = mk(sc.el, '', '', { position: 'absolute', border: '10px solid #2f7fc1', borderRadius: '50%', background: 'rgba(47,127,193,.08)' });
    place(solid, { left: 730, top: 330, width: 460, height: 460 });
    gsap.set([dash, solid], { autoAlpha: 0 });
    master.to(dash, { autoAlpha: 1, duration: 0.4 }, sc.b(15.8));
    master.to(dash, { rotation: 360, duration: sc.b(18) - sc.b(15.8), ease: 'none' }, sc.b(15.8));
    const file = mk(sc.el, 'big', `<div style="color:#2f7fc1">${gicon('zip', 110, 6)}</div>`, { width: '210px', height: '250px' });
    place(file, { left: 855, top: 435 });
    gsap.set(file, { x: 760, y: -420, rotation: 24, autoAlpha: 0 });
    master.to(file, { autoAlpha: 1, duration: 0.2 }, sc.b(16.4));
    master.to(file, { x: 0, y: 0, rotation: 0, duration: 1.1, ease: 'power3.out' }, sc.b(16.4));
    master.to(dash, { autoAlpha: 0, duration: 0.2 }, sc.b(18.2));
    master.to(solid, { autoAlpha: 1, duration: 0.3 }, sc.b(18.1));
    master.fromTo(solid, { scale: 1.18 }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' }, sc.b(18.1));
    master.to(file, { scale: 1.06, duration: 0.2, yoyo: true, repeat: 1 }, sc.b(18.2));
    // quét bảo mật
    const scan = mk(sc.el, '', '', { position: 'absolute', height: '10px', borderRadius: '5px', background: '#2fa36b', boxShadow: '0 0 28px #2fa36b' });
    place(scan, { left: 830, top: 420, width: 260 });
    gsap.set(scan, { autoAlpha: 0 });
    master.to(scan, { autoAlpha: 1, duration: 0.15 }, sc.b(20.2));
    master.fromTo(scan, { y: 0 }, { y: 280, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: 3 }, sc.b(20.2));
    master.to(scan, { autoAlpha: 0, duration: 0.2 }, sc.b(21.9));
    const shield = mk(sc.el, 'node', gicon('shield', 80, 6), { color: '#ffffff', background: '#2fa36b', borderColor: '#2fa36b' });
    place(shield, { left: 1080, top: 300 });
    gsap.set(shield, { autoAlpha: 0, scale: 0.2 });
    master.to(shield, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2.4)' }, sc.b(21.4));
    const pass = mk(sc.el, '', `<div class="chip" style="position:static;font-size:30px;color:#2fa36b;border-color:#bfe6d2">${G.pass} &#10003;</div>`, {});
    place(pass, { left: 1090, top: 470, position: 'absolute' });
    gsap.set(pass, { autoAlpha: 0, y: 14 });
    master.to(pass, { autoAlpha: 1, y: 0, duration: 0.35 }, sc.b(21.7));
    // công tắc
    const tg = mk(sc.el, 'toggle', '<i></i>');
    place(tg, { left: 840, top: 800 });
    gsap.set(tg, { autoAlpha: 0, y: 30 });
    master.to(tg, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out' }, sc.b(22.3));
    master.to(tg, { backgroundColor: '#2fa36b', duration: 0.3 }, sc.b(23.1));
    master.to(tg.firstElementChild, { x: 120, duration: 0.35, ease: 'back.out(2)' }, sc.b(23.1));
    [0, 1, 2].forEach((k) => {
      const r = mk(sc.el, '', '', { position: 'absolute', border: '5px solid #2fa36b', borderRadius: '50%' });
      place(r, { left: 930, top: 770, width: 60, height: 60 });
      gsap.set(r, { autoAlpha: 0 });
      master.fromTo(r, { scale: 0.4, autoAlpha: 0.9 }, { scale: 5 + k * 1.5, autoAlpha: 0, duration: 0.9, ease: 'power2.out', immediateRender: false }, sc.b(23.1) + k * 0.12);
    });
  }

  // 5. Claude Code: zip, thư mục, tệp bung ra, lệnh
  {
    const sc = scene(50, 10);
    mk(sc.el, 'center', `<div class="h2">${G.ccTitle}</div>`, { top: '56px' });
    mk(sc.el, 'center', `<div class="sub">${G.ccSub}</div>`, { top: '152px' });
    const zip = mk(sc.el, 'big', `<div style="color:#2f7fc1">${gicon('zip', 110, 6)}</div>`, { width: '210px', height: '250px' });
    place(zip, { left: 250, top: 270 });
    const arrow = mk(sc.el, '', '<svg viewBox="0 0 160 60" width="160" height="60" fill="none" stroke="#f6b800" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 30h130M108 8l32 22-32 22"/></svg>');
    place(arrow, { left: 500, top: 365, position: 'absolute' });
    const folder = mk(sc.el, 'big', `<div style="color:#2f7fc1">${gicon('folder', 130, 6)}</div>`, { width: '260px', height: '250px' });
    place(folder, { left: 700, top: 270 });
    const flab = mk(sc.el, 'center', '<div class="chip" style="position:static;font-size:28px;font-family:\'Cascadia Mono\',Consolas,monospace;color:#1e2a3b">~/.claude/skills/</div>', { left: '640px', width: '380px', right: 'auto', top: '540px' });
    master.from(zip, { x: -90, autoAlpha: 0, duration: 0.5, ease: 'back.out(1.6)' }, sc.b(0.5));
    master.from(arrow, { x: -30, autoAlpha: 0, duration: 0.4 }, sc.b(1.3));
    master.from(folder, { x: 90, autoAlpha: 0, duration: 0.5, ease: 'back.out(1.6)' }, sc.b(1.5));
    master.from(flab, { y: 20, autoAlpha: 0, duration: 0.4 }, sc.b(2));
    G.ccFiles.forEach((f, i) => {
      const c = mk(sc.el, 'chip', f, { fontFamily: "'Cascadia Mono', Consolas, monospace", fontSize: '30px', color: '#1e2a3b' });
      place(c, { left: 1140, top: 290 + i * 84 });
      master.from(c, { x: -190, autoAlpha: 0, scale: 0.5, duration: 0.5, ease: 'back.out(1.8)' }, sc.b(2.6 + i * 0.5));
    });
    const cmd1 = mk(sc.el, 'codechip', '<span class="pr">$</span> <span class="t"></span>');
    place(cmd1, { left: 250, top: 660 });
    master.from(cmd1, { y: 30, autoAlpha: 0, duration: 0.4 }, sc.b(3.4));
    typeText(cmd1.querySelector('.t'), 'unzip narrated-video-edit-v1.0.0.zip -d ~/.claude/skills', sc.b(3.8), sc.b(6.6) - sc.b(3.8));
    const cmd2 = mk(sc.el, 'codechip', '<span class="pr">&gt;</span> <span class="ok">/narrated-video-edit</span>');
    place(cmd2, { left: 250, top: 790 });
    master.from(cmd2, { y: 30, autoAlpha: 0, scale: 0.9, duration: 0.5, ease: 'back.out(2)' }, sc.b(7));
    master.to(cmd2, { boxShadow: '0 0 0 8px rgba(95,212,154,.45), 0 20px 50px rgba(20,32,46,.3)', duration: 0.4, yoyo: true, repeat: 3 }, sc.b(7.4));
    const win = mk(sc.el, 'center', `<div class="chip" style="position:static;font-size:26px;font-family:'Cascadia Mono',Consolas,monospace;color:#1e2a3b">${G.ccWin}</div>`, { top: '945px' });
    master.from(win, { y: 30, autoAlpha: 0, duration: 0.4 }, sc.b(8));
  }

  // 6. bước 3: nhờ Claude, rồi ba cổng duyệt
  {
    const sc = scene(60, 10);
    stepLabel(sc, 3, G.askTitle, '');
    const box = mk(sc.el, 'chatbox', '<div class="txt"></div>');
    place(box, { left: 330, top: 190, width: 1260, height: 200 });
    master.from(box, { y: 50, autoAlpha: 0, scale: 0.94, duration: 0.5, ease: 'back.out(1.5)' }, sc.b(0.6));
    const send = mk(box, 'send', sendSvg);
    typeText(box.querySelector('.txt'), L.prompt, sc.b(1.3), sc.b(4.4) - sc.b(1.3));
    master.fromTo(send, { scale: 1 }, { scale: 1.25, duration: 0.18, yoyo: true, repeat: 1 }, sc.b(4.7));
    const cards = gateCards(sc, 480, 5.2, false);
    cards.forEach((g, i) => {
      const ck = mk(g, 'check', svgCheck, { position: 'absolute', right: '18px', top: '18px', width: '54px', height: '54px' });
      master.from(ck, { scale: 0, rotation: -40, duration: 0.45, ease: 'back.out(3)' }, sc.b(6.2 + i * 1.3));
    });
    const sub = mk(sc.el, 'center', `<div class="sub" style="color:#1e2a3b">${L.gatesSub}</div>`, { top: '930px' });
    master.from(sub, { y: 30, autoAlpha: 0, duration: 0.4 }, sc.b(8.6));
  }

  // 7. chuẩn bị máy: yêu cầu, ba lệnh có thanh tiến độ, bộ đếm 68/68
  {
    const sc = scene(70, 10);
    mk(sc.el, 'center', `<div class="h2">${G.setupTitle}</div>`, { top: '60px' });
    const glyphs = ['hex', 'film', 'globe', 'code'];
    const row = mk(sc.el, 'center', G.reqs.map((x, i) => `<div class="chip" style="position:static;font-size:30px;display:flex;gap:12px;align-items:center"><span style="display:inline-flex">${gicon(glyphs[i], 34, 8)}</span>${x}</div>`).join(''), { top: '190px', flexDirection: 'row', justifyContent: 'center', gap: '20px' });
    [...row.children].forEach((c, i) => master.from(c, { scale: 0.4, autoAlpha: 0, duration: 0.4, ease: 'back.out(2)' }, sc.b(0.4 + i * 0.35)));
    const rows = [['npm install', 2, 1.1], ['node setup.mjs', 3.7, 1.5], ['node selftest.mjs', 5.6, 2.9]];
    const bars = [];
    rows.forEach(([cmd, t0, dur], i) => {
      const y = 330 + i * 120;
      const chip = mk(sc.el, 'codechip', `<span class="pr">$</span> ${cmd}`, { width: '760px' });
      place(chip, { left: 260, top: y });
      const bar = mk(sc.el, 'bar', '<i></i>');
      place(bar, { left: 1060, top: y + 34, width: 480 });
      const ck = mk(sc.el, 'check', svgCheck, { width: '56px', height: '56px' });
      place(ck, { left: 1580, top: y + 14, position: 'absolute' });
      master.from([chip, bar], { x: -60, autoAlpha: 0, duration: 0.45, ease: 'power3.out' }, sc.b(t0));
      master.to(bar.firstElementChild, { scaleX: 1, duration: dur * P, ease: 'power1.inOut' }, sc.b(t0) + 0.4);
      master.from(ck, { scale: 0, duration: 0.4, ease: 'back.out(3)' }, sc.b(t0) + 0.4 + dur * P);
      bars.push(bar);
    });
    const counter = mk(sc.el, 'center', `<div style="font-weight:900;font-size:150px;line-height:1;color:#2f7fc1"><span class="n">0</span> / 68</div><div class="step-sub" style="font-size:34px;margin-top:30px">${G.checks}</div>`, { top: '705px' });
    master.from(counter, { y: 40, autoAlpha: 0, duration: 0.5 }, sc.b(5.4));
    const o = { n: 0 };
    const nEl = counter.querySelector('.n');
    master.to(o, { n: 68, duration: 2.9 * P, ease: 'power1.inOut', onUpdate() { nEl.textContent = String(Math.round(o.n)); } }, sc.b(5.6) + 0.4);
    master.to(counter.firstElementChild, { color: '#2fa36b', duration: 0.3 }, sc.b(5.6) + 0.4 + 2.9 * P);
  }

  endScene(80, 8);

  // thanh bước ở đáy màn hình, chỉ hiện từ bước 1 đến bước 3
  const trk = mk(stage, 'trk', G.trk.map((tx, i) => `<div class="p"><i>${i + 1}</i>${tx}</div>`).join(''));
  gsap.set(trk, { autoAlpha: 0 });
  master.to(trk, { autoAlpha: 1, duration: 0.3 }, at(16) + 0.15);
  master.to(trk, { autoAlpha: 0, duration: 0.25 }, at(70) - 0.35);
  const pills = [...trk.children];
  const activate = (i, t) => pills.forEach((p, j) => {
    const on = j === i;
    master.to(p, { backgroundColor: on ? '#2f7fc1' : 'rgba(255,255,255,0.7)', color: on ? '#ffffff' : '#5b6b80', borderColor: on ? '#2f7fc1' : '#d3e1ef', duration: 0.25 }, t);
    master.to(p.firstElementChild, { backgroundColor: on ? '#f6b800' : '#d3e1ef', color: on ? '#1e2a3b' : '#ffffff', duration: 0.25 }, t);
  });
  activate(0, at(16) + 0.1);
  activate(1, at(26) + 0.1);
  activate(2, at(60) + 0.1);

  [8, 16, 26, 50, 60, 70, 80].forEach((b) => wipeAt(at(b)));
  return at(88) + 0.4;
}
