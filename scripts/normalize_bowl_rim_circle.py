#!/usr/bin/env python3
"""
历史方案：扁椭圆生图时做纵向拉伸。当前推荐与汤一致：
`chroma_key_ff00ff.py --no-trim` + `postprocess_rim_circle.py`（只补方 + 正圆外遮罩，不拉伸）。
本脚本保留以便兼容旧素材。
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image


def chroma_to_transparent(
    im: Image.Image,
    rgb: tuple[int, int, int] = (255, 0, 255),
    tol: float = 60.0,
) -> Image.Image:
    im = im.convert("RGBA")
    r0, g0, b0 = rgb
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            d = math.sqrt((r - r0) ** 2 + (g - g0) ** 2 + (b - b0) ** 2)
            if d <= tol:
                px[x, y] = (0, 0, 0, 0)
    return im


def trim_alpha_pad(im: Image.Image, thresh: int = 8, pad: int = 8) -> Image.Image:
    im = im.convert("RGBA")
    a = im.split()[3]
    bbox = a.point(lambda p: 255 if p > thresh else 0).getbbox()
    if not bbox:
        return im
    w, h = im.size
    x0, y0, x1, y1 = bbox
    return im.crop(
        (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)),
    )


def stretch_to_square(im: Image.Image, aspect_max: float = 1.08) -> Image.Image:
    """宽明显大于高时，拉高到正方形，使俯视圆不再像上下被切。"""
    im = im.convert("RGBA")
    w, h = im.size
    if w <= 0 or h <= 0:
        return im
    ar = w / h
    if ar > aspect_max:
        side = w
        return im.resize((side, side), Image.Resampling.LANCZOS)
    if (h / w) > aspect_max:
        side = h
        return im.resize((side, side), Image.Resampling.LANCZOS)
    return im


def fit_max_side(im: Image.Image, max_side: int) -> Image.Image:
    w, h = im.size
    m = max(w, h)
    if m <= max_side:
        return im
    s = max_side / m
    nw = max(1, int(round(w * s)))
    nh = max(1, int(round(h * s)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("input", type=Path, help="生图 RGB（洋红底）")
    p.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "assets" / "images" / "bowl_crystal_rim.png",
    )
    p.add_argument("--tol", type=float, default=60.0)
    p.add_argument("--chroma-max", type=int, default=1024, help="色键前先缩到最长边，加速且略柔化噪点")
    p.add_argument("--out-max", type=int, default=512)
    args = p.parse_args()

    im = Image.open(args.input).convert("RGB")
    w, h = im.size
    m = max(w, h)
    if m > args.chroma_max:
        s = args.chroma_max / m
        im = im.resize(
            (max(1, int(round(w * s))), max(1, int(round(h * s)))),
            Image.Resampling.LANCZOS,
        )

    im = chroma_to_transparent(im, tol=args.tol)
    im = trim_alpha_pad(im)
    im = stretch_to_square(im)
    im = fit_max_side(im, args.out_max)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    im.save(args.output, "PNG", optimize=True, compress_level=9)
    print(args.output, im.size, math.ceil(args.output.stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main()
