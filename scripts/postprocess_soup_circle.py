#!/usr/bin/env python3
"""将汤 PNG 规范为 1:1 画布，并按几何正圆裁掉外侧像素（防椭圆/脏边）。"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image


def square_canvas(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    s = min(w, h)
    left = (w - s) // 2
    top = (h - s) // 2
    return im.crop((left, top, left + s, top + s))


def apply_circle_mask(im: Image.Image, diameter_ratio: float = 0.65) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    cx = (w - 1) * 0.5
    cy = (h - 1) * 0.5
    r = 0.5 * diameter_ratio * min(w, h)
    r2 = r * r
    px = im.load()
    for y in range(h):
        for x in range(w):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy > r2:
                px[x, y] = (0, 0, 0, 0)
    return im


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("input", type=Path)
    p.add_argument("-o", "--output", type=Path, required=True)
    p.add_argument("--diameter-ratio", type=float, default=0.65)
    args = p.parse_args()
    im = square_canvas(Image.open(args.input))
    im = apply_circle_mask(im, diameter_ratio=args.diameter_ratio)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    im.save(args.output, "PNG", optimize=True)
    print(args.output, im.size, flush=True)


if __name__ == "__main__":
    main()
