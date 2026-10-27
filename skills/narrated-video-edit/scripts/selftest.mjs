// Tự kiểm cả đường ống bằng dữ liệu tổng hợp (giọng đọc tiếng Anh eSpeak, nền dọc, ảnh tổng hợp). Không cần mạng.
// Chạy: node selftest.mjs [--online] [--model small]    (--online thêm một lượt tìm tài nguyên thật qua mạng)
// Mẫu tiếng Việt với giọng người thật KHÔNG nằm trong selftest: phải thử riêng với video của người dùng.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FPS, args, ffmpeg, launchChrome, probe, pythonPath, readJson, run, segPythonPath, skillRoot, writeJson, here } from './common.mjs';
import { allowed, ccName, licenseKey, score } from './resolve-assets.mjs';
import { loadLibrary } from './fx-lib.mjs';
import { captionProblems } from './glossary-lib.mjs';

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
const styles = ['hype', 'explainer', 'documentary', 'creator'];
const planFile = path.join(work, 'edit-plan.json');
let allGood = true;
for (const id of styles) {
  const sk = node('plan-skeleton.mjs', ['--analysis', analysis, '--style', id, '--out', path.join(work, `plan-${id}.json`)]);
  const lint = node('plan-lint.mjs', ['--plan', path.join(work, `plan-${id}.json`), '--analysis', analysis]);
  if (sk.status !== 0 || lint.status !== 0) { allGood = false; console.log(`  ${id}: ${tail(sk.status !== 0 ? sk : lint)}`); }
}
check('kế hoạch: bộ khung của cả 4 phong cách qua plan-lint', allGood);
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
// Từ điển tên riêng (kế hoạch 51, P1): biến thể mơ hồ chỉ thay khi người dùng đã khai; bản gốc, mốc giờ và chỉ số từ không đổi
{
  const gdir = path.join(work, 'glossary-analysis');
  fs.cpSync(analysis, gdir, { recursive: true });
  const raw = readJson(path.join(gdir, 'words.raw.json'));
  Object.entries({ 2: 'Cloud,', 6: 'cloud', 7: 'storage', 12: 'Cloud', 13: 'Code' }).forEach(([i, t]) => { raw.words[i].text = t; });
  writeJson(path.join(gdir, 'words.raw.json'), raw);
  const undeclared = node('glossary-apply.mjs', ['--analysis', gdir]);
  const wu = readJson(path.join(gdir, 'words.json')).words;
  const ru = readJson(path.join(gdir, 'glossary-report.json'));
  check('từ điển: chưa khai thì "cloud" thật (cloud storage) không bị sửa, chỉ hỏi người dùng', undeclared.status === 0 && wu[2].text === 'Cloud,' && wu[6].text === 'cloud' && ru.pending.length === 1 && ru.pending[0].count === 2, undeclared.status === 0 ? ru.pending[0]?.question : tail(undeclared));
  check('từ điển: "Cloud Code" không mơ hồ nên luôn thành "Claude Code"', wu[12].text === 'Claude' && wu[13].text === 'Code', `${wu[12].text} ${wu[13].text}`);
  const pbq = node('plan-board.mjs', ['--plan', planFile, '--analysis', gdir, '--out', path.join(work, 'board-glossary')]);
  const mdq = fs.existsSync(path.join(work, 'board-glossary', 'plan-board.md')) ? fs.readFileSync(path.join(work, 'board-glossary', 'plan-board.md'), 'utf8') : '';
  check('từ điển: plan-board hỏi người dùng ở CỔNG 1 khi còn tên riêng mơ hồ', pbq.status === 0 && mdq.includes('Cần hỏi người dùng về tên riêng') && mdq.includes('"Claude"'), pbq.status === 0 ? '' : tail(pbq));
  const declared = node('glossary-apply.mjs', ['--analysis', gdir, '--terms', 'Claude']);
  const wd = readJson(path.join(gdir, 'words.json')).words;
  const rd = readJson(path.join(gdir, 'glossary-report.json'));
  const rawAfter = readJson(path.join(gdir, 'words.raw.json'));
  check('từ điển: đã khai thì thay đủ, giữ dấu câu, mốc giờ và bản gốc', declared.status === 0 && wd[2].text === 'Claude,' && wd[6].text === 'Claude' && wd[6].was === 'cloud' && wd[2].start === raw.words[2].start && rd.applied.length === 3 && !rd.pending.length && rawAfter.words[6].text === 'cloud', declared.status === 0 ? `${rd.applied.length} từ` : tail(declared));
  const gplan = (text) => path.join(work, `plan-glossary-${text}.json`);
  for (const text of ['Cloud', 'Claude']) writeJson(gplan(text), { ...good, cards: [{ id: 'gz', type: 'bigtext', text, start: raw.words[12].start, end: raw.words[12].start + 1.5, anchorWord: 12 }] });
  const lintBad = node('plan-lint.mjs', ['--plan', gplan('Cloud'), '--analysis', gdir]);
  const lintOk = node('plan-lint.mjs', ['--plan', gplan('Claude'), '--analysis', gdir]);
  check('từ điển: plan-lint báo FAIL khi thẻ ghi "Cloud" và PASS khi ghi "Claude"', /FAIL chữ trên màn hình viết đúng tên riêng/.test(lintBad.stdout) && /PASS chữ trên màn hình viết đúng tên riêng/.test(lintOk.stdout), tail(lintBad));
  const capOf = (ws) => ws.map((w) => ({ i: w.i, text: w.text }));
  const fixed = captionProblems(rd, capOf(wd));
  const stale = captionProblems(rd, capOf(raw.words));
  check('từ điển: kiểm caption của audit độc lập với bộ nhận dạng (bắt "Cloud", chấp nhận "Claude")', !fixed.changed.length && !fixed.leftover.length && stale.changed.length === 3,`caption sai lệch ${stale.changed.length}, đã sửa ${fixed.changed.length + fixed.leftover.length}`);
}

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
mutate('clipfit', (p) => { p.cutaways[0].clipFit = 'zoom'; }, 'clipFit ngoài cover và contain');
mutate('clipstart', (p) => { p.cutaways[0].clipStart = -3; }, 'clipStart âm');
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
// Clip chạy thật trong thẻ (kế hoạch 51, P2): bắt đầu đúng clipStart, khung đổi theo thời gian (so với thẻ ảnh tĩnh cùng chuyển động), clip ngắn giữ khung cuối
{
  const clipFile = path.join(userDir, 'play.mp4');
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30:duration=8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', clipFile], 'clip mẫu');
  const target = structuredClone(mapped.cutaways.find((c) => c.presentation === 'card') ?? mapped.cutaways.find((c) => c.presentation !== 'fullbleed'));
  const only = (patch) => { const m = structuredClone(mapped); m.cutaways = [{ ...target, ...patch }]; m.captions = { mode: 'off' }; m.stats = []; m.decor = []; m.cards = []; m.lowerThirds = []; return m; };
  const render = (name, m, times) => {
    const f = path.join(work, `plan.${name}.json`);
    writeJson(f, m);
    const dir = path.join(work, `overlay-${name}`);
    const r = node('render-overlay.mjs', ['--mapped', f, '--out', dir, '--analysis', analysis, '--offline', ...(times ? ['--times', times.join(',')] : [])]);
    return { r, dir, data: fs.existsSync(path.join(dir, 'overlay-data.js')) ? JSON.parse(fs.readFileSync(path.join(dir, 'overlay-data.js'), 'utf8').replace('window.OVERLAY = ', '').replace(/;\s*$/, '')) : null };
  };
  const tA = target.oStart + 0.5;
  const tB = target.oEnd - 0.3;
  const gray = (file, box) => run('ffmpeg', ['-v', 'error', '-i', file, '-vf', box ? `crop=iw*${box.w}:ih*${box.h}:iw*${box.x}:ih*${box.y},scale=64:64,format=gray` : 'scale=64:112,format=gray', '-f', 'rawvideo', '-'], { encoding: 'buffer' }).stdout;
  const shots = (dir) => fs.readdirSync(dir).filter((x) => /^test_/.test(x)).sort().map((x) => path.join(dir, x));
  // Cùng hình học và chuyển động của thẻ ở hai lần dựng: chỉ nội dung clip khác nhau (clip chạy so với clip giữ khung đầu), đo trong hộp của thẻ ở mốc cuối cửa sổ
  const crossDiff = (a, b, box) => { const x = gray(shots(a)[1], box); const y = gray(shots(b)[1], box); let d = 0; for (let i = 0; i < Math.min(x.length, y.length); i++) d += Math.abs(x[i] - y[i]); return d / (x.length || 1); };
  const play = render('clip-play', only({ asset: path.relative(work, clipFile).replace(/\\/g, '/'), kind: 'video', userProvided: true, clipStart: 2, entrance: 'pop' }), [tA, tB]);
  const staticFile = path.join(userDir, 'static.mp4');
  ffmpeg(['-ss', '2', '-i', clipFile, '-frames:v', '1', '-vf', 'fps=30', path.join(work, 'static-frame.png')], 'khung tĩnh');
  ffmpeg(['-loop', '1', '-framerate', '30', '-i', path.join(work, 'static-frame.png'), '-t', '8', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', staticFile], 'clip tĩnh');
  const still = render('clip-still', only({ asset: path.relative(work, staticFile).replace(/\\/g, '/'), kind: 'video', userProvided: true, clipStart: 2, entrance: 'pop' }), [tA, tB]);
  const win = target.oEnd - target.oStart;
  const sc = play.data?.showcases?.[0];
  check('clip chạy thật: chuỗi khung trích đủ cho cửa sổ, bắt đầu từ clipStart', play.r.status === 0 && sc?.clip && Math.abs(sc.clip.frames - Math.round(win * 30)) <= 2, play.r.status === 0 ? `${sc?.clip?.frames} khung cho ${win.toFixed(2)}s` : tail(play.r));
  const first = gray(path.join(play.dir, sc?.clip?.dir ?? 'x', 'c_00001.jpg'));
  const src2s = run('ffmpeg', ['-v', 'error', '-ss', '2', '-i', clipFile, '-frames:v', '1', '-vf', 'scale=-2:ih,scale=64:112,format=gray', '-f', 'rawvideo', '-'], { encoding: 'buffer' }).stdout;
  const firstDiff = first.length && first.length === src2s.length ? first.reduce((s, v, i) => s + Math.abs(v - src2s[i]), 0) / first.length : 255;
  check('clip chạy thật: khung đầu của thẻ là khung tại clipStart của clip nguồn', firstDiff < 8, `chênh lệch ${firstDiff.toFixed(1)}`);
  const dPlay = crossDiff(play.dir, still.dir, play.data.showcases[0]);
  const dSelf = crossDiff(still.dir, still.dir, still.data.showcases[0]);
  check('clip chạy thật: cuối cửa sổ thẻ hiện khung khác với clip giữ khung đầu (cùng vị trí và chuyển động của thẻ)', dPlay > 2 && dSelf < 0.5, `clip chạy so với giữ khung đầu ${dPlay.toFixed(1)}, đối chứng ${dSelf.toFixed(1)}`);
  const shortClip = render('clip-short', only({ asset: path.relative(work, clipFile).replace(/\\/g, '/'), kind: 'video', userProvided: true, clipStart: 7.5 }), [tA]);
  check('clip chạy thật: clip ngắn hơn cửa sổ giữ khung cuối, không lặp', shortClip.r.status === 0 && shortClip.data.showcases[0].clip.frames <= 20 && shortClip.data.showcases[0].clip.frames >= 10, shortClip.r.status === 0 ? `${shortClip.data.showcases[0].clip.frames} khung` : tail(shortClip.r));
  const lintPast = path.join(work, 'plan-clip-past.json');
  writeJson(lintPast, { ...resolved, cutaways: [{ ...resolved.cutaways[1], asset: path.relative(work, clipFile).replace(/\\/g, '/'), kind: 'video', userProvided: true, clipStart: 99 }] });
  const lp = node('plan-lint.mjs', ['--plan', lintPast, '--analysis', analysis, '--stage', 'assets']);
  check('plan-lint bắt lỗi: clipStart vượt độ dài clip', lp.status === 1 && /FAIL clipStart nằm trong clip/.test(lp.stdout), lp.status === 1 ? '' : 'không bị chặn');
  // Thẻ rộng (clip 16:9) khi hai vị trí đầu bị mặt chiếm: vị trí thứ ba không được kéo thẻ ra ngoài khung (lỗi gặp khi dựng bộ demo từ vlog ngang)
  {
    const wf = path.join(work, 'analysis-wideface');
    fs.cpSync(analysis, wf, { recursive: true });
    writeJson(path.join(wf, 'faces.json'), { coverage: 1, samples: Array.from({ length: 20 }, (_, t) => ({ t, boxes: [[0, 0.05, 0.38, 0.7]] })) });
    const fm = only({ asset: path.relative(work, clipFile).replace(/\\/g, '/'), kind: 'video', userProvided: true, clipStart: 1, entrance: 'pop' });
    const ff = path.join(work, 'plan.wideface.json');
    writeJson(ff, fm);
    const r = node('render-overlay.mjs', ['--mapped', ff, '--out', path.join(work, 'overlay-wideface'), '--analysis', wf, '--offline', '--times', String(target.oStart + 0.8)]);
    const sc = fs.existsSync(path.join(work, 'overlay-wideface', 'overlay-data.js')) ? JSON.parse(fs.readFileSync(path.join(work, 'overlay-wideface', 'overlay-data.js'), 'utf8').replace('window.OVERLAY = ', '').replace(/;\s*$/, '')).showcases : [];
    check('thẻ showcase rộng luôn nằm trong khung dù hai vị trí đầu bị mặt chiếm', r.status === 0 && sc.length === 1 && sc.every((x) => x.x >= -1e-6 && x.x + x.w <= 1 + 1e-6), r.status === 0 ? sc.map((x) => `x ${x.x.toFixed(2)} w ${x.w.toFixed(2)}`).join(', ') : tail(r));
  }
  const baseClip = path.join(work, 'base-clip.mp4');
  const clipPlanFile = path.join(work, 'edit-plan-clip.json');
  const fb = structuredClone(resolved);
  const fbTarget = fb.cutaways.find((c) => c.presentation === 'fullbleed') ?? fb.cutaways[0];
  Object.assign(fbTarget, { presentation: 'fullbleed', asset: path.relative(work, clipFile).replace(/\\/g, '/'), kind: 'video', userProvided: true, clipStart: 3 });
  writeJson(clipPlanFile, fb);
  const mappedKeepClip = fs.readFileSync(path.join(work, 'plan.mapped.json'));
  const cbClip = node('compose-base.mjs', ['--plan', clipPlanFile, '--analysis', analysis, '--out', baseClip]);
  const fbMapped = readJson(path.join(work, 'plan.mapped.json'));
  fs.writeFileSync(path.join(work, 'plan.mapped.json'), mappedKeepClip);
  const fbm = fbMapped.cutaways.find((c) => c.id === fbTarget.id);
  const grayAt = (file, t) => run('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', 'scale=64:112,format=gray', '-f', 'rawvideo', '-'], { encoding: 'buffer' }).stdout;
  const g1 = cbClip.status === 0 ? grayAt(baseClip, fbm.oStart + 0.5) : Buffer.alloc(0);
  const g2 = cbClip.status === 0 ? grayAt(baseClip, Math.min(fbm.oEnd - 0.4, fbm.oStart + 1.5)) : Buffer.alloc(0);
  let dBase = 0;
  for (let i = 0; i < Math.min(g1.length, g2.length); i++) dBase += Math.abs(g1[i] - g2[i]);
  check('clip chạy thật: cutaway phủ kín ở lớp nền cũng chạy từ clipStart (không lặp từ đầu)', cbClip.status === 0 && dBase / (g1.length || 1) > 6, cbClip.status === 0 ? `chênh lệch giữa hai khung ${(dBase / (g1.length || 1)).toFixed(1)}` : tail(cbClip));
}
// Cảnh demo (kế hoạch 51, P3): nền hoa văn, khung bo góc, zoom vùng và chú thích theo tọa độ clip; đo pixel trên khung hình thật so với tọa độ tính bằng mã
{
  const { demoLayout, demoTheme, focusList, markTrack } = await import(pathToFileURL(path.join(here, 'demo-lib.mjs')).href);
  const marker = path.join(userDir, 'marker.mp4');
  // Clip đen 640x360 có một ô màu magenta ở tọa độ chuẩn hóa (0,70; 0,30; 0,10; 0,15): vị trí đã biết để đo
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=black:s=640x360:r=30:d=8,drawbox=x=448:y=108:w=64:h=54:color=magenta:t=fill', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', marker], 'clip đánh dấu');
  const dd = path.join(work, 'demo');
  fs.mkdirSync(dd, { recursive: true });
  const target = { x: 0.7, y: 0.3, w: 0.1, h: 0.15 };
  const demoCut = { id: 'd01', start: 2, end: 10, anchorWord: 0, query: 'demo', kind: 'video', presentation: 'demo', theme: 'pastel', asset: '../user-assets/marker.mp4', userProvided: true, status: 'resolved', clipStart: 0, focus: [{ start: 4, end: 8, rect: { x: 0.6, y: 0.2, w: 0.3, h: 0.35 } }], marks: [{ type: 'underline', rect: target, start: 2.5, end: 9.5 }, { type: 'circle', rect: target, start: 4.6, end: 7.6 }] };
  const pxPlan = { ...structuredClone(resolved), cuts: [], cutaways: [demoCut], punches: [], effects: [], stats: [], decor: [], cards: [], lowerThirds: [], captions: { mode: 'off' } };
  writeJson(path.join(dd, 'edit-plan.json'), pxPlan);
  const lintDemo = node('plan-lint.mjs', ['--plan', path.join(dd, 'edit-plan.json'), '--analysis', analysis, '--stage', 'assets']);
  check('plan-lint: cảnh demo hợp lệ (chủ đề, vùng zoom, chú thích, tỉ lệ)', /PASS cảnh demo hợp lệ/.test(lintDemo.stdout) && /PASS tỉ lệ cảnh demo/.test(lintDemo.stdout), tail(lintDemo));
  const badDemo = (name, edit, expect) => {
    const p = structuredClone(pxPlan);
    edit(p.cutaways[0]);
    writeJson(path.join(dd, `neg-${name}.json`), p);
    const r = node('plan-lint.mjs', ['--plan', path.join(dd, `neg-${name}.json`), '--analysis', analysis]);
    return check(`plan-lint bắt lỗi: ${expect}`, r.status === 1 && /FAIL (cảnh demo hợp lệ|tỉ lệ cảnh demo)/.test(r.stdout), r.status === 1 ? '' : 'không bị chặn');
  };
  badDemo('theme', (c) => { c.theme = 'khong-co'; }, 'chủ đề demo không có trong data/demo-themes.json');
  badDemo('rect', (c) => { c.focus[0].rect = { x: 0.8, y: 0.2, w: 0.5, h: 0.3 }; }, 'vùng zoom nằm ngoài clip');
  badDemo('mark', (c) => { c.marks[0].type = 'star'; }, 'kiểu chú thích không hợp lệ');
  badDemo('share', (c) => { c.start = 0; c.end = 19.9; c.focus = []; c.marks = []; }, 'cảnh demo chiếm gần hết video');
  const baseDemo = path.join(dd, 'base.mp4');
  const cbd = node('compose-base.mjs', ['--plan', path.join(dd, 'edit-plan.json'), '--analysis', analysis, '--out', baseDemo]);
  check('lớp nền: dựng được cảnh demo (nền hoa văn, khung, zoom vùng)', cbd.status === 0 && fs.existsSync(baseDemo) && Math.abs(probe(baseDemo).duration - 19.9) < 0.15, tail(cbd));
  const mappedDemo = readJson(path.join(dd, 'plan.mapped.json'));
  const demo = mappedDemo.cutaways[0];
  const theme = demoTheme('pastel');
  const layout = demoLayout({ W: 1080, H: 1920, theme, clipW: 640, clipH: 360 });
  const rawAt = (file, t) => run('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' }).stdout;
  const centroid = (buf, W, pick) => { let n = 0; let sx = 0; let sy = 0; for (let i = 0; i + 2 < buf.length; i += 3) if (pick(buf[i], buf[i + 1], buf[i + 2])) { const p = i / 3; sx += p % W; sy += Math.floor(p / W); n++; } return n ? { n, x: sx / n, y: sy / n } : { n: 0, x: -1, y: -1 }; };
  const magenta = (r, g, b) => r > 170 && b > 170 && g < 100;
  const underline = demo.marks[0];
  const track = markTrack({ demo, mark: underline, layout, W: 1080, H: 1920, fps: 30 });
  let worst = 0;
  const probes = [3.0, 4.2, 6.0, 7.8].map((t) => {
    const b = track[Math.round((t - underline.oStart) * 30)];
    const got = centroid(rawAt(baseDemo, t), 1080, magenta);
    const err = b ? Math.hypot(got.x - (b[0] + b[2] / 2) * 1080, got.y - (b[1] + b[3] / 2) * 1920) : 999;
    worst = Math.max(worst, err);
    return `${t}s: ${err.toFixed(1)} px`;
  });
  check('demo: vị trí ô đánh dấu trong khung hình thật khớp tọa độ chú thích tính bằng mã (zoom 1, đang vào, đầy, đang ra)', worst < 8, `lệch tối đa ${worst.toFixed(1)} px (${probes.join('; ')})`);
  const zoomed = centroid(rawAt(baseDemo, 6.0), 1080, magenta);
  const plain = centroid(rawAt(baseDemo, 3.0), 1080, magenta);
  check('demo: zoom vùng thật sự phóng to (ô đánh dấu to gấp hơn 2 lần khi zoom đầy)', zoomed.n > plain.n * 2, `${plain.n} và ${zoomed.n} điểm ảnh`);
  const pat = rawAt(baseDemo, 3.0);
  const corner = (x, y) => [0, 1, 2].map((c) => pat[(y * 1080 + x) * 3 + c]);
  check('demo: nền hoa văn sáng pastel quanh khung (không còn hình người nói)', corner(10, 10).every((v) => v > 200) && corner(1070, 1900).every((v) => v > 200), `${corner(10, 10)} và ${corner(1070, 1900)}`);
  const ovDemo = path.join(dd, 'overlay-px');
  const tCircle = 6.0;
  const rod = node('render-overlay.mjs', ['--mapped', path.join(dd, 'plan.mapped.json'), '--out', ovDemo, '--analysis', analysis, '--offline', '--times', String(tCircle)]);
  const shot = fs.existsSync(ovDemo) ? fs.readdirSync(ovDemo).find((f) => /^test_/.test(f)) : null;
  let pink = { n: 0, x: -1, y: -1 };
  if (rod.status === 0 && shot) {
    const comp = path.join(dd, 'comp.png');
    ffmpeg(['-ss', String(tCircle), '-i', baseDemo, '-i', path.join(ovDemo, shot), '-filter_complex', '[0][1]overlay', '-frames:v', '1', comp], 'ghép khung thử');
    const raw = run('ffmpeg', ['-v', 'error', '-i', comp, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' }).stdout;
    const hits = []; for (let i = 0; i + 2 < raw.length; i += 3) if (raw[i] > 215 && raw[i + 1] > 40 && raw[i + 1] < 130 && raw[i + 2] > 90 && raw[i + 2] < 170) hits.push(i / 3); const xs = hits.map((p) => p % 1080); const ys = hits.map((p) => Math.floor(p / 1080)); pink = hits.length ? { n: hits.length, x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 } : pink;
  }
  const circleBox = markTrack({ demo, mark: demo.marks[1], layout, W: 1080, H: 1920, fps: 30 })[Math.round((tCircle - demo.marks[1].oStart) * 30)];
  const ex = circleBox ? (circleBox[0] + circleBox[2] / 2) * 1080 : -99;
  const ey = circleBox ? (circleBox[1] + circleBox[3] / 2) * 1920 : -99;
  check('demo: nét chú thích (circle) hiện đúng màu chủ đề, hộp bao của nét có tâm nằm trên vùng đích', rod.status === 0 && pink.n > 300 && Math.hypot(pink.x - ex, pink.y - ey) < 14, rod.status === 0 ? `${pink.n} điểm ảnh, lệch tâm ${Math.hypot(pink.x - ex, pink.y - ey).toFixed(1)} px` : tail(rod));
  // Dựng đủ đường ống với cảnh demo trên kế hoạch đầy đủ (caption, sticker, zoom): caption nằm dưới khung clip, audit không FAIL
  const fullPlan = { ...structuredClone(resolved), cutaways: [{ ...demoCut, asset: '../../user-assets/marker.mp4', focus: [{ start: 4, end: 8, rect: { x: 0.6, y: 0.2, w: 0.3, h: 0.35 } }] }] };
  writeJson(path.join(dd, 'full', 'edit-plan.json'), fullPlan);
  const fd = path.join(dd, 'full');
  const fdBase = path.join(fd, 'base.mp4');
  const fcb = node('compose-base.mjs', ['--plan', path.join(fd, 'edit-plan.json'), '--analysis', analysis, '--out', fdBase]);
  const fro = node('render-overlay.mjs', ['--mapped', path.join(fd, 'plan.mapped.json'), '--out', path.join(fd, 'overlay'), '--analysis', analysis, '--offline']);
  const ffin = node('finalize.mjs', ['--base', fdBase, '--overlay', path.join(fd, 'overlay'), '--mapped', path.join(fd, 'plan.mapped.json'), '--out', path.join(fd, 'out.mp4')]);
  const fau = node('audit-edit.mjs', ['--video', path.join(fd, 'out.mp4'), '--work', fd, '--analysis', analysis, '--no-asr']);
  const fsum = fs.existsSync(path.join(fd, 'overlay', 'overlay-summary.json')) ? readJson(path.join(fd, 'overlay', 'overlay-summary.json')) : null;
  const fdata = fs.existsSync(path.join(fd, 'overlay', 'overlay-data.js')) ? JSON.parse(fs.readFileSync(path.join(fd, 'overlay', 'overlay-data.js'), 'utf8').replace('window.OVERLAY = ', '').replace(/;\s*$/, '')) : null;
  check('demo: caption nằm dưới khung clip (captionY không nhỏ hơn đáy khung)', Boolean(fsum?.demos?.length && fdata) && fdata.captionY >= fsum.demos[0].y + fsum.demos[0].h - 0.001, fsum?.demos?.length ? `captionY ${fdata?.captionY}, đáy khung ${(fsum.demos[0].y + fsum.demos[0].h).toFixed(3)}` : tail(fro));
  const fullDemo = readJson(path.join(fd, 'plan.mapped.json')).cutaways[0];
  check('demo: nền pastel báo cửa sổ nền sáng để caption đổi chữ tối (chữ trắng trên pastel không đọc được)', fdata?.demoLight?.length === 1 && Math.abs(fdata.demoLight[0].s - fullDemo.oStart) < 0.01 && Math.abs(fdata.demoLight[0].e - fullDemo.oEnd) < 0.01, JSON.stringify(fdata?.demoLight ?? null));
  check('demo: đường ống đủ (nền, lớp phủ, ghép) và audit-edit không có hạng mục FAIL', fcb.status === 0 && fro.status === 0 && ffin.status === 0 && fau.status === 0, fau.status === 0 ? '' : (fcb.status !== 0 ? tail(fcb) : fro.status !== 0 ? tail(fro) : ffin.status !== 0 ? tail(ffin) : fau.stdout.split('\n').filter((l) => l.startsWith('FAIL')).join(' | ')));
  check('audit-edit: có kiểm tỉ lệ cảnh demo và caption không đè khung clip', /PASS tỉ lệ cảnh demo/.test(fau.stdout) && /PASS caption không đè khung clip của cảnh demo/.test(fau.stdout), tail(fau));
}
// Thẻ chips, headline, textspam và biến thể title (kicker, highlight, plate) (kế hoạch 51, P4): lint, vị trí, thời điểm, pixel
{
  const cd = path.join(work, 'cards');
  const wi = (re) => words.findIndex((w) => re.test(w.text));
  const bare = (t) => t.replace(/[^\p{L}\p{N}\s]/gu, '');
  const iToday = wi(/today/i);
  const iRoast = wi(/roasting/i);
  const iGood = wi(/^good$/i);
  const iEnjoy = wi(/enjoy/i);
  check('P4: tìm được các từ mốc trong phiên âm (today, roasting, good, enjoy)', [iToday, iRoast, iGood, iEnjoy].every((i) => i >= 0), `${iToday},${iRoast},${iGood},${iEnjoy}`);
  const t0 = (i) => words[i].start;
  const cards = [
    { id: 't1', type: 'title', start: t0(iToday), end: t0(iToday) + 3, anchorWord: iToday, text: 'Today I want to talk about coffee', sub: '', kicker: bare(words[iRoast].text), highlight: ['coffee'], plate: true },
    { id: 'h1', type: 'headline', start: t0(iRoast), end: t0(iRoast) + 3, anchorWord: iRoast, lines: [0, 3, 6].map((k) => words.slice(iRoast + k, iRoast + k + 3).map((w) => w.text).join(' ')) },
    { id: 'k1', type: 'chips', start: t0(iGood) - 0.3, end: t0(iGood) + 3, anchorWord: iGood, title: bare(words[iGood + 1].text), items: [iGood, iGood + 2, iGood + 3].map((i) => ({ label: bare(words[i].text), anchorWord: i })) },
    { id: 's1', type: 'textspam', start: t0(iEnjoy) - 0.2, end: Math.min(t0(iEnjoy) + 2.6, 19.8), anchorWord: iEnjoy, text: bare(words[iEnjoy].text), count: 8, coverFace: true }
  ];
  const cardPlan = { ...structuredClone(resolved), cuts: [], cutaways: [], punches: [], effects: [], stats: [], decor: [], lowerThirds: [], captions: { mode: 'off' }, cards };
  const cpFile = path.join(cd, 'edit-plan.json');
  writeJson(cpFile, cardPlan);
  const lintCards = node('plan-lint.mjs', ['--plan', cpFile, '--analysis', analysis]);
  check('plan-lint: thẻ title (kicker, highlight, plate), headline, chips, textspam hợp lệ và chữ có trong lời nói', /PASS thẻ headline hợp lệ: 4 thẻ/.test(lintCards.stdout) && /PASS chữ trên thẻ mới có trong lời nói/.test(lintCards.stdout), tail(lintCards));
  const badCard = (name, edit, expect, rule) => {
    const p = structuredClone(cardPlan);
    edit(p.cards);
    writeJson(path.join(cd, `neg-${name}.json`), p);
    const r = node('plan-lint.mjs', ['--plan', path.join(cd, `neg-${name}.json`), '--analysis', analysis]);
    return check(`plan-lint bắt lỗi: ${expect}`, r.status === 1 && r.stdout.includes(`FAIL ${rule}`), r.status === 1 ? '' : 'không bị chặn');
  };
  badCard('kicker', (c) => { c[0].kicker = 'Zanzibar'; }, 'kicker không có trong lời nói', 'chữ trên thẻ mới');
  badCard('chips', (c) => { c[2].items = []; }, 'thẻ chips không có mục', 'thẻ headline hợp lệ');
  badCard('spam', (c) => { c[3].count = 99; }, 'textspam quá số lượng cho phép', 'thẻ headline hợp lệ');
  badCard('highlight', (c) => { c[0].highlight = ['khong-co']; }, 'highlight không nằm trong chữ của title', 'thẻ headline hợp lệ');
  const cb = node('compose-base.mjs', ['--plan', cpFile, '--analysis', analysis, '--out', path.join(cd, 'base.mp4')]);
  const mc = cb.status === 0 ? readJson(path.join(cd, 'plan.mapped.json')) : null;
  const shootAt = (name, m, times) => {
    const f = path.join(cd, `plan.${name}.json`);
    writeJson(f, m);
    const dir = path.join(cd, `overlay-${name}`);
    const r = node('render-overlay.mjs', ['--mapped', f, '--out', dir, '--analysis', analysis, '--offline', '--times', times.join(',')]);
    const data = fs.existsSync(path.join(dir, 'overlay-data.js')) ? JSON.parse(fs.readFileSync(path.join(dir, 'overlay-data.js'), 'utf8').replace('window.OVERLAY = ', '').replace(/;\s*$/, '')) : null;
    return { r, dir, data, shots: fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => /^test_/.test(x)).sort().map((x) => path.join(dir, x)) : [] };
  };
  const tTitle = cards[0].start + 1.5;
  const tHead = cards[1].start + 1.5;
  const tChip = cards[2].end - 0.3;
  const tSpam = cards[3].end - 0.6;
  const rc = mc ? shootAt('cards', mc, [tTitle, tHead, tChip, tSpam]) : { r: cb, data: null, shots: [] };
  const byId = Object.fromEntries((rc.data?.cards ?? []).map((c) => [c.id, c]));
  check('thẻ mới: cả bốn thẻ được dựng vào lớp phủ, khung thử có nội dung', rc.r.status === 0 && ['t1', 'h1', 'k1', 's1'].every((id) => byId[id]) && rc.shots.length === 4 && rc.shots.every((f) => fs.statSync(f).size > fs.statSync(path.join(rc.dir, 'blank.png')).size * 1.5), rc.r.status === 0 ? Object.keys(byId).join(',') : tail(rc.r));
  check('headline: nằm ở nửa dưới khung (quét chỗ trống từ dưới lên)', Boolean(byId.h1) && byId.h1.y > 0.35, `y ${byId.h1?.y?.toFixed(2)}`);
  const anchored = (byId.k1?.items ?? []).map((it, k) => [it.s, mc?.wordsOut.find((w) => w.i === cards[2].items[k].anchorWord)?.oStart]);
  check('chips: mỗi chip hiện đúng lúc từ neo được nói', anchored.length === 3 && anchored.every(([a, b]) => Number.isFinite(b) && Math.abs(a - Math.max(b, byId.k1.s)) < 0.002), anchored.map(([a, b]) => `${a?.toFixed(2)}/${b?.toFixed(2)}`).join(' '));
  const face = readJson(path.join(analysis, 'faces.json')).samples[0].boxes[0];
  const hitFace = (b) => b.x < face[0] + face[2] && b.x + b.w > face[0] && b.y < face[1] + face[3] && b.y + b.h > face[1];
  check('textspam coverFace: có bản sao đè mặt ở các bản sau (late), bản đầu tránh mặt', byId.s1 && byId.s1.copies.some((c) => c.late) && byId.s1.copies.filter((c) => !c.late).every((c) => !hitFace(c)), byId.s1 ? `${byId.s1.copies.length} bản, ${byId.s1.copies.filter((c) => c.late).length} bản late` : '');
  const mNo = structuredClone(mc ?? { cards: [] });
  const spamNo = mNo.cards?.find((c) => c.id === 's1');
  if (spamNo) spamNo.coverFace = false;
  const rn = mc ? shootAt('cards-nocover', mNo, [tSpam]) : { r: cb, data: null };
  const sNo = rn.data?.cards?.find((c) => c.id === 's1');
  check('textspam không coverFace: mọi bản sao đều tránh mặt', Boolean(sNo) && sNo.copies.length >= 3 && sNo.copies.every((c) => !c.late && !hitFace(c)), sNo ? `${sNo.copies.length} bản` : tail(rn.r));
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const accent = hex(rc.data?.style?.colors?.accent ?? '#000000');
  const rgba = rc.shots[0] ? run('ffmpeg', ['-v', 'error', '-i', rc.shots[0], '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'], { encoding: 'buffer' }).stdout : Buffer.alloc(0);
  let accentPx = 0;
  let platePx = 0;
  const t1 = byId.t1;
  if (t1) for (let yy = Math.floor(t1.y * 1920); yy < Math.ceil((t1.y + t1.h) * 1920); yy++) for (let xx = Math.floor(t1.x * 1080); xx < Math.ceil((t1.x + t1.w) * 1080); xx++) {
    const o = (yy * 1080 + xx) * 4;
    if (rgba[o + 3] > 200 && accent.every((v, k) => Math.abs(rgba[o + k] - v) < 30)) accentPx++;
    if (rgba[o + 3] > 150 && rgba[o + 3] < 255) platePx++;
  }
  check('title: kicker và highlight hiện bằng màu nhấn, nền thẻ (plate) bán trong suốt', accentPx > 150 && platePx > 2000, `${accentPx} điểm ảnh màu nhấn, ${platePx} điểm ảnh nền thẻ`);
}
// Phong cách creator, footage riêng của người dùng, cổng chất lượng truy vấn và cấm chồng vật thể lớn (kế hoạch 51, P5)
{
  const pd = path.join(work, 'p5');
  const fdir = path.join(pd, 'footage');
  fs.mkdirSync(fdir, { recursive: true });
  fs.copyFileSync(path.join(userDir, 'marker.mp4'), path.join(fdir, 'screen.mp4'));
  writeJson(path.join(fdir, 'footage.json'), { files: [{ file: 'screen.mp4', description: 'screen recording of the roasting steps', keywords: ['roasting', 'beans'], demo: true, theme: 'pastel', clipStart: 0, clipSpeed: 2 }] });
  const planFootage = path.join(pd, 'edit-plan.json');
  const sf = node('plan-skeleton.mjs', ['--analysis', analysis, '--user-footage', fdir, '--out', planFootage]);
  const pf = fs.existsSync(planFootage) ? readJson(planFootage) : { cutaways: [], beats: [] };
  const demoCut = pf.cutaways.find((c) => c.presentation === 'demo');
  check('plan-skeleton --user-footage: không nêu --style thì dùng creator, footage khớp từ khóa thành cảnh demo của người dùng', sf.status === 0 && pf.style === 'creator' && demoCut?.userProvided === true && fs.existsSync(path.resolve(pd, demoCut.asset)) && demoCut.clipSpeed === 2, sf.status === 0 ? `${pf.style}, demo ${demoCut?.start?.toFixed(1)}-${demoCut?.end?.toFixed(1)}s` : tail(sf));
  check('cảnh demo chừa nhịp mở đầu (hook) và nhịp kết (cta) cho người nói', Boolean(demoCut) && demoCut.start >= pf.beats[1].start - 0.01 && demoCut.end <= pf.beats.at(-1).start + 0.01, demoCut ? `${demoCut.start.toFixed(1)}s đến ${demoCut.end.toFixed(1)}s, hook kết thúc ${pf.beats[0].end.toFixed(1)}s, cta bắt đầu ${pf.beats.at(-1).start.toFixed(1)}s` : '');
  const lintF = node('plan-lint.mjs', ['--plan', planFootage, '--analysis', analysis]);
  check('plan-lint: kế hoạch có cảnh demo từ footage riêng đạt (demo hợp lệ, không chồng vật thể lớn, không khoảng trống hình)', /PASS cảnh demo hợp lệ/.test(lintF.stdout) && /PASS không chồng hai vật thể lớn/.test(lintF.stdout) && /PASS khoảng trống sự kiện hình/.test(lintF.stdout), tail(lintF));
  const creatorPlan = readJson(path.join(work, 'plan-creator.json'));
  const fxLib = loadLibrary();
  const ownFx = (creatorPlan.effects ?? []).filter((x) => !x.look);
  check('creator: ngân sách hiệu ứng thấp (không cú mạnh, không whoosh)', ownFx.every((x) => fxLib.byId.get(x.effect).intensity < 3) && (creatorPlan.sfx ?? []).every((x) => x.type !== 'whoosh') && creatorPlan.captions.preset === 'minimal', `${ownFx.length} hiệu ứng, ${creatorPlan.decor.length} sticker`);
  // Cổng chất lượng truy vấn: lời nói toàn từ trừu tượng thì bỏ cutaway thay vì tìm ảnh sai
  const ad = path.join(pd, 'analysis-abstract');
  fs.cpSync(analysis, ad, { recursive: true });
  const wj = readJson(path.join(ad, 'words.json'));
  wj.words.forEach((w) => { if (w.text.replace(/[^\p{L}]/gu, '').length >= 5) w.text = 'animation'; });
  writeJson(path.join(ad, 'words.json'), wj);
  const planAbs = path.join(pd, 'plan-abstract.json');
  const sa = node('plan-skeleton.mjs', ['--analysis', ad, '--style', 'hype', '--out', planAbs]);
  const pa = fs.existsSync(planAbs) ? readJson(planAbs) : { cutaways: [{ query: '?' }] };
  check('plan-skeleton: bỏ cutaway có truy vấn trừu tượng thay vì tìm ảnh sai, và báo ra', sa.status === 0 && pa.cutaways.every((c) => !/animation|effect|agent|comment/.test(c.query)) && /Bỏ \d+ cutaway vì truy vấn ảnh không đủ cụ thể/.test(sa.stdout), `${pa.cutaways.length} cutaway còn lại`);
  // Cấm chồng vật thể lớn: thẻ số trong cửa sổ cutaway phủ kín
  const iTw = words.findIndex((w) => /^12$/.test(w.text));
  const clash = { ...structuredClone(pf), cutaways: [{ id: 'c01', start: words[iTw].start - 0.4, end: words[iTw].end + 1.2, anchorWord: iTw, query: 'coffee roasting', kind: 'auto', presentation: 'fullbleed', fit: 'fill', zoom: 'push-in', asset: null, status: 'pending' }], stats: [{ id: 's1', anchorWord: iTw, value: '12', label: '', start: words[iTw].start, end: words[iTw].start + 1.5 }] };
  writeJson(path.join(pd, 'plan-clash.json'), clash);
  const lc = node('plan-lint.mjs', ['--plan', path.join(pd, 'plan-clash.json'), '--analysis', analysis]);
  check('plan-lint bắt lỗi: thẻ số chồng cửa sổ cutaway phủ kín', lc.status === 1 && /FAIL không chồng hai vật thể lớn/.test(lc.stdout), lc.status === 1 ? '' : 'không bị chặn');
}
// Đoạn --keep nằm gọn trong một nhịp liền mạch (video ngắn cắt từ vlog): biên --keep phải cắt nhịp, không được loại hết nhịp rồi sập;
// lời tiếng Việt toàn âm tiết 4 chữ vẫn có từ khóa để gắn sticker, và một sticker trong video ngắn không bị trần mật độ chặn
{
  const ke = path.join(work, 'analysis-keepedge');
  fs.cpSync(analysis, ke, { recursive: true });
  const wk = readJson(path.join(ke, 'words.json'));
  const vi = ['xinh', 'dáng', 'trời', 'cảnh'];
  wk.language = 'vi';
  wk.words = wk.words.map((w, i) => ({ ...w, text: vi[i % vi.length], start: i * 0.4, end: i * 0.4 + 0.35 }));
  writeJson(path.join(ke, 'words.json'), wk);
  const kePlan = path.join(work, 'plan-keepedge.json');
  const ks = node('plan-skeleton.mjs', ['--analysis', ke, '--style', 'hype', '--keep', '2.0-11.2', '--out', kePlan]);
  const kd = fs.existsSync(kePlan) ? readJson(kePlan) : { beats: [], decor: [] };
  check('plan-skeleton --keep: đoạn giữ nằm gọn trong một nhịp liền mạch vẫn ra nhịp (không sập)', ks.status === 0 && kd.beats.length >= 1, ks.status === 0 ? `${kd.beats.length} nhịp` : tail(ks));
  check('plan-skeleton: lời tiếng Việt âm tiết 4 chữ có từ khóa nên có sticker', kd.decor.length >= 1, `${kd.decor.length} sticker`);
  const kl = node('plan-lint.mjs', ['--plan', kePlan, '--analysis', ke]);
  check('plan-lint: video ngắn có một sticker không bị trần mật độ chặn', !/FAIL mật độ sticker/.test(kl.stdout), kl.stdout.split('\n').find((l) => /mật độ sticker/.test(l)) ?? '');
}
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
