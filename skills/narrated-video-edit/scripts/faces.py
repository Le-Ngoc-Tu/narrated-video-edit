"""Tìm khuôn mặt theo thời gian để lớp phủ, zoom nhấn và bố cục không che hay bỏ sót người nói.

Chạy: python faces.py video.mp4 --out faces.json [--every 0.5] [--detector auto|yunet|haar]
Bộ dò mặc định là YuNet (OpenCV Zoo, MIT, mô hình 232 KB gói sẵn ở templates/models): nhận cả mặt nghiêng và mặt nhỏ, cho thêm 5 điểm mốc (mắt, mũi, khóe miệng).
Không có mô hình hoặc OpenCV quá cũ thì dùng Haar (chỉ mặt nhìn thẳng). Chỉ PHÁT HIỆN mặt, không nhận dạng danh tính.
Ghi {width, height, detector, samples[{t, boxes[[x,y,w,h]], marks[[10 số]], scores[]}], coverage}; mọi toạ độ theo tỉ lệ 0..1 của khung.
marks theo thứ tự: mắt phải, mắt trái, mũi, khóe miệng phải, khóe miệng trái (x,y xen kẽ). Không thấy mặt nào thì coverage = 0.
"""
import argparse
import json
import os
import sys

os.environ.setdefault("PYTHONUTF8", "1")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
import cv2

MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "models", "face_detection_yunet_2023mar.onnx")


def make_yunet(width, height):
    if not hasattr(cv2, "FaceDetectorYN") or not os.path.exists(MODEL):
        return None
    return cv2.FaceDetectorYN.create(MODEL, "", (width, height), 0.6, 0.3, 5000)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("--out", required=True)
    parser.add_argument("--every", type=float, default=0.5)
    parser.add_argument("--detector", choices=["auto", "yunet", "haar"], default="auto")
    opts = parser.parse_args()

    cap = cv2.VideoCapture(opts.video)
    if not cap.isOpened():
        raise SystemExit(f"Không mở được {opts.video}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    # Dò trên bản thu nhỏ (cạnh dài tối đa 960) cho nhanh; toạ độ chuẩn hoá nên không phụ thuộc cỡ này
    scale = min(1.0, 960.0 / max(width, height))
    dw, dh = int(round(width * scale)), int(round(height * scale))
    yunet = None if opts.detector == "haar" else make_yunet(dw, dh)
    if opts.detector == "yunet" and yunet is None:
        raise SystemExit("Không dùng được YuNet: thiếu OpenCV có FaceDetectorYN hoặc thiếu templates/models/face_detection_yunet_2023mar.onnx")
    cascade = None if yunet else cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml"))
    detector = "yunet" if yunet else "haar"

    step = max(1, int(round(opts.every * fps)))
    samples = []
    index = 0
    # Đọc tuần tự (grab) rồi chỉ giải mã mẫu cần dò: nhanh hơn nhảy tới từng mốc trên video dài
    while index < total or total == 0:
        if not cap.grab():
            break
        if index % step == 0:
            ok, frame = cap.retrieve()
            if not ok:
                break
            small = cv2.resize(frame, (dw, dh)) if scale < 1 else frame
            boxes, marks, scores = [], [], []
            if yunet:
                _, found = yunet.detect(small)
                for f in (found if found is not None else []):
                    x, y, w, h = float(f[0]), float(f[1]), float(f[2]), float(f[3])
                    boxes.append([round(max(0.0, x) / dw, 4), round(max(0.0, y) / dh, 4), round(w / dw, 4), round(h / dh, 4)])
                    marks.append([round(float(v) / (dw if k % 2 == 0 else dh), 4) for k, v in enumerate(f[4:14])])
                    scores.append(round(float(f[14]), 3))
            else:
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                found = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(int(0.06 * dw), int(0.06 * dw)))
                boxes = [[round(x / dw, 4), round(y / dh, 4), round(w / dw, 4), round(h / dh, 4)] for (x, y, w, h) in found]
            sample = {"t": round(index / fps, 2), "boxes": boxes}
            if marks:
                sample["marks"] = marks
                sample["scores"] = scores
            samples.append(sample)
        index += 1
    cap.release()
    with_face = sum(1 for s in samples if s["boxes"])
    coverage = round(with_face / len(samples), 3) if samples else 0
    with open(opts.out, "w", encoding="utf-8") as handle:
        json.dump({"width": width, "height": height, "detector": detector, "samples": samples, "coverage": coverage}, handle)
    print(f"{len(samples)} mẫu, có mặt ở {with_face} mẫu (coverage {coverage}, bộ dò {detector})")


if __name__ == "__main__":
    main()
