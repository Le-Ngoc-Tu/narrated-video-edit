// Chuẩn bị môi trường một lần: kiểm Node, ffmpeg, Chrome; tạo .venv Python cô lập với faster-whisper và opencv.
// Chạy: node setup.mjs [--skip-python] [--with-segmentation]   (đặt NVE_PYTHON để dùng sẵn một Python đã cài faster-whisper và opencv)
import fs from 'node:fs';
import path from 'node:path';
import { args, pythonPath, run, segPythonPath, skillRoot } from './common.mjs';

const { flags } = args();
const problems = [];
const ok = (msg) => console.log(`ok   ${msg}`);
const bad = (msg) => { problems.push(msg); console.log(`LỖI ${msg}`); };

const node = Number(process.versions.node.split('.')[0]);
if (node >= 20) ok(`Node ${process.versions.node}`); else bad(`cần Node 20 trở lên, đang có ${process.versions.node}`);
for (const tool of ['ffmpeg', 'ffprobe']) {
  const r = run(tool, ['-version']);
  if (r.status === 0) ok(r.stdout.split('\n')[0]); else bad(`thiếu ${tool} trong PATH`);
}
if (fs.existsSync(path.join(skillRoot, 'scripts', 'node_modules', 'playwright-core'))) ok('playwright-core đã cài'); else bad('chạy "npm install" trong thư mục scripts');
if (!process.env.CHROME_PATH) console.log('ghi chú: không đặt CHROME_PATH, dùng Google Chrome cài sẵn (channel chrome)');

if (!flags['skip-python']) {
  let python = pythonPath();
  const venvDir = path.join(skillRoot, '.venv');
  if (!process.env.NVE_PYTHON && !fs.existsSync(venvDir)) {
    const uv = run('uv', ['--version']);
    const created = uv.status === 0 ? run('uv', ['venv', venvDir, '--python', '3.11', '-q']) : run('python', ['-m', 'venv', venvDir]);
    if (created.status !== 0) bad(`không tạo được .venv: ${created.stderr.trim().slice(-200)}`);
    python = pythonPath();
    const install = uv.status === 0
      ? run('uv', ['pip', 'install', '-q', '--python', python, 'faster-whisper', 'opencv-python-headless<5'])
      : run(python, ['-m', 'pip', 'install', '-q', 'faster-whisper', 'opencv-python-headless<5']);
    if (install.status !== 0) bad(`cài gói Python lỗi: ${install.stderr.trim().slice(-300)}`);
  }
  const check = run(python, ['-c', 'import faster_whisper, cv2, sys; assert hasattr(cv2, "FaceDetectorYN") or hasattr(cv2, "CascadeClassifier"); print(sys.version.split()[0])'], { env: { ...process.env, PYTHONUTF8: '1' } });
  if (check.status === 0) ok(`Python ${check.stdout.trim()} có faster-whisper và opencv (${python})`); else bad(`Python ${python} thiếu faster-whisper hoặc opencv-python-headless`);
}
// Tùy chọn: môi trường riêng cho tách người (chữ đặt sau người nói). mediapipe kéo theo OpenCV bản mới và khoảng 300 MB nên tách khỏi .venv chính
if (flags['with-segmentation']) {
  const segDir = path.join(skillRoot, '.venv-seg');
  if (!process.env.NVE_SEG_PYTHON && !fs.existsSync(segDir)) {
    const uv = run('uv', ['--version']);
    const created = uv.status === 0 ? run('uv', ['venv', segDir, '--python', '3.11', '-q']) : run('python', ['-m', 'venv', segDir]);
    if (created.status !== 0) bad(`không tạo được .venv-seg: ${created.stderr.trim().slice(-200)}`);
    const segPy = segPythonPath();
    const install = segPy && (uv.status === 0 ? run('uv', ['pip', 'install', '-q', '--python', segPy, 'mediapipe']) : run(segPy, ['-m', 'pip', 'install', '-q', 'mediapipe']));
    if (install && install.status !== 0) bad(`cài mediapipe lỗi: ${install.stderr.trim().slice(-300)}`);
  }
  const segPy = segPythonPath();
  const check = segPy ? run(segPy, ['-c', 'import mediapipe, cv2; from mediapipe.tasks.python import vision; assert hasattr(vision, "ImageSegmenter"); print(mediapipe.__version__)'], { env: { ...process.env, PYTHONUTF8: '1' } }) : { status: 1, stderr: 'chưa có môi trường' };
  check.status === 0 ? ok(`tách người: mediapipe ${check.stdout.trim()} (${segPy})`) : bad(`môi trường tách người chưa dùng được: ${String(check.stderr).trim().slice(-200)}`);
}
console.log(problems.length ? `\n${problems.length} vấn đề cần xử lý` : '\nMôi trường sẵn sàng');
process.exit(problems.length ? 1 : 0);
