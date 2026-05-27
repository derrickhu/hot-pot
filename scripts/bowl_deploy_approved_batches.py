#!/usr/bin/env python3
"""将用户确认的 final 批次覆盖进 bowl_core（小料 + 可选水果）。"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

PROJECT = Path(Path(__file__).resolve().parents[1])
BOWL = PROJECT / "subpackages/bowl_core/assets/images/bowl"
ASSETS = Path("/Users/rosa/rosa_games/game_assets/hot-pot/assets/bowl_upscale_regen_v2")
TARGET_MAX = 168
PAD = 4

# 用户确认可进包的小料合图批次
DEFAULT_TOPPING_BATCHES = [
    "almond_slice__basil_seed",
    "black_rice__boba_pearl",
    "chocolate_chip__coconut_jelly",
    "oat_flake__osmanthus",
    "peach_gum__peanut",
    "pumpkin_cube__radish_heart",
    "pop_boba__pudding_cube",
]

# 单颗重生水果（已抠图）
DEFAULT_FRUIT_DIRS = [
    ASSETS / "final_singles/mulberry",
    ASSETS / "final_singles/bayberry",
]


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


def deploy_png(src: Path, *, max_dim: int = TARGET_MAX) -> None:
    if not src.is_file():
        raise FileNotFoundError(src)
    im = trim_pad(resize_rgba(Image.open(src), max_dim))
    dest = BOWL / src.name
    im.save(dest, "PNG", optimize=True)
    print(f"{src.name}: {src} {Image.open(src).size} -> {dest} {im.size}", flush=True)


def deploy_batch_dir(batch_dir: Path) -> int:
    n = 0
    for png in sorted(batch_dir.glob("*_[12].png")):
        deploy_png(png)
        n += 1
    return n


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--src-root",
        type=Path,
        default=ASSETS / "final_v2_bad",
        help="小料批次根目录",
    )
    ap.add_argument("--batch", action="append", help="批次文件夹名，可多次指定")
    ap.add_argument("--fruit-dir", type=Path, action="append", help="额外水果目录（已抠图）")
    ap.add_argument("--max-dim", type=int, default=TARGET_MAX)
    args = ap.parse_args()

    batches = args.batch or DEFAULT_TOPPING_BATCHES
    fruit_dirs = args.fruit_dir or DEFAULT_FRUIT_DIRS

    total = 0
    for name in batches:
        d = args.src_root / name
        if not d.is_dir():
            print(f"skip missing batch: {d}", file=sys.stderr)
            continue
        total += deploy_batch_dir(d)

    for fd in fruit_dirs:
        fd = fd.expanduser().resolve()
        if not fd.is_dir():
            print(f"skip missing fruit dir: {fd}", file=sys.stderr)
            continue
        for png in sorted(fd.glob("*_[12].png")):
            deploy_png(png, max_dim=args.max_dim)
            total += 1

    print(f"done: deployed {total} files -> {BOWL}", flush=True)


if __name__ == "__main__":
    main()
