// Tự kiểm cả đường ống bằng dữ liệu tổng hợp (giọng đọc tiếng Anh eSpeak, nền dọc, ảnh tổng hợp). Không cần mạng.
// Chạy: node selftest.mjs [--online] [--model small]    (--online thêm một lượt tìm tài nguyên thật qua mạng)
// Mẫu tiếng Việt với giọng người thật KHÔNG nằm trong selftest: phải thử riêng với video của người dùng.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FPS, args, ffmpeg, launchChrome, probe, pythonPath, readJson, run, segPythonPath, skillRoot, writeJson, here } from './common.mjs';
import { allowed, ccName, licenseKey, score } from './resolve-assets.mjs';
import { loadLibrary } from './fx-lib.mjs';

const { flags } = args();
const model = String(flags.model ?? 'small');
const work = path.join(skillRoot, '.selftest', 'run');
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
const node = (script, a) => run(process.execPath, [path.join(here, script), ...a]);
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; const d = ok ? String(detail).slice(0, 80) : detail; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${d ? ` (${d})` : ''}`); return ok; };
const tail = (r) => (r.stderr || r.stdout).trim().split('\n').filter((l) => !/NODE_TLS|trace-warnings/.test(l)).slice(-4).join(' | ');

// ---- Môi trường và video mẫu ----
const env = node('setup.mjs', []);
check('ccName: giấy phép CC của API thành tên đầy đủ cho dòng ghi công', ccName('by', '2.0') === 'CC BY 2.0' && ccName('by-sa', '4.0') === 'CC BY-SA 4.0' && ccName('cc0', '') === 'CC0 1.0' && ccName('pdm', '1.0') === 'Public Domain Mark 1.0' && ccName('mit', '') === 'mit', `${ccName('by', '2.0')}`);
check('môi trường: Node, ffmpeg, Chrome, Python có faster-whisper và opencv', env.status === 0, env.status === 0 ? '' : tail(env));
if (env.status !== 0) process.exit(1);
const fx = node('make-fixture.mjs', ['--out', path.join(work, 'fixture')]);
const talk = path.join(work, 'fixture', 'talk.mp4');
check('video mẫu tổng hợp', fx.status === 0 && fs.existsSync(talk), tail(fx));

// ---- Khâu A ----
const analysis = path.join(work, 'analysis');
const an = node('analyze.mjs', [talk, '--out', analysis, '--lang', 'en', '--model', model]);
check('phân tích: phiên âm theo từng từ', an.status === 0 && fs.existsSync(path.join(analysis, 'words.json')), tail(an));
const words = readJson(path.join(analysis, 'words.json')).words;
check('phiên âm đủ từ và đúng từ đầu', words.length >= 30 && /hello/i.test(words[0].text), `${words.length} từ, từ đầu "${words[0]?.text}"`);
check('mốc từ tăng dần và nằm trong video', words.every((w, i) => w.end >= w.start && (i === 0 || w.start >= words[i - 1].start - 0.01)) && words.at(-1).end <= probe(talk).duration + 0.1);
const pauses = readJson(path.join(analysis, 'pauses.json')).pauses;
check('tìm thấy các khoảng ngắt', pauses.length >= 3, `${pauses.length} khoảng`);
{
  const stereo = path.join(work, 'fixture', 'talk-stereo.mp4');
  ffmpeg(['-i', talk, '-af', 'pan=stereo|c0=c0|c1=c0', '-c:v', 'copy', '-c:a', 'aac', stereo], 'bản stereo');
  const sa = path.join(work, 'stereo-analysis');
  const r = node('analyze.mjs', [stereo, '--out', sa, '--words', path.join(analysis, 'words.json'), '--no-faces']);
  const direct = run('ffmpeg', ['-hide_banner', '-i', stereo, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const measured = Number(JSON.parse(direct.stderr.match(/\{[\s\S]*?\}/g).pop()).input_i);
  const stored = r.status === 0 ? Number(readJson(path.join(sa, 'loudness.json')).input_i) : NaN;
  check('loudness.json đo trên âm thanh gốc, không phải bản mono 16 kHz (nguồn stereo)', Math.abs(stored - measured) <= 0.3, `${stored} so với ${measured} LUFS`);
}

// Video mẫu tổng hợp không có mặt thật: đặt một khung mặt gọn ở nửa trên để thử bố cục showcase như video người nói dọc thật
writeJson(path.join(analysis, 'faces.json'), { coverage: 1, samples: Array.from({ length: 20 }, (_, t) => ({ t, boxes: [[0.33, 0.14, 0.34, 0.19]] })) });

// Bộ dò mặt: YuNet (mô hình gói sẵn) phải nạp và chạy được; video mẫu tổng hợp không có mặt nên coverage 0
{
  const fj = path.join(work, 'faces-check.json');
  const r = run(pythonPath(), [path.join(here, 'faces.py'), talk, '--out', fj, '--detector', 'yunet', '--every', '1'], { env: { ...process.env, PYTHONUTF8: '1' } });
  const fd = fs.existsSync(fj) ? readJson(fj) : {};
  check('dò mặt: YuNet nạp mô hình gói sẵn và chạy trên video mẫu', r.status === 0 && fd.detector === 'yunet' && fd.samples?.length > 5, r.status === 0 ? `${fd.samples?.length} mẫu` : tail(r));
}

// ---- Khâu B ----
const styles = ['hype', 'explainer', 'documentary'];
const planFile = path.join(work, 'edit-plan.json');
let allGood = true;
for (const id of styles) {
  const sk = node('plan-skeleton.mjs', ['--analysis', analysis, '--style', id, '--out', path.join(work, `plan-${id}.json`)]);
  const lint = node('plan-lint.mjs', ['--plan', path.join(work, `plan-${id}.json`), '--analysis', analysis]);
  if (sk.status !== 0 || lint.status !== 0) { allGood = false; console.log(`  ${id}: ${tail(sk.status !== 0 ? sk : lint)}`); }
}
check('kế hoạch: bộ khung của cả 3 phong cách qua plan-lint', allGood);
// Bản highlight: chọn đoạn quan trọng rồi dựng khung chỉ trên các đoạn đó
const hlFile = path.join(work, 'highlights.json');
const hl = node('pick-highlights.mjs', ['--analysis', analysis, '--out', hlFile, '--target', '8', '--min', '3', '--max', '6', '--bins', '2']);
const hlRanges = fs.existsSync(hlFile) ? readJson(hlFile).ranges : [];
const straddles = hlRanges.flatMap((r) => [r.start, r.end]).some((t) => words.some((w) => t > w.start + 0.02 && t < w.end - 0.02));
check('pick-highlights: chọn đoạn, ranh giới nằm giữa hai từ', hl.status === 0 && hlRanges.length >= 1 && !straddles, hl.status === 0 ? `${hlRanges.length} đoạn` : tail(hl));
const keepPlan = path.join(work, 'plan-keep.json');
const sk2 = node('plan-skeleton.mjs', ['--analysis', analysis, '--style', 'hype', '--keep', hlFile, '--out', keepPlan]);
const kp = fs.existsSync(keepPlan) ? readJson(keepPlan) : { cuts: [], duration: 0 };
const cutTotal = kp.cuts.reduce((t, c) => t + c.end - c.start, 0);
const keptTotal = hlRanges.reduce((t, r) => t + r.end - r.start, 0);
check('plan-skeleton --keep: phần bù của các đoạn được giữ bị cắt', sk2.status === 0 && Math.abs(kp.duration - cutTotal - keptTotal) < 0.05, `cắt ${cutTotal.toFixed(1)}s, giữ ${keptTotal.toFixed(1)}s`);
fs.copyFileSync(path.join(work, 'plan-hype.json'), planFile);
const good = readJson(planFile);
check('gợi ý decor tự động: icon theo từ khóa trong data/decor-keywords.json, truy vấn ảnh bằng tiếng Anh', good.decor.some((d) => d.type === 'icon' && d.query === 'hot beverage') && good.cutaways.every((c) => !/[^\x00-\x7f]/.test(c.query)), `${good.decor.filter((d) => d.auto).map((d) => d.type).join(',')}`);
check('kế hoạch hype có zoom, sticker, thẻ số và cutaway', good.punches.length && good.decor.length && good.stats.length && good.cutaways.length, `${good.punches.length} zoom, ${good.decor.length} sticker, ${good.stats.length} thẻ, ${good.cutaways.length} cutaway`);
{
  const boardDir = path.join(work, 'board');
  const pb = node('plan-board.mjs', ['--plan', planFile, '--analysis', analysis, '--out', boardDir]);
  const mdRows = fs.existsSync(path.join(boardDir, 'plan-board.md')) ? fs.readFileSync(path.join(boardDir, 'plan-board.md'), 'utf8').split('\n').filter((l) => /^\| \d+ \|/.test(l)).length : 0;
  const expected = ['cutaways', 'punches', 'stats', 'decor', 'cards', 'lowerThirds', 'emoji', 'cuts'].reduce((t, k) => t + (good[k]?.length || 0), 0);
  // Nguồn ngang trong kế hoạch dọc 9:16: khung phải giữ tỉ lệ (viền đen trên và dưới), không bị bóp méo
  const wideSrc = path.join(work, 'fixture', 'wide-testsrc.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=s=1280x720:r=30:d=20', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', wideSrc], 'nguồn ngang');
  const widePlanFile = path.join(work, 'edit-plan-wide.json');
  writeJson(widePlanFile, { ...good, source: wideSrc, orientation: '9x16' });
  const wideDir = path.join(work, 'board-wide');
  const pbw = node('plan-board.mjs', ['--plan', widePlanFile, '--analysis', analysis, '--out', wideDir]);
  const lumaAt = (jpg, x, y) => run('ffmpeg', ['-v', 'error', '-i', jpg, '-vf', `crop=2:2:${x}:${y},format=gray`, '-f', 'rawvideo', '-'], { encoding: 'buffer' }).stdout[0];
  const thumb0 = path.join(wideDir, 'plan-board-thumbs', '00.jpg');
  const bar = pbw.status === 0 ? lumaAt(thumb0, 100, 4) : 255;
  const mid = pbw.status === 0 ? lumaAt(thumb0, 100, 190) : 0;
  check('plan-board: nguồn ngang trong khung dọc giữ tỉ lệ (viền đen trên, hình ở giữa)', pbw.status === 0 && bar < 16 && mid > 24, pbw.status === 0 ? `viền ${bar}, giữa ${mid}` : tail(pbw));
  check('plan-board: ảnh storyboard CỔNG 1, mỗi sự kiện của kế hoạch một hàng có khung hình',pb.status === 0 && fs.existsSync(path.join(boardDir, 'plan-board.png')) && mdRows === expected && fs.readdirSync(path.join(boardDir, 'plan-board-thumbs')).length === expected, pb.status === 0 ? `${mdRows}/${expected} hàng` : tail(pb));
}

{
  const menuFile = path.join(work, 'style-menu.html');
  const sm = node('style-menu.mjs', ['--out', menuFile]);
  const total = loadLibrary().effects.length;
  let menuOk = false;
  let menuDetail = sm.status === 0 ? '' : tail(sm);
  if (sm.status === 0) {
    const browser = await launchChrome();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(pathToFileURL(menuFile).href);
      const cards = await page.locator('.card').count();
      await page.locator('[data-add]').first().click();
      await page.locator('[data-add]').nth(5).click();
      await page.click('#copy');
      const prompt = await page.inputValue('#out');
      const need = readJson(path.join(skillRoot, 'data', 'style-menu.json')).constraints;
      const itemLines = prompt.split('\n').filter((l) => /^- [A-Z]{3}-\d\d /.test(l));
      menuOk = cards === total && !errors.length && itemLines.length === 2 && need.every((c) => prompt.includes(c)) && !(await page.content()).includes('[object Object]');
      menuDetail = `${cards}/${total} thẻ, ${itemLines.length} dòng hiệu ứng, ${errors.length} lỗi trang`;
    } finally { await browser.close(); }
  }
  check('style-menu: trang HTML đủ thẻ cho mọi hiệu ứng, chọn hai thẻ rồi Copy ra câu lệnh có mã và các ràng buộc cố định', menuOk, menuDetail);
}

{
  // iris-color: tại tâm khung phải thấy ĐÚNG màu tint trong khoảng giữ (hold), ngoài cửa sổ giữ nguyên ảnh gốc
  const irisOut = path.join(work, 'iris-color.mp4');
  const ir = node('fx-apply.mjs', ['apply', '--in', talk, '--effect', 'iris-color', '--at', '1.0', '--param', 'tint=0x00FF00', '--out', irisOut]);
  let heldFrames = -1;
  if (ir.status === 0) {
    const px = run('ffmpeg', ['-v', 'error', '-ss', '0.9', '-t', '1.0', '-i', irisOut, '-vf', 'crop=2:2:iw/2-1:ih/2-1,format=rgb24', '-f', 'rawvideo', '-'], { encoding: 'buffer' }).stdout;
    heldFrames = 0;
    for (let i = 0; i + 2 < px.length; i += 12) if (px[i + 1] > 200 && px[i] < 60 && px[i + 2] < 60) heldFrames++;
  }
  check('iris-color: tâm khung đặc đúng màu tint trong khoảng giữ (hold 0,3 của 0,7 giây ≈ 6 khung)', heldFrames >= 4 && heldFrames <= 9, ir.status === 0 ? `${heldFrames} khung` : tail(ir));
}

const mutate = (name, edit, expect) => {
  const p = structuredClone(good);
  edit(p);
  const file = path.join(work, `neg-${name}.json`);
  writeJson(file, p);
  const r = node('plan-lint.mjs', ['--plan', file, '--analysis', analysis]);
  return check(`plan-lint bắt lỗi: ${expect}`, r.status === 1 && r.stdout.includes('FAIL'), r.status === 1 ? '' : 'không bị chặn');
};
mutate('stat', (p) => { p.stats[0].value = '999'; }, 'số liệu không có trong lời nói');
mutate('midword', (p) => { const w = words[10]; p.cutaways[0].start = (w.start + w.end) / 2; }, 'cutaway cắt ngang một từ');
mutate('decor', (p) => { p.decor[0].type = 'hologram'; }, 'loại sticker ngoài phong cách');
mutate('share', (p) => { p.cutaways = [{ ...p.cutaways[0], id: 'x1', start: 1, end: 6 }, { ...p.cutaways[0], id: 'x2', start: 7, end: 12 }]; }, 'rời mặt người nói quá nhiều');

// ---- Khâu C (ngoại tuyến): giấy phép, chấm điểm, tài nguyên của người dùng ----
check('licenseKey nhận đúng CC0, miền công cộng, CC BY, BY-SA, NC', licenseKey('CC0 1.0') === 'cc0' && licenseKey('Public domain') === 'pd' && licenseKey('CC BY 4.0') === 'by' && licenseKey('CC BY-SA 3.0') === 'by-sa' && licenseKey('CC BY-NC 2.0') === 'by-nc');
check('danh sách trắng loại BY-SA, NC, ND và không rõ', !['by-sa', 'by-nc', 'by-nd', 'other'].some((l) => allowed({ license: l }, ['cc0', 'pd', 'by'])) && allowed({ license: 'by' }, ['cc0', 'pd', 'by']));
const cand = (title, license, w = 1600, h = 2400) => ({ title, description: '', license, width: w, height: h });
check('chấm điểm ưu tiên đúng chủ đề và đúng hướng khung', score(cand('coffee roasting machine', 'cc0'), 'coffee roasting', '9x16') > score(cand('mountain lake', 'cc0'), 'coffee roasting', '9x16') && score(cand('coffee roasting', 'cc0', 1600, 2400), 'coffee roasting', '9x16') > score(cand('coffee roasting', 'cc0', 2400, 1600), 'coffee roasting', '9x16'));

// ---- Dựng với tài nguyên tổng hợp của "người dùng" ----
const userDir = path.join(work, 'user-assets');
fs.mkdirSync(userDir, { recursive: true });
good.cutaways.forEach((c, i) => ffmpeg(['-f', 'lavfi', '-i', `testsrc2=size=1600x1200:rate=1:duration=1`, '-frames:v', '1', path.join(userDir, `${c.id}.jpg`)], `ảnh mẫu ${i}`));
good.cutaways.forEach((c, i) => { c.asset = null; c.status = 'pending'; c.presentation = i === 0 ? 'fullbleed' : ['card', 'polaroid', 'sticker', 'pip'][i % 4]; });
writeJson(planFile, good);
const rs = node('resolve-assets.mjs', ['--plan', planFile, '--user-assets', userDir, '--sources', 'none']);
const resolved = readJson(planFile);
check('resolve-assets: dùng tài nguyên của người dùng trước, đánh dấu userProvided', rs.status === 0 && resolved.cutaways.every((c) => c.asset && c.userProvided), tail(rs));
const lint2 = node('plan-lint.mjs', ['--plan', planFile, '--analysis', analysis, '--stage', 'assets']);
check('plan-lint giai đoạn assets đạt khi đủ tệp', lint2.status === 0, tail(lint2));

const baseVideo = path.join(work, 'base.mp4');
const cb = node('compose-base.mjs', ['--plan', planFile, '--analysis', analysis, '--out', baseVideo]);
check('lớp nền: dựng được (cắt, zoom, cutaway)', cb.status === 0 && fs.existsSync(baseVideo), tail(cb));
const mapped = readJson(path.join(work, 'plan.mapped.json'));
const bi = probe(baseVideo);
check('lớp nền: độ dài khớp bản đồ cắt', Math.abs(bi.duration - mapped.outDuration) < 0.15 && bi.width === 1080 && bi.height === 1920, `${bi.duration.toFixed(2)}s so với ${mapped.outDuration.toFixed(2)}s`);
const frameStat = (t) => { const r = run('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', baseVideo, '-frames:v', '1', '-vf', 'scale=64:-2,format=gray', '-f', 'rawvideo', '-']); return Buffer.from(r.stdout, 'latin1'); };
const c0 = mapped.cutaways.find((c) => c.presentation === 'fullbleed');
const inside = run('ffmpeg', ['-v', 'error', '-ss', String((c0.oStart + c0.oEnd) / 2), '-i', baseVideo, '-frames:v', '1', '-vf', 'scale=64:112,format=gray', '-f', 'image2pipe', '-vcodec', 'rawvideo', '-pix_fmt', 'gray', '-'], { encoding: 'buffer' });
const outside = run('ffmpeg', ['-v', 'error', '-ss', String(Math.max(0.1, c0.oStart - 0.4)), '-i', baseVideo, '-frames:v', '1', '-vf', 'scale=64:112,format=gray', '-f', 'image2pipe', '-vcodec', 'rawvideo', '-pix_fmt', 'gray', '-'], { encoding: 'buffer' });
let diff = 0;
const a = inside.stdout; const b = outside.stdout;
for (let i = 0; i < Math.min(a.length, b.length); i++) diff += Math.abs(a[i] - b[i]);
check('lớp nền: cutaway thật sự hiện đúng giờ (khung trong khác khung ngoài)', Buffer.isBuffer(a) && a.length > 1000 && diff / a.length > 12, `chênh lệch trung bình ${(diff / (a.length || 1)).toFixed(1)}`);
void frameStat;

// ---- Hiệu ứng thư viện (data/effects): plan-skeleton gợi ý, plan-lint kiểm, compose-base áp lên lớp nền ----
{
  const fxLib = loadLibrary();
  check('plan-skeleton: có mục effects, mọi hiệu ứng là engine video có trong thư viện', Array.isArray(good.effects) && good.effects.every((x) => fxLib.byId.get(x.effect)?.engine === 'video'), `${good.effects?.length} hiệu ứng tự gợi ý`);
  const fxPlanFile = path.join(work, 'edit-plan-fx.json');
  const fxPlan = readJson(planFile);
  const winStart = 2.2;
  fxPlan.effects = [{ id: 'e1', effect: 'whip-pan', atCut: 0, dur: 0.4 }, { id: 'e2', effect: 'crash-zoom', start: winStart, end: winStart + 0.9 }];
  writeJson(fxPlanFile, fxPlan);
  const lintFx = node('plan-lint.mjs', ['--plan', fxPlanFile, '--analysis', analysis, '--stage', 'assets']);
  check('plan-lint: hiệu ứng thư viện hợp lệ, trong ngân sách, an toàn nhấp nháy', lintFx.status === 0 && /PASS hiệu ứng thư viện hợp lệ/.test(lintFx.stdout) && /PASS an toàn nhấp nháy/.test(lintFx.stdout), tail(lintFx));
  const badFxPlan = { ...fxPlan, effects: [{ id: 'x1', effect: 'khong-co-hieu-ung', start: 1, end: 2 }, { id: 'x2', effect: 'impact', start: 1, end: 2 }] };
  writeJson(path.join(work, 'edit-plan-badfx.json'), badFxPlan);
  const lintBad = node('plan-lint.mjs', ['--plan', path.join(work, 'edit-plan-badfx.json'), '--analysis', analysis, '--stage', 'assets']);
  check('plan-lint bắt lỗi: hiệu ứng không tồn tại hoặc không thuộc engine video', lintBad.status === 1 && /FAIL hiệu ứng thư viện hợp lệ/.test(lintBad.stdout), lintBad.status === 1 ? '' : 'không bị chặn');
  const mappedKeep = fs.readFileSync(path.join(work, 'plan.mapped.json'));
  const fxBase = path.join(work, 'base-fx.mp4');
  const cbFx = node('compose-base.mjs', ['--plan', fxPlanFile, '--analysis', analysis, '--out', fxBase]);
  const fxMapped = readJson(path.join(work, 'plan.mapped.json'));
  fs.writeFileSync(path.join(work, 'plan.mapped.json'), mappedKeep);
  check('compose-base: áp hiệu ứng lên lớp nền, độ dài và kích thước không đổi', cbFx.status === 0 && Math.abs(probe(fxBase).duration - bi.duration) < 0.06 && probe(fxBase).width === 1080, tail(cbFx));
  const gray = (file, t) => run('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=64:112,format=gray', '-f', 'image2pipe', '-vcodec', 'rawvideo', '-pix_fmt', 'gray', '-'], { encoding: 'buffer' }).stdout;
  const meanDiff = (x, y) => { let d = 0; const n = Math.min(x.length, y.length); for (let i = 0; i < n; i++) d += Math.abs(x[i] - y[i]); return d / (n || 1); };
  const zoomWin = fxMapped.effects.find((x) => x.effect === 'crash-zoom');
  const tIn = zoomWin ? zoomWin.oStart + 0.12 : 0;
  const tOut = Math.max(0.1, (fxMapped.effects[0]?.oStart ?? 1) - 0.3);
  const dIn = meanDiff(gray(fxBase, tIn), gray(baseVideo, tIn));
  const dOut = meanDiff(gray(fxBase, tOut), gray(baseVideo, tOut));
  check('compose-base: khung trong cửa sổ hiệu ứng khác lớp nền gốc, khung ngoài giữ nguyên', dIn > 3 && dOut < 2, `trong ${dIn.toFixed(1)}, ngoài ${dOut.toFixed(1)}`);
}

// ---- Khâu D2, E ----
const ovDir = path.join(work, 'overlay');
const ro = node('render-overlay.mjs', ['--mapped', path.join(work, 'plan.mapped.json'), '--out', ovDir]);
const frames = fs.existsSync(path.join(ovDir, 'frames')) ? fs.readdirSync(path.join(ovDir, 'frames')) : [];
check('lớp phủ: đủ khung PNG', ro.status === 0 && frames.length === Math.ceil(mapped.outDuration * 30), `${frames.length} khung`);
const blankSize = fs.statSync(path.join(ovDir, 'blank.png')).size;
const nonBlank = frames.filter((f) => fs.statSync(path.join(ovDir, 'frames', f)).size !== blankSize).length;
check('lớp phủ: phần lớn khung có nội dung (caption)', nonBlank > frames.length * 0.6, `${nonBlank}/${frames.length}`);
// Social edit v2: caption đủ từ, showcase dựng vào lớp phủ và nằm trong vùng an toàn của video dọc
const ovSummary = readJson(path.join(ovDir, 'overlay-summary.json'));
const ovData = JSON.parse(fs.readFileSync(path.join(ovDir, 'overlay-data.js'), 'utf8').replace('window.OVERLAY = ', '').replace(/;\s*$/, ''));
check('lớp phủ: caption đủ 100% số từ', ovSummary.captionWords === ovSummary.sourceWords, `${ovSummary.captionWords}/${ovSummary.sourceWords}`);
const planned = mapped.cutaways.filter((c) => c.presentation !== 'fullbleed').length;
check('lớp phủ: showcase không phủ kín được dựng vào lớp phủ (không nằm ở lớp nền)', planned >= 1 && ovData.showcases.length >= 1 && ovData.showcases.every((x) => fs.existsSync(path.join(ovDir, x.src))), `${ovData.showcases.length}/${planned}`);
check('video dọc: showcase và caption nằm trong vùng an toàn (không chiếm 26% dưới khung)', ovData.showcases.every((x) => x.mode === 'peek' || (x.y >= 0.09 && x.y + x.h <= 0.75)) && ovData.captionY + 0.12 <= 0.76, `captionY ${ovData.captionY}`);
const sc0 = ovData.showcases[0];
const roSc = node('render-overlay.mjs', ['--mapped', path.join(work, 'plan.mapped.json'), '--out', path.join(work, 'overlay-sc'), '--analysis', analysis, '--times', String(((sc0?.s ?? 0) + (sc0?.e ?? 1)) / 2)]);
const scShot = fs.readdirSync(path.join(work, 'overlay-sc')).find((f) => f.startsWith('test_'));
check('lớp phủ: khung giữa showcase có hình vật thể (khác khung trống)', roSc.status === 0 && scShot && fs.statSync(path.join(work, 'overlay-sc', scShot)).size > fs.statSync(path.join(work, 'overlay-sc', 'blank.png')).size * 3, scShot ?? tail(roSc));
// Từ có cùng mốc thời gian (Whisper hay gán vậy): lượt caption phải có cửa sổ dương, không kẹt chữ trên màn hình
const dup = structuredClone(mapped);
const k0 = Math.floor(dup.wordsOut.length / 2);
for (let i = 1; i <= 3; i++) { dup.wordsOut[k0 + i].oStart = dup.wordsOut[k0].oStart; dup.wordsOut[k0 + i].oEnd = dup.wordsOut[k0].oStart + 0.04; }
dup.wordsOut[k0].oEnd = dup.wordsOut[k0].oStart + 0.04;
writeJson(path.join(work, 'plan.dup.json'), dup);
const roDup = node('render-overlay.mjs', ['--mapped', path.join(work, 'plan.dup.json'), '--out', path.join(work, 'overlay-dup'), '--analysis', analysis, '--times', '1']);
const dupData = JSON.parse(fs.readFileSync(path.join(work, 'overlay-dup', 'overlay-data.js'), 'utf8').replace('window.OVERLAY = ', '').replace(/;\s*$/, ''));
check('lớp phủ: từ cùng mốc không tạo lượt caption có cửa sổ âm', roDup.status === 0 && dupData.chunks.every((c) => c.e > c.s), `${dupData.chunks.filter((c) => c.e <= c.s).length} lượt lỗi`);
const { facesIn, speechGap, sizeOf } = await import(pathToFileURL(path.join(here, 'plan-lib.mjs')).href);
check('sizeOf: --size 1280x720 được nhận, mặc định theo hướng', sizeOf('16x9', '1280x720').W === 1280 && sizeOf('16x9', '1280x720').H === 720 && sizeOf('9x16').H === 1920 && sizeOf('16x9').W === 1920);
const fz = { samples: [{ t: 10, boxes: [[0.1, 0.1, 0.2, 0.3]] }, { t: 30, boxes: [] }] };
check('facesIn: lấy mặt trong cửa sổ, mẫu gần trong 2,5s, và không dùng mẫu xa', facesIn(fz, 9.5, 10.5).length === 1 && facesIn(fz, 12, 12.4).length === 1 && facesIn(fz, 20, 21).length === 0);
check('speechGap: trừ khoảng lặng từ 1,5s (cảnh quay không lời)', Math.abs(speechGap(0, 20, [{ start: 0, end: 2 }, { start: 12, end: 14 }]) - 10) < 1e-6);
const outVideo = path.join(work, 'out.mp4');
const fin = node('finalize.mjs', ['--base', baseVideo, '--overlay', ovDir, '--mapped', path.join(work, 'plan.mapped.json'), '--out', outVideo]);
check('ghép: video thành phẩm, SRT', fin.status === 0 && fs.existsSync(outVideo) && fs.existsSync(outVideo.replace(/\.mp4$/, '.srt')), tail(fin));

// ---- Khâu F ----
const au = node('audit-edit.mjs', ['--video', outVideo, '--work', work, '--analysis', analysis, '--asr-model', model]);
check('audit-edit: toàn bộ hạng mục tự động đạt (gồm lệch caption đo bằng phiên âm lại)', au.status === 0, au.status === 0 ? '' : au.stdout.split('\n').filter((l) => l.startsWith('FAIL')).join(' | '));
// Phép thử âm: lớp phủ thiếu khung (render-overlay chưa chạy xong) phải bị finalize từ chối; nếu vẫn ghép thiếu thì audit-edit phải bắt
{
  const allFrames = fs.readdirSync(path.join(ovDir, 'frames')).filter((n) => /^f_\d{5}\.png$/.test(n)).sort();
  const keep = Math.floor(allFrames.length * 0.6);
  const partialDir = path.join(work, 'overlay-partial');
  fs.mkdirSync(path.join(partialDir, 'frames'), { recursive: true });
  for (const n of allFrames.slice(0, keep)) fs.copyFileSync(path.join(ovDir, 'frames', n), path.join(partialDir, 'frames', n));
  for (const n of ['overlay-data.js', 'overlay-summary.json']) fs.copyFileSync(path.join(ovDir, n), path.join(partialDir, n));
  const finPartial = node('finalize.mjs', ['--base', baseVideo, '--overlay', partialDir, '--mapped', path.join(work, 'plan.mapped.json'), '--out', path.join(work, 'out-partial.mp4')]);
  check('finalize từ chối lớp phủ thiếu khung (render-overlay chưa xong)', finPartial.status !== 0 && /Lớp phủ có \d+ khung, cần \d+/.test(finPartial.stderr), finPartial.status !== 0 ? '' : 'vẫn ghép');
  const stale = path.join(work, 'out-stale.mp4');
  ffmpeg(['-i', baseVideo, '-framerate', String(FPS), '-i', path.join(partialDir, 'frames', 'f_%05d.png'), '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]', '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-crf', '20', '-c:a', 'aac', '-r', String(FPS), stale], 'ghép lớp phủ thiếu');
  const auStale = node('audit-edit.mjs', ['--video', stale, '--work', work, '--analysis', analysis, '--no-asr']);
  check('audit-edit bắt lỗi: thành phẩm ghép từ lớp phủ thiếu khung (chữ đứng, thẻ mất)', auStale.status === 1 && /FAIL thành phẩm khớp nền cộng lớp phủ/.test(auStale.stdout), auStale.status === 1 ? '' : 'không bị chặn');
}
// Phép thử âm: giấy phép BY-SA chèn vào credits phải bị chặn
const creditsFile = path.join(work, 'assets', 'credits.json');
fs.writeFileSync(creditsFile, JSON.stringify(resolved.cutaways.map((c) => ({ file: path.basename(c.asset), license: 'by-sa' }))));
const resolvedBad = structuredClone(resolved);
resolvedBad.cutaways.forEach((c) => { c.userProvided = false; });
writeJson(planFile, resolvedBad);
const mappedBad = readJson(path.join(work, 'plan.mapped.json'));
mappedBad.cutaways.forEach((c) => { c.userProvided = false; });
writeJson(path.join(work, 'plan.mapped.json'), mappedBad);
const auBad = node('audit-edit.mjs', ['--video', outVideo, '--work', work, '--analysis', analysis, '--no-asr']);
check('audit-edit bắt lỗi: giấy phép ngoài danh sách trắng', auBad.status === 1 && /giấy phép nằm trong danh sách trắng/.test(auBad.stdout), auBad.status === 1 ? '' : 'không bị chặn');

if (flags.online) {
  const planOnline = structuredClone(good);
  planOnline.cutaways = [{ ...good.cutaways[0], id: 'o1', query: 'coffee roasting machine', asset: null, status: 'pending' }];
  const f = path.join(work, 'online', 'edit-plan.json');
  writeJson(f, planOnline);
  const on = node('resolve-assets.mjs', ['--plan', f, '--sources', 'commons']);
  const credits = fs.existsSync(path.join(work, 'online', 'assets', 'credits.json')) ? readJson(path.join(work, 'online', 'assets', 'credits.json')) : [];
  const { notoLottie, iconifyFind } = await import(pathToFileURL(path.join(here, 'decor-lib.mjs')).href);
  const lot = await notoLottie('fire');
  check('trực tuyến: tải emoji động Noto (Lottie) có ghi công CC BY', Boolean(lot?.data?.layers?.length) && /CC BY 4.0/.test(lot.credit), lot ? `${lot.data.fr} khung/giây` : 'không tải được');
  const ico = await iconifyFind('shopping bags');
  check('trực tuyến: tìm icon Iconify trong danh sách trắng', Boolean(ico?.svg?.startsWith('<svg')) && ['MIT', 'Apache-2.0', 'CC-BY-4.0'].includes(ico.license), ico ? `${ico.set}:${ico.name} ${ico.license}` : 'không tìm được');
  check('trực tuyến: tìm và tải một ảnh có giấy phép, có ghi công', on.status === 0 && credits.length === 1 && ['cc0', 'pd', 'by'].includes(credits[0].license) && credits[0].sha256, tail(on));
}

// Decor mã (sparkle, confetti) và thẻ số ba kiểu dựng được khi offline
{
  const dcMapped = structuredClone(mapped);
  const wi = Math.floor(dcMapped.wordsOut.length / 3);
  const at = dcMapped.wordsOut[wi];
  dcMapped.decor = [{ id: 'x1', type: 'sparkle', anchorWord: at.i, start: at.start, end: at.end + 1, oStart: at.oStart, oEnd: at.oEnd + 1 }, { id: 'x2', type: 'confetti', anchorWord: dcMapped.wordsOut[wi + 4].i, start: 0, end: 1, oStart: dcMapped.wordsOut[wi + 4].oStart, oEnd: dcMapped.wordsOut[wi + 4].oStart + 1.4 }];
  const variantsOk = [];
  for (const v of ['ring', 'sticker', 'capsule']) {
    const f = path.join(work, `plan.stat-${v}.json`);
    writeJson(f, dcMapped);
    const outDir = path.join(work, `overlay-stat-${v}`);
    const r = node('render-overlay.mjs', ['--mapped', f, '--out', outDir, '--analysis', analysis, '--offline', '--stat-variant', v, '--times', String((dcMapped.stats[0]?.oStart ?? 2) + 0.9)]);
    const shot = fs.existsSync(outDir) ? fs.readdirSync(outDir).find((x) => x.startsWith('test_')) : null;
    variantsOk.push(Boolean(r.status === 0 && shot && fs.statSync(path.join(outDir, shot)).size > fs.statSync(path.join(outDir, 'blank.png')).size));
  }
  check('decor mã (sparkle, confetti) và 3 kiểu thẻ số dựng được khi offline', variantsOk.every(Boolean), variantsOk.join(','));
}

// Bố cục stack (video ngang sang dọc 9:16) và thẻ headline: dựng được khi offline, decor không che vùng video
{
  const { stackGeometry, mapFacesToStack } = await import(pathToFileURL(path.join(here, 'plan-lib.mjs')).href);
  const geo = stackGeometry({ layout: 'stack', orientation: '9x16', srcSize: { w: 1280, h: 720 } });
  const mf = mapFacesToStack({ samples: [{ t: 0, boxes: [[0.4, 0.2, 0.2, 0.4]] }] }, geo);
  check('stack: hình học khung dọc và đổi khung mặt', geo && geo.fgH === 608 && Math.abs(mf.samples[0].boxes[0][1] - (geo.y + 0.2 * geo.fgH) / geo.H) < 1e-9 && Math.abs(mf.samples[0].boxes[0][3] - (0.4 * geo.fgH) / geo.H) < 1e-9);
  const wide = path.join(work, 'wide.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30:duration=21', '-i', talk, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', wide], 'video ngang mẫu');
  const wa = path.join(work, 'wide-analysis');
  const an2 = node('analyze.mjs', [wide, '--out', wa, '--lang', 'en', '--model', model, '--no-faces']);
  const stackDir = path.join(work, 'stack');
  fs.mkdirSync(stackDir, { recursive: true });
  const sp = path.join(stackDir, 'edit-plan.json');
  const sk3 = node('plan-skeleton.mjs', ['--analysis', wa, '--style', 'explainer', '--layout', 'stack', '--size', '720x1280', '--out', sp]);
  const stackPlan = fs.existsSync(sp) ? readJson(sp) : {};
  check('stack: plan-skeleton --layout stack ghi bố cục và khung dọc', an2.status === 0 && sk3.status === 0 && stackPlan.layout === 'stack' && stackPlan.orientation === '9x16' && stackPlan.srcSize?.w === 1280, tail(sk3));
  stackPlan.cards = [{ id: 'k1', type: 'title', text: 'Tiêu đề thử', sub: 'Dòng phụ', start: 0.5, end: 3.5 }];
  stackPlan.cutaways = [];
  writeJson(sp, stackPlan);
  const stackBase = path.join(stackDir, 'base.mp4');
  const cb3 = node('compose-base.mjs', ['--plan', sp, '--analysis', wa, '--out', stackBase]);
  const sbi = fs.existsSync(stackBase) ? probe(stackBase) : {};
  check('stack: lớp nền ra khung 720x1280 (video gốc giữa, nền mờ)', cb3.status === 0 && sbi.width === 720 && sbi.height === 1280, tail(cb3));
  const ovS = path.join(stackDir, 'overlay');
  const ro3 = node('render-overlay.mjs', ['--mapped', path.join(stackDir, 'plan.mapped.json'), '--out', ovS, '--analysis', wa, '--offline', '--times', '1.5']);
  const sum = fs.existsSync(path.join(ovS, 'overlay-summary.json')) ? readJson(path.join(ovS, 'overlay-summary.json')) : {};
  const shotS = fs.existsSync(ovS) ? fs.readdirSync(ovS).find((x) => x.startsWith('test_')) : null;
  const dataS = fs.existsSync(path.join(ovS, 'overlay-data.js')) ? JSON.parse(fs.readFileSync(path.join(ovS, 'overlay-data.js'), 'utf8').replace('window.OVERLAY = ', '').replace(/;\s*$/, '')) : { cards: [] };
  const card = dataS.cards[0];
  check('stack: thẻ title nằm ở vùng trên, phía trên video gốc', ro3.status === 0 && sum.layout === 'stack' && card && card.y + card.h <= 0.38 && shotS && fs.statSync(path.join(ovS, shotS)).size > fs.statSync(path.join(ovS, 'blank.png')).size, tail(ro3));
}

// Bố cục follow: khung cắt 9:16 bám mặt (hàm thuần) và dựng nền bằng ffmpeg
{
  const { followPath, followLeftAt, mapFacesForLayout } = await import(pathToFileURL(path.join(here, 'plan-lib.mjs')).href);
  // Mặt trượt từ trái sang phải trong 20s: khung cắt phải đi theo, mượt (không nhảy quá 0,25 chiều rộng mỗi giây)
  const samples = Array.from({ length: 41 }, (_, i) => ({ t: i * 0.5, boxes: [[0.1 + (0.6 * i) / 40, 0.2, 0.1, 0.2]] }));
  const fp = followPath({ samples }, { w: 1280, h: 720 }, 20);
  const l0 = followLeftAt(fp, 0);
  const l20 = followLeftAt(fp, 20);
  const stepMax = Math.max(...fp.knots.slice(1).map((k, i) => Math.abs(k[1] - fp.knots[i][1]) / (k[0] - fp.knots[i][0])));
  check('follow: khung cắt đi theo mặt và không giật', fp.wNorm > 0.3 && l20 > l0 + 0.3 && stepMax <= 0.26, `trái ${l0.toFixed(2)} đến ${l20.toFixed(2)}, tốc độ tối đa ${stepMax.toFixed(2)}`);
  const mf = mapFacesForLayout({ samples: [{ t: 10, boxes: [[0.5, 0.2, 0.1, 0.2]] }] }, { layout: 'follow', follow: fp, orientation: '9x16' });
  check('follow: khung mặt được đổi sang khung dọc (mặt nằm trong khung)', mf.samples[0].boxes.length === 1 && mf.samples[0].boxes[0][0] > -0.05 && mf.samples[0].boxes[0][0] < 1);
  const followDir = path.join(work, 'follow');
  fs.mkdirSync(followDir, { recursive: true });
  const wf = path.join(work, 'wide-analysis');
  writeJson(path.join(wf, 'faces.json'), { coverage: 1, samples: Array.from({ length: 42 }, (_, i) => ({ t: i * 0.5, boxes: [[0.1 + (0.6 * i) / 41, 0.2, 0.1, 0.2]] })) });
  const fplan = { ...structuredClone(readJson(path.join(work, 'stack', 'edit-plan.json'))), layout: 'follow', follow: followPath({ samples }, { w: 1280, h: 720 }, 21), cards: [] };
  delete fplan.layoutY;
  const fpPath = path.join(followDir, 'edit-plan.json');
  writeJson(fpPath, fplan);
  const fb = path.join(followDir, 'base.mp4');
  const cbf = node('compose-base.mjs', ['--plan', fpPath, '--analysis', wf, '--out', fb]);
  const fbi = fs.existsSync(fb) ? probe(fb) : {};
  check('follow: lớp nền cắt 9:16 bám mặt ra khung 720x1280', cbf.status === 0 && fbi.width === 720 && fbi.height === 1280, tail(cbf));
  // Chữ lớn sau người nói (bigtext): render-overlay ghi lớp behind riêng và cửa sổ behind cho bước tách người
  const bplan = { ...fplan, cards: [{ id: 'b1', type: 'bigtext', text: 'Xin chào', start: 1, end: 3.5 }] };
  writeJson(fpPath, bplan);
  const cbb = node('compose-base.mjs', ['--plan', fpPath, '--analysis', wf, '--out', fb]);
  const ovB = path.join(followDir, 'overlay');
  const rob = node('render-overlay.mjs', ['--mapped', path.join(followDir, 'plan.mapped.json'), '--out', ovB, '--analysis', wf, '--offline', '--times', '2']);
  const sumB = fs.existsSync(path.join(ovB, 'overlay-summary.json')) ? readJson(path.join(ovB, 'overlay-summary.json')) : {};
  const behindShot = fs.existsSync(ovB) ? fs.readdirSync(ovB).find((x) => x.startsWith('behind_test_')) : null;
  const sz = (f) => fs.statSync(path.join(ovB, f)).size;
  check('bigtext: chữ dựng ở lớp behind riêng và có cửa sổ behind', cbb.status === 0 && rob.status === 0 && sumB.behindWindows?.length === 1 && behindShot && sz(behindShot) > sz('blank.png') * 3, `${sumB.behindWindows?.length} cửa sổ`);  // Thẻ CTA và bằng chứng (comment, actions, counter): dựng được, không cảnh báo, mỗi thẻ có hình; plan-lint chặn số trên counter không có nguồn
  const cplan = { ...fplan, userSource: ['100000 lượt xem'], cards: [
    { id: 'k1', type: 'comment', text: 'EDIT', reply: 'Đã gửi.', start: 1, end: 5 },
    { id: 'k2', type: 'actions', active: 'save', start: 5.5, end: 7.5 },
    { id: 'k3', type: 'counter', title: 'Video trước', rows: [{ label: 'lượt xem', from: 86000, to: 100000 }], start: 8, end: 11 }
  ] };
  writeJson(fpPath, cplan);
  const cbc = node('compose-base.mjs', ['--plan', fpPath, '--analysis', wf, '--out', fb]);
  const ovC = path.join(followDir, 'overlay-cta');
  const mappedC = readJson(path.join(followDir, 'plan.mapped.json'));
  const midTimes = mappedC.cards.map((x) => ((x.oStart + x.oEnd) / 2).toFixed(2)).join(',');
  const roc = node('render-overlay.mjs', ['--mapped', path.join(followDir, 'plan.mapped.json'), '--out', ovC, '--analysis', wf, '--offline', '--times', midTimes]);
  const sumC = fs.existsSync(path.join(ovC, 'overlay-summary.json')) ? readJson(path.join(ovC, 'overlay-summary.json')) : {};
  const blankSize = fs.existsSync(path.join(ovC, 'blank.png')) ? fs.statSync(path.join(ovC, 'blank.png')).size : Infinity;
  const ctaFrames = fs.existsSync(ovC) ? fs.readdirSync(ovC).filter((x) => /^test_/.test(x)) : [];
  check('thẻ comment, actions, counter: dựng được, không cảnh báo, mỗi thẻ có hình', cbc.status === 0 && roc.status === 0 && sumC.cards?.length === 3 && !sumC.warnings?.length && ctaFrames.length === 3 && ctaFrames.every((x) => fs.statSync(path.join(ovC, x)).size > blankSize * 3), `${sumC.cards?.length} thẻ, ${ctaFrames.length} khung, ${sumC.warnings?.length ?? '?'} cảnh báo`);
  const lintOk = node('plan-lint.mjs', ['--plan', fpPath, '--analysis', wf]);
  check('plan-lint: số trên thẻ counter có nguồn trong userSource thì đạt', /PASS số trên thẻ headline có trong lời nói/.test(lintOk.stdout) && /PASS thẻ headline hợp lệ/.test(lintOk.stdout));
  const badNumPath = path.join(followDir, 'edit-plan-badnum.json');
  writeJson(badNumPath, { ...cplan, userSource: [] });
  const lintNum = node('plan-lint.mjs', ['--plan', badNumPath, '--analysis', wf]);
  check('plan-lint bắt lỗi: số trên thẻ counter không có nguồn', /FAIL số trên thẻ headline có trong lời nói/.test(lintNum.stdout));
  // captions.mode off (video nguồn đã có phụ đề cứng) và ghi đè cỡ chữ: không dựng phụ đề mới, không cảnh báo về caption, thẻ khác vẫn dựng; sizeRatio của kế hoạch vào dữ liệu lớp phủ
  const renderCaptions = (captions, name) => {
    writeJson(fpPath, { ...cplan, captions: { ...cplan.captions, ...captions } });
    const cb = node('compose-base.mjs', ['--plan', fpPath, '--analysis', wf, '--out', fb]);
    const mp = readJson(path.join(followDir, 'plan.mapped.json'));
    const dir = path.join(followDir, name);
    const r = node('render-overlay.mjs', ['--mapped', path.join(followDir, 'plan.mapped.json'), '--out', dir, '--analysis', wf, '--offline', '--times', ((mp.cards[0].oStart + mp.cards[0].oEnd) / 2).toFixed(2)]);
    const sm = fs.existsSync(path.join(dir, 'overlay-summary.json')) ? readJson(path.join(dir, 'overlay-summary.json')) : {};
    const od = fs.existsSync(path.join(dir, 'overlay-data.js')) ? JSON.parse(fs.readFileSync(path.join(dir, 'overlay-data.js'), 'utf8').replace('window.OVERLAY = ', '').replace(/;\s*$/, '')) : {};
    return { ok: cb.status === 0 && r.status === 0, sm, od };
  };
  const off = renderCaptions({ mode: 'off' }, 'overlay-off');
  check('captions.mode off: không dựng phụ đề mới, không cảnh báo caption, thẻ khác vẫn dựng', off.ok && off.sm.chunks === 0 && off.sm.captionWords === 0 && !(off.sm.warnings ?? []).some((x) => /caption/.test(x)) && off.sm.cards?.length === 3, `${off.sm.chunks} lượt, ${off.sm.cards?.length} thẻ`);
  const edi = renderCaptions({ preset: 'editorial', emphasis: [3, 5] }, 'overlay-editorial');
  check('preset editorial: dựng được, phông Lora nghiêng và giấy phép OFL đi kèm', edi.ok && edi.od.style?.captions?.preset === 'editorial' && fs.existsSync(path.join(followDir, 'overlay-editorial', 'fonts', 'Lora-Italic.ttf')) && fs.existsSync(path.join(followDir, 'overlay-editorial', 'fonts', 'OFL-lora.txt')), `${edi.od.style?.captions?.preset}`);
  const sized = renderCaptions({ sizeRatio: 0.03 }, 'overlay-size');
  check('captions.sizeRatio trong kế hoạch ghi đè cỡ chữ của phong cách', sized.ok && sized.od.style?.captions?.sizeRatio === 0.03, `${sized.od.style?.captions?.sizeRatio}`);
  // Thẻ orbit và wall (nằm SAU người nói): dựng được hai lớp, có cửa sổ behind cho bước tách người; plan-lint chặn thiếu mục và yêu cầu môi trường tách người
  const obPlan = { ...cplan, captions: { ...cplan.captions, mode: 'off' }, cards: [
    { id: 'k1', type: 'orbit', items: ['A', 'B', 'C', 'D', 'E'], start: 1, end: 4.5 },
    { id: 'k2', type: 'wall', cols: 3, items: ['X', 'Y'], start: 5, end: 8 }
  ] };
  writeJson(fpPath, obPlan);
  const cbo = node('compose-base.mjs', ['--plan', fpPath, '--analysis', wf, '--out', fb]);
  const mpo = readJson(path.join(followDir, 'plan.mapped.json'));
  const ovO = path.join(followDir, 'overlay-orbit');
  const mid = (x) => ((x.oStart + x.oEnd) / 2).toFixed(2);
  const roo = node('render-overlay.mjs', ['--mapped', path.join(followDir, 'plan.mapped.json'), '--out', ovO, '--analysis', wf, '--offline', '--times', `${mid(mpo.cards[0])},${mid(mpo.cards[1])}`]);
  const sumO = fs.existsSync(path.join(ovO, 'overlay-summary.json')) ? readJson(path.join(ovO, 'overlay-summary.json')) : {};
  const blankO = fs.existsSync(path.join(ovO, 'blank.png')) ? fs.statSync(path.join(ovO, 'blank.png')).size : Infinity;
  const behindShots = fs.existsSync(ovO) ? fs.readdirSync(ovO).filter((x) => x.startsWith('behind_test_')).sort() : [];
  check('thẻ orbit và wall: dựng lớp sau người, có hai cửa sổ behind, khung nào cũng có hình', cbo.status === 0 && roo.status === 0 && sumO.behindWindows?.length === 2 && behindShots.length === 2 && behindShots.every((x) => fs.statSync(path.join(ovO, x)).size > blankO * 2) && !(sumO.warnings ?? []).length, `${sumO.behindWindows?.length} cửa sổ, ${behindShots.length} khung, ${sumO.warnings?.length ?? '?'} cảnh báo`);
  const badOrbit = path.join(followDir, 'edit-plan-badorbit.json');
  writeJson(badOrbit, { ...obPlan, cards: [{ id: 'k1', type: 'orbit', items: ['A', 'B'], start: 1, end: 4.5 }, { id: 'k2', type: 'wall', items: [], start: 5, end: 8 }] });
  const lintOrbit = node('plan-lint.mjs', ['--plan', badOrbit, '--analysis', wf]);
  check('plan-lint bắt lỗi: orbit dưới 3 mục hoặc wall không có mục', /FAIL thẻ headline hợp lệ: k1, k2/.test(lintOrbit.stdout));
  const lintMask = node('plan-lint.mjs', ['--plan', fpPath, '--analysis', wf]);
  check('plan-lint: thẻ orbit và wall đòi môi trường tách người (đạt khi đã cài, trượt khi chưa)', segPythonPath() ? /PASS môi trường tách người cho thẻ orbit và wall/.test(lintMask.stdout) : /FAIL môi trường tách người cho thẻ orbit và wall/.test(lintMask.stdout));
}

console.log(failures ? `\n${failures} kiểm tra TRƯỢT` : '\nTất cả kiểm tra đạt');
process.exit(failures ? 1 : 0);
