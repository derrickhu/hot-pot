#!/usr/bin/env python3
"""汇总 bowl 放大重生成品：合并到 final_all，并按芒果尺度缩放。"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
BOWL = PROJECT / "subpackages/bowl_core/assets/images/bowl"
ASSETS = Path("/Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2")
FINAL_ALL = ASSETS / "final_all"
TARGET_MAX = 168  # mango_2 ~152，略留余量


def resize_rgba(im: Image.Image, max_dim: int) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    m = max(w, h)
    if m <= max_dim:
        return im
    s = max_dim / m
    return im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.Resampling.LANCZOS)


def ingest_dir(src: Path, max_dim: int) -> int:
    n = 0
    for p in sorted(src.glob("*.png")):
        if "_pick" in p.stem:
            continue
        im = resize_rgba(Image.open(p), max_dim)
        out = FINAL_ALL / p.name
        im.save(out, "PNG", optimize=True)
        n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=TARGET_MAX)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    FINAL_ALL.mkdir(parents=True, exist_ok=True)
    total = 0
    final_root = ASSETS / "final"
    if final_root.is_dir():
        for sub in sorted(final_root.iterdir()):
            if sub.is_dir():
                if args.dry_run:
                    print(f"would ingest {sub}")
                else:
                    total += ingest_dir(sub, args.max)
    if args.dry_run:
        print("dry-run only")
        return
    print(f"final_all: {total} files -> {FINAL_ALL}")
    sizes = []
    for p in sorted(FINAL_ALL.glob("*.png")):
        im = Image.open(p)
        sizes.append((p.name, max(im.size)))
    print(f"count={len(sizes)} min_max={min(s[1] for s in sizes) if sizes else 0} max_max={max(s[1] for s in sizes) if sizes else 0}")


if __name__ == "__main__":
    main()
