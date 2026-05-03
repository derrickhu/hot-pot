#!/usr/bin/env python3
"""裁掉透明边并缩小 bowl 汤 / 水晶碗沿 PNG，减轻体积与内存。"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def trim_alpha_tight(im: Image.Image, alpha_thresh: int = 16, pad: int = 2) -> Image.Image:
    im = im.convert("RGBA")
    a = np.array(im.split()[3])
    ys, xs = np.where(a > alpha_thresh)
    if ys.size == 0:
        return im
    h, w = a.shape
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w, x1 + pad)
    y1 = min(h, y1 + pad)
    return im.crop((x0, y0, x1, y1))


def fit_max_side(im: Image.Image, max_side: int) -> Image.Image:
    w, h = im.size
    m = max(w, h)
    if m <= max_side:
        return im
    s = max_side / m
    nw = max(1, int(round(w * s)))
    nh = max(1, int(round(h * s)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def pad_to_square(im: Image.Image) -> Image.Image:
    """透明边补齐为正方形，避免游戏里等比缩放时上下像被裁掉。"""
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


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--assets-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "assets" / "images",
    )
    p.add_argument("--soup-max", type=int, default=480, help="汤图裁透明边后，最长边不超过该值")
    p.add_argument("--rim-max", type=int, default=512, help="碗沿最长边不超过该值")
    args = p.parse_args()
    d = args.assets_dir

    soup_path = d / "bowl_soup_milk.png"
    rim_path = d / "bowl_crystal_rim.png"

    soup = Image.open(soup_path).convert("RGBA")
    soup = trim_alpha_tight(soup)
    soup = fit_max_side(soup, args.soup_max)
    soup.save(soup_path, "PNG", optimize=True, compress_level=9)
    print("soup", soup_path.name, soup.size, soup_path.stat().st_size // 1024, "KB")

    rim = Image.open(rim_path).convert("RGBA")
    rim = trim_alpha_tight(rim)
    rim = fit_max_side(rim, args.rim_max)
    rim = pad_to_square(rim)
    rim.save(rim_path, "PNG", optimize=True, compress_level=9)
    print("rim", rim_path.name, rim.size, rim_path.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
