"""Tách người khỏi nền (mặt nạ trắng đen theo thời gian) để đặt chữ lớn SAU người nói.

Chạy: python segment.py base.mp4 --out mask.mkv --ranges "12.0-14.5,40-43" [--stats stats.json] [--model auto|general|landscape]
Dùng MediaPipe Selfie Segmentation (Google, Apache-2.0; hai mô hình 250 KB gói sẵn ở templates/models). Chạy trong môi trường Python riêng
(.venv-seg, tạo bằng "node setup.mjs --with-segmentation") vì mediapipe kéo theo OpenCV bản mới. Chỉ tách người khỏi nền, không nhận dạng danh tính.
Mặt nạ cùng kích thước và tốc độ khung với video vào; khung ngoài các khoảng --ranges là đen (không có người nên không che gì).
Ghi thêm thống kê: tỉ lệ diện tích người trung bình trong từng khoảng (để audit phát hiện tách hỏng hoặc không có người).
"""
import argparse
import json
import os
import subprocess
import sys

os.environ.setdefault("PYTHONUTF8", "1")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python import vision

MODELS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "models")


def parse_ranges(text):
    out = []
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        a, b = part.split("-")
        out.append((float(a), float(b)))
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("--out", required=True)
    parser.add_argument("--ranges", required=True)
    parser.add_argument("--stats")
    parser.add_argument("--model", choices=["auto", "general", "landscape"], default="auto")
    opts = parser.parse_args()

    ranges = parse_ranges(opts.ranges)
    cap = cv2.VideoCapture(opts.video)
    if not cap.isOpened():
        raise SystemExit(f"Không mở được {opts.video}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    kind = opts.model if opts.model != "auto" else ("landscape" if width > height * 1.2 else "general")
    model_path = os.path.join(MODELS, "selfie_segmenter_landscape.tflite" if kind == "landscape" else "selfie_segmenter.tflite")
    options = vision.ImageSegmenterOptions(
        base_options=mp_tasks.BaseOptions(model_asset_path=model_path),
        running_mode=vision.RunningMode.VIDEO,
        output_category_mask=False,
        output_confidence_masks=True,
    )
    segmenter = vision.ImageSegmenter.create_from_options(options)
    ff = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "gray", "-s", f"{width}x{height}", "-r", f"{fps}", "-i", "-", "-c:v", "ffv1", opts.out],
        stdin=subprocess.PIPE,
    )
    black = np.zeros((height, width), dtype=np.uint8).tobytes()
    sums = [0.0] * len(ranges)
    counts = [0] * len(ranges)
    previous = None
    index = 0
    while index < total or total == 0:
        ok, frame = cap.read()
        if not ok:
            break
        t = index / fps
        active = next((i for i, (a, b) in enumerate(ranges) if a - 0.05 <= t <= b + 0.05), None)
        if active is None:
            ff.stdin.write(black)
            previous = None
        else:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = segmenter.segment_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(round(t * 1000)))
            # selfie_segmenter chỉ có một mặt nạ tin cậy: xác suất NGƯỜI (đã kiểm: khung toàn cảnh đêm không người cho trung bình 0,001)
            person = np.squeeze(result.confidence_masks[0].numpy_view()).astype(np.float32)
            person = cv2.GaussianBlur(person, (5, 5), 0)
            person = np.clip((person - 0.35) / 0.3, 0.0, 1.0)  # làm gọn viền: dưới 0,35 là nền, trên 0,65 là người
            if previous is not None:
                person = 0.6 * person + 0.4 * previous  # ổn định theo thời gian, bớt nhấp nháy ở viền
            previous = person
            ff.stdin.write((person * 255).astype(np.uint8).tobytes())
            sums[active] += float(person.mean())
            counts[active] += 1
        index += 1
    cap.release()
    ff.stdin.close()
    if ff.wait() != 0:
        raise SystemExit("ffmpeg ghi mặt nạ lỗi")
    stats = [{"start": a, "end": b, "coverage": round(sums[i] / counts[i], 3) if counts[i] else None, "frames": counts[i]} for i, (a, b) in enumerate(ranges)]
    if opts.stats:
        with open(opts.stats, "w", encoding="utf-8") as handle:
            json.dump({"model": kind, "ranges": stats}, handle)
    print(f"Đã ghi {opts.out} (mô hình {kind}): " + "; ".join(f"{s['start']:.1f}-{s['end']:.1f}s diện tích người {s['coverage']}" for s in stats))


if __name__ == "__main__":
    main()
