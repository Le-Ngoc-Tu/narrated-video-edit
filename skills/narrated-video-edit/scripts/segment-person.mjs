// Khâu D3 (chỉ khi có thẻ đặt SAU người nói: bigtext, orbit, wall): tách người khỏi nền trong các khoảng có chữ đó, ghi overlay/mask.mkv và mask-stats.json.
// Chạy: node segment-person.mjs --base work/base.mp4 --overlay work/overlay
// Cần môi trường tách người: node setup.mjs --with-segmentation (mediapipe, mô hình Apache-2.0 gói sẵn). Chỉ tách người khỏi nền, không nhận dạng danh tính.
import path from 'node:path';
import { args, here, readJson, run, segPythonPath } from './common.mjs';

const { flags } = args();
if (!flags.base || !flags.overlay) { console.error('Dùng: node segment-person.mjs --base work/base.mp4 --overlay work/overlay'); process.exit(2); }
const overlay = path.resolve(String(flags.overlay));
const summary = readJson(path.join(overlay, 'overlay-summary.json'));
const windows = summary.behindWindows ?? [];
if (!windows.length) { console.log('Không có chữ đặt sau người nói: không cần mặt nạ.'); process.exit(0); }
const py = segPythonPath();
if (!py) { console.error('Chưa có môi trường tách người. Chạy: node setup.mjs --with-segmentation (hoặc đặt behind:false cho thẻ bigtext để chữ nằm phía trước).'); process.exit(1); }
// Đệm 0,15s hai đầu cho các khoảng chữ vào và ra
const ranges = windows.map((w) => `${Math.max(0, w.s - 0.15).toFixed(2)}-${(w.e + 0.15).toFixed(2)}`).join(',');
const r = run(py, [path.join(here, 'segment.py'), path.resolve(String(flags.base)), '--out', path.join(overlay, 'mask.mkv'), '--ranges', ranges, '--stats', path.join(overlay, 'mask-stats.json')], { env: { ...process.env, PYTHONUTF8: '1' } });
if (r.status !== 0) { console.error(`Tách người lỗi: ${(r.stderr || r.stdout).trim().split('\n').slice(-4).join(' | ')}`); process.exit(1); }
console.log(r.stdout.trim().split('\n').filter((l) => !/^(W0|I0|WARNING)/.test(l)).join('\n'));
const stats = readJson(path.join(overlay, 'mask-stats.json'));
const low = stats.ranges.filter((x) => (x.coverage ?? 0) < 0.03);
if (low.length) console.log(`cảnh báo: ${low.length} khoảng gần như không có người trong khung (diện tích người dưới 3%): chữ sẽ hiện nguyên vẹn không bị che; kiểm lại thời điểm của thẻ bigtext`);
