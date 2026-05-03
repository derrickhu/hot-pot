#!/usr/bin/env python3
"""
与汤图 postprocess_soup_circle 同思路：先得到正方形画布，再按几何正圆处理外侧像素。
区别：汤用「中心裁成正方」（汤常带左右条）；碗沿 **只补方、不裁内容**，再套外接正圆遮罩。
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image


def pad_to_square_no_crop(im: Image.Image) -> Image.Image:
    """用透明边补成正方形，不丢弃任何像素。"""
    im = im.convert("RGBA")
    w, h = im.size
    if w == h:
        return im
    side = max(w, h)
    out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    x0 = (side - w) // 2
    y0 = (side - h) // 2
    out.paste(im, (x0, y0), im)
    return out


def apply_outer_circle_mask(im: Image.Image, diameter_ratio: float = 0.98) -> Image.Image:
    """圆外透明，得到数学正圆外轮廓（与汤 apply_circle_mask 同公式）。"""
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


def fit_max_side(im: Image.Image, max_side: int) -> Image.Image:
    w, h = im.size
    m = max(w, h)
    if m <= max_side:
        return im
    s = max_side / m
    nw = max(1, int(round(w * s)))
    nh = max(1, int(round(h * s)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def trim_alpha(im: Image.Image, thresh: int = 8, pad: int = 2) -> Image.Image:
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


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("input", type=Path, help="已色键的 RGBA PNG（建议 chroma_key_ff00ff.py --no-trim）")
    p.add_argument("-o", "--output", type=Path, required=True)
    p.add_argument(
        "--diameter-ratio",
        type=float,
        default=0.98,
        help="外接圆直径占短边比例，与汤脚本一致思路；0.98 仅切掉补方后的四角",
    )
    p.add_argument("--out-max", type=int, default=512, help="最长边不超过该值，等比缩小")
    p.add_argument(
        "--no-trim-alpha",
        action="store_true",
        help="保留透明外边（默认会按 alpha 紧裁）",
    )
    args = p.parse_args()
    im = pad_to_square_no_crop(Image.open(args.input))
    im = apply_outer_circle_mask(im, diameter_ratio=args.diameter_ratio)
    im = fit_max_side(im, args.out_max)
    if not args.no_trim_alpha:
        im = trim_alpha(im)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    im.save(args.output, "PNG", optimize=True, compress_level=9)
    print(args.output, im.size, math.ceil(args.output.stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main()
