#!/usr/bin/env python3
"""
Make a timed .srt transcript from audio/video that YOU are allowed to use.

This runs completely on your own computer (free, no API key, nothing is uploaded).
It writes the ORIGINAL-language dialogue with timings. Then, in the admin panel:
AI Studio -> New subtitle job -> step 2 "Source text" -> open the .srt it produced.

Only use it on material you own, made yourself, or have written permission /
a licence to transcribe and translate. Do not use it on pirated copies.

Install once:
    pip install faster-whisper
    (ffmpeg is NOT required - faster-whisper decodes audio by itself.)

Examples:
    python tools/transcribe.py my-short-film.mp4
    python tools/transcribe.py talk.mp3 --language ta --model medium
    python tools/transcribe.py film.mkv --english        # translate speech to English text

Models: tiny, base, small (default), medium, large-v3. Bigger = better and slower.
On a normal laptop CPU "small" needs roughly the length of the film.
"""
import argparse
import sys
from pathlib import Path


def stamp(seconds: float) -> str:
    ms = max(0, round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def wrap(text: str, width: int = 42) -> str:
    """At most two balanced lines of about `width` characters."""
    text = " ".join(text.split())
    if len(text) <= width:
        return text
    words, best, target = text.split(" "), None, len(text) / 2
    for i in range(1, len(words)):
        left = " ".join(words[:i])
        if best is None or abs(len(left) - target) < abs(len(best[0]) - target):
            best = (left, " ".join(words[i:]))
    return "\n".join(best) if best else text


def main() -> int:
    ap = argparse.ArgumentParser(description="Transcribe audio/video you have the rights to into a timed .srt file.")
    ap.add_argument("media", type=Path, help="audio or video file")
    ap.add_argument("-o", "--output", type=Path, help="output .srt (default: next to the media file)")
    ap.add_argument("-m", "--model", default="small", help="tiny | base | small | medium | large-v3 (default: small)")
    ap.add_argument("-l", "--language", help="spoken language code, e.g. ta, te, hi, en (default: detect)")
    ap.add_argument("--english", action="store_true", help="write English text instead of the spoken language")
    ap.add_argument("--device", default="auto", help="auto | cpu | cuda (default: auto)")
    ap.add_argument("--max-chars", type=int, default=84, help="longest subtitle in characters (default: 84 = 2 lines x 42)")
    args = ap.parse_args()

    if not args.media.is_file():
        print(f"File not found: {args.media}", file=sys.stderr)
        return 2
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper is not installed. Run:  pip install faster-whisper", file=sys.stderr)
        return 2

    out = args.output or args.media.with_suffix(".en.srt" if args.english else ".srt")
    print(f"Loading model '{args.model}' (downloaded once, then cached)…", file=sys.stderr)
    model = WhisperModel(args.model, device=args.device, compute_type="auto")
    segments, info = model.transcribe(
        str(args.media),
        language=args.language,
        task="translate" if args.english else "transcribe",
        vad_filter=True,  # skips music / silence, which reduces invented text
        word_timestamps=True,
    )
    print(f"Language: {info.language} ({info.language_probability:.0%}) · length {info.duration / 60:.1f} min", file=sys.stderr)

    cues = []
    for seg in segments:
        words = [w for w in (seg.words or []) if w.word.strip()]
        if not words:
            if seg.text.strip():
                cues.append((seg.start, seg.end, seg.text.strip()))
            continue
        # Split long segments at word boundaries so every cue stays readable.
        chunk = []
        for w in words:
            candidate = "".join(x.word for x in chunk + [w]).strip()
            if chunk and len(candidate) > args.max_chars:
                cues.append((chunk[0].start, chunk[-1].end, "".join(x.word for x in chunk).strip()))
                chunk = []
            chunk.append(w)
        if chunk:
            cues.append((chunk[0].start, chunk[-1].end, "".join(x.word for x in chunk).strip()))
        print(f"\r{seg.end / max(info.duration, 1):.0%}", end="", file=sys.stderr)

    lines = []
    for n, (start, end, text) in enumerate(cues, 1):
        end = max(end, start + 0.7)  # never shorter than 0.7 s
        if n < len(cues):
            end = min(end, max(cues[n][0] - 0.04, start + 0.2))  # never overlap the next cue
        lines.append(f"{n}\n{stamp(start)} --> {stamp(end)}\n{wrap(text)}\n")
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nWrote {len(cues)} cues to {out}", file=sys.stderr)
    print("Speech recognition makes mistakes (names, numbers, songs). Read it against the audio before translating.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
