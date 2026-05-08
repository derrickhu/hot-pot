#!/usr/bin/env python3
"""
把一张 1:1（或近似 1:1）的图按 3x3 等分切成 9 张方图，导出为 JPG。
常用于把"36 枚徽章合成图"或"宣传大图"做成朋友圈/小红书九宫格推广。

切分顺序：左→右、上→下，命名 `<base>_9grid_01.jpg ~ _09.jpg`：
    01 02 03
    04 05 06
    07 08 09

示例：
    python3 scripts/split_to_9grid.py \
        --input /path/to/big_image.png \
        --out-dir /path/to/output_dir \
        --base square_collection_6x6_v1 \
        --max-side 1080 --quality 85 --max-kb 200
"""
from __future__ import annotations

import argparse
import io
from pathlib import Path

from PIL import Image


def save_jpg_under_kb(im: Image.Image, out_path: Path, quality: int, max_kb: int) -> tuple[int, int]:
    """以指定 quality 保存**标准 baseline JPEG**（非 progressive，平台兼容性更好）。"""
    q = quality
    while q >= 50:
        buf = io.BytesIO()
        im.convert("RGB").save(
            buf, format="JPEG",
            quality=q, optimize=True,
            progressive=False, subsampling=0,
        )
        kb = len(buf.getvalue()) / 1024
        if kb <= max_kb or q == 50:
            out_path.write_bytes(buf.getvalue())
            return q, int(kb)
        q -= 5
    return q, int(kb)


def main() -> None:
    ap = argparse.ArgumentParser(description="Split a square image into a 3x3 grid (9 JPGs).")
    ap.add_argument("--input", required=True, help="Source image path (PNG/JPG).")
    ap.add_argument("--out-dir", required=True, help="Output directory.")
    ap.add_argument(
        "--base",
        required=True,
        help="Output base name; files will be <base>_9grid_01.jpg ~ _09.jpg",
    )
    ap.add_argument(
        "--target-size",
        type=int,
        default=0,
        help="Exact NxN target size (px). When set, every tile is resized to this. "
        "Default 0 = use --max-side.",
    )
    ap.add_argument(
        "--max-side",
        type=int,
        default=1080,
        help="Max side (px) when --target-size is unset (only downscales if larger). Default 1080.",
    )
    ap.add_argument("--quality", type=int, default=85, help="JPEG quality starting point. Default 85.")
    ap.add_argument(
        "--max-kb",
        type=int,
        default=200,
        help="Per-tile max size (KB). If exceeded, JPEG quality is reduced. Default 200.",
    )
    args = ap.parse_args()

    src_path = Path(args.input)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    if abs(w - h) > 4:
        print(f"warn: source is not square ({w}x{h}); cropping to centered square.")
        s = min(w, h)
        x0 = (w - s) // 2
        y0 = (h - s) // 2
        im = im.crop((x0, y0, x0 + s, y0 + s))
        w = h = s

    cell = w / 3.0
    print(f"source: {src_path}  size: {w}x{h}  cell: {cell:.1f}px")

    for r in range(3):
        for c in range(3):
            idx = r * 3 + c + 1
            x0 = int(round(c * cell))
            y0 = int(round(r * cell))
            x1 = int(round((c + 1) * cell))
            y1 = int(round((r + 1) * cell))
            tile = im.crop((x0, y0, x1, y1))
            if args.target_size > 0:
                tile = tile.resize((args.target_size, args.target_size), Image.LANCZOS)
            elif tile.size[0] > args.max_side:
                tile = tile.resize((args.max_side, args.max_side), Image.LANCZOS)
            out_path = out_dir / f"{args.base}_9grid_{idx:02d}.jpg"
            q, kb = save_jpg_under_kb(tile, out_path, args.quality, args.max_kb)
            print(f"  [{idx:02d}] {tile.size[0]}x{tile.size[1]}  q={q}  {kb} KB  -> {out_path.name}")

    print("done.")


if __name__ == "__main__":
    main()
