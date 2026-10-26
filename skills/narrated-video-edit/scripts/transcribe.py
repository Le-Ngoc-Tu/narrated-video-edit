"""Phiên âm theo từng từ bằng faster-whisper, chạy cục bộ (không gửi âm thanh đi đâu).

Chạy: python transcribe.py audio.wav --out words.json [--model large-v3] [--lang vi] [--device auto] [--prompt "tên riêng, thuật ngữ"]
Ghi words.json: {language, duration, model, device, words[{i,text,start,end,startMs,endMs,confidence}], segments[{start,end,text}]}.
Trên Windows cần PYTHONUTF8=1 để in tiếng Việt; script tự đặt cho chính nó.
"""
import argparse
import json
import os
import sys
import time

os.environ.setdefault("PYTHONUTF8", "1")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def load_model(name, device):
    from faster_whisper import WhisperModel

    candidates = [device] if device != "auto" else ["cuda", "cpu"]
    last = None
    for dev in candidates:
        try:
            compute = "int8_float16" if dev == "cuda" else "int8"
            model = WhisperModel(name, device=dev, compute_type=compute)
            return model, dev
        except Exception as error:  # thiếu CUDA hoặc hết bộ nhớ GPU: thử thiết bị kế
            last = error
    raise SystemExit(f"Không nạp được model {name}: {last}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--out", required=True)
    parser.add_argument("--model", default="large-v3")
    parser.add_argument("--lang", default=None, help="mã ngôn ngữ (vi, en...); bỏ trống để tự nhận")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--prompt", default=None, help="gợi ý tên riêng và thuật ngữ để nhận đúng chính tả")
    opts = parser.parse_args()

    started = time.time()
    model, device = load_model(opts.model, opts.device)
    segments, info = model.transcribe(
        opts.audio,
        language=opts.lang,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 300},
        initial_prompt=opts.prompt,
        condition_on_previous_text=False,
    )
    words, segs = [], []
    for seg in segments:
        segs.append({"start": round(seg.start, 3), "end": round(seg.end, 3), "text": seg.text.strip()})
        for w in seg.words or []:
            text = w.word.strip()
            if not text:
                continue
            words.append({
                "i": len(words),
                "text": text,
                "start": round(w.start, 3),
                "end": round(w.end, 3),
                "startMs": int(round(w.start * 1000)),
                "endMs": int(round(w.end * 1000)),
                "confidence": round(w.probability, 3),
            })
    result = {"language": info.language, "duration": round(info.duration, 3), "model": opts.model, "device": device, "words": words, "segments": segs}
    with open(opts.out, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=1)
    print(f"{len(words)} từ, ngôn ngữ {info.language}, {info.duration:.1f}s âm thanh, {time.time() - started:.1f}s ({opts.model} trên {device})")


if __name__ == "__main__":
    main()
