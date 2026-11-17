#!/usr/bin/env python3
"""Extract full-size video frames and their playback timestamps with FFmpeg."""

import argparse
import csv
import math
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

TIME_BASE = re.compile(r"config in time_base:\s*(\d+)/(\d+)")
FRAME_PTS = re.compile(r"\bn:\s*\d+\s+pts:\s*(-?\d+)\s+pts_time:")


def sample(video, destination, start, end, step, ffmpeg):
    # Retain display timestamps relative to the media start, including after a seek.
    seek = str(start)
    trim = f"trim=start={seek}"
    if end is not None:
        trim += f":end={end}"
    current_bin = f"floor((t-{seek})/{step})"
    last_bin = f"floor((prev_selected_t-{seek})/{step})"
    frame_filter = (
        f"{trim},select='isnan(prev_selected_t)+gt({current_bin},{last_bin})',"
        "showinfo=checksum=0"
    )
    command = [
        ffmpeg, "-nostdin", "-hide_banner", "-nostats", "-loglevel", "info",
        "-copyts", "-start_at_zero", "-ss", seek,
    ]
    if end is not None:
        command += ["-t", str(end - start)]
    command += [
        "-i", str(video), "-map", "0:V:0", "-vf", frame_filter,
        "-fps_mode", "passthrough", "-q:v", "2", "-threads:v", "1",
        "-start_number", "0", str(destination / "frame-%07d.jpg"),
    ]
    result = subprocess.run(command, capture_output=True, text=True, errors="replace")
    if result.returncode:
        raise ValueError("\n".join(result.stderr.splitlines()[-12:]))

    frames = sorted(destination.glob("frame-*.jpg"))
    if not frames:
        raise ValueError("No video frame in the requested time interval.")
    # showinfo can announce a new time base after a stream configuration change.
    time_base = None
    timestamps = []
    for line in result.stderr.splitlines():
        if "showinfo" not in line:
            continue
        if match := TIME_BASE.search(line):
            numerator, denominator = map(int, match.groups())
            time_base = numerator / denominator
        elif match := FRAME_PTS.search(line):
            if time_base is None:
                raise ValueError("FFmpeg did not report a video time base.")
            timestamps.append(int(match.group(1)) * time_base)
    if len(frames) != len(timestamps):
        raise ValueError("Image count and source timestamp count differ.")
    with (destination / "frames.csv").open("w", encoding="utf-8", newline="") as output:
        writer = csv.writer(output)
        writer.writerow(["file", "video_s"])
        for frame, seconds in zip(frames, timestamps):
            writer.writerow([frame.name, f"{seconds:.6f}"])
    return len(frames)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("destination", type=Path, help="new output directory")
    parser.add_argument("--start", type=float, default=0, help="inclusive, seconds")
    parser.add_argument("--end", type=float, help="exclusive, seconds (default: end of file)")
    parser.add_argument("--step", type=float, default=5, help="sampling interval, seconds")
    args = parser.parse_args()
    if not math.isfinite(args.start) or args.start < 0:
        parser.error("--start must be a finite, nonnegative time")
    if args.end is not None and (not math.isfinite(args.end) or args.end <= args.start):
        parser.error("--end must be a finite time after --start")
    if not math.isfinite(args.step) or args.step <= 0:
        parser.error("--step must be a finite positive number")
    if not args.video.is_file():
        parser.error(f"Video file does not exist: {args.video}")
    destination = args.destination.absolute()
    if destination.exists():
        parser.error(f"Choose a new output directory: {destination}")
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        parser.error("FFmpeg is required for local frame extraction")
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=destination.parent) as staging:
            frames = Path(staging) / "frames"
            frames.mkdir()
            count = sample(args.video.resolve(), frames, args.start, args.end, args.step, ffmpeg)
            frames.rename(destination)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Frame extraction failed: {error}\n")
    print(f"{count} frames and frames.csv written to {destination}")


if __name__ == "__main__":
    main()
