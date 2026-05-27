#!/usr/bin/env python3
"""将 final_v2_bad 中非小料素材缩放后覆盖进 bowl_core（排除小料）。"""
from __future__ import annotations

import hashlib
import shutil
import sys
from pathlib import Path

from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
BOWL = PROJECT / "subpackages/bowl_core/assets/images/bowl"
SRC = Path("/Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2/final_v2_bad")
TARGET_MAX = 168
PAD = 4


def img_hash(p: Path) -> str:
    im = Image.open(p).convert("RGBA")
    return hashlib.md5(im.tobytes()).hexdigest()


def is_topping(fid: str) -> bool:
    p1, p2 = BOWL / f"{fid}_1.png", BOWL / f"{fid}_2.png"
    if not p1.is_file() or not p2.is_file():
        return False
    return img_hash(p1) == img_hash(p2)


def resize_rgba(im: Image.Image, max_dim: int) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    m = max(w, h)
    if m <= max_dim:
        return im
    s = max_dim / m
    return im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.Resampling.LANCZOS)


def trim_pad(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    a = im.split()[3]
    bbox = a.point(lambda p: 255 if p > 8 else 0).getbbox()
    if not bbox:
        return im
    w, h = im.size
    x0, y0, x1, y1 = bbox
    return im.crop(
        (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD), min(h, y1 + PAD)),
    )


def main() -> None:
    if not SRC.is_dir():
        print(f"missing {SRC}", file=sys.stderr)
        sys.exit(1)
    copied = 0
    skipped_top = 0
    for png in sorted(SRC.rglob("*.png")):
        name = png.stem
        if not name.endswith("_1") and not name.endswith("_2"):
            continue
        fid = name[:-2]
        if is_topping(fid):
            skipped_top += 1
            continue
        im = trim_pad(resize_rgba(Image.open(png), TARGET_MAX))
        dest = BOWL / png.name
        im.save(dest, "PNG", optimize=True)
        copied += 1
        print(f"{png.name} {png} -> {dest} {im.size}", flush=True)
    print(f"done: copied={copied} skipped_toppings={skipped_top}", flush=True)


if __name__ == "__main__":
    main()
