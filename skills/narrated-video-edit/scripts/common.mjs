// Tiện ích dùng chung: đọc đối số, ffmpeg và ffprobe, mở Chrome, bản đồ thời gian khi cắt khoảng lặng, ghi JSON.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const skillRoot = path.resolve(here, '..');
export const FPS = 30;

export function args(argv = process.argv.slice(2)) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) flags[argv[i].slice(2)] = true; else { flags[argv[i].slice(2)] = next; i++; }
    } else positional.push(argv[i]);
  }
  return { flags, positional };
}

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

/** Chạy một lệnh, trả { status, stdout, stderr }; không ném lỗi. */
export function run(cmd, cmdArgs, options = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error };
}

/** Chạy ffmpeg, ném lỗi kèm đoạn cuối của stderr nếu thoát khác 0. */
export function ffmpeg(ffArgs, label = 'ffmpeg') {
  const r = run('ffmpeg', ['-v', 'error', '-y', ...ffArgs]);
  if (r.status !== 0) throw new Error(`${label} lỗi (mã ${r.status}): ${r.stderr.split('\n').slice(-8).join('\n')}`);
  return r;
}

export function probe(file) {
  const r = run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  if (r.status !== 0) throw new Error(`ffprobe không đọc được ${file}: ${r.stderr.trim()}`);
  const info = JSON.parse(r.stdout);
  const video = info.streams.find((s) => s.codec_type === 'video');
  const audio = info.streams.find((s) => s.codec_type === 'audio');
  const [num, den] = (video?.r_frame_rate ?? '30/1').split('/').map(Number);
  return { duration: Number(info.format.duration), width: video?.width, height: video?.height, fps: num / (den || 1), hasAudio: Boolean(audio), rotation: Number(video?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0) };
}

export async function loadPlaywright() {
  try { return await import('playwright-core'); } catch {
    const fallback = process.env.PLAYWRIGHT_CORE;
    if (!fallback) throw new Error('Thiếu playwright-core. Chạy "npm install" trong thư mục scripts của skill.');
    return createRequire(path.join(fallback, 'package.json'))('playwright-core');
  }
}

export async function launchChrome() {
  const playwright = await loadPlaywright();
  const { chromium } = playwright.chromium ? playwright : playwright.default;
  const executablePath = process.env.CHROME_PATH;
  return chromium.launch(executablePath ? { executablePath, headless: true } : { channel: 'chrome', headless: true });
}

/**
 * Bản đồ thời gian khi cắt các đoạn "cuts" (giây trong video gốc). Hàm trả giờ trong video đã cắt,
 * hoặc null khi mốc nằm trong đoạn bị cắt. Lớp phủ, B-roll và âm thanh đều dùng chung bản đồ này.
 */
export function makeTimeMap(cuts = []) {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  const keep = [];
  let cursor = 0;
  for (const c of sorted) {
    if (c.start > cursor) keep.push([cursor, c.start]);
    cursor = Math.max(cursor, c.end);
  }
  keep.push([cursor, Infinity]);
  const toOut = (t) => {
    let acc = 0;
    for (const [a, b] of keep) {
      if (t >= a && t < b) return acc + (t - a);
      acc += b - a;
    }
    return null;
  };
  /** Ngược lại: giờ trong video đã cắt về giờ trong video gốc. */
  const toSrc = (o) => {
    let acc = 0;
    for (const [a, b] of keep) {
      const len = b - a;
      if (o < acc + len) return a + (o - acc);
      acc += len;
    }
    return keep.at(-1)[0] + (o - acc);
  };
  return { keep, toOut, toSrc, outDuration: (total) => keep.reduce((s, [a, b]) => s + (Math.min(b, total) - a), 0) };
}

export const fmt = (n, d = 2) => Number(n).toFixed(d);
export const pad = (n, w = 4) => String(n).padStart(w, '0');

/** Đường dẫn Python của môi trường phiên âm: biến NVE_PYTHON, rồi .venv của skill, rồi python hệ thống. */
/** Python của môi trường tách người (.venv-seg, tạo bằng "node setup.mjs --with-segmentation"), hoặc null nếu chưa có. NVE_SEG_PYTHON ghi đè. */
export function segPythonPath() {
  if (process.env.NVE_SEG_PYTHON) return process.env.NVE_SEG_PYTHON;
  const venv = path.join(skillRoot, '.venv-seg', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  return fs.existsSync(venv) ? venv : null;
}

export function pythonPath() {
  if (process.env.NVE_PYTHON) return process.env.NVE_PYTHON;
  const venv = path.join(skillRoot, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  return fs.existsSync(venv) ? venv : 'python';
}
