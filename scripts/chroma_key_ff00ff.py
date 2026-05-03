#!/usr/bin/env python3
"""将接近 #FF00FF 的纯色底转为透明，便于汤/碗素材入库。"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image


def chroma_to_transparent(
    im: Image.Image,
    rgb: tuple[int, int, int] = (255, 0, 255),
    tol: float = 85.0,
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


def trim_alpha(im: Image.Image, thresh: int = 8, pad: int = 2) -> Image.Image:
    a = im.split()[3]
    bbox = a.point(lambda p: 255 if p > thresh else 0).getbbox()
    if not bbox:
        return im
    w, h = im.size
    x0, y0, x1, y1 = bbox
    return im.crop(
        (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)),
    )


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("input", type=Path)
    p.add_argument("-o", "--output", type=Path, required=True)
    p.add_argument("--tol", type=float, default=85)
    p.add_argument(
        "--no-trim",
        action="store_true",
        help="不裁 alpha 外接框，保留完整画布（与 postprocess_rim_circle 等配合）",
    )
    args = p.parse_args()
    im = chroma_to_transparent(Image.open(args.input), tol=args.tol)
    if not args.no_trim:
        im = trim_alpha(im)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    im.save(args.output, "PNG", optimize=True)
    print(args.output, im.size, flush=True)


if __name__ == "__main__":
    main()
