// Dùng thư viện hiệu ứng từ dòng lệnh: xem danh sách, xem chi tiết, kiểm lược đồ, áp dụng một hiệu ứng lên video, sinh tiếng, sinh mục lục.
// node fx-apply.mjs list [--family camera] [--engine video] [--style hype]
// node fx-apply.mjs show <id>
// node fx-apply.mjs validate
// node fx-apply.mjs apply --in clip.mp4 --effect crash-zoom --at 1.0 [--dur 0.9] [--param amount=0.4 ...] [--fx 0.5 --fy 0.35] [--mask mask.mkv] [--lossless] --out out.mp4
// node fx-apply.mjs sound --effect whoosh [--dur 0.4] --out whoosh.wav
// node fx-apply.mjs filters                       kiểm ffmpeg của máy có đủ bộ lọc cho mọi hiệu ứng (mã thoát 1 nếu thiếu)
// node fx-apply.mjs catalog --out references/12-effects-catalog.md
import fs from 'node:fs';
import path from 'node:path';
import { args, ffmpeg, probe } from './common.mjs';
import { audioRecipe, loadLibrary, makeCtx, snapWindow, usedFilters, validateEffect, videoStage } from './fx-lib.mjs';
import { run } from './common.mjs';

const { flags, positional } = args();
const lib = loadLibrary();
const cmd = positional[0];
const need = (v, msg) => { if (v === undefined || v === true) { console.error(msg); process.exit(2); } return v; };
const pick = (id) => { const e = lib.byId.get(id); if (!e) { console.error(`Không có hiệu ứng "${id}". Chạy: node fx-apply.mjs list`); process.exit(2); } return e; };
const parseParams = () => {
  const raw = [flags.param].flat().filter(Boolean);
  const extra = process.argv.slice(2).flatMap((a, i, all) => (a === '--param' ? [all[i + 1]] : []));
  return Object.fromEntries([...new Set([...raw, ...extra])].filter((s) => typeof s === 'string' && s.includes('=')).map((s) => { const [k, ...v] = s.split('='); const val = v.join('='); return [k, /^-?d+(.d+)?$/.test(val) ? Number(val) : val]; }));
};

if (cmd === 'list') {
  const rows = lib.effects.filter((e) => (!flags.family || e.family === flags.family) && (!flags.engine || e.engine === flags.engine) && (!flags.style || e.styles[flags.style] !== 'avoid'));
  for (const e of rows) console.log(`${e.id.padEnd(26)} ${e.family.padEnd(11)} ${e.engine.padEnd(8)} ${e.purpose.padEnd(10)} ${e.name.vi}`);
  console.log(`\n${rows.length} hiệu ứng${flags.family ? ` họ ${flags.family}` : ''} (tổng thư viện ${lib.effects.length})`);
} else if (cmd === 'show') {
  console.log(JSON.stringify(pick(need(positional[1], 'Dùng: show <id>')), null, 2));
} else if (cmd === 'validate') {
  const errs = lib.effects.flatMap((e) => validateEffect(e, lib));
  const ids = new Set();
  lib.effects.forEach((e) => { if (ids.has(e.id)) errs.push(`${e.id}: trùng id giữa các tệp`); ids.add(e.id); });
  errs.forEach((m) => console.log(`LỖI ${m}`));
  console.log(errs.length ? `\n${errs.length} lỗi lược đồ` : `Lược đồ đạt: ${lib.effects.length} hiệu ứng, ${Object.keys(lib.dsl.families).length} họ`);
  process.exit(errs.length ? 1 : 0);
} else if (cmd === 'apply') {
  const e = pick(need(flags.effect, 'Thiếu --effect'));
  if (!['video', 'mask'].includes(e.engine)) { console.error(`Hiệu ứng ${e.id} thuộc engine ${e.engine}, không áp dụng lên video bằng lệnh apply.`); process.exit(2); }
  const input = path.resolve(need(flags.in, 'Thiếu --in'));
  const out = path.resolve(need(flags.out, 'Thiếu --out'));
  const info = probe(input);
  const fps = Math.round(info.fps) || 30;
  const totalFrames = Math.round(info.duration * fps);
  const win = snapWindow(Number(need(flags.at, 'Thiếu --at (giây)')), Number(flags.at) + Number(flags.dur ?? e.dur.default), fps, totalFrames);
  const ctx = makeCtx({ W: info.width, H: info.height, fps, fx: flags.fx !== undefined ? Number(flags.fx) : 0.5, fy: flags.fy !== undefined ? Number(flags.fy) : 0.35 });
  const inputs = ['-i', input];
  const pre = [`[0:v]fps=${fps},setsar=1[src]`];
  if (e.engine === 'mask') { inputs.push('-i', path.resolve(need(flags.mask, `${e.id} cần --mask (mặt nạ người)`))); pre.push(`[1:v]scale=${info.width}:${info.height},fps=${fps},format=gray[msk]`); }
  const stage = videoStage(e, { params: parseParams(), ctx, ...win, n0: win.n0, n1: win.n1, totalFrames, fps, tag: 'e0', input: 'src', output: 'vout', maskInput: e.engine === 'mask' ? 'msk' : undefined }, lib.dsl);
  const script = path.join(path.dirname(out), `.fx-${path.basename(out)}.txt`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(script, [...pre, ...stage].join(';\n'));
  const codec = flags.lossless ? ['-c:v', 'ffv1'] : ['-c:v', 'libx264', '-crf', '16', '-preset', 'fast'];
  ffmpeg([...inputs, '-/filter_complex', script, '-map', '[vout]', ...(info.hasAudio && !flags.lossless ? ['-map', '0:a', '-c:a', 'copy'] : []), ...codec, '-pix_fmt', 'yuv420p', '-r', String(fps), out], `hiệu ứng ${e.id}`);
  if (!flags.keep) fs.rmSync(script, { force: true });
  console.log(`Đã ghi ${out}: ${e.id} từ ${win.t0.toFixed(2)}s đến ${win.t1.toFixed(2)}s`);
} else if (cmd === 'sound') {
  const e = pick(need(flags.effect, 'Thiếu --effect'));
  if (e.engine !== 'audio') { console.error(`${e.id} không phải hiệu ứng âm thanh`); process.exit(2); }
  const out = path.resolve(need(flags.out, 'Thiếu --out'));
  const r = audioRecipe(e, { params: parseParams(), ctx: makeCtx({ W: 1080, H: 1920 }), dur: flags.dur ? Number(flags.dur) : undefined }, lib.dsl);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  ffmpeg(['-f', 'lavfi', '-i', r.input, ...(r.post ? ['-af', r.post] : []), '-ar', '48000', '-ac', '2', '-t', String(r.dur), out], `tiếng ${e.id}`);
  console.log(`Đã ghi ${out} (${r.dur}s)`);
} else if (cmd === 'filters') {
  const r = run('ffmpeg', ['-hide_banner', '-filters']);
  if (r.status !== 0) { console.error('Không chạy được ffmpeg -filters (ffmpeg có trong PATH không?)'); process.exit(2); }
  const have = new Set([...r.stdout.matchAll(/^\s*[TSC.]{2,3}\s+(\S+)\s/gm)].map((m) => m[1]));
  const missing = lib.effects.filter((e) => e.engine !== 'overlay').map((e) => ({ id: e.id, lacking: usedFilters(e).filter((f) => !have.has(f)) })).filter((x) => x.lacking.length);
  missing.forEach((x) => console.log(`THIẾU ${x.id}: ${x.lacking.join(', ')}`));
  const all = [...new Set(missing.flatMap((x) => x.lacking))];
  console.log(missing.length ? `
${missing.length} hiệu ứng thiếu bộ lọc (${all.join(', ')}): cài bản ffmpeg đầy đủ (Windows: winget install Gyan.FFmpeg)` : `ffmpeg có đủ bộ lọc cho ${lib.effects.filter((e) => e.engine !== 'overlay').length} hiệu ứng`);
  process.exit(missing.length ? 1 : 0);
} else if (cmd === 'catalog') {
  const out = path.resolve(need(flags.out, 'Thiếu --out'));
  const L = [];
  L.push('# 12. Danh mục hiệu ứng (tự sinh từ data/effects, đừng sửa tay)', '');
  L.push(`Tạo bằng: node scripts/fx-apply.mjs catalog --out references/12-effects-catalog.md. Tổng ${lib.effects.length} hiệu ứng. Cách chọn và dùng: xem 12-effects.md.`, '');
  for (const [fam, desc] of Object.entries(lib.dsl.families)) {
    const rows = lib.effects.filter((e) => e.family === fam);
    if (!rows.length) continue;
    L.push(`## ${fam}: ${desc} (${rows.length})`, '', '| id | tên | engine | mục đích | hype | explainer | documentary | tham số chính | lỗi hay gặp |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const e of rows) {
      const ps = Object.entries(e.params ?? {}).map(([k, s]) => (s.type === 'choice' ? `${k}=${s.default}` : s.type === 'text' ? k : `${k}=${s.default}${s.unit ?? ''}`)).join(', ');
      L.push(`| \`${e.id}\` | ${e.name.vi} | ${e.engine} | ${e.purpose} | ${e.styles.hype} | ${e.styles.explainer} | ${e.styles.documentary} | ${ps || '-'} | ${(e.pitfalls?.[0] ?? '').replace(/\|/g, '/')} |`);
    }
    L.push('');
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${L.join('\n')}\n`);
  console.log(`Đã ghi ${out}: ${lib.effects.length} hiệu ứng`);
} else {
  console.error('Dùng: node fx-apply.mjs list|show|validate|apply|sound|catalog (xem đầu tệp)');
  process.exit(2);
}
